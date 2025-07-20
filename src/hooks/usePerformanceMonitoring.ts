import { useEffect, useState, useCallback } from 'react';
import { webVitalsService, type WebVitalsMetrics } from '../services/performance/WebVitalsService';
import { memoryMonitorService, type MemoryUsage, type MemoryAlert } from '../services/performance/MemoryMonitorService';
import { performanceProfiler, type PerformanceProfile } from '../services/performance/PerformanceProfiler';
import { bundleAnalyzer, type BundleStats, type BudgetResult } from '../services/performance/BundleAnalyzer';

export interface PerformanceMonitoringState {
  webVitals: WebVitalsMetrics;
  memoryUsage: MemoryUsage | null;
  memoryAlerts: MemoryAlert[];
  activeProfiles: PerformanceProfile[];
  bundleStats: BundleStats | null;
  budgetResults: BudgetResult[];
  isMonitoring: boolean;
}

export interface PerformanceMonitoringActions {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  startProfile: (name: string, metadata?: Record<string, unknown>) => string;
  endProfile: (profileId: string) => PerformanceProfile | null;
  markProfile: (profileId: string, markName: string, metadata?: Record<string, unknown>) => void;
  measureProfile: (profileId: string, measureName: string, startMark: string, endMark: string) => void;
  analyzeBundleSize: () => void;
  exportReport: () => string;
  clearAlerts: () => void;
  triggerGarbageCollection: () => void;
}

export function usePerformanceMonitoring(): PerformanceMonitoringState & PerformanceMonitoringActions {
  const [state, setState] = useState<PerformanceMonitoringState>({
    webVitals: webVitalsService.getCurrentMetrics(),
    memoryUsage: memoryMonitorService.getCurrentUsage(),
    memoryAlerts: [],
    activeProfiles: [],
    bundleStats: null,
    budgetResults: [],
    isMonitoring: false
  });

  const updateWebVitals = useCallback((metrics: WebVitalsMetrics) => {
    setState(prev => ({ ...prev, webVitals: metrics }));
  }, []);

  const updateMemoryUsage = useCallback((usage: MemoryUsage) => {
    setState(prev => ({ ...prev, memoryUsage: usage }));
  }, []);

  const handleMemoryAlert = useCallback((alert: MemoryAlert) => {
    setState(prev => ({
      ...prev,
      memoryAlerts: [...prev.memoryAlerts, alert].slice(-10) // Keep last 10 alerts
    }));
  }, []);

  const startMonitoring = useCallback(() => {
    if (state.isMonitoring) return;

    // Start memory monitoring
    memoryMonitorService.startMonitoring(5000); // Every 5 seconds

    setState(prev => ({ ...prev, isMonitoring: true }));
  }, [state.isMonitoring]);

  const stopMonitoring = useCallback(() => {
    if (!state.isMonitoring) return;

    memoryMonitorService.stopMonitoring();
    setState(prev => ({ ...prev, isMonitoring: false }));
  }, [state.isMonitoring]);

  const startProfile = useCallback((name: string, metadata: Record<string, unknown> = {}) => {
    const profileId = performanceProfiler.startProfile(name, metadata);
    setState(prev => ({
      ...prev,
      activeProfiles: performanceProfiler.getActiveProfiles()
    }));
    return profileId;
  }, []);

  const endProfile = useCallback((profileId: string) => {
    const profile = performanceProfiler.endProfile(profileId);
    setState(prev => ({
      ...prev,
      activeProfiles: performanceProfiler.getActiveProfiles()
    }));
    return profile;
  }, []);

  const markProfile = useCallback((profileId: string, markName: string, metadata: Record<string, unknown> = {}) => {
    performanceProfiler.mark(profileId, markName, metadata);
  }, []);

  const measureProfile = useCallback((profileId: string, measureName: string, startMark: string, endMark: string) => {
    performanceProfiler.measure(profileId, measureName, startMark, endMark);
  }, []);

  const analyzeBundleSize = useCallback(() => {
    const stats = bundleAnalyzer.analyzeCurrentBundle();
    const budgetResults = bundleAnalyzer.checkBudgets(stats);
    
    setState(prev => ({
      ...prev,
      bundleStats: stats,
      budgetResults
    }));
  }, []);

  const exportReport = useCallback(() => {
    const report = {
      timestamp: Date.now(),
      webVitals: {
        current: state.webVitals,
        score: webVitalsService.getPerformanceScore(),
        reports: webVitalsService.getStoredReports()
      },
      memory: {
        current: state.memoryUsage,
        stats: memoryMonitorService.getMemoryStats(),
        history: memoryMonitorService.getMemoryHistory(),
        alerts: state.memoryAlerts
      },
      profiling: {
        activeProfiles: state.activeProfiles,
        completedProfiles: performanceProfiler.getCompletedProfiles(),
        insights: performanceProfiler.getPerformanceInsights()
      },
      bundle: {
        stats: state.bundleStats,
        budgetResults: state.budgetResults,
        suggestions: state.bundleStats ? bundleAnalyzer.generateOptimizationSuggestions(state.bundleStats) : []
      },
      browserInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        connection: (navigator as any).connection ? {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt
        } : null
      }
    };

    return JSON.stringify(report, null, 2);
  }, [state]);

  const clearAlerts = useCallback(() => {
    setState(prev => ({ ...prev, memoryAlerts: [] }));
  }, []);

  const triggerGarbageCollection = useCallback(() => {
    memoryMonitorService.triggerGarbageCollection();
  }, []);

  // Set up event listeners
  useEffect(() => {
    const unsubscribeWebVitals = webVitalsService.onMetricsUpdate(updateWebVitals);
    const unsubscribeMemory = memoryMonitorService.onMemoryUpdate(updateMemoryUsage);
    const unsubscribeAlerts = memoryMonitorService.onMemoryAlert(handleMemoryAlert);

    return () => {
      unsubscribeWebVitals();
      unsubscribeMemory();
      unsubscribeAlerts();
    };
  }, [updateWebVitals, updateMemoryUsage, handleMemoryAlert]);

  // Auto-start monitoring on mount
  useEffect(() => {
    startMonitoring();
    analyzeBundleSize();

    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, analyzeBundleSize, stopMonitoring]);

  // Update active profiles periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        activeProfiles: performanceProfiler.getActiveProfiles()
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    startProfile,
    endProfile,
    markProfile,
    measureProfile,
    analyzeBundleSize,
    exportReport,
    clearAlerts,
    triggerGarbageCollection
  };
}