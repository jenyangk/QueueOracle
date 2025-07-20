import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';

export interface WebVitalsMetrics {
  cls: number | null;
  inp: number | null;
  fcp: number | null;
  lcp: number | null;
  ttfb: number | null;
  timestamp: number;
}

export interface PerformanceReport {
  metrics: WebVitalsMetrics;
  userAgent: string;
  url: string;
  timestamp: number;
  sessionId: string;
}

export class WebVitalsService {
  private metrics: WebVitalsMetrics = {
    cls: null,
    inp: null,
    fcp: null,
    lcp: null,
    ttfb: null,
    timestamp: Date.now()
  };

  private listeners: Array<(metrics: WebVitalsMetrics) => void> = [];
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeTracking();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeTracking(): void {
    // Track Core Web Vitals
    onCLS(this.handleMetric.bind(this, 'cls'));
    onINP(this.handleMetric.bind(this, 'inp'));
    onFCP(this.handleMetric.bind(this, 'fcp'));
    onLCP(this.handleMetric.bind(this, 'lcp'));
    onTTFB(this.handleMetric.bind(this, 'ttfb'));
  }

  private handleMetric(metricName: keyof WebVitalsMetrics, metric: Metric): void {
    this.metrics[metricName] = metric.value;
    this.metrics.timestamp = Date.now();
    
    // Notify listeners
    this.listeners.forEach(listener => listener(this.metrics));
    
    // Store in localStorage for persistence
    this.storeMetrics();
  }

  private storeMetrics(): void {
    try {
      const report: PerformanceReport = {
        metrics: this.metrics,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: Date.now(),
        sessionId: this.sessionId
      };
      
      const existingReports = this.getStoredReports();
      existingReports.push(report);
      
      // Keep only last 50 reports
      const recentReports = existingReports.slice(-50);
      localStorage.setItem('web-vitals-reports', JSON.stringify(recentReports));
    } catch (error) {
      console.warn('Failed to store Web Vitals metrics:', error);
    }
  }

  public getStoredReports(): PerformanceReport[] {
    try {
      const stored = localStorage.getItem('web-vitals-reports');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to retrieve stored Web Vitals reports:', error);
      return [];
    }
  }

  public storeReport(report: any): void {
    try {
      const existingReports = this.getStoredReports();
      existingReports.unshift(report);
      
      // Keep only last 50 reports
      const recentReports = existingReports.slice(0, 50);
      localStorage.setItem('web-vitals-reports', JSON.stringify(recentReports));
    } catch (error) {
      console.warn('Failed to store Web Vitals report:', error);
    }
  }

  public getCurrentMetrics(): WebVitalsMetrics {
    return { ...this.metrics };
  }

  public onMetricsUpdate(callback: (metrics: WebVitalsMetrics) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public getPerformanceScore(): number {
    const { cls, inp, fcp, lcp, ttfb } = this.metrics;
    
    if (!cls || !inp || !fcp || !lcp || !ttfb) {
      return 0;
    }

    // Scoring based on Google's thresholds
    let score = 0;
    
    // CLS (good: < 0.1, needs improvement: 0.1-0.25, poor: > 0.25)
    if (cls < 0.1) score += 20;
    else if (cls < 0.25) score += 10;
    
    // INP (good: < 200ms, needs improvement: 200-500ms, poor: > 500ms)
    if (inp < 200) score += 20;
    else if (inp < 500) score += 10;
    
    // FCP (good: < 1.8s, needs improvement: 1.8-3s, poor: > 3s)
    if (fcp < 1800) score += 20;
    else if (fcp < 3000) score += 10;
    
    // LCP (good: < 2.5s, needs improvement: 2.5-4s, poor: > 4s)
    if (lcp < 2500) score += 20;
    else if (lcp < 4000) score += 10;
    
    // TTFB (good: < 800ms, needs improvement: 800-1800ms, poor: > 1800ms)
    if (ttfb < 800) score += 20;
    else if (ttfb < 1800) score += 10;
    
    return score;
  }

  public exportReport(): string {
    const reports = this.getStoredReports();
    const summary = {
      totalReports: reports.length,
      averageScore: reports.reduce((sum, report) => {
        const service = new WebVitalsService();
        service.metrics = report.metrics;
        return sum + service.getPerformanceScore();
      }, 0) / reports.length,
      reports
    };
    
    return JSON.stringify(summary, null, 2);
  }
}

export const webVitalsService = new WebVitalsService();