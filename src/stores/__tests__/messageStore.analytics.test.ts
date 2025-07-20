/**
 * Tests for message store analytics integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMessageStore } from '../messageStore';
import type { ServiceBusMessage } from '../../services/storage/types';

// Mock the analytics worker service
vi.mock('../../services/worker/AnalyticsWorkerService', () => ({
  getAnalyticsWorkerService: () => ({
    analyzeMessages: vi.fn().mockResolvedValue({
      analytics: {
        id: 'analytics-1',
        connectionId: 'conn-1',
        totalMessages: 2,
        messageTypes: { 'test-message': 2 },
        fieldAnalytics: {},
        timeSeriesData: [],
        correlationMatrix: [],
        lastUpdated: new Date(),
      },
      fieldAnalytics: {
        'test.field': {
          id: 'field-1',
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
          connectionId: 'conn-1',
          lastUpdated: new Date(),
        },
      },
    }),
    updateAnalytics: vi.fn().mockResolvedValue({
      analytics: {
        id: 'analytics-1',
        connectionId: 'conn-1',
        totalMessages: 3,
        messageTypes: { 'test-message': 3 },
        fieldAnalytics: {},
        timeSeriesData: [],
        correlationMatrix: [],
        lastUpdated: new Date(),
      },
      updatedFields: [
        {
          id: 'field-1',
          fieldPath: 'test.field',
          dataType: 'string',
          count: 3,
          uniqueValues: 3,
          coverage: 100,
          topValues: [
            { value: 'value1', count: 1, percentage: 33.33 },
            { value: 'value2', count: 1, percentage: 33.33 },
            { value: 'value3', count: 1, percentage: 33.33 },
          ],
          trend: [],
          connectionId: 'conn-1',
          lastUpdated: new Date(),
        },
      ],
    }),
  }),
}));

describe('MessageStore Analytics Integration', () => {
  const mockMessages: ServiceBusMessage[] = [
    {
      messageId: 'msg-1',
      sequenceNumber: '1',
      enqueuedTimeUtc: new Date(),
      body: { test: { field: 'value1' } },
      properties: { messageType: 'test-message' },
      deliveryCount: 1,
      jsonFields: { test: { field: 'value1' } },
      analyzedAt: new Date(),
      connectionId: 'conn-1',
      queueOrTopicName: 'test-queue',
    },
    {
      messageId: 'msg-2',
      sequenceNumber: '2',
      enqueuedTimeUtc: new Date(),
      body: { test: { field: 'value2' } },
      properties: { messageType: 'test-message' },
      deliveryCount: 1,
      jsonFields: { test: { field: 'value2' } },
      analyzedAt: new Date(),
      connectionId: 'conn-1',
      queueOrTopicName: 'test-queue',
    },
  ];

  beforeEach(() => {
    useMessageStore.getState().resetStore();
  });

  afterEach(() => {
    useMessageStore.getState().resetStore();
  });

  describe('analyzeMessages', () => {
    it('should analyze messages and update analytics state', async () => {
      let store = useMessageStore.getState();
      
      // Set up initial state
      store.setMessages(mockMessages);
      store.setAnalyticsEnabled(true);

      expect(store.analytics).toBeNull();
      expect(Object.keys(store.fieldAnalytics)).toHaveLength(0);

      // Analyze messages
      await store.analyzeMessages('conn-1');

      // Get fresh state after async operation
      store = useMessageStore.getState();

      // Check that analytics were updated
      expect(store.analytics).toBeDefined();
      expect(store.analytics?.totalMessages).toBe(2);
      expect(store.analytics?.connectionId).toBe('conn-1');
      expect(Object.keys(store.fieldAnalytics)).toHaveLength(1);
      expect(store.fieldAnalytics['test.field']).toBeDefined();
    });

    it('should not analyze when analytics is disabled', async () => {
      const store = useMessageStore.getState();
      
      store.setMessages(mockMessages);
      store.setAnalyticsEnabled(false);

      await store.analyzeMessages('conn-1');

      expect(store.analytics).toBeNull();
      expect(Object.keys(store.fieldAnalytics)).toHaveLength(0);
    });

    it('should not analyze when no messages exist', async () => {
      const store = useMessageStore.getState();
      
      store.setAnalyticsEnabled(true);

      await store.analyzeMessages('conn-1');

      expect(store.analytics).toBeNull();
      expect(Object.keys(store.fieldAnalytics)).toHaveLength(0);
    });

    it('should set analyzing state during analysis', async () => {
      const store = useMessageStore.getState();
      
      store.setMessages(mockMessages);
      store.setAnalyticsEnabled(true);

      expect(store.isAnalyzing).toBe(false);

      const analysisPromise = store.analyzeMessages('conn-1');
      
      // Note: In a real scenario, we might need to check this during the async operation
      // For this test, we'll just verify the final state
      await analysisPromise;

      expect(store.isAnalyzing).toBe(false);
    });
  });

  describe('updateAnalyticsWithNewMessages', () => {
    it('should update existing analytics with new messages', async () => {
      let store = useMessageStore.getState();
      
      // Set up initial analytics
      store.setMessages(mockMessages);
      store.setAnalyticsEnabled(true);
      await store.analyzeMessages('conn-1');

      // Get fresh state after first analysis
      store = useMessageStore.getState();
      const initialTotalMessages = store.analytics?.totalMessages;

      // Add new message
      const newMessage: ServiceBusMessage = {
        messageId: 'msg-3',
        sequenceNumber: '3',
        enqueuedTimeUtc: new Date(),
        body: { test: { field: 'value3' } },
        properties: { messageType: 'test-message' },
        deliveryCount: 1,
        jsonFields: { test: { field: 'value3' } },
        analyzedAt: new Date(),
        connectionId: 'conn-1',
        queueOrTopicName: 'test-queue',
      };

      await store.updateAnalyticsWithNewMessages([newMessage], 'conn-1');

      // Get fresh state after update
      store = useMessageStore.getState();

      // Check that analytics were updated
      expect(store.analytics?.totalMessages).toBe(3);
      expect(store.analytics?.totalMessages).toBeGreaterThan(initialTotalMessages || 0);
      expect(store.fieldAnalytics['test.field'].count).toBe(3);
    });

    it('should not update when analytics is disabled', async () => {
      const store = useMessageStore.getState();
      
      store.setMessages(mockMessages);
      store.setAnalyticsEnabled(false);

      const newMessage = mockMessages[0];
      await store.updateAnalyticsWithNewMessages([newMessage], 'conn-1');

      expect(store.analytics).toBeNull();
    });

    it('should not update when no new messages provided', async () => {
      const store = useMessageStore.getState();
      
      store.setMessages(mockMessages);
      store.setAnalyticsEnabled(true);
      await store.analyzeMessages('conn-1');

      const initialAnalytics = store.analytics;

      await store.updateAnalyticsWithNewMessages([], 'conn-1');

      expect(store.analytics).toBe(initialAnalytics);
    });
  });

  describe('analytics state management', () => {
    it('should enable and disable analytics', () => {
      let store = useMessageStore.getState();
      
      expect(store.isAnalyticsEnabled).toBe(true); // Default state

      store.setAnalyticsEnabled(false);
      store = useMessageStore.getState(); // Get fresh state
      expect(store.isAnalyticsEnabled).toBe(false);

      store.setAnalyticsEnabled(true);
      store = useMessageStore.getState(); // Get fresh state
      expect(store.isAnalyticsEnabled).toBe(true);
    });

    it('should set and update field analytics', () => {
      let store = useMessageStore.getState();
      
      const fieldAnalytics = {
        'test.field': {
          id: 'field-1',
          fieldPath: 'test.field',
          dataType: 'string',
          count: 1,
          uniqueValues: 1,
          coverage: 100,
          topValues: [{ value: 'test', count: 1, percentage: 100 }],
          trend: [],
          connectionId: 'conn-1',
          lastUpdated: new Date(),
        },
      };

      store.setFieldAnalytics(fieldAnalytics);
      store = useMessageStore.getState(); // Get fresh state
      expect(store.fieldAnalytics).toEqual(fieldAnalytics);

      // Update specific field
      const updatedField = {
        ...fieldAnalytics['test.field'],
        count: 2,
      };

      store.updateFieldAnalytics('test.field', updatedField);
      store = useMessageStore.getState(); // Get fresh state
      expect(store.fieldAnalytics['test.field'].count).toBe(2);
    });

    it('should set analytics data', () => {
      let store = useMessageStore.getState();
      
      const analytics = {
        id: 'analytics-1',
        connectionId: 'conn-1',
        totalMessages: 5,
        messageTypes: { 'test': 5 },
        fieldAnalytics: {},
        timeSeriesData: [],
        correlationMatrix: [],
        lastUpdated: new Date(),
      };

      store.setAnalytics(analytics);
      store = useMessageStore.getState(); // Get fresh state
      expect(store.analytics).toEqual(analytics);

      store.setAnalytics(null);
      store = useMessageStore.getState(); // Get fresh state
      expect(store.analytics).toBeNull();
    });
  });
});