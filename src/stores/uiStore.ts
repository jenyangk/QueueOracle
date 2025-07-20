/**
 * UI Store - Manages application UI state and user preferences
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type Theme = 'green' | 'amber' | 'blue';
export type ViewMode = 'list' | 'grid' | 'table';
export type PanelLayout = 'horizontal' | 'vertical';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
}

export interface UIState {
  // Theme and appearance
  theme: Theme;
  isDarkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  
  // Layout preferences
  viewMode: ViewMode;
  panelLayout: PanelLayout;
  sidebarCollapsed: boolean;
  showAnalyticsPanel: boolean;
  showMessageDetails: boolean;
  
  // Terminal styling
  terminalOpacity: number;
  showASCIIBorders: boolean;
  enableAnimations: boolean;
  
  // Application state
  isFullscreen: boolean;
  activeModule: 'service-bus' | 'chirpstack';
  currentView: string;
  
  // Notifications
  notifications: Notification[];
  maxNotifications: number;
  
  // Modal and dialog state
  activeModal: string | null;
  modalData: Record<string, unknown>;
  
  // Loading and error states
  globalLoading: boolean;
  globalError: string | null;
  
  // User preferences
  autoRefresh: boolean;
  refreshInterval: number;
  enableNotifications: boolean;
  enableSounds: boolean;
  
  // Actions - Theme and appearance
  setTheme: (theme: Theme) => void;
  setDarkMode: (isDark: boolean) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  
  // Actions - Layout
  setViewMode: (mode: ViewMode) => void;
  setPanelLayout: (layout: PanelLayout) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleAnalyticsPanel: () => void;
  setShowAnalyticsPanel: (show: boolean) => void;
  toggleMessageDetails: () => void;
  setShowMessageDetails: (show: boolean) => void;
  
  // Actions - Terminal styling
  setTerminalOpacity: (opacity: number) => void;
  setShowASCIIBorders: (show: boolean) => void;
  setEnableAnimations: (enable: boolean) => void;
  
  // Actions - Application state
  setFullscreen: (fullscreen: boolean) => void;
  setActiveModule: (module: 'service-bus' | 'chirpstack') => void;
  setCurrentView: (view: string) => void;
  
  // Actions - Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  markNotificationAsRead: (id: string) => void;
  
  // Actions - Modal and dialog
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  setModalData: (data: Record<string, unknown>) => void;
  
  // Actions - Loading and error states
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  
  // Actions - User preferences
  setAutoRefresh: (autoRefresh: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  setEnableNotifications: (enable: boolean) => void;
  setEnableSounds: (enable: boolean) => void;
  
  // Utility functions
  getUnreadNotificationsCount: () => number;
  getThemeClasses: () => string;
  resetUIState: () => void;
}

const initialState = {
  theme: 'green' as Theme,
  isDarkMode: true,
  fontSize: 'medium' as const,
  viewMode: 'table' as ViewMode,
  panelLayout: 'horizontal' as PanelLayout,
  sidebarCollapsed: false,
  showAnalyticsPanel: true,
  showMessageDetails: false,
  terminalOpacity: 0.95,
  showASCIIBorders: true,
  enableAnimations: true,
  isFullscreen: false,
  activeModule: 'service-bus' as const,
  currentView: 'messages',
  notifications: [],
  maxNotifications: 10,
  activeModal: null,
  modalData: {},
  globalLoading: false,
  globalError: null,
  autoRefresh: true,
  refreshInterval: 30000,
  enableNotifications: true,
  enableSounds: false,
};

export const useUIStore = create<UIState>()(
  persist(
    immer((set, get) => ({
      ...initialState,
      
      // Theme and appearance
      setTheme: (theme) =>
        set((state) => {
          state.theme = theme;
        }),
      
      setDarkMode: (isDark) =>
        set((state) => {
          state.isDarkMode = isDark;
        }),
      
      setFontSize: (size) =>
        set((state) => {
          state.fontSize = size;
        }),
      
      // Layout management
      setViewMode: (mode) =>
        set((state) => {
          state.viewMode = mode;
        }),
      
      setPanelLayout: (layout) =>
        set((state) => {
          state.panelLayout = layout;
        }),
      
      toggleSidebar: () =>
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        }),
      
      setSidebarCollapsed: (collapsed) =>
        set((state) => {
          state.sidebarCollapsed = collapsed;
        }),
      
      toggleAnalyticsPanel: () =>
        set((state) => {
          state.showAnalyticsPanel = !state.showAnalyticsPanel;
        }),
      
      setShowAnalyticsPanel: (show) =>
        set((state) => {
          state.showAnalyticsPanel = show;
        }),
      
      toggleMessageDetails: () =>
        set((state) => {
          state.showMessageDetails = !state.showMessageDetails;
        }),
      
      setShowMessageDetails: (show) =>
        set((state) => {
          state.showMessageDetails = show;
        }),
      
      // Terminal styling
      setTerminalOpacity: (opacity) =>
        set((state) => {
          state.terminalOpacity = Math.max(0.1, Math.min(1, opacity));
        }),
      
      setShowASCIIBorders: (show) =>
        set((state) => {
          state.showASCIIBorders = show;
        }),
      
      setEnableAnimations: (enable) =>
        set((state) => {
          state.enableAnimations = enable;
        }),
      
      // Application state
      setFullscreen: (fullscreen) =>
        set((state) => {
          state.isFullscreen = fullscreen;
        }),
      
      setActiveModule: (module) =>
        set((state) => {
          state.activeModule = module;
        }),
      
      setCurrentView: (view) =>
        set((state) => {
          state.currentView = view;
        }),
      
      // Notification management
      addNotification: (notification) =>
        set((state) => {
          const newNotification: Notification = {
            ...notification,
            id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
          };
          
          state.notifications.unshift(newNotification);
          
          // Limit number of notifications
          if (state.notifications.length > state.maxNotifications) {
            state.notifications = state.notifications.slice(0, state.maxNotifications);
          }
        }),
      
      removeNotification: (id) =>
        set((state) => {
          state.notifications = state.notifications.filter(n => n.id !== id);
        }),
      
      clearNotifications: () =>
        set((state) => {
          state.notifications = [];
        }),
      
      markNotificationAsRead: (id) =>
        set((state) => {
          const notification = state.notifications.find(n => n.id === id);
          if (notification) {
            // In a real implementation, you might add a 'read' property
            // For now, we'll just remove it
            state.notifications = state.notifications.filter(n => n.id !== id);
          }
        }),
      
      // Modal and dialog management
      openModal: (modalId, data = {}) =>
        set((state) => {
          state.activeModal = modalId;
          state.modalData = data;
        }),
      
      closeModal: () =>
        set((state) => {
          state.activeModal = null;
          state.modalData = {};
        }),
      
      setModalData: (data) =>
        set((state) => {
          state.modalData = { ...state.modalData, ...data };
        }),
      
      // Loading and error states
      setGlobalLoading: (loading) =>
        set((state) => {
          state.globalLoading = loading;
        }),
      
      setGlobalError: (error) =>
        set((state) => {
          state.globalError = error;
        }),
      
      // User preferences
      setAutoRefresh: (autoRefresh) =>
        set((state) => {
          state.autoRefresh = autoRefresh;
        }),
      
      setRefreshInterval: (interval) =>
        set((state) => {
          state.refreshInterval = Math.max(5000, interval); // Minimum 5 seconds
        }),
      
      setEnableNotifications: (enable) =>
        set((state) => {
          state.enableNotifications = enable;
        }),
      
      setEnableSounds: (enable) =>
        set((state) => {
          state.enableSounds = enable;
        }),
      
      // Utility functions
      getUnreadNotificationsCount: () => {
        const state = get();
        return state.notifications.length; // All notifications are considered unread until removed
      },
      
      getThemeClasses: () => {
        const state = get();
        const themeClasses = {
          green: 'theme-green',
          amber: 'theme-amber',
          blue: 'theme-blue',
        };
        
        return [
          themeClasses[state.theme],
          state.isDarkMode ? 'dark' : 'light',
          `font-${state.fontSize}`,
          state.showASCIIBorders ? 'ascii-borders' : '',
          state.enableAnimations ? 'animations-enabled' : 'animations-disabled',
        ].filter(Boolean).join(' ');
      },
      
      resetUIState: () =>
        set((state) => {
          Object.assign(state, initialState);
        }),
    })),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        isDarkMode: state.isDarkMode,
        fontSize: state.fontSize,
        viewMode: state.viewMode,
        panelLayout: state.panelLayout,
        sidebarCollapsed: state.sidebarCollapsed,
        showAnalyticsPanel: state.showAnalyticsPanel,
        terminalOpacity: state.terminalOpacity,
        showASCIIBorders: state.showASCIIBorders,
        enableAnimations: state.enableAnimations,
        autoRefresh: state.autoRefresh,
        refreshInterval: state.refreshInterval,
        enableNotifications: state.enableNotifications,
        enableSounds: state.enableSounds,
      }),
    }
  )
);

// Selectors for common use cases
export const useTheme = () => useUIStore(state => ({
  theme: state.theme,
  isDarkMode: state.isDarkMode,
  themeClasses: state.getThemeClasses(),
}));

export const useLayout = () => useUIStore(state => ({
  viewMode: state.viewMode,
  panelLayout: state.panelLayout,
  sidebarCollapsed: state.sidebarCollapsed,
  showAnalyticsPanel: state.showAnalyticsPanel,
  showMessageDetails: state.showMessageDetails,
}));

export const useNotifications = () => useUIStore(state => ({
  notifications: state.notifications,
  unreadCount: state.getUnreadNotificationsCount(),
}));

export const useModal = () => useUIStore(state => ({
  activeModal: state.activeModal,
  modalData: state.modalData,
}));

export const useGlobalState = () => useUIStore(state => ({
  globalLoading: state.globalLoading,
  globalError: state.globalError,
  activeModule: state.activeModule,
  currentView: state.currentView,
}));