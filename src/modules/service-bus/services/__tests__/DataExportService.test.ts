/**
 * Unit tests for DataExportService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataExportService } from '../DataExportService';
import type { ServiceBusMessage } from '../../../services/storage/types';

// Mock Blob
global.Blob = class MockBlob {
  constructor(public content: any[], public options: any = {}) {}
  get type() { return this.options.type || ''; }
  get size() { return JSON.stringify(this.content).length; }
  text() { return Promise.resolve(this.content.join('')); }
  arrayBuffer() { return Promise.resolve(new ArrayBuffer(this.size)); }
} as any;

// Mock URL.createObjectURL
global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
} as any;

describe('DataExportService', () => {
  let exportService: DataExportService;
  
  const mockMessages: ServiceBusMessage[] = [
    {
      messageId: 'msg-1',
      sequenceNumber: '1',
      enqueuedTimeUtc: new Date('2023-01-01T10:00:00Z'),
      body: { type: 'order', id: 1, amount: 100.50 },
      properties: { source: 'web', priority: 'high' },
      deliveryCount: 1,
      jsonFields: { 'type': 'order', 'id': 1, 'amount': 100.50 },
      analyzedAt: new Date('2023-01-01T10:01:00Z'),
      connectionId: 'test-connection',
    },
    {
      messageId: 'msg-2',
      sequenceNumber: '2',
      enqueuedTimeUtc: new Date('2023-01-01T11:00:00Z'),
      body: { type: 'payment', id: 2, amount: 75.25 },
      properties: { source: 'mobile', priority: 'normal' },
      deliveryCount: 1,
      jsonFields: { 'type': 'payment', 'id': 2, 'amount': 75.25 },
      analyzedAt: new Date('2023-01-01T11:01:00Z'),
      connectionId: 'test-connection',
    },
  ];

  const mockFilter = {
    dateRange: {
      start: new Date('2023-01-01'),
      end: new Date('2023-12-31'),
    },
    fieldFilters: [],
    messageTypes: [],
    textSearch: '',
  };

  beforeEach(() => {
    exportService = new DataExportService();
    vi.clearAllMocks();
  });

  describe('JSON export', () => {
    it('should export messages as JSON', async () => {
      const result = await exportService.exportToJSON(mockMessages, mockFilter);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/json');
      
      const content = await result.text();
      const parsed = JSON.parse(content);
      
      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('messages');
      expect(parsed.messages).toHaveLength(2);
      expect(parsed.metadata.totalMessages).toBe(2);
      expect(parsed.metadata.exportedAt).toBeDefined();
    });

    it('should include filter information in JSON export', async () => {
      const filterWithCriteria = {
        ...mockFilter,
        textSearch: 'order',
        messageTypes: ['order'],
      };

      const result = await exportService.exportToJSON(mockMessages, filterWithCriteria);
      const content = await result.text();
      const parsed = JSON.parse(content);
      
      expect(parsed.metadata.filter.textSearch).toBe('order');
      expect(parsed.metadata.filter.messageTypes).toEqual(['order']);
    });

    it('should handle empty message list', async () => {
      const result = await exportService.exportToJSON([], mockFilter);
      const content = await result.text();
      const parsed = JSON.parse(content);
      
      expect(parsed.messages).toHaveLength(0);
      expect(parsed.metadata.totalMessages).toBe(0);
    });

    it('should sanitize sensitive data in JSON export', async () => {
      const messagesWithSensitive = [
        {
          ...mockMessages[0],
          body: { 
            type: 'payment', 
            creditCard: '4111-1111-1111-1111',
            ssn: '123-45-6789',
            email: 'user@example.com'
          },
        },
      ];

      const result = await exportService.exportToJSON(messagesWithSensitive, mockFilter, {
        sanitizeSensitiveData: true,
      });
      
      const content = await result.text();
      const parsed = JSON.parse(content);
      
      expect(parsed.messages[0].body.creditCard).toBe('[REDACTED]');
      expect(parsed.messages[0].body.ssn).toBe('[REDACTED]');
      expect(parsed.messages[0].body.email).toBe('[REDACTED]');
    });
  });

  describe('CSV export', () => {
    it('should export messages as CSV', async () => {
      const result = await exportService.exportToCSV(mockMessages, mockFilter);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('text/csv');
      
      const content = await result.text();
      const lines = content.split('\n');
      
      // Should have header + 2 data rows
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines[0]).toContain('messageId');
      expect(lines[0]).toContain('enqueuedTimeUtc');
      expect(lines[1]).toContain('msg-1');
      expect(lines[2]).toContain('msg-2');
    });

    it('should handle custom column selection', async () => {
      const options = {
        columns: ['messageId', 'body.type', 'properties.source'],
      };

      const result = await exportService.exportToCSV(mockMessages, mockFilter, options);
      const content = await result.text();
      const lines = content.split('\n');
      
      expect(lines[0]).toBe('messageId,body.type,properties.source');
      expect(lines[1]).toContain('msg-1,order,web');
      expect(lines[2]).toContain('msg-2,payment,mobile');
    });

    it('should escape CSV special characters', async () => {
      const messagesWithSpecialChars = [
        {
          ...mockMessages[0],
          body: { 
            description: 'Order with "quotes" and, commas',
            notes: 'Line 1\nLine 2'
          },
        },
      ];

      const result = await exportService.exportToCSV(messagesWithSpecialChars, mockFilter);
      const content = await result.text();
      
      expect(content).toContain('"Order with ""quotes"" and, commas"');
      expect(content).toContain('"Line 1\nLine 2"');
    });

    it('should handle nested object flattening', async () => {
      const result = await exportService.exportToCSV(mockMessages, mockFilter);
      const content = await result.text();
      const lines = content.split('\n');
      
      // Should flatten nested objects with dot notation
      expect(lines[0]).toContain('body.type');
      expect(lines[0]).toContain('properties.source');
      expect(lines[1]).toContain('order');
      expect(lines[1]).toContain('web');
    });
  });

  describe('analytics report export', () => {
    it('should export analytics report', async () => {
      const analytics = {
        connectionId: 'test-connection',
        totalMessages: 2,
        messageTypes: { order: 1, payment: 1 },
        fieldAnalytics: {
          'type': {
            fieldPath: 'type',
            dataType: 'string',
            count: 2,
            uniqueValues: 2,
            coverage: 100,
            topValues: [
              { value: 'order', count: 1, percentage: 50 },
              { value: 'payment', count: 1, percentage: 50 },
            ],
            trend: [],
          },
        },
        timeSeriesData: [],
        correlationMatrix: [],
        lastUpdated: new Date(),
      };

      const result = await exportService.exportAnalyticsReport(analytics, mockFilter);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/json');
      
      const content = await result.text();
      const parsed = JSON.parse(content);
      
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('fieldAnalytics');
      expect(parsed).toHaveProperty('messageTypes');
      expect(parsed.summary.totalMessages).toBe(2);
    });

    it('should include visualizations in analytics report', async () => {
      const analytics = {
        connectionId: 'test-connection',
        totalMessages: 100,
        messageTypes: { order: 60, payment: 40 },
        fieldAnalytics: {},
        timeSeriesData: [
          { timestamp: new Date('2023-01-01T10:00:00Z'), count: 10, avgSize: 1024, fieldValues: {} },
          { timestamp: new Date('2023-01-01T11:00:00Z'), count: 15, avgSize: 1200, fieldValues: {} },
        ],
        correlationMatrix: [],
        lastUpdated: new Date(),
      };

      const result = await exportService.exportAnalyticsReport(analytics, mockFilter);
      const content = await result.text();
      const parsed = JSON.parse(content);
      
      expect(parsed).toHaveProperty('charts');
      expect(parsed.charts).toHaveProperty('messageTypeDistribution');
      expect(parsed.charts).toHaveProperty('timeSeriesData');
    });
  });

  describe('batch export', () => {
    it('should handle large message batches', async () => {
      const largeMessageSet = Array.from({ length: 10000 }, (_, index) => ({
        ...mockMessages[0],
        messageId: `msg-${index}`,
        sequenceNumber: index.toString(),
        body: { type: 'test', id: index },
      }));

      const result = await exportService.exportToJSON(largeMessageSet, mockFilter, {
        batchSize: 1000,
      });
      
      expect(result).toBeInstanceOf(Blob);
      
      const content = await result.text();
      const parsed = JSON.parse(content);
      
      expect(parsed.messages).toHaveLength(10000);
      expect(parsed.metadata.totalMessages).toBe(10000);
    });

    it('should show progress for large exports', async () => {
      const progressCallback = vi.fn();
      const largeMessageSet = Array.from({ length: 5000 }, (_, index) => ({
        ...mockMessages[0],
        messageId: `msg-${index}`,
      }));

      await exportService.exportToCSV(largeMessageSet, mockFilter, {
        batchSize: 1000,
        onProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback.mock.calls.some(call => call[0] === 100)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle export errors gracefully', async () => {
      // Mock Blob constructor to throw error
      const originalBlob = global.Blob;
      global.Blob = class {
        constructor() {
          throw new Error('Blob creation failed');
        }
      } as any;

      await expect(
        exportService.exportToJSON(mockMessages, mockFilter)
      ).rejects.toThrow('Export failed: Blob creation failed');

      global.Blob = originalBlob;
    });

    it('should handle malformed message data', async () => {
      const malformedMessages = [
        {
          ...mockMessages[0],
          body: null, // Malformed body
        },
        {
          messageId: 'msg-invalid',
          // Missing required fields
        },
      ] as ServiceBusMessage[];

      const exportOptions: ExportOptions = {
        format: 'json',
        includeBody: true,
        includeProperties: true,
        includeAnalytics: false,
        sanitizeData: true,
        filter: mockFilter
      };

      const result = await exportService.exportToJSON(malformedMessages, exportOptions);
      
      expect(result.data).toBeInstanceOf(Blob);
      
      const content = await result.data.text();
      const parsed = JSON.parse(content);
      
      expect(parsed.messages).toHaveLength(2);
      expect(parsed.metadata.errors).toBeDefined();
    });

    it('should handle memory constraints for large exports', async () => {
      const hugeMessageSet = Array.from({ length: 100000 }, (_, index) => ({
        ...mockMessages[0],
        messageId: `msg-${index}`,
        body: { data: 'x'.repeat(1000) }, // Large body
      }));

      // Should not throw memory errors
      const exportOptions: ExportOptions = {
        format: 'json',
        includeBody: true,
        includeProperties: true,
        includeAnalytics: false,
        sanitizeData: true,
        filter: mockFilter
      };

      await expect(
        exportService.exportToJSON(hugeMessageSet, exportOptions)
      ).resolves.toBeInstanceOf(Blob);
    });
  });

  describe('format validation', () => {
    it('should validate export format', () => {
      expect(() => {
        (exportService as any).validateFormat('json');
      }).not.toThrow();

      expect(() => {
        (exportService as any).validateFormat('csv');
      }).not.toThrow();

      expect(() => {
        (exportService as any).validateFormat('invalid');
      }).toThrow('Unsupported export format: invalid');
    });

    it('should validate export options', () => {
      const validOptions = {
        columns: ['messageId', 'body.type'],
        sanitizeSensitiveData: true,
        batchSize: 1000,
      };

      expect(() => {
        (exportService as any).validateOptions(validOptions);
      }).not.toThrow();

      const invalidOptions = {
        batchSize: -1, // Invalid batch size
      };

      expect(() => {
        (exportService as any).validateOptions(invalidOptions);
      }).toThrow('Invalid batch size');
    });
  });

  describe('data sanitization', () => {
    it('should identify and redact credit card numbers', () => {
      const data = { creditCard: '4111-1111-1111-1111' };
      const sanitized = (exportService as any).sanitizeData(data);
      
      expect(sanitized.creditCard).toBe('[REDACTED]');
    });

    it('should identify and redact SSNs', () => {
      const data = { ssn: '123-45-6789' };
      const sanitized = (exportService as any).sanitizeData(data);
      
      expect(sanitized.ssn).toBe('[REDACTED]');
    });

    it('should identify and redact email addresses', () => {
      const data = { email: 'user@example.com' };
      const sanitized = (exportService as any).sanitizeData(data);
      
      expect(sanitized.email).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive data', () => {
      const data = { 
        id: 123, 
        type: 'order', 
        amount: 100.50,
        description: 'Regular order data'
      };
      const sanitized = (exportService as any).sanitizeData(data);
      
      expect(sanitized.id).toBe(123);
      expect(sanitized.type).toBe('order');
      expect(sanitized.amount).toBe(100.50);
      expect(sanitized.description).toBe('Regular order data');
    });
  });
});