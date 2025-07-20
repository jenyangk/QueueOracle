export interface PerformanceBenchmark {
  name: string;
  operation: () => Promise<void> | void;
  expectedMaxDuration: number; // in milliseconds
  iterations: number;
  warmupIterations: number;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  standardDeviation: number;
  passed: boolean;
  expectedMaxDuration: number;
  timestamp: number;
}

export interface RegressionTestResult {
  benchmarks: BenchmarkResult[];
  overallPassed: boolean;
  totalDuration: number;
  timestamp: number;
  environment: {
    userAgent: string;
    platform: string;
    hardwareConcurrency: number;
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  };
}

class PerformanceRegressionTester {
  private benchmarks: PerformanceBenchmark[] = [];
  private results: RegressionTestResult[] = [];

  public addBenchmark(benchmark: PerformanceBenchmark): void {
    this.benchmarks.push(benchmark);
  }

  public removeBenchmark(name: string): void {
    this.benchmarks = this.benchmarks.filter(b => b.name !== name);
  }

  public getBenchmarks(): PerformanceBenchmark[] {
    return [...this.benchmarks];
  }

  public async runBenchmark(benchmark: PerformanceBenchmark): Promise<BenchmarkResult> {
    const durations: number[] = [];
    
    // Warmup iterations
    for (let i = 0; i < benchmark.warmupIterations; i++) {
      await this.executeOperation(benchmark.operation);
    }

    // Actual benchmark iterations
    for (let i = 0; i < benchmark.iterations; i++) {
      const startTime = performance.now();
      await this.executeOperation(benchmark.operation);
      const endTime = performance.now();
      durations.push(endTime - startTime);
    }

    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const averageDuration = totalDuration / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    // Calculate standard deviation
    const variance = durations.reduce((sum, duration) => {
      return sum + Math.pow(duration - averageDuration, 2);
    }, 0) / durations.length;
    const standardDeviation = Math.sqrt(variance);

    const passed = averageDuration <= benchmark.expectedMaxDuration;

    return {
      name: benchmark.name,
      iterations: benchmark.iterations,
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      standardDeviation,
      passed,
      expectedMaxDuration: benchmark.expectedMaxDuration,
      timestamp: Date.now()
    };
  }

  private async executeOperation(operation: () => Promise<void> | void): Promise<void> {
    const result = operation();
    if (result instanceof Promise) {
      await result;
    }
  }

  public async runAllBenchmarks(): Promise<RegressionTestResult> {
    const startTime = performance.now();
    const benchmarkResults: BenchmarkResult[] = [];

    for (const benchmark of this.benchmarks) {
      const result = await this.runBenchmark(benchmark);
      benchmarkResults.push(result);
    }

    const endTime = performance.now();
    const overallPassed = benchmarkResults.every(result => result.passed);

    const testResult: RegressionTestResult = {
      benchmarks: benchmarkResults,
      overallPassed,
      totalDuration: endTime - startTime,
      timestamp: Date.now(),
      environment: this.getEnvironmentInfo()
    };

    this.results.push(testResult);
    this.storeResults();

    return testResult;
  }

  private getEnvironmentInfo() {
    const env = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency
    };

    // Add memory info if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      (env as any).memory = {
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize
      };
    }

    return env;
  }

  private storeResults(): void {
    try {
      // Keep only last 20 test results
      const recentResults = this.results.slice(-20);
      localStorage.setItem('performance-regression-results', JSON.stringify(recentResults));
    } catch (error) {
      console.warn('Failed to store performance regression results:', error);
    }
  }

  public getStoredResults(): RegressionTestResult[] {
    try {
      const stored = localStorage.getItem('performance-regression-results');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to retrieve stored regression results:', error);
      return [];
    }
  }

  public getResults(): RegressionTestResult[] {
    return [...this.results];
  }

  public getLatestResult(): RegressionTestResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1]! : null;
  }

  public compareWithBaseline(baselineResult: RegressionTestResult, currentResult: RegressionTestResult): {
    regressions: Array<{
      benchmarkName: string;
      baselineAverage: number;
      currentAverage: number;
      percentageIncrease: number;
      isRegression: boolean;
    }>;
    improvements: Array<{
      benchmarkName: string;
      baselineAverage: number;
      currentAverage: number;
      percentageDecrease: number;
    }>;
  } {
    const regressions: any[] = [];
    const improvements: any[] = [];
    const regressionThreshold = 0.1; // 10% increase is considered a regression

    for (const currentBenchmark of currentResult.benchmarks) {
      const baselineBenchmark = baselineResult.benchmarks.find(
        b => b.name === currentBenchmark.name
      );

      if (!baselineBenchmark) continue;

      const percentageChange = (currentBenchmark.averageDuration - baselineBenchmark.averageDuration) / baselineBenchmark.averageDuration;

      if (percentageChange > regressionThreshold) {
        regressions.push({
          benchmarkName: currentBenchmark.name,
          baselineAverage: baselineBenchmark.averageDuration,
          currentAverage: currentBenchmark.averageDuration,
          percentageIncrease: percentageChange * 100,
          isRegression: true
        });
      } else if (percentageChange < -0.05) { // 5% improvement
        improvements.push({
          benchmarkName: currentBenchmark.name,
          baselineAverage: baselineBenchmark.averageDuration,
          currentAverage: currentBenchmark.averageDuration,
          percentageDecrease: Math.abs(percentageChange) * 100
        });
      }
    }

    return { regressions, improvements };
  }

  public generateReport(result: RegressionTestResult): string {
    const report = {
      summary: {
        timestamp: new Date(result.timestamp).toISOString(),
        overallPassed: result.overallPassed,
        totalBenchmarks: result.benchmarks.length,
        passedBenchmarks: result.benchmarks.filter(b => b.passed).length,
        failedBenchmarks: result.benchmarks.filter(b => !b.passed).length,
        totalDuration: `${result.totalDuration.toFixed(2)}ms`
      },
      environment: result.environment,
      benchmarks: result.benchmarks.map(benchmark => ({
        name: benchmark.name,
        passed: benchmark.passed,
        iterations: benchmark.iterations,
        averageDuration: `${benchmark.averageDuration.toFixed(2)}ms`,
        minDuration: `${benchmark.minDuration.toFixed(2)}ms`,
        maxDuration: `${benchmark.maxDuration.toFixed(2)}ms`,
        standardDeviation: `${benchmark.standardDeviation.toFixed(2)}ms`,
        expectedMaxDuration: `${benchmark.expectedMaxDuration}ms`,
        performanceRatio: (benchmark.averageDuration / benchmark.expectedMaxDuration).toFixed(2)
      })),
      failedBenchmarks: result.benchmarks
        .filter(b => !b.passed)
        .map(benchmark => ({
          name: benchmark.name,
          averageDuration: `${benchmark.averageDuration.toFixed(2)}ms`,
          expectedMaxDuration: `${benchmark.expectedMaxDuration}ms`,
          exceedsBy: `${(benchmark.averageDuration - benchmark.expectedMaxDuration).toFixed(2)}ms`,
          exceedsPercentage: `${((benchmark.averageDuration / benchmark.expectedMaxDuration - 1) * 100).toFixed(1)}%`
        }))
    };

    return JSON.stringify(report, null, 2);
  }

  public clearResults(): void {
    this.results = [];
    try {
      localStorage.removeItem('performance-regression-results');
    } catch (error) {
      console.warn('Failed to clear stored regression results:', error);
    }
  }

  // Predefined benchmarks for common operations
  public addCommonBenchmarks(): void {
    // JSON parsing benchmark
    this.addBenchmark({
      name: 'JSON Parsing Large Object',
      operation: () => {
        const largeObject = { data: new Array(1000).fill({ id: 1, name: 'test', values: [1, 2, 3, 4, 5] }) };
        const jsonString = JSON.stringify(largeObject);
        JSON.parse(jsonString);
      },
      expectedMaxDuration: 5, // 5ms
      iterations: 100,
      warmupIterations: 10
    });

    // Array operations benchmark
    this.addBenchmark({
      name: 'Array Operations',
      operation: () => {
        const arr = new Array(10000).fill(0).map((_, i) => i);
        arr.filter(x => x % 2 === 0).map(x => x * 2).reduce((sum, x) => sum + x, 0);
      },
      expectedMaxDuration: 10, // 10ms
      iterations: 50,
      warmupIterations: 5
    });

    // DOM manipulation benchmark
    this.addBenchmark({
      name: 'DOM Manipulation',
      operation: () => {
        const div = document.createElement('div');
        for (let i = 0; i < 100; i++) {
          const child = document.createElement('span');
          child.textContent = `Item ${i}`;
          div.appendChild(child);
        }
        div.remove();
      },
      expectedMaxDuration: 15, // 15ms
      iterations: 20,
      warmupIterations: 3
    });

    // Local storage benchmark
    this.addBenchmark({
      name: 'LocalStorage Operations',
      operation: () => {
        const data = { test: 'data', numbers: [1, 2, 3, 4, 5], nested: { value: 'test' } };
        localStorage.setItem('benchmark-test', JSON.stringify(data));
        const retrieved = localStorage.getItem('benchmark-test');
        if (retrieved) JSON.parse(retrieved);
        localStorage.removeItem('benchmark-test');
      },
      expectedMaxDuration: 2, // 2ms
      iterations: 100,
      warmupIterations: 10
    });
  }
}

export const performanceRegressionTester = new PerformanceRegressionTester();