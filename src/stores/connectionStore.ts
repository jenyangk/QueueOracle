/**
 * Connection Store - Manages Service Bus connection profiles and state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ConnectionProfile } from '../services/storage/types';

export interface ConnectionState {
  // Connection profiles
  profiles: ConnectionProfile[];
  activeProfileId: string | null;
  
  // Connection status
  isConnecting: boolean;
  isConnected: boolean;
  connectionError: string | null;
  lastConnectionAttempt: Date | null;
  
  // Queue/Topic information
  availableQueues: string[];
  availableTopics: string[];
  selectedQueue: string | null;
  selectedTopic: string | null;
  
  // Actions
  addProfile: (profile: ConnectionProfile) => void;
  updateProfile: (profile: ConnectionProfile) => void;
  deleteProfile: (profileId: string) => void;
  setActiveProfile: (profileId: string | null) => void;
  
  // Connection actions
  setConnecting: (connecting: boolean) => void;
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  updateLastConnectionAttempt: () => void;
  
  // Queue/Topic actions
  setAvailableQueues: (queues: string[]) => void;
  setAvailableTopics: (topics: string[]) => void;
  setSelectedQueue: (queue: string | null) => void;
  setSelectedTopic: (topic: string | null) => void;
  
  // Utility actions
  getActiveProfile: () => ConnectionProfile | null;
  clearConnectionState: () => void;
  resetStore: () => void;
}

const initialState = {
  profiles: [],
  activeProfileId: null,
  isConnecting: false,
  isConnected: false,
  connectionError: null,
  lastConnectionAttempt: null,
  availableQueues: [],
  availableTopics: [],
  selectedQueue: null,
  selectedTopic: null,
};

export const useConnectionStore = create<ConnectionState>()(
  persist(
    immer((set, get) => ({
      ...initialState,
      
      // Profile management
      addProfile: (profile) =>
        set((state) => {
          state.profiles.push(profile);
        }),
      
      updateProfile: (profile) =>
        set((state) => {
          const index = state.profiles.findIndex(p => p.id === profile.id);
          if (index !== -1) {
            state.profiles[index] = profile;
          }
        }),
      
      deleteProfile: (profileId) =>
        set((state) => {
          state.profiles = state.profiles.filter(p => p.id !== profileId);
          if (state.activeProfileId === profileId) {
            state.activeProfileId = null;
            state.isConnected = false;
            state.connectionError = null;
          }
        }),
      
      setActiveProfile: (profileId) =>
        set((state) => {
          state.activeProfileId = profileId;
          if (profileId) {
            // Update last used timestamp
            const profile = state.profiles.find(p => p.id === profileId);
            if (profile) {
              profile.lastUsed = new Date();
            }
          }
        }),
      
      // Connection state management
      setConnecting: (connecting) =>
        set((state) => {
          state.isConnecting = connecting;
          if (connecting) {
            state.connectionError = null;
          }
        }),
      
      setConnected: (connected) =>
        set((state) => {
          state.isConnected = connected;
          state.isConnecting = false;
          if (connected) {
            state.connectionError = null;
          }
        }),
      
      setConnectionError: (error) =>
        set((state) => {
          state.connectionError = error;
          state.isConnecting = false;
          if (error) {
            state.isConnected = false;
          }
        }),
      
      updateLastConnectionAttempt: () =>
        set((state) => {
          state.lastConnectionAttempt = new Date();
        }),
      
      // Queue/Topic management
      setAvailableQueues: (queues) =>
        set((state) => {
          state.availableQueues = queues;
        }),
      
      setAvailableTopics: (topics) =>
        set((state) => {
          state.availableTopics = topics;
        }),
      
      setSelectedQueue: (queue) =>
        set((state) => {
          state.selectedQueue = queue;
          if (queue) {
            state.selectedTopic = null; // Clear topic selection when queue is selected
          }
        }),
      
      setSelectedTopic: (topic) =>
        set((state) => {
          state.selectedTopic = topic;
          if (topic) {
            state.selectedQueue = null; // Clear queue selection when topic is selected
          }
        }),
      
      // Utility functions
      getActiveProfile: () => {
        const state = get();
        return state.profiles.find(p => p.id === state.activeProfileId) || null;
      },
      
      clearConnectionState: () =>
        set((state) => {
          state.isConnecting = false;
          state.isConnected = false;
          state.connectionError = null;
          state.availableQueues = [];
          state.availableTopics = [];
          state.selectedQueue = null;
          state.selectedTopic = null;
        }),
      
      resetStore: () =>
        set((state) => {
          Object.assign(state, initialState);
        }),
    })),
    {
      name: 'connection-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        selectedQueue: state.selectedQueue,
        selectedTopic: state.selectedTopic,
      }),
    }
  )
);

// Selectors for common use cases
export const useActiveProfile = () => useConnectionStore(state => state.getActiveProfile());
export const useConnectionStatus = () => useConnectionStore(state => ({
  isConnecting: state.isConnecting,
  isConnected: state.isConnected,
  connectionError: state.connectionError,
}));
export const useSelectedDestination = () => useConnectionStore(state => ({
  selectedQueue: state.selectedQueue,
  selectedTopic: state.selectedTopic,
}));