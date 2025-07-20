/**
 * Offline Service - Manages offline capabilities and data synchronization
 */

import { pwaService } from './PWAService';
import { secureStorage } from '../storage/SecureStorageService';
import { getAnalyticsWorkerService } from '../worker/AnalyticsWorkerService';
import type { ServiceBusMessage, MessageAnalytics, FieldAnalytics } from '../storage/types';

export interface OfflineOperation {
  id: string;
  type: 'send' | 'delete' | 'complete' | 'abandon' | 'deadletter';
  entityName: string;
  data: unknown;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'failed' | 'completed';
  error?: string;
}

export interface SyncConflict {
  id: string;
  type: 'message' | 'analytics' | 'connection';
  localData: unknown;
  remoteData: unknown;
  timestamp: Date;
  resolution?: 'local' | 'remote' | 'merge';
}

export interface OfflineStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingOperations: number;
  conflicts: number;
  storageUsage: {
    totalSize: number;
    messageCount: number;
    analyticsCount: number;
  };
  syncInProgress: boolean;
}

export interface OfflineAnalyticsResult {
  analytics: MessageAnalytics;
  fieldAnalytics: Record<string, FieldAnalytics>;
  isFromCache: boolean;
  lastUpdated: Date;
}

export class OfflineService {
  private pendingOperations: Map<string, OfflineOperation> = new Map();
  private syncConflicts: Map<string, SyncConflict> = new Map();
  private statusCallbacks: Array<(status: OfflineStatus) => void> = [];
  private syncInProgress = false;
  private lastSync: Date | null = null;

  constructor() {
    this.initializeOfflineCapabilities();
  }

  /**
   * Initialize offline capabilities
   */
  private async initializeOfflineCapabilities(): Promise<void> {
    try {
      // Load pending operations from storage
      await this.loadPendingOperations();
      
      // Load sync conflicts from storage
      await this.loadSyncConflicts();
      
      // Set up network status monitoring
      pwaService.onNetworkChange((isOnline) => {
        if (isOnline) {
          this.handleOnlineReconnection();
        }
        this.notifyStatusChange();
      });

      // Set up periodic sync when online
      this.setupPeriodicSync();
    } catch (error) {
      console.error('Failed to initialize offline capabilities:', error);
    }
  }

  /**
   * Get current offline status
   */
  async getOfflineStatus(): Promise<OfflineStatus> {
    const storageStats = await secureStorage.getStorageStats();
    
    return {
      isOnline: pwaService.isOnline(),
      lastSync: this.lastSync,
      pendingOperations: this.pendingOperations.size,
      conflicts: this.syncConflicts.size,
      storageUsage: storageStats,
      syncInProgress: this.syncInProgress
    };
  }

  /**
   * Subscribe to offline status changes
   */
  onStatusChange(callback: (status: OfflineStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Perform offline message analysis
   */
  async analyzeMessagesOffline(
    connectionId: string,
    messages?: ServiceBusMessage[]
  ): Promise<OfflineAnalyticsResult> {
    try {
      let messagesToAnalyze: ServiceBusMessage[];
      
      if (messages) {
        messagesToAnalyze = messages;
      } else {
        // Get cached messages from storage
        messagesToAnalyze = await secureStorage.getMessages(connectionId, 10000);
      }

      if (messagesToAnalyze.length === 0) {
        throw new Error('No messages available for offline analysis');
      }

      // Use analytics worker for processing
      const workerService = getAnalyticsWorkerService();
      const result = await workerService.analyzeMessages(messagesToAnalyze, connectionId);

      // Store analytics results locally
      await secureStorage.storeAnalytics(result.analytics);
      await secureStorage.updateFieldAnalytics(connectionId, Object.values(result.fieldAnalytics));

      return {
        analytics: result.analytics,
        fieldAnalytics: result.fieldAnalytics,
        isFromCache: true,
        lastUpdated: new Date()
      };
    } catch (error) {
      throw new Error(`Offline analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Queue operation for later execution when online
   */
  async queueOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedOperation: OfflineOperation = {
      ...operation,
      id: operationId,
      timestamp: new Date(),
      retryCount: 0,
      status: 'pending'
    };

    this.pendingOperations.set(operationId, queuedOperation);
    await this.savePendingOperations();
    this.notifyStatusChange();

    return operationId;
  }

  /**
   * Get pending operations
   */
  getPendingOperations(): OfflineOperation[] {
    return Array.from(this.pendingOperations.values());
  }

  /**
   * Cancel a pending operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    if (this.pendingOperations.has(operationId)) {
      this.pendingOperations.delete(operationId);
      await this.savePendingOperations();
      this.notifyStatusChange();
      return true;
    }
    return false;
  }

  /**
   * Retry a failed operation
   */
  async retryOperation(operationId: string): Promise<boolean> {
    const operation = this.pendingOperations.get(operationId);
    if (!operation) {
      return false;
    }

    operation.status = 'pending';
    operation.retryCount = 0;
    delete operation.error;

    await this.savePendingOperations();
    
    if (pwaService.isOnline()) {
      await this.executeOperation(operation);
    }

    return true;
  }

  /**
   * Sync pending operations when online
   */
  async syncPendingOperations(): Promise<void> {
    if (!pwaService.isOnline() || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    this.notifyStatusChange();

    try {
      const operations = Array.from(this.pendingOperations.values())
        .filter(op => op.status === 'pending')
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      for (const operation of operations) {
        try {
          await this.executeOperation(operation);
        } catch (error) {
          console.error(`Failed to execute operation ${operation.id}:`, error);
        }
      }

      this.lastSync = new Date();
    } finally {
      this.syncInProgress = false;
      this.notifyStatusChange();
    }
  }

  /**
   * Handle sync conflicts
   */
  async handleSyncConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge'
  ): Promise<void> {
    const conflict = this.syncConflicts.get(conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    try {
      switch (resolution) {
        case 'local':
          // Keep local data, discard remote
          await this.applyLocalData(conflict);
          break;
        case 'remote':
          // Keep remote data, discard local
          await this.applyRemoteData(conflict);
          break;
        case 'merge':
          // Attempt to merge data
          await this.mergeConflictData(conflict);
          break;
      }

      // Mark conflict as resolved
      conflict.resolution = resolution;
      this.syncConflicts.delete(conflictId);
      await this.saveSyncConflicts();
      this.notifyStatusChange();
    } catch (error) {
      throw new Error(`Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sync conflicts
   */
  getSyncConflicts(): SyncConflict[] {
    return Array.from(this.syncConflicts.values());
  }

  /**
   * Clear resolved conflicts
   */
  async clearResolvedConflicts(): Promise<void> {
    const resolvedConflicts = Array.from(this.syncConflicts.entries())
      .filter(([, conflict]) => conflict.resolution !== undefined);

    for (const [id] of resolvedConflicts) {
      this.syncConflicts.delete(id);
    }

    await this.saveSyncConflicts();
    this.notifyStatusChange();
  }

  /**
   * Manage offline storage
   */
  async manageOfflineStorage(): Promise<void> {
    try {
      const stats = await secureStorage.getStorageStats();
      const maxStorageSize = 100 * 1024 * 1024; // 100MB limit
      
      if (stats.totalSize > maxStorageSize) {
        await this.cleanupOldData();
      }
    } catch (error) {
      console.error('Failed to manage offline storage:', error);
    }
  }

  /**
   * Export offline data
   */
  async exportOfflineData(): Promise<Blob> {
    try {
      const data = await secureStorage.exportData();
      const exportData = {
        data,
        pendingOperations: Array.from(this.pendingOperations.values()),
        conflicts: Array.from(this.syncConflicts.values()),
        exportedAt: new Date().toISOString()
      };

      return new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
    } catch (error) {
      throw new Error(`Failed to export offline data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import offline data
   */
  async importOfflineData(data: Blob): Promise<void> {
    try {
      const text = await data.text();
      const importData = JSON.parse(text);

      // Import main data
      if (importData.data) {
        await secureStorage.importData(importData.data);
      }

      // Import pending operations
      if (importData.pendingOperations) {
        for (const operation of importData.pendingOperations) {
          this.pendingOperations.set(operation.id, operation);
        }
        await this.savePendingOperations();
      }

      // Import conflicts
      if (importData.conflicts) {
        for (const conflict of importData.conflicts) {
          this.syncConflicts.set(conflict.id, conflict);
        }
        await this.saveSyncConflicts();
      }

      this.notifyStatusChange();
    } catch (error) {
      throw new Error(`Failed to import offline data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Private methods
   */

  private async executeOperation(operation: OfflineOperation): Promise<void> {
    try {
      // This would integrate with ServiceBusClientService
      // For now, we'll simulate the operation
      console.log(`Executing operation: ${operation.type} on ${operation.entityName}`);
      
      // Mark as completed
      operation.status = 'completed';
      this.pendingOperations.delete(operation.id);
      await this.savePendingOperations();
    } catch (error) {
      operation.retryCount++;
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      
      if (operation.retryCount >= operation.maxRetries) {
        operation.status = 'failed';
      }
      
      await this.savePendingOperations();
      throw error;
    }
  }

  private async handleOnlineReconnection(): Promise<void> {
    // Sync pending operations
    await this.syncPendingOperations();
    
    // Check for conflicts
    await this.detectSyncConflicts();
  }

  private async detectSyncConflicts(): Promise<void> {
    // This would compare local and remote data to detect conflicts
    // Implementation would depend on specific data synchronization strategy
    console.log('Detecting sync conflicts...');
  }

  private async applyLocalData(conflict: SyncConflict): Promise<void> {
    // Apply local data resolution
    console.log(`Applying local data for conflict ${conflict.id}`);
  }

  private async applyRemoteData(conflict: SyncConflict): Promise<void> {
    // Apply remote data resolution
    console.log(`Applying remote data for conflict ${conflict.id}`);
  }

  private async mergeConflictData(conflict: SyncConflict): Promise<void> {
    // Merge conflict data
    console.log(`Merging data for conflict ${conflict.id}`);
  }

  private async cleanupOldData(): Promise<void> {
    // Remove old messages and analytics to free up space
    console.log('Cleaning up old offline data...');
  }

  private setupPeriodicSync(): void {
    // Sync every 5 minutes when online
    setInterval(async () => {
      if (pwaService.isOnline() && !this.syncInProgress) {
        await this.syncPendingOperations();
      }
    }, 5 * 60 * 1000);
  }

  private async loadPendingOperations(): Promise<void> {
    try {
      const stored = localStorage.getItem('offline-pending-operations');
      if (stored) {
        const operations = JSON.parse(stored) as OfflineOperation[];
        for (const operation of operations) {
          this.pendingOperations.set(operation.id, {
            ...operation,
            timestamp: new Date(operation.timestamp)
          });
        }
      }
    } catch (error) {
      console.error('Failed to load pending operations:', error);
    }
  }

  private async savePendingOperations(): Promise<void> {
    try {
      const operations = Array.from(this.pendingOperations.values());
      localStorage.setItem('offline-pending-operations', JSON.stringify(operations));
    } catch (error) {
      console.error('Failed to save pending operations:', error);
    }
  }

  private async loadSyncConflicts(): Promise<void> {
    try {
      const stored = localStorage.getItem('offline-sync-conflicts');
      if (stored) {
        const conflicts = JSON.parse(stored) as SyncConflict[];
        for (const conflict of conflicts) {
          this.syncConflicts.set(conflict.id, {
            ...conflict,
            timestamp: new Date(conflict.timestamp)
          });
        }
      }
    } catch (error) {
      console.error('Failed to load sync conflicts:', error);
    }
  }

  private async saveSyncConflicts(): Promise<void> {
    try {
      const conflicts = Array.from(this.syncConflicts.values());
      localStorage.setItem('offline-sync-conflicts', JSON.stringify(conflicts));
    } catch (error) {
      console.error('Failed to save sync conflicts:', error);
    }
  }

  private async notifyStatusChange(): Promise<void> {
    const status = await this.getOfflineStatus();
    this.statusCallbacks.forEach(callback => callback(status));
  }
}

// Singleton instance
export const offlineService = new OfflineService();