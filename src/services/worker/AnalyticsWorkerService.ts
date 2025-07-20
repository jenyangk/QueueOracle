/**
 * Analytics Worker Service - Manages communication with the analytics web worker
 */

import type {
  WorkerMessage,
  WorkerResponse,
  AnalyzeMessagesRequest,
  AnalyzeMessagesResponse,
  UpdateAnalyticsRequest,
  UpdateAnalyticsResponse,
  ExportDataRequest,
  ExportDataResponse,
  AnalyticsWorkerConfig,
} from './types';

import type {
  ServiceBusMessage,
  MessageAnalytics,
  FieldAnalytics,
} from '../storage/types';

export class AnalyticsWorkerService {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    try {
      // Create worker from the analytics worker file
      this.worker = new Worker(
        new URL('./analyticsWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
      this.worker.addEventListener('error', this.handleWorkerError.bind(this));
    } catch (error) {
      console.error('Failed to initialize analytics worker:', error);
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { id, success, payload, error } = event.data;
    const pendingRequest = this.pendingRequests.get(id);

    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(id);

      if (success) {
        pendingRequest.resolve(payload);
      } else {
        pendingRequest.reject(new Error(error || 'Worker operation failed'));
      }
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('Analytics worker error:', error);
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Worker encountered an error'));
    });
    this.pendingRequests.clear();

    // Try to reinitialize the worker
    this.terminate();
    setTimeout(() => this.initializeWorker(), 1000);
  }

  private sendMessage<T>(type: string, payload: unknown, timeoutMs = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Analytics worker not available'));
        return;
      }

      const id = `msg_${++this.messageId}_${Date.now()}`;
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Worker operation timed out'));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const message: WorkerMessage = { id, type, payload };
      this.worker.postMessage(message);
    });
  }

  /**
   * Analyze messages and generate comprehensive analytics
   */
  async analyzeMessages(
    messages: ServiceBusMessage[],
    connectionId: string
  ): Promise<{ analytics: MessageAnalytics; fieldAnalytics: Record<string, FieldAnalytics> }> {
    const request: AnalyzeMessagesRequest = { messages, connectionId };
    return this.sendMessage<AnalyzeMessagesResponse>('ANALYZE_MESSAGES', request);
  }

  /**
   * Update existing analytics with new messages
   */
  async updateAnalytics(
    existingAnalytics: MessageAnalytics | null,
    newMessages: ServiceBusMessage[],
    connectionId: string
  ): Promise<{ analytics: MessageAnalytics; updatedFields: FieldAnalytics[] }> {
    const request: UpdateAnalyticsRequest = {
      existingAnalytics,
      newMessages,
      connectionId,
    };
    return this.sendMessage<UpdateAnalyticsResponse>('UPDATE_ANALYTICS', request);
  }

  /**
   * Export message data in specified format
   */
  async exportData(
    messages: ServiceBusMessage[],
    format: 'json' | 'csv',
    options: {
      fieldAnalytics?: Record<string, FieldAnalytics>;
      includeAnalytics?: boolean;
    } = {}
  ): Promise<{ data: string; filename: string; mimeType: string }> {
    const request: ExportDataRequest = {
      messages,
      format,
      includeAnalytics: options.includeAnalytics || false,
      ...(options.fieldAnalytics && { fieldAnalytics: options.fieldAnalytics }),
    };
    return this.sendMessage<ExportDataResponse>('EXPORT_DATA', request);
  }

  /**
   * Update worker configuration
   */
  async updateConfig(config: Partial<AnalyticsWorkerConfig>): Promise<AnalyticsWorkerConfig> {
    return this.sendMessage<AnalyticsWorkerConfig>('UPDATE_CONFIG', config);
  }

  /**
   * Check if worker is available
   */
  isAvailable(): boolean {
    return this.worker !== null;
  }

  /**
   * Get worker status
   */
  getStatus(): {
    available: boolean;
    pendingRequests: number;
  } {
    return {
      available: this.isAvailable(),
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Clear all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Worker terminated'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Restart the worker
   */
  restart(): void {
    this.terminate();
    this.initializeWorker();
  }
}

// Singleton instance
let analyticsWorkerService: AnalyticsWorkerService | null = null;

export function getAnalyticsWorkerService(): AnalyticsWorkerService {
  if (!analyticsWorkerService) {
    analyticsWorkerService = new AnalyticsWorkerService();
  }
  return analyticsWorkerService;
}

export function terminateAnalyticsWorkerService(): void {
  if (analyticsWorkerService) {
    analyticsWorkerService.terminate();
    analyticsWorkerService = null;
  }
}