/**
 * Message Store - Manages Service Bus messages and analytics
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ServiceBusMessage, MessageAnalytics, FieldAnalytics } from '../services/storage/types';
import { getAnalyticsWorkerService } from '../services/worker/AnalyticsWorkerService';
import { getMessageFilterService } from '../modules/service-bus/services/MessageFilterService';
import type { FilterGroup, SavedFilterProfile } from '../modules/service-bus/components/FilterBuilder';
import { getFilterProfileService } from '../modules/service-bus/services/FilterProfileService';
import { offlineService } from '../services/pwa/OfflineService';
import { pwaService } from '../services/pwa/PWAService';

export interface MessageFilter {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  fieldFilters: Array<{
    fieldPath: string;
    operator: 'equals' | 'contains' | 'regex' | 'exists';
    value: unknown;
  }>;
  messageTypes: string[];
  textSearch: string;
  // Advanced filtering
  advancedFilter?: FilterGroup;
  useAdvancedFilter: boolean;
}

export interface MessageState {
  // Messages
  messages: ServiceBusMessage[];
  filteredMessages: ServiceBusMessage[];
  selectedMessageIds: string[];
  
  // Pagination
  currentPage: number;
  pageSize: number;
  totalMessages: number;
  
  // Loading states
  isLoadingMessages: boolean;
  isAnalyzing: boolean;
  lastRefresh: Date | null;
  
  // Filtering and search
  filter: MessageFilter;
  sortBy: 'enqueuedTimeUtc' | 'messageId' | 'sequenceNumber';
  sortOrder: 'asc' | 'desc';
  
  // Analytics
  analytics: MessageAnalytics | null;
  fieldAnalytics: Record<string, FieldAnalytics>;
  isAnalyticsEnabled: boolean;
  
  // Actions - Message management
  setMessages: (messages: ServiceBusMessage[]) => void;
  addMessages: (messages: ServiceBusMessage[]) => void;
  updateMessage: (message: ServiceBusMessage) => void;
  removeMessages: (messageIds: string[]) => void;
  clearMessages: () => void;
  
  // Actions - Selection
  selectMessage: (messageId: string) => void;
  selectMessages: (messageIds: string[]) => void;
  deselectMessage: (messageId: string) => void;
  deselectAllMessages: () => void;
  toggleMessageSelection: (messageId: string) => void;
  
  // Actions - Pagination
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  
  // Actions - Loading states
  setLoadingMessages: (loading: boolean) => void;
  setAnalyzing: (analyzing: boolean) => void;
  updateLastRefresh: () => void;
  
  // Actions - Filtering and sorting
  setFilter: (filter: Partial<MessageFilter>) => void;
  clearFilter: () => void;
  setSortBy: (sortBy: 'enqueuedTimeUtc' | 'messageId' | 'sequenceNumber') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  applyFilters: () => void;
  
  // Actions - Advanced filtering
  setAdvancedFilter: (filter: FilterGroup) => void;
  clearAdvancedFilter: () => void;
  toggleAdvancedFilter: (enabled: boolean) => void;
  getAvailableFields: () => Array<{ path: string; type: string; sampleValues: unknown[]; frequency: number }>;
  
  // Actions - Filter profiles
  savedFilterProfiles: SavedFilterProfile[];
  loadFilterProfiles: () => Promise<void>;
  saveFilterProfile: (profile: Omit<SavedFilterProfile, 'id' | 'createdAt' | 'lastUsed' | 'usageCount'>) => Promise<void>;
  loadFilterProfile: (profile: SavedFilterProfile) => Promise<void>;
  deleteFilterProfile: (profileId: string) => Promise<void>;
  exportFilter: (filter: FilterGroup) => void;
  importFilter: (filterData: string) => Promise<void>;
  
  // Actions - Analytics
  setAnalytics: (analytics: MessageAnalytics | null) => void;
  setFieldAnalytics: (fieldAnalytics: Record<string, FieldAnalytics>) => void;
  updateFieldAnalytics: (fieldPath: string, analytics: FieldAnalytics) => void;
  setAnalyticsEnabled: (enabled: boolean) => void;
  analyzeMessages: (connectionId: string) => Promise<void>;
  updateAnalyticsWithNewMessages: (newMessages: ServiceBusMessage[], connectionId: string) => Promise<void>;
  
  // Actions - Offline capabilities
  analyzeMessagesOffline: (connectionId: string) => Promise<void>;
  queueMessageOperation: (operation: {
    type: 'send' | 'delete' | 'complete' | 'abandon' | 'deadletter';
    entityName: string;
    data: unknown;
  }) => Promise<string>;
  getOfflineAnalytics: (connectionId: string) => Promise<{ analytics: MessageAnalytics | null; fieldAnalytics: Record<string, FieldAnalytics> }>;
  syncWhenOnline: () => Promise<void>;
  
  // Utility functions
  getSelectedMessages: () => ServiceBusMessage[];
  getMessageById: (messageId: string) => ServiceBusMessage | null;
  getMessagesCount: () => number;
  getFilteredMessagesCount: () => number;
  resetStore: () => void;
}

const initialFilter: MessageFilter = {
  dateRange: {
    start: null,
    end: null,
  },
  fieldFilters: [],
  messageTypes: [],
  textSearch: '',
  useAdvancedFilter: false,
};

const initialState = {
  messages: [],
  filteredMessages: [],
  selectedMessageIds: [],
  currentPage: 1,
  pageSize: 50,
  totalMessages: 0,
  isLoadingMessages: false,
  isAnalyzing: false,
  lastRefresh: null,
  filter: initialFilter,
  sortBy: 'enqueuedTimeUtc' as const,
  sortOrder: 'desc' as const,
  analytics: null,
  fieldAnalytics: {},
  isAnalyticsEnabled: true,
  savedFilterProfiles: [],
};

export const useMessageStore = create<MessageState>()(
  persist(
    immer((set, get) => ({
      ...initialState,
      
      // Message management
      setMessages: (messages) =>
        set((state) => {
          state.messages = messages;
          state.totalMessages = messages.length;
          state.applyFilters();
        }),
      
      addMessages: (messages) =>
        set((state) => {
          const existingIds = new Set(state.messages.map(m => m.messageId));
          const newMessages = messages.filter(m => !existingIds.has(m.messageId));
          state.messages.push(...newMessages);
          state.totalMessages = state.messages.length;
          state.applyFilters();
        }),
      
      updateMessage: (message) =>
        set((state) => {
          const index = state.messages.findIndex(m => m.messageId === message.messageId);
          if (index !== -1) {
            state.messages[index] = message;
            state.applyFilters();
          }
        }),
      
      removeMessages: (messageIds) =>
        set((state) => {
          state.messages = state.messages.filter(m => !messageIds.includes(m.messageId));
          state.selectedMessageIds = state.selectedMessageIds.filter(id => !messageIds.includes(id));
          state.totalMessages = state.messages.length;
          state.applyFilters();
        }),
      
      clearMessages: () =>
        set((state) => {
          state.messages = [];
          state.filteredMessages = [];
          state.selectedMessageIds = [];
          state.totalMessages = 0;
          state.currentPage = 1;
        }),
      
      // Selection management
      selectMessage: (messageId) =>
        set((state) => {
          if (!state.selectedMessageIds.includes(messageId)) {
            state.selectedMessageIds.push(messageId);
          }
        }),
      
      selectMessages: (messageIds) =>
        set((state) => {
          const newIds = messageIds.filter(id => !state.selectedMessageIds.includes(id));
          state.selectedMessageIds.push(...newIds);
        }),
      
      deselectMessage: (messageId) =>
        set((state) => {
          state.selectedMessageIds = state.selectedMessageIds.filter(id => id !== messageId);
        }),
      
      deselectAllMessages: () =>
        set((state) => {
          state.selectedMessageIds = [];
        }),
      
      toggleMessageSelection: (messageId) =>
        set((state) => {
          const index = state.selectedMessageIds.indexOf(messageId);
          if (index === -1) {
            state.selectedMessageIds.push(messageId);
          } else {
            state.selectedMessageIds.splice(index, 1);
          }
        }),
      
      // Pagination
      setCurrentPage: (page) =>
        set((state) => {
          state.currentPage = Math.max(1, page);
        }),
      
      setPageSize: (size) =>
        set((state) => {
          state.pageSize = Math.max(1, size);
          state.currentPage = 1; // Reset to first page
        }),
      
      nextPage: () =>
        set((state) => {
          const maxPage = Math.ceil(state.filteredMessages.length / state.pageSize);
          if (state.currentPage < maxPage) {
            state.currentPage += 1;
          }
        }),
      
      previousPage: () =>
        set((state) => {
          if (state.currentPage > 1) {
            state.currentPage -= 1;
          }
        }),
      
      // Loading states
      setLoadingMessages: (loading) =>
        set((state) => {
          state.isLoadingMessages = loading;
        }),
      
      setAnalyzing: (analyzing) =>
        set((state) => {
          state.isAnalyzing = analyzing;
        }),
      
      updateLastRefresh: () =>
        set((state) => {
          state.lastRefresh = new Date();
        }),
      
      // Filtering and sorting
      setFilter: (filterUpdate) =>
        set((state) => {
          state.filter = { ...state.filter, ...filterUpdate };
          state.currentPage = 1; // Reset to first page
          state.applyFilters();
        }),
      
      clearFilter: () =>
        set((state) => {
          state.filter = initialFilter;
          state.currentPage = 1;
          state.applyFilters();
        }),
      
      setSortBy: (sortBy) =>
        set((state) => {
          state.sortBy = sortBy;
          state.applyFilters();
        }),
      
      setSortOrder: (order) =>
        set((state) => {
          state.sortOrder = order;
          state.applyFilters();
        }),
      
      applyFilters: () =>
        set((state) => {
          let filtered = [...state.messages];
          
          // Use advanced filter if enabled
          if (state.filter.useAdvancedFilter && state.filter.advancedFilter) {
            try {
              const filterService = getMessageFilterService();
              const result = filterService.filterMessages(filtered, state.filter.advancedFilter);
              filtered = result.filteredMessages;
            } catch (error) {
              console.error('Advanced filter failed, falling back to basic filters:', error);
              // Fall through to basic filters
            }
          } else {
            // Apply basic filters
            
            // Apply date range filter
            if (state.filter.dateRange.start || state.filter.dateRange.end) {
              filtered = filtered.filter(message => {
                const messageDate = new Date(message.enqueuedTimeUtc);
                if (state.filter.dateRange.start && messageDate < state.filter.dateRange.start) {
                  return false;
                }
                if (state.filter.dateRange.end && messageDate > state.filter.dateRange.end) {
                  return false;
                }
                return true;
              });
            }
            
            // Apply text search
            if (state.filter.textSearch) {
              const searchTerm = state.filter.textSearch.toLowerCase();
              filtered = filtered.filter(message => {
                const searchableText = [
                  message.messageId,
                  message.sequenceNumber,
                  JSON.stringify(message.body),
                  JSON.stringify(message.properties),
                ].join(' ').toLowerCase();
                return searchableText.includes(searchTerm);
              });
            }
            
            // Apply field filters
            state.filter.fieldFilters.forEach(fieldFilter => {
              filtered = filtered.filter(message => {
                const fieldValue = getNestedValue(message.jsonFields, fieldFilter.fieldPath);
                
                switch (fieldFilter.operator) {
                  case 'equals':
                    return fieldValue === fieldFilter.value;
                  case 'contains':
                    return String(fieldValue).toLowerCase().includes(String(fieldFilter.value).toLowerCase());
                  case 'regex':
                    try {
                      const regex = new RegExp(String(fieldFilter.value), 'i');
                      return regex.test(String(fieldValue));
                    } catch {
                      return false;
                    }
                  case 'exists':
                    return fieldValue !== undefined && fieldValue !== null;
                  default:
                    return true;
                }
              });
            });
          }
          
          // Apply sorting
          filtered.sort((a, b) => {
            let aValue: any;
            let bValue: any;
            
            switch (state.sortBy) {
              case 'enqueuedTimeUtc':
                aValue = new Date(a.enqueuedTimeUtc).getTime();
                bValue = new Date(b.enqueuedTimeUtc).getTime();
                break;
              case 'messageId':
                aValue = a.messageId;
                bValue = b.messageId;
                break;
              case 'sequenceNumber':
                aValue = parseInt(a.sequenceNumber) || 0;
                bValue = parseInt(b.sequenceNumber) || 0;
                break;
              default:
                return 0;
            }
            
            if (state.sortOrder === 'asc') {
              return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
              return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
          });
          
          state.filteredMessages = filtered;
        }),
      
      // Analytics
      setAnalytics: (analytics) =>
        set((state) => {
          state.analytics = analytics;
        }),
      
      setFieldAnalytics: (fieldAnalytics) =>
        set((state) => {
          state.fieldAnalytics = fieldAnalytics;
        }),
      
      updateFieldAnalytics: (fieldPath, analytics) =>
        set((state) => {
          state.fieldAnalytics[fieldPath] = analytics;
        }),
      
      setAnalyticsEnabled: (enabled) =>
        set((state) => {
          state.isAnalyticsEnabled = enabled;
        }),

      analyzeMessages: async (connectionId) => {
        const state = get();
        if (!state.isAnalyticsEnabled || state.messages.length === 0) {
          return;
        }

        set((state) => {
          state.isAnalyzing = true;
        });

        try {
          const workerService = getAnalyticsWorkerService();
          const result = await workerService.analyzeMessages(state.messages, connectionId);
          
          set((state) => {
            state.analytics = result.analytics;
            state.fieldAnalytics = result.fieldAnalytics;
            state.isAnalyzing = false;
          });
        } catch (error) {
          console.error('Failed to analyze messages:', error);
          set((state) => {
            state.isAnalyzing = false;
          });
        }
      },

      updateAnalyticsWithNewMessages: async (newMessages, connectionId) => {
        const state = get();
        if (!state.isAnalyticsEnabled || newMessages.length === 0) {
          return;
        }

        set((state) => {
          state.isAnalyzing = true;
        });

        try {
          const workerService = getAnalyticsWorkerService();
          const result = await workerService.updateAnalytics(
            state.analytics,
            newMessages,
            connectionId
          );
          
          set((state) => {
            state.analytics = result.analytics;
            // Update field analytics with new data
            result.updatedFields.forEach(field => {
              state.fieldAnalytics[field.fieldPath] = field;
            });
            state.isAnalyzing = false;
          });
        } catch (error) {
          console.error('Failed to update analytics:', error);
          set((state) => {
            state.isAnalyzing = false;
          });
        }
      },

      // Advanced filtering
      setAdvancedFilter: (filter) =>
        set((state) => {
          state.filter.advancedFilter = filter;
          state.currentPage = 1;
          state.applyFilters();
        }),

      clearAdvancedFilter: () =>
        set((state) => {
          state.filter.advancedFilter = undefined;
          state.filter.useAdvancedFilter = false;
          state.currentPage = 1;
          state.applyFilters();
        }),

      toggleAdvancedFilter: (enabled) =>
        set((state) => {
          state.filter.useAdvancedFilter = enabled;
          state.currentPage = 1;
          state.applyFilters();
        }),

      getAvailableFields: () => {
        const state = get();
        if (state.messages.length === 0) return [];
        
        try {
          const filterService = getMessageFilterService();
          return filterService.analyzeFieldUsage(state.messages);
        } catch (error) {
          console.error('Failed to analyze field usage:', error);
          return [];
        }
      },

      // Filter profiles
      loadFilterProfiles: async () => {
        try {
          const profileService = getFilterProfileService();
          const profiles = await profileService.getProfiles();
          set((state) => {
            state.savedFilterProfiles = profiles;
          });
        } catch (error) {
          console.error('Failed to load filter profiles:', error);
        }
      },

      saveFilterProfile: async (profile) => {
        try {
          const profileService = getFilterProfileService();
          const savedProfile = await profileService.saveProfile(profile);
          set((state) => {
            state.savedFilterProfiles.push(savedProfile);
          });
        } catch (error) {
          console.error('Failed to save filter profile:', error);
          throw error;
        }
      },

      loadFilterProfile: async (profile) => {
        try {
          const profileService = getFilterProfileService();
          await profileService.markProfileAsUsed(profile.id);
          
          set((state) => {
            state.filter.advancedFilter = profile.filter;
            state.filter.useAdvancedFilter = true;
            state.currentPage = 1;
            state.applyFilters();
            
            // Update profile usage in local state
            const profileIndex = state.savedFilterProfiles.findIndex(p => p.id === profile.id);
            if (profileIndex !== -1) {
              state.savedFilterProfiles[profileIndex].usageCount += 1;
              state.savedFilterProfiles[profileIndex].lastUsed = new Date();
            }
          });
        } catch (error) {
          console.error('Failed to load filter profile:', error);
          throw error;
        }
      },

      deleteFilterProfile: async (profileId) => {
        try {
          const profileService = getFilterProfileService();
          const success = await profileService.deleteProfile(profileId);
          
          if (success) {
            set((state) => {
              state.savedFilterProfiles = state.savedFilterProfiles.filter(p => p.id !== profileId);
            });
          }
        } catch (error) {
          console.error('Failed to delete filter profile:', error);
          throw error;
        }
      },

      exportFilter: (filter) => {
        try {
          const exportData = JSON.stringify(filter, null, 2);
          
          // Create and trigger download
          const blob = new Blob([exportData], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `filter-${Date.now()}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Failed to export filter:', error);
          throw error;
        }
      },

      importFilter: async (filterData) => {
        try {
          const parsedFilter = JSON.parse(filterData) as FilterGroup;
          
          set((state) => {
            state.filter.advancedFilter = parsedFilter;
            state.filter.useAdvancedFilter = true;
            state.currentPage = 1;
            state.applyFilters();
          });
        } catch (error) {
          console.error('Failed to import filter:', error);
          throw new Error('Invalid filter format');
        }
      },

      // Offline capabilities
      analyzeMessagesOffline: async (connectionId) => {
        const state = get();
        if (!state.isAnalyticsEnabled) {
          return;
        }

        set((state) => {
          state.isAnalyzing = true;
        });

        try {
          const result = await offlineService.analyzeMessagesOffline(connectionId, state.messages);
          
          set((state) => {
            state.analytics = result.analytics;
            state.fieldAnalytics = result.fieldAnalytics;
            state.isAnalyzing = false;
          });
        } catch (error) {
          console.error('Failed to analyze messages offline:', error);
          set((state) => {
            state.isAnalyzing = false;
          });
          throw error;
        }
      },

      queueMessageOperation: async (operation) => {
        try {
          return await offlineService.queueOperation({
            ...operation,
            maxRetries: 3
          });
        } catch (error) {
          console.error('Failed to queue message operation:', error);
          throw error;
        }
      },

      getOfflineAnalytics: async (connectionId) => {
        try {
          const result = await offlineService.analyzeMessagesOffline(connectionId);
          return {
            analytics: result.analytics,
            fieldAnalytics: result.fieldAnalytics
          };
        } catch (error) {
          console.error('Failed to get offline analytics:', error);
          return {
            analytics: null,
            fieldAnalytics: {}
          };
        }
      },

      syncWhenOnline: async () => {
        if (!pwaService.isOnline()) {
          console.warn('Cannot sync while offline');
          return;
        }

        try {
          await offlineService.syncPendingOperations();
        } catch (error) {
          console.error('Failed to sync when online:', error);
          throw error;
        }
      },
      
      // Utility functions
      getSelectedMessages: () => {
        const state = get();
        return state.messages.filter(m => state.selectedMessageIds.includes(m.messageId));
      },
      
      getMessageById: (messageId) => {
        const state = get();
        return state.messages.find(m => m.messageId === messageId) || null;
      },
      
      getMessagesCount: () => {
        const state = get();
        return state.messages.length;
      },
      
      getFilteredMessagesCount: () => {
        const state = get();
        return state.filteredMessages.length;
      },
      
      resetStore: () =>
        set((state) => {
          Object.assign(state, initialState);
        }),
    })),
    {
      name: 'message-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pageSize: state.pageSize,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        isAnalyticsEnabled: state.isAnalyticsEnabled,
      }),
    }
  )
);

// Helper function to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// Selectors for common use cases
export const useFilteredMessages = () => useMessageStore(state => state.filteredMessages);
export const useSelectedMessages = () => useMessageStore(state => state.getSelectedMessages());
export const useMessagePagination = () => useMessageStore(state => ({
  currentPage: state.currentPage,
  pageSize: state.pageSize,
  totalMessages: state.filteredMessages.length,
  totalPages: Math.ceil(state.filteredMessages.length / state.pageSize),
}));
export const useMessageLoadingState = () => useMessageStore(state => ({
  isLoadingMessages: state.isLoadingMessages,
  isAnalyzing: state.isAnalyzing,
  lastRefresh: state.lastRefresh,
}));