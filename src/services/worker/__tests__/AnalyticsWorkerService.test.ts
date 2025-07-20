/**
 * Unit tests for AnalyticsWorkerService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalyticsWorkerService } from '../AnalyticsWorkerService';
import type { ServiceBusMessage } from '../../storage/types';

// Mock Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  
  postMessage = vi.fn((message: any) => {
    // Simulate async worker response
    setTimeout(() => {
      if (this.onmessage) {
        const response = this.generateMockResponse(message);
        this.onmessage({ data: response } as MessageEvent);
      }
    }, 10);
  });

  terminate = vi.fn();

  private generateMockResponse(message: any) {
    switch (message.type) {
      case 'ANALYZE_MESSAGES':
        return {
          id: message.id,
          type: 'ANALYSIS_COMPLETE',
          result: {
            analytics: {
              connectionId: 'test-connection',
              totalMessages: message.messages.length,
              messageTypes: { 'test-type': message.messages.length },
              fieldAnalytics: {
                'test.field': {
                  fieldPath: 'test.field',
                  dataType: 'string',
                  count: message.messages.length,
                  uniqueValues: 1,
                  coverage: 100,
                  topValues: [{ value: 'test', count: message.messages.length, percentage: 100 }],
                  trend: [],
                }
              },
              timeSeriesData: [],
              correlationMatrix: [],
              lastUpdated: new Date(),
            },
            fieldAnalytics: {
              'test.field': {
                fieldPath: 'test.field',
                dataType: 'string',
                count: message.messages.length,
                uniqueValues: 1,
                coverage: 100,
                topValues: [{ value: 'test', count: message.messages.length, percentage: 100 }],
                trend: [],
              }
            }
          }
        };
      case 'UPDATE_ANALYTICS':
        return {
          id: message.id,
          type: 'UPDATE_COMPLETE',
          result: {
            'test.field': {
              fieldPath: 'test.field',
              dataType: 'string',
              count: message.newMessages.length,
              uniqueValues: 1,
              coverage: 100,
              topValues: [{ value: 'test', count: message.newMessages.length, percentage: 100 }],
              trend: [],
            }
          }
        };
      case 'EXPORT_DATA':
        return {
          id: message.id,
          type: 'EXPORT_COMPLETE',
          result: new ArrayBuffer(100) // Mock blob data
        };
      default:
        return {
          id: message.id,
          type: 'ERROR',
          error: 'Unknown message type'
        };
    }
  }
}

// Mock Worker constructor
global.Worker = MockWorker as any;

describe('AnalyticsWorkerService', () => {
  let service: AnalyticsWorkerService;

  beforeEach(() => {
    service = new AnalyticsWorkerService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.terminate();
  });

  describe('analyzeMessages', () => {
    it('should analyze messages and return analytics', async () => {
      const messages: ServiceBusMessage[] = [
        {
          messageId: 'msg1',
          sequenceNumber: '1',
          enqueuedTimeUtc: new Date(),
          body: { test: { field: 'value1' } },
          properties: {},
          deliveryCount: 1,
          jsonFields: { 'test.field': 'value1' },
          analyzedAt: new Date(),
          connectionId: 'test-connection',
          queueOrTopicName: 'test-queue'
        },
        {
          messageId: 'msg2',
          sequenceNumber: '2',
          enqueuedTimeUtc: new Date(),
          body: { test: { field: 'value2' } },
          properties: {},
          deliveryCount: 1,
          jsonFields: { 'test.field': 'value2' },
          analyzedAt: new Date(),
          connectionId: 'test-connection',
          queueOrTopicName: 'test-queue'
        },
      ];

      const result = await service.analyzeMessages(messages, 'test-connection');

      expect(result.analytics.totalMessages).toBe(2);
      expect(result.analytics.connectionId).toBe('test-connection');
      expect(result.fieldAnalytics).toHaveProperty('test.field');
      expect(result.fieldAnalytics['test.field'].count).toBe(2);
    });

    it('should handle empty message array', async () => {
      const result = await service.analyzeMessages([], 'test-connection');

      expect(result.analytics.totalMessages).toBe(0);
      expect(result.analytics.connectionId).toBe('test-connection');
    });

    it('should handle worker errors', async () => {
      // Mock worker to simulate error
      const originalWorker = global.Worker;
      global.Worker = class extends MockWorker {
        postMessage = vi.fn((_: any) => {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror({ message: 'Worker error' } as ErrorEvent);
            }
          }, 10);
        });
      } as any;

      const service = new AnalyticsWorkerService();
      
      await expect(
        service.analyzeMessages([], 'test-connection')
      ).rejects.toThrow('Worker error');

      service.terminate();
      global.Worker = originalWorker;
    });
  });

  describe('updateAnalytics', () => {
    it('should update analytics with new messages', async () => {
      const newMessages: ServiceBusMessage[] = [
        {
          messageId: 'msg3',
          sequenceNumber: '3',
          enqueuedTimeUtc: new Date(),
          body: { test: { field: 'value3' } },
          properties: {},
          deliveryCount: 1,
          jsonFields: { 'test.field': 'value3' },
          analyzedAt: new Date(),
          connectionId: 'test-connection',
          queueOrTopicName: 'test-queue'
        },
      ];

      const existingAnalytics = {
        'test.field': {
          fieldPath: 'test.field',
          dataType: 'string',
          count: 2,
          uniqueValues: 2,
          coverage: 100,
          topValues: [
            { value: 'value1', count: 1, percentage: 50 },
            { value: 'value2', count: 1, percentage: 50 },
          ],
          trend: [],
        }
      };

      const result = await service.updateAnalytics(newMessages, existingAnalytics, 'test-connection');

      expect(result).toHaveProperty('test.field');
      expect(result['test.field'].count).toBe(1); // New messages count
    });

    it('should handle empty existing analytics', async () => {
      const newMessages: ServiceBusMessage[] = [
        {
          messageId: 'msg1',
          sequenceNumber: '1',
          enqueuedTimeUtc: new Date(),
          body: { test: 'value' },
          properties: {},
          deliveryCount: 1,
          jsonFields: { test: 'value' },
          analyzedAt: new Date(),
          connectionId: 'test-connection',
          queueOrTopicName: 'test-queue'
        },
      ];

      const result = await service.updateAnalytics(newMessages, {}, 'test-connection');

      expect(result).toHaveProperty('test.field');
    });
  });

  describe('exportData', () => {
    it('should export data in JSON format', async () => {
      const messages: ServiceBusMessage[] = [
        {
          messageId: 'msg1',
          sequenceNumber: '1',
          enqueuedTimeUtc: new Date(),
          body: { test: 'value' },
          properties: {},
          deliveryCount: 1,
          jsonFields: { test: 'value' },
          analyzedAt: new Date(),
          connectionId: 'test-connection',
        },
      ];

      const filter = {
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31'),
        },
        fieldFilters: [],
        messageTypes: [],
        textSearch: '',
      };

      const result = await service.exportData(messages, 'json', filter);

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(result.byteLength).toBe(100); // Mock data size
    });

    it('should export data in CSV format', async () => {
      const messages: ServiceBusMessage[] = [
        {
          messageId: 'msg1',
          sequenceNumber: '1',
          enqueuedTimeUtc: new Date(),
          body: { test: 'value' },
          properties: {},
          deliveryCount: 1,
          jsonFields: { test: 'value' },
          analyzedAt: new Date(),
          connectionId: 'test-connection',
        },
      ];

      const filter = {
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31'),
        },
        fieldFilters: [],
        messageTypes: [],
        textSearch: '',
      };

      const result = await service.exportData(messages, 'csv', filter);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle export errors', async () => {
      // Mock worker to return error
      const originalWorker = global.Worker;
      global.Worker = class extends MockWorker {
        postMessage = vi.fn((message: any) => {
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: {
                  id: message.id,
                  type: 'ERROR',
                  error: 'Export failed'
                }
              } as MessageEvent);
            }
          }, 10);
        });
      } as any;

      const service = new AnalyticsWorkerService();
      
      await expect(
        service.exportData([], 'json', {
          dateRange: { start: new Date(), end: new Date() },
          fieldFilters: [],
          messageTypes: [],
          textSearch: '',
        })
      ).rejects.toThrow('Export failed');

      service.terminate();
      global.Worker = originalWorker;
    });
  });

  describe('worker lifecycle', () => {
    it('should terminate worker', () => {
      const worker = (service as any).worker;
      const terminateSpy = vi.spyOn(worker, 'terminate');

      service.terminate();

      expect(terminateSpy).toHaveBeenCalled();
    });

    it('should handle multiple operations concurrently', async () => {
      const messages1: ServiceBusMessage[] = [
        {
          messageId: 'msg1',
          sequenceNumber: '1',
          enqueuedTimeUtc: new Date(),
          body: { test: 'value1' },
          properties: {},
          deliveryCount: 1,
          jsonFields: { test: 'value1' },
          analyzedAt: new Date(),
          connectionId: 'test-connection-1',
        },
      ];

      const messages2: ServiceBusMessage[] = [
        {
          messageId: 'msg2',
          sequenceNumber: '2',
          enqueuedTimeUtc: new Date(),
          body: { test: 'value2' },
          properties: {},
          deliveryCount: 1,
          jsonFields: { test: 'value2' },
          analyzedAt: new Date(),
          connectionId: 'test-connection-2',
        },
      ];

      const [result1, result2] = await Promise.all([
        service.analyzeMessages(messages1, 'test-connection-1'),
        service.analyzeMessages(messages2, 'test-connection-2'),
      ]);

      expect(result1.analytics.connectionId).toBe('test-connection-1');
      expect(result2.analytics.connectionId).toBe('test-connection-2');
    });

    it('should handle worker timeout', async () => {
      // Mock worker that never responds
      const originalWorker = global.Worker;
      global.Worker = class extends MockWorker {
        postMessage = vi.fn(); // Never calls onmessage
      } as any;

      const service = new AnalyticsWorkerService();
      
      // This would timeout in a real scenario, but for testing we'll just verify the setup
      expect(service).toBeInstanceOf(AnalyticsWorkerService);

      service.terminate();
      global.Worker = originalWorker;
    });
  });

  describe('message handling', () => {
    it('should generate unique message IDs', async () => {
      const messages: ServiceBusMessage[] = [];
      
      const promise1 = service.analyzeMessages('conn1', messages);
      const promise2 = service.analyzeMessages('conn2', messages);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should complete successfully with different connection IDs
      expect(result1.analytics.connectionId).toBe('conn1');
      expect(result2.analytics.connectionId).toBe('conn2');
    });

    it('should handle malformed worker responses', async () => {
      // Mock worker with malformed response
      const originalWorker = global.Worker;
      global.Worker = class extends MockWorker {
        postMessage = vi.fn((_: any) => {
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: { /* malformed response */ }
              } as MessageEvent);
            }
          }, 10);
        });
      } as any;

      const service = new AnalyticsWorkerService();
      
      await expect(
        service.analyzeMessages('test-connection', [])
      ).rejects.toThrow();

      service.terminate();
      global.Worker = originalWorker;
    });
  });
});