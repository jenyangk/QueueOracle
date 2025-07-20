import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePerformanceMonitoring } from '../usePerformanceMonitoring';

// Mock web-vitals first
vi.mock('web-vitals', () => ({
  getCLS: vi.fn(),
  getFID: vi.fn(),
  getFCP: vi.fn(),
  getLCP: vi.fn(),
  getTTFB: vi.fn()
}));

// Mock the performance services
vi.mock('../../services/performance/WebVitalsService', () => ({
  webVitalsService: {
    getCurrentMetrics: vi.fn(() => ({
      cls: null,
      fid: null,
      fcp: null,
      lcp: null,
      ttfb: null,
      timestamp: Date.now()
    })),
    onMetricsUpdate: vi.fn(() => vi.fn()),
    getPerformanceScore: vi.fn(() => 0),
    getStoredReports: vi.fn(() => [])
  }
}));

vi.mock('../../services/performance/MemoryMonitorService', () => ({
  memoryMonitorService: {
    getCurrentUsage: vi.fn(() => null),
    onMemoryUpdate: vi.fn(() => vi.fn()),
    onMemoryAlert: vi.fn(() => vi.fn()),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    getMemoryStats: vi.fn(() => ({
      current: null,
      average: 0,
      peak: 0,
      trend: 'stable'
    })),
    getMemoryHistory: vi.fn(() => []),
    triggerGarbageCollection: vi.fn()
  }
}));

vi.mock('../../services/performance/PerformanceProfiler', () => ({
  performanceProfiler: {
    getActiveProfiles: vi.fn(() => []),
    startProfile: vi.fn(() => 'test-profile-id'),
    endProfile: vi.fn(() => null),
    mark: vi.fn(),
    measure: vi.fn(),
    getCompletedProfiles: vi.fn(() => []),
    getPerformanceInsights: vi.fn(() => ({
      slowestProfiles: [],
      averageDurations: {},
      totalProfiles: 0,
      activeProfiles: 0
    }))
  }
}));

vi.mock('../../services/performance/BundleAnalyzer', () => ({
  bundleAnalyzer: {
    analyzeCurrentBundle: vi.fn(() => ({
      totalSize: 1000,
      gzippedSize: 500,
      chunks: [],
      assets: [],
      modules: [],
      timestamp: Date.now()
    })),
    checkBudgets: vi.fn(() => []),
    generateOptimizationSuggestions: vi.fn(() => [])
  }
}));

describe('usePerformanceMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => usePerformanceMonitoring());

    expect(result.current.webVitals).toBeDefined();
    expect(result.current.memoryUsage).toBeNull();
    expect(result.current.memoryAlerts).toEqual([]);
    expect(result.current.activeProfiles).toEqual([]);
    expect(result.current.bundleStats).toBeDefined();
    expect(result.current.budgetResults).toEqual([]);
    expect(result.current.isMonitoring).toBe(true);
  });

  it('should provide performance monitoring actions', () => {
    const { result } = renderHook(() => usePerformanceMonitoring());

    expect(typeof result.current.startMonitoring).toBe('function');
    expect(typeof result.current.stopMonitoring).toBe('function');
    expect(typeof result.current.startProfile).toBe('function');
    expect(typeof result.current.endProfile).toBe('function');
    expect(typeof result.current.markProfile).toBe('function');
    expect(typeof result.current.measureProfile).toBe('function');
    expect(typeof result.current.analyzeBundleSize).toBe('function');
    expect(typeof result.current.exportReport).toBe('function');
    expect(typeof result.current.clearAlerts).toBe('function');
    expect(typeof result.current.triggerGarbageCollection).toBe('function');
  });

  it('should start and stop monitoring', () => {
    const { result } = renderHook(() => usePerformanceMonitoring());

    act(() => {
      result.current.stopMonitoring();
    });

    expect(result.current.isMonitoring).toBe(false);

    act(() => {
      result.current.startMonitoring();
    });

    expect(result.current.isMonitoring).toBe(true);
  });

  it('should handle profile operations', () => {
    const { result } = renderHook(() => usePerformanceMonitoring());

    let profileId: string;

    act(() => {
      profileId = result.current.startProfile('test-profile', { test: true });
    });

    expect(profileId).toBe('test-profile-id');

    act(() => {
      result.current.markProfile(profileId, 'test-mark', { mark: true });
    });

    act(() => {
      result.current.measureProfile(profileId, 'test-measure', 'start', 'end');
    });

    act(() => {
      const profile = result.current.endProfile(profileId);
      expect(profile).toBeNull(); // Mocked to return null
    });
  });

  it('should clear memory alerts', () => {
    const { result } = renderHook(() => usePerformanceMonitoring());

    // Simulate having alerts
    act(() => {
      // This would normally be triggered by the memory monitor
      // but we'll simulate it by directly modifying state
      result.current.clearAlerts();
    });

    expect(result.current.memoryAlerts).toEqual([]);
  });

  it('should export performance report', () => {
    const { result } = renderHook(() => usePerformanceMonitoring());

    act(() => {
      const report = result.current.exportReport();
      expect(typeof report).toBe('string');
      
      const parsed = JSON.parse(report);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('webVitals');
      expect(parsed).toHaveProperty('memory');
      expect(parsed).toHaveProperty('profiling');
      expect(parsed).toHaveProperty('bundle');
      expect(parsed).toHaveProperty('browserInfo');
    });
  });

  it('should trigger garbage collection', () => {
    const { result } = renderHook(() => usePerformanceMonitoring());

    act(() => {
      result.current.triggerGarbageCollection();
    });

    // The function should execute without errors
    expect(typeof result.current.triggerGarbageCollection).toBe('function');
  });

  it('should analyze bundle size', () => {
    const { result } = renderHook(() => usePerformanceMonitoring());

    act(() => {
      result.current.analyzeBundleSize();
    });

    expect(result.current.bundleStats).toBeDefined();
    expect(result.current.bundleStats?.totalSize).toBe(1000);
  });
});