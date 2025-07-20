/**
 * Feature Flag Service for gradual rollout and A/B testing
 */

import { useState, useEffect } from 'react';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions?: {
    userAgent?: string[];
    environment?: string[];
    version?: string[];
  };
  description: string;
}

export interface FeatureFlagConfig {
  flags: Record<string, FeatureFlag>;
  userId?: string;
  environment: 'development' | 'staging' | 'production';
  version: string;
}

class FeatureFlagService {
  private config: FeatureFlagConfig;
  private userHash: number;

  constructor() {
    this.config = {
      flags: this.getDefaultFlags(),
      environment: this.getEnvironment(),
      version: this.getVersion()
    };
    
    // Generate consistent user hash for rollout percentage
    this.userHash = this.generateUserHash();
    
    // Load remote config if available
    this.loadRemoteConfig();
  }

  private getDefaultFlags(): Record<string, FeatureFlag> {
    return {
      // Analytics features
      'advanced-analytics': {
        key: 'advanced-analytics',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Advanced JSON analytics and correlation features'
      },
      
      'real-time-analytics': {
        key: 'real-time-analytics',
        enabled: true,
        rolloutPercentage: 90,
        description: 'Real-time analytics updates'
      },
      
      // Performance features
      'web-workers': {
        key: 'web-workers',
        enabled: true,
        rolloutPercentage: 95,
        description: 'Web Workers for background processing'
      },
      
      'virtual-scrolling': {
        key: 'virtual-scrolling',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Virtual scrolling for large message lists'
      },
      
      // Security features
      'enhanced-encryption': {
        key: 'enhanced-encryption',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Enhanced encryption for stored credentials'
      },
      
      'audit-logging': {
        key: 'audit-logging',
        enabled: true,
        rolloutPercentage: 80,
        description: 'Detailed audit logging for security events'
      },
      
      // UI features
      'terminal-theme': {
        key: 'terminal-theme',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Terminal-style UI theme'
      },
      
      'dark-mode': {
        key: 'dark-mode',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Dark mode support'
      },
      
      // Experimental features
      'ai-insights': {
        key: 'ai-insights',
        enabled: false,
        rolloutPercentage: 5,
        conditions: {
          environment: ['development', 'staging']
        },
        description: 'AI-powered message insights (experimental)'
      },
      
      'batch-operations-v2': {
        key: 'batch-operations-v2',
        enabled: false,
        rolloutPercentage: 20,
        description: 'Enhanced batch operations interface'
      },
      
      // Integration features
      'chirpstack-integration': {
        key: 'chirpstack-integration',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Chirpstack gateway monitoring integration'
      },
      
      'export-scheduling': {
        key: 'export-scheduling',
        enabled: true,
        rolloutPercentage: 85,
        description: 'Scheduled data export functionality'
      },
      
      // PWA features
      'offline-analytics': {
        key: 'offline-analytics',
        enabled: true,
        rolloutPercentage: 90,
        description: 'Offline analytics processing'
      },
      
      'background-sync': {
        key: 'background-sync',
        enabled: true,
        rolloutPercentage: 95,
        description: 'Background synchronization'
      }
    };
  }

  private getEnvironment(): 'development' | 'staging' | 'production' {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      }
      if (hostname.includes('staging') || hostname.includes('dev')) {
        return 'staging';
      }
    }
    return 'production';
  }

  private getVersion(): string {
    // Use environment variable or fallback to default version
    return import.meta.env.VITE_APP_VERSION || '1.0.0';
  }

  private generateUserHash(): number {
    // Generate a consistent hash based on browser fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('fingerprint', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash) % 100;
  }

  private async loadRemoteConfig(): Promise<void> {
    try {
      // In a real implementation, this would fetch from a remote service
      // For now, we'll check localStorage for overrides
      const localOverrides = localStorage.getItem('feature-flags-override');
      if (localOverrides) {
        const overrides = JSON.parse(localOverrides);
        this.config.flags = { ...this.config.flags, ...overrides };
      }
    } catch (error) {
      console.warn('Failed to load remote feature flag config:', error);
    }
  }

  /**
   * Check if a feature flag is enabled for the current user
   */
  isEnabled(flagKey: string): boolean {
    const flag = this.config.flags[flagKey];
    if (!flag) {
      console.warn(`Feature flag '${flagKey}' not found`);
      return false;
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check environment conditions
    if (flag.conditions?.environment && 
        !flag.conditions.environment.includes(this.config.environment)) {
      return false;
    }

    // Check version conditions
    if (flag.conditions?.version && 
        !flag.conditions.version.includes(this.config.version)) {
      return false;
    }

    // Check user agent conditions
    if (flag.conditions?.userAgent && 
        !flag.conditions.userAgent.some(ua => navigator.userAgent.includes(ua))) {
      return false;
    }

    // Check rollout percentage
    return this.userHash < flag.rolloutPercentage;
  }

  /**
   * Get all enabled feature flags
   */
  getEnabledFlags(): string[] {
    return Object.keys(this.config.flags).filter(key => this.isEnabled(key));
  }

  /**
   * Get feature flag configuration
   */
  getFlag(flagKey: string): FeatureFlag | undefined {
    return this.config.flags[flagKey];
  }

  /**
   * Override a feature flag (for testing/debugging)
   */
  override(flagKey: string, enabled: boolean): void {
    if (this.config.environment === 'development') {
      const overrides = JSON.parse(localStorage.getItem('feature-flags-override') || '{}');
      overrides[flagKey] = { ...this.config.flags[flagKey], enabled };
      localStorage.setItem('feature-flags-override', JSON.stringify(overrides));
      const existingFlag = this.config.flags[flagKey];
      this.config.flags[flagKey] = { 
        ...existingFlag,
        key: flagKey,
        enabled,
        rolloutPercentage: existingFlag?.rolloutPercentage ?? 100,
        description: existingFlag?.description ?? '',
      };
    }
  }

  /**
   * Clear all overrides
   */
  clearOverrides(): void {
    localStorage.removeItem('feature-flags-override');
    this.config.flags = this.getDefaultFlags();
  }

  /**
   * Get feature flag statistics for monitoring
   */
  getStats(): {
    totalFlags: number;
    enabledFlags: number;
    environment: string;
    version: string;
    userHash: number;
  } {
    const enabledFlags = this.getEnabledFlags();
    return {
      totalFlags: Object.keys(this.config.flags).length,
      enabledFlags: enabledFlags.length,
      environment: this.config.environment,
      version: this.config.version,
      userHash: this.userHash
    };
  }
}

// Export singleton instance
export const featureFlagService = new FeatureFlagService();

// React hook for using feature flags

export function useFeatureFlag(flagKey: string): boolean {
  const [isEnabled, setIsEnabled] = useState(() => featureFlagService.isEnabled(flagKey));

  useEffect(() => {
    // Re-check flag status (useful for remote config updates)
    const checkFlag = () => {
      const enabled = featureFlagService.isEnabled(flagKey);
      setIsEnabled(enabled);
    };

    checkFlag();

    // Listen for storage changes (for override updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'feature-flags-override') {
        checkFlag();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [flagKey]);

  return isEnabled;
}

// Development helper component
export function FeatureFlagDebugPanel(): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const stats = featureFlagService.getStats();

  if (featureFlagService.getStats().environment === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 text-white px-3 py-2 rounded text-sm"
      >
        🚩 Flags ({stats.enabledFlags}/{stats.totalFlags})
      </button>
      
      {isOpen && (
        <div className="absolute bottom-12 right-0 bg-white border shadow-lg rounded p-4 w-80 max-h-96 overflow-y-auto">
          <h3 className="font-bold mb-2">Feature Flags Debug</h3>
          <div className="text-xs mb-2 text-gray-600">
            Environment: {stats.environment} | Version: {stats.version} | Hash: {stats.userHash}
          </div>
          
          {Object.entries(featureFlagService['config'].flags).map(([key, flag]) => (
            <div key={key} className="flex items-center justify-between py-1 border-b">
              <div className="flex-1">
                <div className="text-sm font-medium">{key}</div>
                <div className="text-xs text-gray-500">{flag.rolloutPercentage}%</div>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={featureFlagService.isEnabled(key)}
                  onChange={(e) => featureFlagService.override(key, e.target.checked)}
                  className="mr-1"
                />
                <span className="text-xs">
                  {featureFlagService.isEnabled(key) ? '✅' : '❌'}
                </span>
              </label>
            </div>
          ))}
          
          <button
            onClick={() => featureFlagService.clearOverrides()}
            className="mt-2 text-xs bg-red-500 text-white px-2 py-1 rounded"
          >
            Clear Overrides
          </button>
        </div>
      )}
    </div>
  );
}