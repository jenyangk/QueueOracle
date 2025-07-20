import { describe, it, expect, beforeEach } from 'vitest';
import { MessageFilterService } from '../MessageFilterService';
import type { ServiceBusMessage } from '../../../../services/storage/types';
import type { FilterGroup } from '../../components/FilterBuilder';

describe('MessageFilterService', () => {
  let service: MessageFilterService;
  let mockMessages: ServiceBusMessage[];

  beforeEach(() => {
    service = MessageFilterService.getInstance();
    service.clearCaches();

    // Create mock messages for testing
    mockMessages = [
      {
        messageId: 'msg-1',
        sequenceNumber: '1',
        enqueuedTimeUtc: new Date('2023-01-01T10:00:00Z'),
        body: { type: 'order', amount: 100, status: 'pending' },
        properties: { userId: '123', region: 'us-east' },
        deliveryCount: 1,
        analyzedAt: new Date(),
        connectionId: 'test-conn',
        queueOrTopicName: 'test-queue',
        jsonFields: { 
          user: { id: '123', name: 'John Doe', age: 30 },
          order: { id: 'ord-1', total: 100.50 }
        },
      },
      {
        messageId: 'msg-2',
        sequenceNumber: '2',
        enqueuedTimeUtc: new Date('2023-01-01T11:00:00Z'),
        body: { type: 'payment', amount: 200, status: 'completed' },
        properties: { userId: '456', region: 'us-west' },
        deliveryCount: 1,
        analyzedAt: new Date(),
        connectionId: 'test-conn',
        queueOrTopicName: 'test-queue',
        jsonFields: { 
          user: { id: '456', name: 'Jane Smith', age: 25 },
          order: { id: 'ord-2', total: 200.75 }
        },
      },
      {
        messageId: 'msg-3',
        sequenceNumber: '3',
        enqueuedTimeUtc: new Date('2023-01-01T12:00:00Z'),
        body: { type: 'order', amount: 50, status: 'cancelled' },
        properties: { userId: '789', region: 'eu-west' },
        deliveryCount: 1,
        analyzedAt: new Date(),
        connectionId: 'test-conn',
        queueOrTopicName: 'test-queue',
        jsonFields: { 
          user: { id: '789', name: 'Bob Wilson', age: 35 },
          order: { id: 'ord-3', total: 50.25 }
        },
      },
    ] as ServiceBusMessage[];
  });

  describe('Basic Filtering', () => {
    it('filters messages with equals condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.type',
            operator: 'equals',
            value: 'order',
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(2);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-1');
      expect(result.filteredMessages[1]?.messageId).toBe('msg-3');
    });

    it('filters messages with contains condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'jsonFields.user.name',
            operator: 'contains',
            value: 'John',
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(1);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-1');
    });

    it('filters messages with regex condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'properties.region',
            operator: 'regex',
            value: '^us-',
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(2);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-1');
      expect(result.filteredMessages[1]?.messageId).toBe('msg-2');
    });

    it('filters messages with exists condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'jsonFields.user.age',
            operator: 'exists',
            value: true,
            dataType: 'number',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(3); // All messages have user.age
    });

    it('filters messages with not_exists condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'jsonFields.user.email',
            operator: 'not_exists',
            value: true,
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(3); // No messages have user.email
    });
  });

  describe('Numeric Filtering', () => {
    it('filters messages with greater_than condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.amount',
            operator: 'greater_than',
            value: 75,
            dataType: 'number',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(2);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-1');
      expect(result.filteredMessages[1]?.messageId).toBe('msg-2');
    });

    it('filters messages with less_than condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'jsonFields.user.age',
            operator: 'less_than',
            value: 30,
            dataType: 'number',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(1);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-2');
    });

    it('filters messages with between condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.amount',
            operator: 'between',
            value: 75,
            secondaryValue: 150,
            dataType: 'number',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(1);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-1');
    });
  });

  describe('Array Filtering', () => {
    it('filters messages with in condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.status',
            operator: 'in',
            value: ['pending', 'completed'],
            dataType: 'array',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(2);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-1');
      expect(result.filteredMessages[1]?.messageId).toBe('msg-2');
    });

    it('filters messages with not_in condition', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.status',
            operator: 'not_in',
            value: ['cancelled'],
            dataType: 'array',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(2);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-1');
      expect(result.filteredMessages[1]?.messageId).toBe('msg-2');
    });
  });

  describe('Complex Filtering', () => {
    it('applies AND logic correctly', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.type',
            operator: 'equals',
            value: 'order',
            dataType: 'string',
            enabled: true,
          },
          {
            id: 'cond-2',
            fieldPath: 'body.amount',
            operator: 'greater_than',
            value: 75,
            dataType: 'number',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(1);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-1');
    });

    it('applies OR logic correctly', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'OR',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.type',
            operator: 'equals',
            value: 'payment',
            dataType: 'string',
            enabled: true,
          },
          {
            id: 'cond-2',
            fieldPath: 'body.status',
            operator: 'equals',
            value: 'cancelled',
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(2);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-2');
      expect(result.filteredMessages[1]?.messageId).toBe('msg-3');
    });

    it('handles nested groups correctly', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.type',
            operator: 'equals',
            value: 'order',
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [
          {
            id: 'group-1',
            name: 'Amount or Status',
            operator: 'OR',
            enabled: true,
            conditions: [
              {
                id: 'cond-2',
                fieldPath: 'body.amount',
                operator: 'greater_than',
                value: 75,
                dataType: 'number',
                enabled: true,
              },
              {
                id: 'cond-3',
                fieldPath: 'body.status',
                operator: 'equals',
                value: 'cancelled',
                dataType: 'string',
                enabled: true,
              },
            ],
            groups: [],
          },
        ],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(2);
      expect(result.filteredMessages[0]?.messageId).toBe('msg-1');
      expect(result.filteredMessages[1]?.messageId).toBe('msg-3');
    });

    it('ignores disabled conditions', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.type',
            operator: 'equals',
            value: 'order',
            dataType: 'string',
            enabled: true,
          },
          {
            id: 'cond-2',
            fieldPath: 'body.amount',
            operator: 'equals',
            value: 999, // This would filter out all messages
            dataType: 'number',
            enabled: false, // But it's disabled
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(2); // Should match both order messages
    });

    it('ignores disabled groups', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [],
        groups: [
          {
            id: 'group-1',
            name: 'Disabled Group',
            operator: 'AND',
            enabled: false, // Disabled group
            conditions: [
              {
                id: 'cond-1',
                fieldPath: 'body.type',
                operator: 'equals',
                value: 'nonexistent',
                dataType: 'string',
                enabled: true,
              },
            ],
            groups: [],
          },
        ],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(3); // Should return all messages
    });
  });

  describe('Performance and Caching', () => {
    it('provides performance metrics', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.type',
            operator: 'equals',
            value: 'order',
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.totalMessages).toBe(3);
      expect(result.metrics.filteredMessages).toBe(2);
      expect(result.metrics.filterTime).toBeGreaterThan(0);
      expect(result.metrics.conditionsEvaluated).toBeGreaterThan(0);
    });

    it('uses caching for repeated operations', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.type',
            operator: 'equals',
            value: 'order',
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [],
      };

      // First run
      const result1 = service.filterMessages(mockMessages, filter);
      const firstRunCacheHits = result1.metrics.cacheHits;

      // Second run with same filter
      const result2 = service.filterMessages(mockMessages, filter);
      const secondRunCacheHits = result2.metrics.cacheHits;

      expect(secondRunCacheHits).toBeGreaterThan(firstRunCacheHits);
    });
  });

  describe('Field Analysis', () => {
    it('analyzes field usage correctly', () => {
      const analysis = service.analyzeFieldUsage(mockMessages);

      expect(analysis).toBeInstanceOf(Array);
      expect(analysis.length).toBeGreaterThan(0);

      // Check that common fields are detected
      const bodyTypeField = analysis.find(field => field.path === 'body.type');
      expect(bodyTypeField).toBeDefined();
      expect(bodyTypeField?.frequency).toBe(1.0); // Present in all messages

      const userIdField = analysis.find(field => field.path === 'jsonFields.user.id');
      expect(userIdField).toBeDefined();
      expect(userIdField?.type).toBe('string');
    });

    it('provides sample values for fields', () => {
      const analysis = service.analyzeFieldUsage(mockMessages);

      const bodyTypeField = analysis.find(field => field.path === 'body.type');
      expect(bodyTypeField?.sampleValues).toContain('order');
      expect(bodyTypeField?.sampleValues).toContain('payment');
    });
  });

  describe('Error Handling', () => {
    it('handles invalid regex gracefully', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'body.type',
            operator: 'regex',
            value: '[invalid regex',
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(0); // Invalid regex should match nothing
      expect(result.metrics.totalMessages).toBe(3);
    });

    it('handles missing field paths gracefully', () => {
      const filter: FilterGroup = {
        id: 'root',
        name: 'Root',
        operator: 'AND',
        enabled: true,
        conditions: [
          {
            id: 'cond-1',
            fieldPath: 'nonexistent.field.path',
            operator: 'equals',
            value: 'anything',
            dataType: 'string',
            enabled: true,
          },
        ],
        groups: [],
      };

      const result = service.filterMessages(mockMessages, filter);

      expect(result.filteredMessages).toHaveLength(0);
      expect(result.metrics.totalMessages).toBe(3);
    });
  });
});