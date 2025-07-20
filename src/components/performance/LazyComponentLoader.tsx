import React, { Suspense, lazy, useState, useEffect, useRef, type ComponentType, type ReactElement } from 'react';

export interface LazyLoadConfig {
  threshold?: number; // Intersection threshold (0-1)
  rootMargin?: string; // Root margin for intersection observer
  fallback?: ReactElement; // Loading fallback component
  errorFallback?: ComponentType<{ error: Error; retry: () => void }>; // Error boundary fallback
  preload?: boolean; // Whether to preload the component
  delay?: number; // Delay before loading (ms)
  retryAttempts?: number; // Number of retry attempts on failure
}

export interface LazyComponentProps {
  loader: () => Promise<{ default: ComponentType<any> }>;
  config?: LazyLoadConfig;
  children?: React.ReactNode;
  [key: string]: any;
}

interface LazyComponentState {
  isVisible: boolean;
  isLoading: boolean;
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

const DefaultFallback: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
    <span className="ml-2 text-green-400 font-mono">Loading component...</span>
  </div>
);

const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({ error, retry }) => (
  <div className="border border-red-500 bg-red-900/20 p-4 rounded">
    <div className="text-red-400 font-mono text-sm mb-2">Component Load Error</div>
    <div className="text-red-300 text-xs mb-3 font-mono">{error.message}</div>
    <button
      onClick={retry}
      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-mono rounded"
    >
      Retry
    </button>
  </div>
);

export const LazyComponentLoader: React.FC<LazyComponentProps> = ({
  loader,
  config = {},
  children,
  ...props
}) => {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    fallback = <DefaultFallback />,
    errorFallback: ErrorFallback = DefaultErrorFallback,
    preload = false,
    delay = 0,
    retryAttempts = 3
  } = config;

  const [state, setState] = useState<LazyComponentState>({
    isVisible: preload,
    isLoading: false,
    hasError: false,
    error: null,
    retryCount: 0
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const LazyComponent = useRef<ComponentType<any> | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (preload || state.isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setState(prev => ({ ...prev, isVisible: true }));
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin, preload, state.isVisible]);

  // Load component when visible
  useEffect(() => {
    if (!state.isVisible || LazyComponent.current) return;

    const loadComponent = async () => {
      setState(prev => ({ ...prev, isLoading: true, hasError: false }));

      try {
        // Add delay if specified
        if (delay > 0) {
          await new Promise(resolve => {
            loadingTimeoutRef.current = setTimeout(resolve, delay);
          });
        }

        const module = await loader();
        LazyComponent.current = module.default;
        
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          hasError: false, 
          error: null 
        }));
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to load component');
        
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          hasError: true, 
          error: err,
          retryCount: prev.retryCount + 1
        }));
      }
    };

    loadComponent();

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [state.isVisible, loader, delay]);

  const handleRetry = () => {
    if (state.retryCount < retryAttempts) {
      LazyComponent.current = null;
      setState(prev => ({ 
        ...prev, 
        hasError: false, 
        error: null, 
        isLoading: false 
      }));
    }
  };

  // Render loading state
  if (!state.isVisible) {
    return <div ref={containerRef} className="min-h-[100px]" />;
  }

  // Render error state
  if (state.hasError && state.error) {
    if (state.retryCount >= retryAttempts) {
      return (
        <div className="border border-red-500 bg-red-900/20 p-4 rounded">
          <div className="text-red-400 font-mono text-sm">
            Component failed to load after {retryAttempts} attempts
          </div>
        </div>
      );
    }
    return <ErrorFallback error={state.error} retry={handleRetry} />;
  }

  // Render loading state
  if (state.isLoading || !LazyComponent.current) {
    return fallback;
  }

  // Render loaded component
  const Component = LazyComponent.current;
  return <Component {...props}>{children}</Component>;
};

// Higher-order component for creating lazy components
export function createLazyComponent<P = {}>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  config?: LazyLoadConfig
) {
  return React.forwardRef<any, P & { lazyConfig?: LazyLoadConfig }>((props, ref) => {
    const { lazyConfig, ...componentProps } = props as any;
    const finalConfig = { ...config, ...lazyConfig };

    return (
      <LazyComponentLoader
        loader={loader}
        config={finalConfig}
        ref={ref}
        {...componentProps}
      />
    );
  });
}

// Hook for preloading components
export function useComponentPreloader() {
  const preloadedComponents = useRef(new Set<string>());

  const preloadComponent = async (
    key: string,
    loader: () => Promise<{ default: ComponentType<any> }>
  ) => {
    if (preloadedComponents.current.has(key)) {
      return;
    }

    try {
      await loader();
      preloadedComponents.current.add(key);
    } catch (error) {
      console.warn(`Failed to preload component ${key}:`, error);
    }
  };

  const preloadComponents = async (
    components: Array<{ key: string; loader: () => Promise<{ default: ComponentType<any> }> }>
  ) => {
    await Promise.allSettled(
      components.map(({ key, loader }) => preloadComponent(key, loader))
    );
  };

  const isPreloaded = (key: string) => preloadedComponents.current.has(key);

  const clearPreloadCache = () => {
    preloadedComponents.current.clear();
  };

  return {
    preloadComponent,
    preloadComponents,
    isPreloaded,
    clearPreloadCache
  };
}

// Utility for creating lazy-loaded route components
export function createLazyRoute<P = {}>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  fallback?: ReactElement
) {
  const LazyRouteComponent = lazy(loader);

  return React.forwardRef<any, P>((props, ref) => (
    <Suspense fallback={fallback || <DefaultFallback />}>
      <LazyRouteComponent {...props} ref={ref} />
    </Suspense>
  ));
}

// Performance monitoring for lazy components
export class LazyLoadPerformanceMonitor {
  private static instance: LazyLoadPerformanceMonitor;
  private loadTimes = new Map<string, number[]>();
  private errorCounts = new Map<string, number>();

  static getInstance(): LazyLoadPerformanceMonitor {
    if (!LazyLoadPerformanceMonitor.instance) {
      LazyLoadPerformanceMonitor.instance = new LazyLoadPerformanceMonitor();
    }
    return LazyLoadPerformanceMonitor.instance;
  }

  recordLoadTime(componentName: string, loadTime: number): void {
    if (!this.loadTimes.has(componentName)) {
      this.loadTimes.set(componentName, []);
    }
    this.loadTimes.get(componentName)!.push(loadTime);
  }

  recordError(componentName: string): void {
    const currentCount = this.errorCounts.get(componentName) || 0;
    this.errorCounts.set(componentName, currentCount + 1);
  }

  getStats(): {
    components: Array<{
      name: string;
      averageLoadTime: number;
      loadCount: number;
      errorCount: number;
      errorRate: number;
    }>;
  } {
    const components: any[] = [];

    for (const [name, times] of this.loadTimes.entries()) {
      const averageLoadTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const loadCount = times.length;
      const errorCount = this.errorCounts.get(name) || 0;
      const errorRate = errorCount / (loadCount + errorCount);

      components.push({
        name,
        averageLoadTime,
        loadCount,
        errorCount,
        errorRate
      });
    }

    return { components };
  }

  clearStats(): void {
    this.loadTimes.clear();
    this.errorCounts.clear();
  }
}