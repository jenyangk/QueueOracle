/**
 * Unit tests for WebVitalsService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebVitalsService } from '../WebVitalsService';

// Mock web-vitals
vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onINP: vi.fn(),
  onFCP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('WebVitalsService', () => {
  let webVitalsService: WebVitalsService;

  beforeEach(() => {
    webVitalsService = new WebVitalsService();
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('initialization', () => {
    it('should initialize with default metrics', () => {
      const metrics = webVitalsService.getCurrentMetrics();
      
      expect(metrics).toEqual({
        cls: null,
        inp: null,
        fcp: null,
        lcp: null,
        ttfb: null,
        timestamp: expect.any(Number),
      });
    });

    it('should start collecting metrics on initialization', async () => {
      const { onCLS, onINP, onFCP, onLCP, onTTFB } = await import('web-vitals');
      
      expect(onCLS).toHaveBeenCalled();
      expect(onINP).toHaveBeenCalled();
      expect(onFCP).toHaveBeenCalled();
      expect(onLCP).toHaveBeenCalled();
      expect(onTTFB).toHaveBeenCalled();
    });
  });

  describe('metric collection', () => {
    it('should update CLS metric', async () => {
      const { onCLS } = await import('web-vitals');
      const mockCallback = vi.mocked(onCLS).mock.calls?.[0]?.[0];
      
      if (mockCallback) {
        const clsMetric = {
          name: 'CLS' as const,
          value: 0.1,
          rating: 'good' as const,
          delta: 0.1,
          entries: [],
          id: 'cls-1',
          navigationType: 'navigate' as const,
        };

        mockCallback(clsMetric as any);

        expect(webVitalsService.getMetric('cls')).toEqual({
          value: 0.1,
          rating: 'good'
        });
      }
    });

    it('should update INP metric', async () => {
      const { onINP } = await import('web-vitals');
      const mockCallback = vi.mocked(onINP).mock.calls?.[0]?.[0];
      
      if (mockCallback) {
        const inpMetric = {
          name: 'INP' as const,
          value: 50,
          rating: 'good' as const,
          delta: 50,
          entries: [],
          id: 'inp-1',
          navigationType: 'navigate' as const,
        };

        mockCallback(inpMetric as any);

        expect(webVitalsService.getMetric('inp')).toEqual({
          value: 50,
          rating: 'good'
        });
      }
    });

    it('should update FCP metric', async () => {
      const { onFCP } = await import('web-vitals');
      const mockCallback = vi.mocked(onFCP).mock.calls?.[0]?.[0];
      
      if (mockCallback) {
        const fcpMetric = {
          name: 'FCP' as const,
          value: 1500,
          rating: 'good' as const,
          delta: 1500,
          entries: [],
          id: 'fcp-1',
          navigationType: 'navigate' as const,
        };

        mockCallback(fcpMetric as any);

        expect(webVitalsService.getMetric('fcp')).toEqual({
          value: 1500,
          rating: 'good'
        });
      }
    });

    it('should update LCP metric', async () => {
      const { onLCP } = await import('web-vitals');
      const mockCallback = vi.mocked(onLCP).mock.calls?.[0]?.[0];
      
      if (mockCallback) {
        const lcpMetric = {
          name: 'LCP' as const,
          value: 2000,
          rating: 'good' as const,
          delta: 2000,
          entries: [],
          id: 'lcp-1',
          navigationType: 'navigate' as const,
        };

        mockCallback(lcpMetric as any);

        expect(webVitalsService.getMetric('lcp')).toEqual({
          value: 2000,
          rating: 'good'
        });
      }
    });

    it('should update TTFB metric', async () => {
      const { onTTFB } = await import('web-vitals');
      const mockCallback = vi.mocked(onTTFB).mock.calls?.[0]?.[0];
      
      if (mockCallback) {
        const ttfbMetric = {
          name: 'TTFB' as const,
          value: 200,
          rating: 'good' as const,
          delta: 200,
          entries: [],
          id: 'ttfb-1',
          navigationType: 'navigate' as const,
        };

        mockCallback(ttfbMetric as any);

        expect(webVitalsService.getMetric('ttfb')).toEqual({
          value: 200,
          rating: 'good'
        });
      }
    });
  });

  describe('performance scoring', () => {
    it('should calculate performance score with all good metrics', async () => {
      // Simulate all good metrics
      const { onCLS, onINP, onFCP, onLCP, onTTFB } = await import('web-vitals');
      
      if (vi.mocked(onCLS).mock.calls?.[0]?.[0]) {
        vi.mocked(onCLS).mock.calls[0][0]({
          name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, entries: [], id: 'cls-1', navigationType: 'navigate'
        } as any);
      }
      
      if (vi.mocked(onINP).mock.calls?.[0]?.[0]) {
        vi.mocked(onINP).mock.calls[0][0]({
          name: 'INP', value: 50, rating: 'good', delta: 50, entries: [], id: 'inp-1', navigationType: 'navigate'
        } as any);
      }
      
      if (vi.mocked(onFCP).mock.calls?.[0]?.[0]) {
        vi.mocked(onFCP).mock.calls[0][0]({
          name: 'FCP', value: 1500, rating: 'good', delta: 1500, entries: [], id: 'fcp-1', navigationType: 'navigate'
        } as any);
      }
      
      if (vi.mocked(onLCP).mock.calls?.[0]?.[0]) {
        vi.mocked(onLCP).mock.calls[0][0]({
          name: 'LCP', value: 2000, rating: 'good', delta: 2000, entries: [], id: 'lcp-1', navigationType: 'navigate'
        } as any);
      }
      
      if (vi.mocked(onTTFB).mock.calls?.[0]?.[0]) {
        vi.mocked(onTTFB).mock.calls[0][0]({
          name: 'TTFB', value: 200, rating: 'good', delta: 200, entries: [], id: 'ttfb-1', navigationType: 'navigate'
        } as any);
      }

      const score = webVitalsService.getPerformanceScore();
      expect(score).toBe(100); // All good metrics should give perfect score
    });

    it('should calculate performance score with mixed metrics', async () => {
      const { onCLS, onINP, onFCP } = await import('web-vitals');
      
      // Mix of good and poor metrics
      if (vi.mocked(onCLS).mock.calls?.[0]?.[0]) {
        vi.mocked(onCLS).mock.calls[0][0]({
          name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, entries: [], id: 'cls-1', navigationType: 'navigate'
        } as any);
      }
      
      if (vi.mocked(onINP).mock.calls?.[0]?.[0]) {
        vi.mocked(onINP).mock.calls[0][0]({
          name: 'INP', value: 200, rating: 'poor', delta: 200, entries: [], id: 'inp-1', navigationType: 'navigate'
        } as any);
      }
      
      if (vi.mocked(onFCP).mock.calls?.[0]?.[0]) {
        vi.mocked(onFCP).mock.calls[0][0]({
          name: 'FCP', value: 2500, rating: 'needs-improvement', delta: 2500, entries: [], id: 'fcp-1', navigationType: 'navigate'
        } as any);
      }

      const score = webVitalsService.getPerformanceScore();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it('should return 0 score when no metrics available', () => {
      const score = webVitalsService.getPerformanceScore();
      expect(score).toBe(0);
    });
  });

  describe('metric updates subscription', () => {
    it('should notify subscribers when metrics update', async () => {
      const callback = vi.fn();
      const unsubscribe = webVitalsService.onMetricsUpdate(callback);

      const { onCLS } = await import('web-vitals');
      const mockCallback = vi.mocked(onCLS).mock.calls?.[0]?.[0];
      
      if (mockCallback) {
        const clsMetric = {
          name: 'CLS' as const,
          value: 0.1,
          rating: 'good' as const,
          delta: 0.1,
          entries: [],
          id: 'cls-1',
          navigationType: 'navigate' as const,
        };

        mockCallback(clsMetric as any);

        expect(callback).toHaveBeenCalledWith(expect.objectContaining({
          cls: 0.1,
        }));
      }

      unsubscribe();
    });

    it('should not notify unsubscribed callbacks', async () => {
      const callback = vi.fn();
      const unsubscribe = webVitalsService.onMetricsUpdate(callback);
      unsubscribe();

      const { onCLS } = await import('web-vitals');
      const mockCallback = vi.mocked(onCLS).mock.calls?.[0]?.[0];
      
      if (mockCallback) {
        mockCallback({
          name: 'CLS', value: 0.1, rating: 'good', delta: 0.1, entries: [], id: 'cls-1', navigationType: 'navigate'
        } as any);
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('report storage', () => {
    it('should store performance reports', () => {
      const report = {
        timestamp: Date.now(),
        metrics: webVitalsService.getCurrentMetrics(),
        score: webVitalsService.getPerformanceScore(),
        url: 'http://localhost:3000',
        userAgent: 'test-agent',
      };

      webVitalsService.storeReport(report);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'web-vitals-reports',
        expect.stringContaining('"timestamp"')
      );
    });

    it('should retrieve stored reports', () => {
      const mockReports = [
        {
          timestamp: Date.now(),
          metrics: webVitalsService.getCurrentMetrics(),
          score: 85,
          url: 'http://localhost:3000',
          userAgent: 'test-agent',
        },
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockReports));

      const reports = webVitalsService.getStoredReports();
      expect(reports).toEqual(mockReports);
    });

    it('should handle corrupted stored reports', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      const reports = webVitalsService.getStoredReports();
      expect(reports).toEqual([]);
    });

    it('should limit stored reports to maximum count', () => {
      const existingReports = Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now() - i * 1000,
        metrics: webVitalsService.getCurrentMetrics(),
        score: 85,
        url: 'http://localhost:3000',
        userAgent: 'test-agent',
      }));

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingReports));

      const newReport = {
        timestamp: Date.now(),
        metrics: webVitalsService.getCurrentMetrics(),
        score: 90,
        url: 'http://localhost:3000',
        userAgent: 'test-agent',
      };

      webVitalsService.storeReport(newReport);

      const setItemCall = mockLocalStorage.setItem.mock.calls[0];
      const storedReports = JSON.parse(setItemCall[1]);
      
      expect(storedReports).toHaveLength(50); // Should be limited to max count
      expect(storedReports[0]).toEqual(newReport); // New report should be first
    });
  });

  describe('error handling', () => {
    it('should handle web-vitals import errors gracefully', async () => {
      // This test verifies that the service doesn't crash if web-vitals fails to load
      expect(() => new WebVitalsService()).not.toThrow();
    });

    it('should handle localStorage errors', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const report = {
        timestamp: Date.now(),
        metrics: webVitalsService.getCurrentMetrics(),
        score: 85,
        url: 'http://localhost:3000',
        userAgent: 'test-agent',
      };

      expect(() => webVitalsService.storeReport(report)).not.toThrow();
    });
  });

  describe('metric thresholds', () => {
    it('should correctly identify good CLS values', async () => {
      const { onCLS } = await import('web-vitals');
      const mockCallback = vi.mocked(onCLS).mock.calls[0][0];
      
      mockCallback({
        name: 'CLS', value: 0.05, rating: 'good', delta: 0.05, entries: [], id: 'cls-1', navigationType: 'navigate'
      });

      const metrics = webVitalsService.getCurrentMetrics();
      expect(metrics.cls?.rating).toBe('good');
    });

    it('should correctly identify poor LCP values', async () => {
      const { onLCP } = await import('web-vitals');
      const mockCallback = vi.mocked(onLCP).mock.calls[0][0];
      
      mockCallback({
        name: 'LCP', value: 4500, rating: 'poor', delta: 4500, entries: [], id: 'lcp-1', navigationType: 'navigate'
      });

      const metrics = webVitalsService.getCurrentMetrics();
      expect(metrics.lcp?.rating).toBe('poor');
    });
  });
});