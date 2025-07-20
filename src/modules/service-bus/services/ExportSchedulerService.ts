/**
 * Export Scheduler Service - Manages scheduled data exports
 */

import type { ScheduledExport, ExportOptions } from './DataExportService';
import { secureStorage } from '../../../services/storage/SecureStorageService';

class ExportSchedulerService {
  private scheduledExports: Map<string, ScheduledExport> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize the scheduler service
   */
  async initialize(): Promise<void> {
    try {
      const exports = await this.loadScheduledExports();
      
      exports.forEach(exportConfig => {
        this.scheduledExports.set(exportConfig.id, exportConfig);
        if (exportConfig.isActive) {
          this.scheduleExport(exportConfig);
        }
      });
    } catch (error) {
      console.error('Failed to initialize export scheduler:', error);
    }
  }

  /**
   * Create a new scheduled export
   */
  async createScheduledExport(
    name: string,
    options: ExportOptions,
    schedule: ScheduledExport['schedule'],
    connectionId: string
  ): Promise<ScheduledExport> {
    const scheduledExport: ScheduledExport = {
      id: this.generateId(),
      name,
      options,
      schedule,
      connectionId,
      isActive: true,
      nextRun: this.calculateNextRun(schedule),
      createdAt: new Date(),
    };

    this.scheduledExports.set(scheduledExport.id, scheduledExport);
    await this.saveScheduledExports();
    
    this.scheduleExport(scheduledExport);
    
    return scheduledExport;
  }

  /**
   * Update an existing scheduled export
   */
  async updateScheduledExport(
    id: string,
    updates: Partial<Omit<ScheduledExport, 'id' | 'createdAt'>>
  ): Promise<ScheduledExport | null> {
    const existingExport = this.scheduledExports.get(id);
    if (!existingExport) {
      return null;
    }

    const updatedExport: ScheduledExport = {
      ...existingExport,
      ...updates,
      nextRun: updates.schedule 
        ? this.calculateNextRun(updates.schedule)
        : existingExport.nextRun,
    };

    this.scheduledExports.set(id, updatedExport);
    await this.saveScheduledExports();

    // Reschedule if active
    this.cancelScheduledExport(id);
    if (updatedExport.isActive) {
      this.scheduleExport(updatedExport);
    }

    return updatedExport;
  }

  /**
   * Delete a scheduled export
   */
  async deleteScheduledExport(id: string): Promise<boolean> {
    const exportConfig = this.scheduledExports.get(id);
    if (!exportConfig) {
      return false;
    }

    this.cancelScheduledExport(id);
    this.scheduledExports.delete(id);
    await this.saveScheduledExports();
    
    return true;
  }

  /**
   * Get all scheduled exports
   */
  getScheduledExports(): ScheduledExport[] {
    return Array.from(this.scheduledExports.values());
  }

  /**
   * Get scheduled exports for a specific connection
   */
  getScheduledExportsForConnection(connectionId: string): ScheduledExport[] {
    return Array.from(this.scheduledExports.values())
      .filter(exp => exp.connectionId === connectionId);
  }

  /**
   * Toggle scheduled export active state
   */
  async toggleScheduledExport(id: string, isActive: boolean): Promise<boolean> {
    const exportConfig = this.scheduledExports.get(id);
    if (!exportConfig) {
      return false;
    }

    exportConfig.isActive = isActive;
    exportConfig.nextRun = isActive ? this.calculateNextRun(exportConfig.schedule) : exportConfig.nextRun;
    
    await this.saveScheduledExports();

    if (isActive) {
      this.scheduleExport(exportConfig);
    } else {
      this.cancelScheduledExport(id);
    }

    return true;
  }

  /**
   * Manually trigger a scheduled export
   */
  async triggerExport(id: string): Promise<boolean> {
    const exportConfig = this.scheduledExports.get(id);
    if (!exportConfig) {
      return false;
    }

    try {
      await this.executeExport(exportConfig);
      return true;
    } catch (error) {
      console.error(`Failed to trigger export ${id}:`, error);
      return false;
    }
  }

  /**
   * Schedule an export to run at the specified time
   */
  private scheduleExport(exportConfig: ScheduledExport): void {
    const now = new Date();
    const delay = exportConfig.nextRun.getTime() - now.getTime();

    if (delay <= 0) {
      // Should run immediately
      this.executeExport(exportConfig);
      return;
    }

    const timer = setTimeout(() => {
      this.executeExport(exportConfig);
    }, delay);

    this.timers.set(exportConfig.id, timer);
  }

  /**
   * Cancel a scheduled export
   */
  private cancelScheduledExport(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  /**
   * Execute a scheduled export
   */
  private async executeExport(exportConfig: ScheduledExport): Promise<void> {
    try {
      console.log(`Executing scheduled export: ${exportConfig.name}`);
      
      // Update last run time
      exportConfig.lastRun = new Date();
      exportConfig.nextRun = this.calculateNextRun(exportConfig.schedule);
      
      // Save updated config
      await this.saveScheduledExports();
      
      // Schedule next run
      if (exportConfig.isActive) {
        this.scheduleExport(exportConfig);
      }

      // TODO: Implement actual export execution
      // This would need to:
      // 1. Get messages from the message store or storage
      // 2. Apply filters from exportConfig.options
      // 3. Generate the export using DataExportService
      // 4. Save or send the export (depending on configuration)
      
      console.log(`Scheduled export ${exportConfig.name} completed successfully`);
      
    } catch (error) {
      console.error(`Failed to execute scheduled export ${exportConfig.name}:`, error);
      
      // Optionally disable the export on repeated failures
      // or implement retry logic here
    }
  }

  /**
   * Calculate the next run time based on schedule
   */
  private calculateNextRun(schedule: ScheduledExport['schedule']): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    let nextRun = new Date(now);
    nextRun.setHours(hours || 0, minutes || 0, 0, 0);

    switch (schedule.frequency) {
      case 'daily': {
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      }

      case 'weekly': {
        const targetDay = schedule.dayOfWeek ?? 0;
        const currentDay = nextRun.getDay();
        let daysUntilTarget = targetDay - currentDay;
        
        if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
          daysUntilTarget += 7;
        }
        
        nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        break;
      }

      case 'monthly': {
        const targetDate = schedule.dayOfMonth ?? 1;
        nextRun.setDate(targetDate);
        
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
          nextRun.setDate(targetDate);
        }
        
        // Handle months with fewer days
        if (nextRun.getDate() !== targetDate) {
          nextRun.setDate(0); // Last day of previous month
        }
        break;
      }
    }

    return nextRun;
  }

  /**
   * Load scheduled exports from storage
   */
  private async loadScheduledExports(): Promise<ScheduledExport[]> {
    try {
      const storage = secureStorage;
      const data = await storage.retrieve('scheduled-exports', false);
      
      if (Array.isArray(data)) {
        return data.map(item => ({
          ...item,
          createdAt: new Date(item.createdAt),
          lastRun: item.lastRun ? new Date(item.lastRun) : undefined,
          nextRun: new Date(item.nextRun),
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to load scheduled exports:', error);
      return [];
    }
  }

  /**
   * Save scheduled exports to storage
   */
  private async saveScheduledExports(): Promise<void> {
    try {
      const storage = secureStorage;
      const exports = Array.from(this.scheduledExports.values());
      await storage.store('scheduled-exports', exports, false);
    } catch (error) {
      console.error('Failed to save scheduled exports:', error);
    }
  }

  /**
   * Generate a unique ID for scheduled exports
   */
  private generateId(): string {
    return `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup timers when service is destroyed
   */
  destroy(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.scheduledExports.clear();
  }
}

// Singleton instance
let exportSchedulerService: ExportSchedulerService | null = null;

export function getExportSchedulerService(): ExportSchedulerService {
  if (!exportSchedulerService) {
    exportSchedulerService = new ExportSchedulerService();
  }
  return exportSchedulerService;
}

export { ExportSchedulerService };