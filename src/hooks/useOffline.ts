/**
 * useOffline Hook - React hook for offline capabilities
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineService, type OfflineStatus, type OfflineOperation, type SyncConflict, type OfflineAnalyticsResult } from '../services/pwa/OfflineService';
import type { ServiceBusMessage } from '../services/storage/types';

export interface UseOfflineReturn {
  // Status
  status: OfflineStatus | null;
  isOnline: boolean;
  
  // Operations
  pendingOperations: OfflineOperation[];
  queueOperation: (operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>) => Promise<string>;
  cancelOperation: (operationId: string) => Promise<boolean>;
  retryOperation: (operationId: string) => Promise<boolean>;
  syncOperations: () => Promise<void>;
  
  // Conflicts
  conflicts: SyncConflict[];
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge') => Promise<void>;
  clearResolvedConflicts: () => Promise<void>;
  
  // Analytics
  analyzeOffline: (connectionId: string, messages?: ServiceBusMessage[]) => Promise<OfflineAnalyticsResult>;
  
  // Storage management
  manageStorage: () => Promise<void>;
  exportData: () => Promise<Blob>;
  importData: (data: Blob) => Promise<void>;
  
  // Loading states
  isSyncing: boolean;
  isAnalyzing: boolean;
}

export function useOffline(): UseOfflineReturn {
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Initialize and subscribe to status changes
  useEffect(() => {
    let mounted = true;

    const initializeStatus = async () => {
      try {
        const initialStatus = await offlineService.getOfflineStatus();
        if (mounted) {
          setStatus(initialStatus);
        }
      } catch (error) {
        console.error('Failed to get initial offline status:', error);
      }
    };

    const unsubscribe = offlineService.onStatusChange((newStatus) => {
      if (mounted) {
        setStatus(newStatus);
      }
    });

    initializeStatus();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Queue operation
  const queueOperation = useCallback(async (
    operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>
  ): Promise<string> => {
    try {
      return await offlineService.queueOperation(operation);
    } catch (error) {
      console.error('Failed to queue operation:', error);
      throw error;
    }
  }, []);

  // Cancel operation
  const cancelOperation = useCallback(async (operationId: string): Promise<boolean> => {
    try {
      return await offlineService.cancelOperation(operationId);
    } catch (error) {
      console.error('Failed to cancel operation:', error);
      return false;
    }
  }, []);

  // Retry operation
  const retryOperation = useCallback(async (operationId: string): Promise<boolean> => {
    try {
      return await offlineService.retryOperation(operationId);
    } catch (error) {
      console.error('Failed to retry operation:', error);
      return false;
    }
  }, []);

  // Sync operations
  const syncOperations = useCallback(async (): Promise<void> => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      await offlineService.syncPendingOperations();
    } catch (error) {
      console.error('Failed to sync operations:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Resolve conflict
  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge'
  ): Promise<void> => {
    try {
      await offlineService.handleSyncConflict(conflictId, resolution);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      throw error;
    }
  }, []);

  // Clear resolved conflicts
  const clearResolvedConflicts = useCallback(async (): Promise<void> => {
    try {
      await offlineService.clearResolvedConflicts();
    } catch (error) {
      console.error('Failed to clear resolved conflicts:', error);
      throw error;
    }
  }, []);

  // Analyze offline
  const analyzeOffline = useCallback(async (
    connectionId: string,
    messages?: ServiceBusMessage[]
  ): Promise<OfflineAnalyticsResult> => {
    setIsAnalyzing(true);
    try {
      return await offlineService.analyzeMessagesOffline(connectionId, messages);
    } catch (error) {
      console.error('Failed to analyze messages offline:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Manage storage
  const manageStorage = useCallback(async (): Promise<void> => {
    try {
      await offlineService.manageOfflineStorage();
    } catch (error) {
      console.error('Failed to manage storage:', error);
      throw error;
    }
  }, []);

  // Export data
  const exportData = useCallback(async (): Promise<Blob> => {
    try {
      return await offlineService.exportOfflineData();
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }, []);

  // Import data
  const importData = useCallback(async (data: Blob): Promise<void> => {
    try {
      await offlineService.importOfflineData(data);
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }, []);

  return {
    // Status
    status,
    isOnline: status?.isOnline ?? false,
    
    // Operations
    pendingOperations: status ? offlineService.getPendingOperations() : [],
    queueOperation,
    cancelOperation,
    retryOperation,
    syncOperations,
    
    // Conflicts
    conflicts: status ? offlineService.getSyncConflicts() : [],
    resolveConflict,
    clearResolvedConflicts,
    
    // Analytics
    analyzeOffline,
    
    // Storage management
    manageStorage,
    exportData,
    importData,
    
    // Loading states
    isSyncing,
    isAnalyzing
  };
}

// Specialized hooks for specific use cases

export function useOfflineStatus() {
  const { status, isOnline } = useOffline();
  return { status, isOnline };
}

export function useOfflineOperations() {
  const { 
    pendingOperations, 
    queueOperation, 
    cancelOperation, 
    retryOperation, 
    syncOperations,
    isSyncing 
  } = useOffline();
  
  return {
    pendingOperations,
    queueOperation,
    cancelOperation,
    retryOperation,
    syncOperations,
    isSyncing
  };
}

export function useOfflineConflicts() {
  const { 
    conflicts, 
    resolveConflict, 
    clearResolvedConflicts 
  } = useOffline();
  
  return {
    conflicts,
    resolveConflict,
    clearResolvedConflicts
  };
}

export function useOfflineAnalytics() {
  const { analyzeOffline, isAnalyzing } = useOffline();
  
  return {
    analyzeOffline,
    isAnalyzing
  };
}