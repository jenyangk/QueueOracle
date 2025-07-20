export interface PerformanceMark {
  name: string;
  startTime: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceProfile {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  marks: PerformanceMark[];
  measures: PerformanceMeasure[];
  metadata: Record<string, unknown>;
}

export interface PerformanceMeasure {
  name: string;
  startMark: string;
  endMark: string;
  duration: number;
  startTime: number;
}

class PerformanceProfiler {
  private activeProfiles = new Map<string, PerformanceProfile>();
  private completedProfiles: PerformanceProfile[] = [];
  private readonly MAX_PROFILES = 50;

  public startProfile(name: string, metadata: Record<string, unknown> = {}): string {
    const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const profile: PerformanceProfile = {
      id,
      name,
      startTime: performance.now(),
      marks: [],
      measures: [],
      metadata
    };

    this.activeProfiles.set(id, profile);
    
    // Create performance mark
    const markName = `profile-start-${id}`;
    performance.mark(markName);
    
    return id;
  }

  public endProfile(profileId: string): PerformanceProfile | null {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) {
      console.warn(`Profile ${profileId} not found`);
      return null;
    }

    profile.endTime = performance.now();
    profile.duration = profile.endTime - profile.startTime;

    // Create end mark and measure
    const endMarkName = `profile-end-${profileId}`;
    const startMarkName = `profile-start-${profileId}`;
    performance.mark(endMarkName);
    
    try {
      performance.measure(`profile-${profileId}`, startMarkName, endMarkName);
    } catch (error) {
      console.warn('Failed to create performance measure:', error);
    }

    // Move to completed profiles
    this.activeProfiles.delete(profileId);
    this.completedProfiles.push(profile);

    // Limit stored profiles
    if (this.completedProfiles.length > this.MAX_PROFILES) {
      this.completedProfiles.shift();
    }

    // Clean up performance marks
    this.cleanupMarks(startMarkName, endMarkName);

    return profile;
  }

  public mark(profileId: string, markName: string, metadata: Record<string, unknown> = {}): void {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) {
      console.warn(`Profile ${profileId} not found`);
      return;
    }

    const mark: PerformanceMark = {
      name: markName,
      startTime: performance.now(),
      metadata
    };

    profile.marks.push(mark);

    // Create performance mark
    const fullMarkName = `${profileId}-${markName}`;
    performance.mark(fullMarkName);
  }

  public measure(profileId: string, measureName: string, startMark: string, endMark: string): void {
    const profile = this.activeProfiles.get(profileId);
    if (!profile) {
      console.warn(`Profile ${profileId} not found`);
      return;
    }

    const startMarkFull = `${profileId}-${startMark}`;
    const endMarkFull = `${profileId}-${endMark}`;

    try {
      const measureFullName = `${profileId}-${measureName}`;
      performance.measure(measureFullName, startMarkFull, endMarkFull);
      
      const entries = performance.getEntriesByName(measureFullName, 'measure');
      if (entries.length > 0) {
        const entry = entries[entries.length - 1]!;
        
        const measure: PerformanceMeasure = {
          name: measureName,
          startMark,
          endMark,
          duration: entry.duration,
          startTime: entry.startTime
        };

        profile.measures.push(measure);
      }
    } catch (error) {
      console.warn(`Failed to create measure ${measureName}:`, error);
    }
  }

  public getProfile(profileId: string): PerformanceProfile | null {
    return this.activeProfiles.get(profileId) || 
           this.completedProfiles.find(p => p.id === profileId) || 
           null;
  }

  public getActiveProfiles(): PerformanceProfile[] {
    return Array.from(this.activeProfiles.values());
  }

  public getCompletedProfiles(): PerformanceProfile[] {
    return [...this.completedProfiles];
  }

  public getAllProfiles(): PerformanceProfile[] {
    return [...this.getActiveProfiles(), ...this.getCompletedProfiles()];
  }

  public getProfilesByName(name: string): PerformanceProfile[] {
    return this.getAllProfiles().filter(profile => profile.name === name);
  }

  public getAverageProfileDuration(name: string): number {
    const profiles = this.getProfilesByName(name).filter(p => p.duration !== undefined);
    if (profiles.length === 0) return 0;
    
    const totalDuration = profiles.reduce((sum, profile) => sum + (profile.duration || 0), 0);
    return totalDuration / profiles.length;
  }

  public getPerformanceInsights(): {
    slowestProfiles: PerformanceProfile[];
    averageDurations: Record<string, number>;
    totalProfiles: number;
    activeProfiles: number;
  } {
    const completed = this.getCompletedProfiles();
    const slowestProfiles = completed
      .filter(p => p.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    const profileNames = [...new Set(completed.map(p => p.name))];
    const averageDurations: Record<string, number> = {};
    
    profileNames.forEach(name => {
      averageDurations[name] = this.getAverageProfileDuration(name);
    });

    return {
      slowestProfiles,
      averageDurations,
      totalProfiles: completed.length,
      activeProfiles: this.activeProfiles.size
    };
  }

  private cleanupMarks(...markNames: string[]): void {
    markNames.forEach(markName => {
      try {
        performance.clearMarks(markName);
        performance.clearMeasures(markName);
      } catch {
        // Ignore cleanup errors
      }
    });
  }

  public clearAllProfiles(): void {
    // Clear active profiles
    this.activeProfiles.forEach((_profile, id) => {
      this.endProfile(id);
    });

    // Clear completed profiles
    this.completedProfiles.length = 0;

    // Clear all performance marks and measures
    performance.clearMarks();
    performance.clearMeasures();
  }

  public exportProfiles(): string {
    const data = {
      timestamp: Date.now(),
      activeProfiles: this.getActiveProfiles(),
      completedProfiles: this.getCompletedProfiles(),
      insights: this.getPerformanceInsights(),
      browserInfo: {
        userAgent: navigator.userAgent,
        timing: performance.timing,
        navigation: performance.navigation
      }
    };

    return JSON.stringify(data, null, 2);
  }

  // Utility method for timing async operations
  public async timeAsync<T>(
    profileId: string, 
    operationName: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    this.mark(profileId, `${operationName}-start`);
    
    try {
      const result = await operation();
      this.mark(profileId, `${operationName}-end`);
      this.measure(profileId, operationName, `${operationName}-start`, `${operationName}-end`);
      return result;
    } catch (error) {
      this.mark(profileId, `${operationName}-error`);
      this.measure(profileId, `${operationName}-error`, `${operationName}-start`, `${operationName}-error`);
      throw error;
    }
  }

  // Utility method for timing sync operations
  public timeSync<T>(
    profileId: string, 
    operationName: string, 
    operation: () => T
  ): T {
    this.mark(profileId, `${operationName}-start`);
    
    try {
      const result = operation();
      this.mark(profileId, `${operationName}-end`);
      this.measure(profileId, operationName, `${operationName}-start`, `${operationName}-end`);
      return result;
    } catch (error) {
      this.mark(profileId, `${operationName}-error`);
      this.measure(profileId, `${operationName}-error`, `${operationName}-start`, `${operationName}-error`);
      throw error;
    }
  }
}

export const performanceProfiler = new PerformanceProfiler();