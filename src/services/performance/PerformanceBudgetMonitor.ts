export interface PerformanceBudget {
  name: string;
  metric: 'bundle-size' | 'memory-usage' | 'load-time' | 'fcp' | 'lcp' | 'cls' | 'fid' | 'ttfb';
  warning: number;
  error: number;
  unit: 'bytes' | 'ms' | 'score' | 'percentage';
  enabled: boolean;
}

export interface BudgetViolation {
  budget: PerformanceBudget;
  currentValue: number;
  severity: 'warning' | 'error';
  timestamp: number;
  message: string;
}

export interface BudgetReport {
  timestamp: number;
  violations: BudgetViolation[];
  passedBudgets: PerformanceBudget[];
  overallStatus: 'pass' | 'warning' | 'error';
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
  };
}

class PerformanceBudgetMonitor {
  private budgets: PerformanceBudget[] = [];
  private violations: BudgetViolation[] = [];
  private listeners: Array<(violation: BudgetViolation) => void> = [];
  private reportListeners: Array<(report: BudgetReport) => void> = [];

  constructor() {
    this.initializeDefaultBudgets();
  }

  private initializeDefaultBudgets(): void {
    this.budgets = [
      {
        name: 'Bundle Size',
        metric: 'bundle-size',
        warning: 500 * 1024, // 500KB
        error: 1024 * 1024,  // 1MB
        unit: 'bytes',
        enabled: true
      },
      {
        name: 'Memory Usage',
        metric: 'memory-usage',
        warning: 50 * 1024 * 1024, // 50MB
        error: 100 * 1024 * 1024,  // 100MB
        unit: 'bytes',
        enabled: true
      },
      {
        name: 'First Contentful Paint',
        metric: 'fcp',
        warning: 1800, // 1.8s
        error: 3000,   // 3s
        unit: 'ms',
        enabled: true
      },
      {
        name: 'Largest Contentful Paint',
        metric: 'lcp',
        warning: 2500, // 2.5s
        error: 4000,   // 4s
        unit: 'ms',
        enabled: true
      },
      {
        name: 'Cumulative Layout Shift',
        metric: 'cls',
        warning: 0.1,
        error: 0.25,
        unit: 'score',
        enabled: true
      },
      {
        name: 'First Input Delay',
        metric: 'fid',
        warning: 100, // 100ms
        error: 300,   // 300ms
        unit: 'ms',
        enabled: true
      },
      {
        name: 'Time to First Byte',
        metric: 'ttfb',
        warning: 800,  // 800ms
        error: 1800,   // 1.8s
        unit: 'ms',
        enabled: true
      }
    ];
  }

  public setBudgets(budgets: PerformanceBudget[]): void {
    this.budgets = budgets;
  }

  public addBudget(budget: PerformanceBudget): void {
    const existingIndex = this.budgets.findIndex(b => b.name === budget.name);
    if (existingIndex >= 0) {
      this.budgets[existingIndex] = budget;
    } else {
      this.budgets.push(budget);
    }
  }

  public removeBudget(name: string): void {
    this.budgets = this.budgets.filter(b => b.name !== name);
  }

  public getBudgets(): PerformanceBudget[] {
    return [...this.budgets];
  }

  public checkBudget(metric: string, value: number): BudgetViolation | null {
    const budget = this.budgets.find(b => b.metric === metric && b.enabled);
    if (!budget) return null;

    let severity: 'warning' | 'error' | null = null;
    let message = '';

    if (value > budget.error) {
      severity = 'error';
      message = `${budget.name} (${this.formatValue(value, budget.unit)}) exceeds error threshold (${this.formatValue(budget.error, budget.unit)})`;
    } else if (value > budget.warning) {
      severity = 'warning';
      message = `${budget.name} (${this.formatValue(value, budget.unit)}) exceeds warning threshold (${this.formatValue(budget.warning, budget.unit)})`;
    }

    if (severity) {
      const violation: BudgetViolation = {
        budget,
        currentValue: value,
        severity,
        timestamp: Date.now(),
        message
      };

      this.violations.push(violation);
      this.notifyViolation(violation);
      
      return violation;
    }

    return null;
  }

  public checkMultipleMetrics(metrics: Record<string, number>): BudgetViolation[] {
    const violations: BudgetViolation[] = [];

    for (const [metric, value] of Object.entries(metrics)) {
      const violation = this.checkBudget(metric, value);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  public generateReport(): BudgetReport {
    const enabledBudgets = this.budgets.filter(b => b.enabled);
    const recentViolations = this.violations.filter(
      v => Date.now() - v.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    const violatedBudgetNames = new Set(recentViolations.map(v => v.budget.name));
    const passedBudgets = enabledBudgets.filter(b => !violatedBudgetNames.has(b.name));

    const warnings = recentViolations.filter(v => v.severity === 'warning').length;
    const errors = recentViolations.filter(v => v.severity === 'error').length;

    let overallStatus: 'pass' | 'warning' | 'error' = 'pass';
    if (errors > 0) {
      overallStatus = 'error';
    } else if (warnings > 0) {
      overallStatus = 'warning';
    }

    const report: BudgetReport = {
      timestamp: Date.now(),
      violations: recentViolations,
      passedBudgets,
      overallStatus,
      summary: {
        total: enabledBudgets.length,
        passed: passedBudgets.length,
        warnings,
        errors
      }
    };

    this.notifyReport(report);
    return report;
  }

  private formatValue(value: number, unit: string): string {
    switch (unit) {
      case 'bytes':
        return this.formatBytes(value);
      case 'ms':
        return `${value.toFixed(1)}ms`;
      case 'score':
        return value.toFixed(3);
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      default:
        return value.toString();
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public onViolation(callback: (violation: BudgetViolation) => void): () => void {
    this.listeners.push(callback);
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public onReport(callback: (report: BudgetReport) => void): () => void {
    this.reportListeners.push(callback);
    
    return () => {
      const index = this.reportListeners.indexOf(callback);
      if (index > -1) {
        this.reportListeners.splice(index, 1);
      }
    };
  }

  private notifyViolation(violation: BudgetViolation): void {
    this.listeners.forEach(listener => listener(violation));
  }

  private notifyReport(report: BudgetReport): void {
    this.reportListeners.forEach(listener => listener(report));
  }

  public getViolations(timeRange?: { start: number; end: number }): BudgetViolation[] {
    let violations = [...this.violations];

    if (timeRange) {
      violations = violations.filter(
        v => v.timestamp >= timeRange.start && v.timestamp <= timeRange.end
      );
    }

    return violations;
  }

  public getViolationsByMetric(metric: string): BudgetViolation[] {
    return this.violations.filter(v => v.budget.metric === metric);
  }

  public getViolationsBySeverity(severity: 'warning' | 'error'): BudgetViolation[] {
    return this.violations.filter(v => v.severity === severity);
  }

  public clearViolations(): void {
    this.violations = [];
  }

  public exportBudgetConfig(): string {
    return JSON.stringify({
      budgets: this.budgets,
      timestamp: Date.now()
    }, null, 2);
  }

  public importBudgetConfig(config: string): void {
    try {
      const parsed = JSON.parse(config);
      if (parsed.budgets && Array.isArray(parsed.budgets)) {
        this.budgets = parsed.budgets;
      }
    } catch {
      throw new Error('Invalid budget configuration format');
    }
  }

  public getBudgetTrends(metric: string, days = 7): {
    dates: string[];
    violations: number[];
    averageValues: number[];
  } {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    const dates: string[] = [];
    const violations: number[] = [];
    const averageValues: number[] = [];

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      dates.push(dateStr);

      const dayStart = new Date(d).setHours(0, 0, 0, 0);
      const dayEnd = new Date(d).setHours(23, 59, 59, 999);

      const dayViolations = this.violations.filter(
        v => v.budget.metric === metric && 
             v.timestamp >= dayStart && 
             v.timestamp <= dayEnd
      );

      violations.push(dayViolations.length);

      const avgValue = dayViolations.length > 0
        ? dayViolations.reduce((sum, v) => sum + v.currentValue, 0) / dayViolations.length
        : 0;
      
      averageValues.push(avgValue);
    }

    return { dates, violations, averageValues };
  }

  // Automatic monitoring integration
  public startAutomaticMonitoring(intervalMs = 60000): () => void { // 1 minute default
    const intervalId = setInterval(() => {
      this.performAutomaticChecks();
    }, intervalMs);

    // Initial check
    this.performAutomaticChecks();

    return () => clearInterval(intervalId);
  }

  private performAutomaticChecks(): void {
    // Check memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.checkBudget('memory-usage', memory.usedJSHeapSize);
    }

    // Check bundle size (approximate from loaded resources)
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const totalSize = resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0);
    this.checkBudget('bundle-size', totalSize);
  }
}

export const performanceBudgetMonitor = new PerformanceBudgetMonitor();