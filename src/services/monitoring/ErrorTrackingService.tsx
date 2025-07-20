/**
 * Error Tracking Service for production monitoring
 */

import React from 'react';

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId: string;
  level: 'error' | 'warning' | 'info';
  context: Record<string, unknown>;
  fingerprint: string;
}

export interface PerformanceMetric {
  id: string;
  timestamp: Date;
  name: string;
  value: number;
  unit: string;
  context: Record<string, unknown>;
}

export interface UserAction {
  id: string;
  timestamp: Date;
  action: string;
  component: string;
  context: Record<string, unknown>;
  sessionId: string;
}

class ErrorTrackingService {
  private sessionId: string;
  private userId?: string;
  private errorQueue: ErrorEvent[] = [];
  private performanceQueue: PerformanceMetric[] = [];
  private actionQueue: UserAction[] = [];
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupErrorHandlers();
    this.setupPerformanceMonitoring();
    this.setupNetworkMonitoring();
    this.startPeriodicFlush();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupErrorHandlers(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        level: 'error'
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        level: 'error',
        context: { type: 'unhandledrejection' }
      });
    });

    // React error boundary integration
    if (typeof window !== 'undefined') {
      (window as any).__ERROR_TRACKING__ = this;
    }
  }

  private setupPerformanceMonitoring(): void {
    // Web Vitals monitoring
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.capturePerformanceMetric({
            name: 'LCP',
            value: entry.startTime,
            unit: 'ms',
            context: { element: (entry as any).element?.tagName }
          });
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.capturePerformanceMetric({
            name: 'FID',
            value: (entry as any).processingStart - entry.startTime,
            unit: 'ms',
            context: { eventType: (entry as any).name }
          });
        }
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        if (clsValue > 0) {
          this.capturePerformanceMetric({
            name: 'CLS',
            value: clsValue,
            unit: 'score'
          });
        }
      }).observe({ entryTypes: ['layout-shift'] });
    }

    // Memory usage monitoring
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.capturePerformanceMetric({
          name: 'memory_used',
          value: memory.usedJSHeapSize,
          unit: 'bytes',
          context: {
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit
          }
        });
      }, 30000); // Every 30 seconds
    }
  }

  private setupNetworkMonitoring(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueues();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private startPeriodicFlush(): void {
    setInterval(() => {
      if (this.isOnline) {
        this.flushQueues();
      }
    }, 60000); // Every minute
  }

  /**
   * Capture an error event
   */
  captureError(error: {
    message: string;
    stack?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    level?: 'error' | 'warning' | 'info';
    context?: Record<string, unknown>;
  }): void {
    const errorEvent: ErrorEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      message: error.message,
      stack: error.stack || '',
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId || '',
      sessionId: this.sessionId,
      level: error.level || 'error',
      context: {
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        ...error.context
      },
      fingerprint: this.generateFingerprint(error.message, error.stack)
    };

    this.errorQueue.push(errorEvent);
    
    // Immediate flush for critical errors
    if (error.level === 'error') {
      this.flushQueues();
    }

    // Log to console in development
    if (this.isDevelopment()) {
      console.error('Error captured:', errorEvent);
    }
  }

  /**
   * Capture a performance metric
   */
  capturePerformanceMetric(metric: {
    name: string;
    value: number;
    unit: string;
    context?: Record<string, unknown>;
  }): void {
    const performanceMetric: PerformanceMetric = {
      id: this.generateId(),
      timestamp: new Date(),
      name: metric.name,
      value: metric.value,
      unit: metric.unit,
      context: metric.context || {}
    };

    this.performanceQueue.push(performanceMetric);
  }

  /**
   * Capture a user action
   */
  captureUserAction(action: {
    action: string;
    component: string;
    context?: Record<string, unknown>;
  }): void {
    const userAction: UserAction = {
      id: this.generateId(),
      timestamp: new Date(),
      action: action.action,
      component: action.component,
      context: action.context || {},
      sessionId: this.sessionId
    };

    this.actionQueue.push(userAction);
  }

  /**
   * Set user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Add breadcrumb for debugging context
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
    this.captureUserAction({
      action: 'breadcrumb',
      component: category,
      context: { message, ...data }
    });
  }

  /**
   * Flush all queues to storage/remote service
   */
  private async flushQueues(): Promise<void> {
    try {
      // Store locally first
      await this.storeLocally();

      // Send to remote service if configured
      if (this.isOnline && this.shouldSendToRemote()) {
        await this.sendToRemote();
      }
    } catch (error) {
      console.warn('Failed to flush monitoring queues:', error);
    }
  }

  private async storeLocally(): Promise<void> {
    try {
      const data = {
        errors: this.errorQueue.splice(0),
        performance: this.performanceQueue.splice(0),
        actions: this.actionQueue.splice(0),
        timestamp: new Date().toISOString()
      };

      // Store in IndexedDB
      const request = indexedDB.open('monitoring-db', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('monitoring')) {
          db.createObjectStore('monitoring', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['monitoring'], 'readwrite');
        const store = transaction.objectStore('monitoring');
        store.add(data);
      };
    } catch (error) {
      console.warn('Failed to store monitoring data locally:', error);
    }
  }

  private async sendToRemote(): Promise<void> {
    // In a real implementation, this would send to your monitoring service
    // For now, we'll just log the data
    if (this.isDevelopment()) {
      console.log('Would send monitoring data to remote service');
    }
  }

  private shouldSendToRemote(): boolean {
    // Only send to remote in production or when explicitly configured
    return !this.isDevelopment() && this.isOnline;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFingerprint(message: string, stack?: string): string {
    const content = `${message}${stack || ''}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    sessionId: string;
    errorsQueued: number;
    performanceQueued: number;
    actionsQueued: number;
    isOnline: boolean;
  } {
    return {
      sessionId: this.sessionId,
      errorsQueued: this.errorQueue.length,
      performanceQueued: this.performanceQueue.length,
      actionsQueued: this.actionQueue.length,
      isOnline: this.isOnline
    };
  }

  /**
   * Clear all queued data
   */
  clearQueues(): void {
    this.errorQueue = [];
    this.performanceQueue = [];
    this.actionQueue = [];
  }
}

// Export singleton instance
export const errorTrackingService = new ErrorTrackingService();

// React Error Boundary integration

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class MonitoringErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorTrackingService.captureError({
      message: error.message,
      stack: error.stack || '',
      level: 'error',
      context: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Something went wrong</h3>
              </div>
            </div>
            <div className="text-sm text-gray-500 mb-4">
              An unexpected error occurred. The error has been logged and will be investigated.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for tracking user actions
export function useActionTracking() {
  return {
    trackAction: (action: string, component: string, context?: Record<string, unknown>) => {
      errorTrackingService.captureUserAction({ action, component, context: context || {} });
    },
    addBreadcrumb: (message: string, category: string, data?: Record<string, unknown>) => {
      errorTrackingService.addBreadcrumb(message, category, data);
    }
  };
}