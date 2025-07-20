export interface MemoryUsage {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

export interface MemoryAlert {
  type: 'warning' | 'critical';
  message: string;
  usage: MemoryUsage;
  timestamp: number;
}

class MemoryMonitorService {
  private isMonitoring = false;
  private monitoringInterval: number | null = null;
  private memoryHistory: MemoryUsage[] = [];
  private listeners: Array<(usage: MemoryUsage) => void> = [];
  private alertListeners: Array<(alert: MemoryAlert) => void> = [];
  
  // Thresholds (in bytes)
  private readonly WARNING_THRESHOLD = 0.7; // 70% of heap limit
  private readonly CRITICAL_THRESHOLD = 0.85; // 85% of heap limit
  private readonly HISTORY_LIMIT = 100; // Keep last 100 measurements

  public startMonitoring(intervalMs = 5000): void {
    if (this.isMonitoring) {
      return;
    }

    if (!this.isMemoryAPIAvailable()) {
      console.warn('Memory API not available in this browser');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = window.setInterval(() => {
      this.collectMemoryUsage();
    }, intervalMs);

    // Initial measurement
    this.collectMemoryUsage();
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  private isMemoryAPIAvailable(): boolean {
    return 'memory' in performance && 'usedJSHeapSize' in (performance as any).memory;
  }

  private collectMemoryUsage(): void {
    if (!this.isMemoryAPIAvailable()) {
      return;
    }

    const memory = (performance as any).memory;
    const usage: MemoryUsage = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };

    // Add to history
    this.memoryHistory.push(usage);
    if (this.memoryHistory.length > this.HISTORY_LIMIT) {
      this.memoryHistory.shift();
    }

    // Check for alerts
    this.checkMemoryAlerts(usage);

    // Notify listeners
    this.listeners.forEach(listener => listener(usage));

    // Store in localStorage for persistence
    this.storeMemoryData();
  }

  private checkMemoryAlerts(usage: MemoryUsage): void {
    const usageRatio = usage.usedJSHeapSize / usage.jsHeapSizeLimit;

    if (usageRatio >= this.CRITICAL_THRESHOLD) {
      const alert: MemoryAlert = {
        type: 'critical',
        message: `Critical memory usage: ${Math.round(usageRatio * 100)}% of heap limit`,
        usage,
        timestamp: Date.now()
      };
      this.alertListeners.forEach(listener => listener(alert));
    } else if (usageRatio >= this.WARNING_THRESHOLD) {
      const alert: MemoryAlert = {
        type: 'warning',
        message: `High memory usage: ${Math.round(usageRatio * 100)}% of heap limit`,
        usage,
        timestamp: Date.now()
      };
      this.alertListeners.forEach(listener => listener(alert));
    }
  }

  private storeMemoryData(): void {
    try {
      const recentHistory = this.memoryHistory.slice(-20); // Store last 20 measurements
      localStorage.setItem('memory-usage-history', JSON.stringify(recentHistory));
    } catch (error) {
      console.warn('Failed to store memory usage data:', error);
    }
  }

  public getCurrentUsage(): MemoryUsage | null {
    if (!this.isMemoryAPIAvailable()) {
      return null;
    }

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };
  }

  public getMemoryHistory(): MemoryUsage[] {
    return [...this.memoryHistory];
  }

  public getStoredHistory(): MemoryUsage[] {
    try {
      const stored = localStorage.getItem('memory-usage-history');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to retrieve stored memory history:', error);
      return [];
    }
  }

  public onMemoryUpdate(callback: (usage: MemoryUsage) => void): () => void {
    this.listeners.push(callback);
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public onMemoryAlert(callback: (alert: MemoryAlert) => void): () => void {
    this.alertListeners.push(callback);
    
    return () => {
      const index = this.alertListeners.indexOf(callback);
      if (index > -1) {
        this.alertListeners.splice(index, 1);
      }
    };
  }

  public getMemoryStats(): {
    current: MemoryUsage | null;
    average: number;
    peak: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    const current = this.getCurrentUsage();
    
    if (this.memoryHistory.length === 0) {
      return {
        current,
        average: 0,
        peak: 0,
        trend: 'stable'
      };
    }

    const usages = this.memoryHistory.map(h => h.usedJSHeapSize);
    const average = usages.reduce((sum, usage) => sum + usage, 0) / usages.length;
    const peak = Math.max(...usages);

    // Calculate trend based on last 10 measurements
    const recentUsages = usages.slice(-10);
    const firstHalf = recentUsages.slice(0, 5);
    const secondHalf = recentUsages.slice(5);
    
    const firstAvg = firstHalf.reduce((sum, usage) => sum + usage, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, usage) => sum + usage, 0) / secondHalf.length;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const difference = secondAvg - firstAvg;
    const threshold = average * 0.05; // 5% threshold
    
    if (difference > threshold) {
      trend = 'increasing';
    } else if (difference < -threshold) {
      trend = 'decreasing';
    }

    return {
      current,
      average,
      peak,
      trend
    };
  }

  public triggerGarbageCollection(): void {
    // Force garbage collection if available (Chrome DevTools)
    if ('gc' in window) {
      (window as any).gc();
    } else {
      // Fallback: create and release large objects to encourage GC
      const largeArray = new Array(1000000).fill(0);
      largeArray.length = 0;
    }
  }

  public schedulePeriodicCleanup(intervalMs = 300000): () => void { // 5 minutes default
    const intervalId = setInterval(() => {
      this.performMemoryCleanup();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }

  private performMemoryCleanup(): void {
    const currentUsage = this.getCurrentUsage();
    if (!currentUsage) return;

    const usageRatio = currentUsage.usedJSHeapSize / currentUsage.jsHeapSizeLimit;
    
    // Trigger cleanup if memory usage is above 60%
    if (usageRatio > 0.6) {
      // Notify cleanup listeners
      this.notifyCleanupNeeded(currentUsage);
      
      // Trigger garbage collection
      this.triggerGarbageCollection();
    }
  }

  private cleanupListeners: Array<(usage: MemoryUsage) => void> = [];

  public onCleanupNeeded(callback: (usage: MemoryUsage) => void): () => void {
    this.cleanupListeners.push(callback);
    
    return () => {
      const index = this.cleanupListeners.indexOf(callback);
      if (index > -1) {
        this.cleanupListeners.splice(index, 1);
      }
    };
  }

  private notifyCleanupNeeded(usage: MemoryUsage): void {
    this.cleanupListeners.forEach(listener => listener(usage));
  }

  public exportMemoryReport(): string {
    const stats = this.getMemoryStats();
    const history = this.getMemoryHistory();
    
    const report = {
      timestamp: Date.now(),
      stats,
      history,
      browserInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency
      }
    };
    
    return JSON.stringify(report, null, 2);
  }
}

export const memoryMonitorService = new MemoryMonitorService();