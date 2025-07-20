/**
 * Unit tests for Connection Store
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConnectionStore } from '../connectionStore';
import type { ConnectionProfile } from '../../services/storage/types';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Connection Store', () => {
  const mockProfile: ConnectionProfile = {
    id: 'test-profile-1',
    name: 'Test Profile',
    connectionString: 'test-connection-string',
    type: 'connectionString',
    createdAt: new Date('2023-01-01'),
    lastUsed: new Date('2023-01-01'),
  };

  beforeEach(() => {
    // Reset store state
    useConnectionStore.getState().resetStore();
    vi.clearAllMocks();
  });

  describe('profile management', () => {
    it('should add a new profile', () => {
      const { addProfile } = useConnectionStore.getState();
      
      addProfile(mockProfile);
      
      const state = useConnectionStore.getState();
      expect(state.profiles).toHaveLength(1);
      expect(state.profiles[0]).toEqual(mockProfile);
    });

    it('should update an existing profile', () => {
      const { addProfile, updateProfile } = useConnectionStore.getState();
      
      addProfile(mockProfile);
      
      const updatedProfile = {
        ...mockProfile,
        name: 'Updated Profile Name',
      };
      
      updateProfile(updatedProfile);
      
      const state = useConnectionStore.getState();
      expect(state.profiles[0].name).toBe('Updated Profile Name');
    });

    it('should delete a profile', () => {
      const { addProfile, deleteProfile } = useConnectionStore.getState();
      
      addProfile(mockProfile);
      deleteProfile(mockProfile.id);
      
      const state = useConnectionStore.getState();
      expect(state.profiles).toHaveLength(0);
    });

    it('should set active profile and update last used timestamp', () => {
      const { addProfile, setActiveProfile } = useConnectionStore.getState();
      
      addProfile(mockProfile);
      setActiveProfile(mockProfile.id);
      
      const state = useConnectionStore.getState();
      expect(state.activeProfileId).toBe(mockProfile.id);
      
      const updatedProfile = state.profiles.find(p => p.id === mockProfile.id);
      expect(updatedProfile?.lastUsed).toBeInstanceOf(Date);
      expect(updatedProfile?.lastUsed.getTime()).toBeGreaterThan(mockProfile.lastUsed.getTime());
    });

    it('should clear connection state when deleting active profile', () => {
      const { addProfile, setActiveProfile, setConnected, deleteProfile } = useConnectionStore.getState();
      
      addProfile(mockProfile);
      setActiveProfile(mockProfile.id);
      setConnected(true);
      
      deleteProfile(mockProfile.id);
      
      const state = useConnectionStore.getState();
      expect(state.activeProfileId).toBeNull();
      expect(state.isConnected).toBe(false);
    });
  });

  describe('connection state management', () => {
    it('should set connecting state', () => {
      const { setConnecting } = useConnectionStore.getState();
      
      setConnecting(true);
      
      const state = useConnectionStore.getState();
      expect(state.isConnecting).toBe(true);
      expect(state.connectionError).toBeNull();
    });

    it('should set connected state', () => {
      const { setConnected } = useConnectionStore.getState();
      
      setConnected(true);
      
      const state = useConnectionStore.getState();
      expect(state.isConnected).toBe(true);
      expect(state.isConnecting).toBe(false);
      expect(state.connectionError).toBeNull();
    });

    it('should set connection error', () => {
      const { setConnectionError } = useConnectionStore.getState();
      const error = 'Connection failed';
      
      setConnectionError(error);
      
      const state = useConnectionStore.getState();
      expect(state.connectionError).toBe(error);
      expect(state.isConnecting).toBe(false);
      expect(state.isConnected).toBe(false);
    });

    it('should update last connection attempt', () => {
      const { updateLastConnectionAttempt } = useConnectionStore.getState();
      const beforeTime = Date.now();
      
      updateLastConnectionAttempt();
      
      const state = useConnectionStore.getState();
      expect(state.lastConnectionAttempt).toBeInstanceOf(Date);
      expect(state.lastConnectionAttempt!.getTime()).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should clear connection state', () => {
      const { setConnected, setAvailableQueues, clearConnectionState } = useConnectionStore.getState();
      
      setConnected(true);
      setAvailableQueues(['queue1', 'queue2']);
      
      clearConnectionState();
      
      const state = useConnectionStore.getState();
      expect(state.isConnected).toBe(false);
      expect(state.isConnecting).toBe(false);
      expect(state.connectionError).toBeNull();
      expect(state.availableQueues).toEqual([]);
    });
  });

  describe('queue and topic management', () => {
    it('should set available queues', () => {
      const { setAvailableQueues } = useConnectionStore.getState();
      const queues = ['queue1', 'queue2', 'queue3'];
      
      setAvailableQueues(queues);
      
      const state = useConnectionStore.getState();
      expect(state.availableQueues).toEqual(queues);
    });

    it('should set available topics', () => {
      const { setAvailableTopics } = useConnectionStore.getState();
      const topics = ['topic1', 'topic2'];
      
      setAvailableTopics(topics);
      
      const state = useConnectionStore.getState();
      expect(state.availableTopics).toEqual(topics);
    });

    it('should set selected queue and clear topic selection', () => {
      const { setSelectedQueue, setSelectedTopic } = useConnectionStore.getState();
      
      setSelectedTopic('topic1');
      setSelectedQueue('queue1');
      
      const state = useConnectionStore.getState();
      expect(state.selectedQueue).toBe('queue1');
      expect(state.selectedTopic).toBeNull();
    });

    it('should set selected topic and clear queue selection', () => {
      const { setSelectedQueue, setSelectedTopic } = useConnectionStore.getState();
      
      setSelectedQueue('queue1');
      setSelectedTopic('topic1');
      
      const state = useConnectionStore.getState();
      expect(state.selectedTopic).toBe('topic1');
      expect(state.selectedQueue).toBeNull();
    });
  });

  describe('utility functions', () => {
    it('should get active profile', () => {
      const { addProfile, setActiveProfile, getActiveProfile } = useConnectionStore.getState();
      
      addProfile(mockProfile);
      setActiveProfile(mockProfile.id);
      
      const activeProfile = getActiveProfile();
      expect(activeProfile).toEqual(expect.objectContaining({
        id: mockProfile.id,
        name: mockProfile.name,
      }));
    });

    it('should return null when no active profile', () => {
      const { getActiveProfile } = useConnectionStore.getState();
      
      const activeProfile = getActiveProfile();
      expect(activeProfile).toBeNull();
    });

    it('should reset store to initial state', () => {
      const { addProfile, setConnected, resetStore } = useConnectionStore.getState();
      
      addProfile(mockProfile);
      setConnected(true);
      
      resetStore();
      
      const state = useConnectionStore.getState();
      expect(state.profiles).toEqual([]);
      expect(state.isConnected).toBe(false);
      expect(state.activeProfileId).toBeNull();
    });
  });

  describe('selectors', () => {
    it('should select active profile', () => {
      const { addProfile, setActiveProfile } = useConnectionStore.getState();
      
      addProfile(mockProfile);
      setActiveProfile(mockProfile.id);
      
      // Test the selector by calling the store directly
      const activeProfile = useConnectionStore.getState().getActiveProfile();
      expect(activeProfile?.id).toBe(mockProfile.id);
    });

    it('should select connection status', () => {
      const { setConnecting, setConnected, setConnectionError } = useConnectionStore.getState();
      
      setConnecting(true);
      setConnected(false);
      setConnectionError('Test error');
      
      const state = useConnectionStore.getState();
      const connectionStatus = {
        isConnecting: state.isConnecting,
        isConnected: state.isConnected,
        connectionError: state.connectionError,
      };
      
      // When connection error is set, isConnecting is automatically set to false
      expect(connectionStatus).toEqual({
        isConnecting: false,
        isConnected: false,
        connectionError: 'Test error',
      });
    });

    it('should select destination selection', () => {
      const { setSelectedQueue, setSelectedTopic } = useConnectionStore.getState();
      
      setSelectedQueue('test-queue');
      setSelectedTopic(null);
      
      const state = useConnectionStore.getState();
      const selectedDestination = {
        selectedQueue: state.selectedQueue,
        selectedTopic: state.selectedTopic,
      };
      
      expect(selectedDestination).toEqual({
        selectedQueue: 'test-queue',
        selectedTopic: null,
      });
    });
  });
});