/**
 * Filter Profile Service - Manages saved filter profiles
 */

import { secureStorage } from '../../../services/storage/SecureStorageService';
import type { SavedFilterProfile, FilterGroup } from '../components/FilterBuilder';

export class FilterProfileService {
  private static instance: FilterProfileService;
  private readonly storageKey = 'filter_profiles';
  private profiles: SavedFilterProfile[] = [];
  private initialized = false;

  private constructor() {}

  public static getInstance(): FilterProfileService {
    if (!FilterProfileService.instance) {
      FilterProfileService.instance = new FilterProfileService();
    }
    return FilterProfileService.instance;
  }

  /**
   * Initialize the service and load existing profiles
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const storageService = secureStorage;
      const storedProfiles = await storageService.get<SavedFilterProfile[]>(this.storageKey);
      
      if (storedProfiles && Array.isArray(storedProfiles)) {
        this.profiles = storedProfiles.map(profile => ({
          ...profile,
          createdAt: new Date(profile.createdAt),
          lastUsed: new Date(profile.lastUsed),
        }));
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize FilterProfileService:', error);
      this.profiles = [];
      this.initialized = true;
    }
  }

  /**
   * Get all saved filter profiles
   */
  public async getProfiles(): Promise<SavedFilterProfile[]> {
    await this.initialize();
    return [...this.profiles].sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
  }

  /**
   * Save a new filter profile
   */
  public async saveProfile(profile: Omit<SavedFilterProfile, 'id' | 'createdAt' | 'lastUsed' | 'usageCount'>): Promise<SavedFilterProfile> {
    await this.initialize();

    const newProfile: SavedFilterProfile = {
      ...profile,
      id: this.generateId(),
      createdAt: new Date(),
      lastUsed: new Date(),
      usageCount: 0,
    };

    this.profiles.push(newProfile);
    await this.persistProfiles();

    return newProfile;
  }

  /**
   * Update an existing filter profile
   */
  public async updateProfile(profileId: string, updates: Partial<Omit<SavedFilterProfile, 'id' | 'createdAt'>>): Promise<SavedFilterProfile | null> {
    await this.initialize();

    const index = this.profiles.findIndex(p => p.id === profileId);
    if (index === -1) return null;

    const currentProfile = this.profiles[index];
    if (currentProfile) {
      this.profiles[index] = {
        ...currentProfile,
        ...updates,
      };
    }

    await this.persistProfiles();
    return this.profiles[index] || null;
  }

  /**
   * Delete a filter profile
   */
  public async deleteProfile(profileId: string): Promise<boolean> {
    await this.initialize();

    const index = this.profiles.findIndex(p => p.id === profileId);
    if (index === -1) return false;

    this.profiles.splice(index, 1);
    await this.persistProfiles();
    return true;
  }

  /**
   * Get a specific filter profile by ID
   */
  public async getProfile(profileId: string): Promise<SavedFilterProfile | null> {
    await this.initialize();
    return this.profiles.find(p => p.id === profileId) || null;
  }

  /**
   * Mark a profile as used (increment usage count and update last used)
   */
  public async markProfileAsUsed(profileId: string): Promise<void> {
    await this.initialize();

    const profile = this.profiles.find(p => p.id === profileId);
    if (profile) {
      profile.usageCount += 1;
      profile.lastUsed = new Date();
      await this.persistProfiles();
    }
  }

  /**
   * Search profiles by name or tags
   */
  public async searchProfiles(query: string): Promise<SavedFilterProfile[]> {
    await this.initialize();

    const lowerQuery = query.toLowerCase();
    return this.profiles.filter(profile => 
      profile.name.toLowerCase().includes(lowerQuery) ||
      profile.description?.toLowerCase().includes(lowerQuery) ||
      profile.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get profiles by tags
   */
  public async getProfilesByTags(tags: string[]): Promise<SavedFilterProfile[]> {
    await this.initialize();

    const lowerTags = tags.map(tag => tag.toLowerCase());
    return this.profiles.filter(profile =>
      profile.tags.some(tag => lowerTags.includes(tag.toLowerCase()))
    );
  }

  /**
   * Export a filter profile to JSON
   */
  public exportProfile(profile: SavedFilterProfile): string {
    return JSON.stringify(profile, null, 2);
  }

  /**
   * Export all profiles to JSON
   */
  public async exportAllProfiles(): Promise<string> {
    await this.initialize();
    return JSON.stringify(this.profiles, null, 2);
  }

  /**
   * Import profiles from JSON
   */
  public async importProfiles(jsonData: string, overwrite = false): Promise<SavedFilterProfile[]> {
    await this.initialize();

    try {
      const importedData = JSON.parse(jsonData);
      let profilesToImport: SavedFilterProfile[];

      // Handle both single profile and array of profiles
      if (Array.isArray(importedData)) {
        profilesToImport = importedData;
      } else if (importedData.id && importedData.name && importedData.filter) {
        profilesToImport = [importedData];
      } else {
        throw new Error('Invalid profile data format');
      }

      const importedProfiles: SavedFilterProfile[] = [];

      for (const profileData of profilesToImport) {
        // Validate profile structure
        if (!this.validateProfileStructure(profileData)) {
          console.warn('Skipping invalid profile:', profileData.name || 'Unknown');
          continue;
        }

        const existingIndex = this.profiles.findIndex(p => p.name === profileData.name);
        
        if (existingIndex !== -1) {
          if (overwrite) {
            // Update existing profile
            const existingProfile = this.profiles[existingIndex];
            if (existingProfile) {
              this.profiles[existingIndex] = {
                ...profileData,
                id: existingProfile.id, // Keep original ID
                createdAt: new Date(profileData.createdAt),
                lastUsed: new Date(profileData.lastUsed),
              };
              importedProfiles.push(this.profiles[existingIndex]);
            }
          }
        } else {
          // Add new profile
          const newProfile: SavedFilterProfile = {
            ...profileData,
            id: this.generateId(),
            createdAt: new Date(profileData.createdAt),
            lastUsed: new Date(profileData.lastUsed),
          };
          this.profiles.push(newProfile);
          importedProfiles.push(newProfile);
        }
      }

      await this.persistProfiles();
      return importedProfiles;
    } catch (error) {
      throw new Error(`Failed to import profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get filter performance metrics
   */
  public async getFilterPerformanceMetrics(filter: FilterGroup): Promise<{
    estimatedComplexity: number;
    optimizationSuggestions: string[];
  }> {
    const complexity = this.calculateFilterComplexity(filter);
    const suggestions = this.generateOptimizationSuggestions(filter);

    return {
      estimatedComplexity: complexity,
      optimizationSuggestions: suggestions,
    };
  }

  /**
   * Optimize filter for better performance
   */
  public optimizeFilter(filter: FilterGroup): FilterGroup {
    // Create a deep copy
    const optimized = JSON.parse(JSON.stringify(filter));

    // Remove disabled conditions
    this.removeDisabledConditions(optimized);

    // Reorder conditions by performance impact (exists/not_exists first, regex last)
    this.reorderConditionsByPerformance(optimized);

    // Consolidate similar conditions
    this.consolidateSimilarConditions(optimized);

    return optimized;
  }

  /**
   * Validate filter structure
   */
  private validateProfileStructure(profile: any): boolean {
    return (
      profile &&
      typeof profile.id === 'string' &&
      typeof profile.name === 'string' &&
      profile.filter &&
      typeof profile.filter === 'object' &&
      profile.createdAt &&
      profile.lastUsed &&
      typeof profile.usageCount === 'number' &&
      Array.isArray(profile.tags)
    );
  }

  /**
   * Calculate filter complexity score
   */
  private calculateFilterComplexity(group: FilterGroup): number {
    let complexity = 0;

    // Add complexity for each condition
    group.conditions.forEach(condition => {
      if (!condition.enabled) return;

      switch (condition.operator) {
        case 'exists':
        case 'not_exists':
          complexity += 1; // Fastest
          break;
        case 'equals':
        case 'not_equals':
          complexity += 2;
          break;
        case 'contains':
        case 'not_contains':
          complexity += 3;
          break;
        case 'regex':
        case 'not_regex':
          complexity += 5; // Most expensive
          break;
        default:
          complexity += 2;
      }
    });

    // Add complexity for nested groups
    group.groups.forEach(subGroup => {
      complexity += this.calculateFilterComplexity(subGroup) * 1.5; // Nested groups are more expensive
    });

    return Math.round(complexity);
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(group: FilterGroup): string[] {
    const suggestions: string[] = [];

    // Check for regex patterns
    const regexConditions = this.findRegexConditions(group);
    if (regexConditions.length > 0) {
      suggestions.push(`Consider replacing ${regexConditions.length} regex condition(s) with simpler operators when possible`);
    }

    // Check for disabled conditions
    const disabledConditions = this.findDisabledConditions(group);
    if (disabledConditions.length > 0) {
      suggestions.push(`Remove ${disabledConditions.length} disabled condition(s) to improve performance`);
    }

    // Check for redundant conditions
    const redundantConditions = this.findRedundantConditions(group);
    if (redundantConditions.length > 0) {
      suggestions.push(`Consolidate ${redundantConditions.length} redundant condition(s)`);
    }

    // Check condition order
    if (this.hasSuboptimalConditionOrder(group)) {
      suggestions.push('Reorder conditions to put faster operations first');
    }

    return suggestions;
  }

  /**
   * Helper methods for optimization
   */
  private removeDisabledConditions(group: FilterGroup): void {
    group.conditions = group.conditions.filter(c => c.enabled);
    group.groups.forEach(subGroup => this.removeDisabledConditions(subGroup));
  }

  private reorderConditionsByPerformance(group: FilterGroup): void {
    const performanceOrder = ['exists', 'not_exists', 'equals', 'not_equals', 'contains', 'not_contains', 'regex', 'not_regex'];
    
    group.conditions.sort((a, b) => {
      const aIndex = performanceOrder.indexOf(a.operator);
      const bIndex = performanceOrder.indexOf(b.operator);
      return aIndex - bIndex;
    });

    group.groups.forEach(subGroup => this.reorderConditionsByPerformance(subGroup));
  }

  private consolidateSimilarConditions(group: FilterGroup): void {
    // This is a simplified version - in practice, you'd want more sophisticated logic
    const fieldGroups = new Map<string, typeof group.conditions>();
    
    group.conditions.forEach(condition => {
      const key = condition.fieldPath;
      if (!fieldGroups.has(key)) {
        fieldGroups.set(key, []);
      }
      fieldGroups.get(key)!.push(condition);
    });

    // For now, just remove exact duplicates
    group.conditions = group.conditions.filter((condition, index, array) => {
      return !array.slice(0, index).some(other => 
        other.fieldPath === condition.fieldPath &&
        other.operator === condition.operator &&
        other.value === condition.value
      );
    });

    group.groups.forEach(subGroup => this.consolidateSimilarConditions(subGroup));
  }

  private findRegexConditions(group: FilterGroup): any[] {
    const regexConditions: any[] = [];
    
    group.conditions.forEach(condition => {
      if (condition.operator === 'regex' || condition.operator === 'not_regex') {
        regexConditions.push(condition);
      }
    });

    group.groups.forEach(subGroup => {
      regexConditions.push(...this.findRegexConditions(subGroup));
    });

    return regexConditions;
  }

  private findDisabledConditions(group: FilterGroup): any[] {
    const disabledConditions: any[] = [];
    
    group.conditions.forEach(condition => {
      if (!condition.enabled) {
        disabledConditions.push(condition);
      }
    });

    group.groups.forEach(subGroup => {
      disabledConditions.push(...this.findDisabledConditions(subGroup));
    });

    return disabledConditions;
  }

  private findRedundantConditions(group: FilterGroup): any[] {
    const redundant: any[] = [];
    const seen = new Set<string>();

    group.conditions.forEach(condition => {
      const key = `${condition.fieldPath}:${condition.operator}:${condition.value}`;
      if (seen.has(key)) {
        redundant.push(condition);
      } else {
        seen.add(key);
      }
    });

    group.groups.forEach(subGroup => {
      redundant.push(...this.findRedundantConditions(subGroup));
    });

    return redundant;
  }

  private hasSuboptimalConditionOrder(group: FilterGroup): boolean {
    const performanceOrder = ['exists', 'not_exists', 'equals', 'not_equals', 'contains', 'not_contains', 'regex', 'not_regex'];
    
    for (let i = 1; i < group.conditions.length; i++) {
      const prevCondition = group.conditions[i - 1];
      const currCondition = group.conditions[i];
      
      if (!prevCondition || !currCondition) continue;
      
      const prevIndex = performanceOrder.indexOf(prevCondition.operator);
      const currIndex = performanceOrder.indexOf(currCondition.operator);
      
      if (prevIndex > currIndex) {
        return true;
      }
    }

    return group.groups.some(subGroup => this.hasSuboptimalConditionOrder(subGroup));
  }

  /**
   * Persist profiles to storage
   */
  private async persistProfiles(): Promise<void> {
    try {
      const storageService = secureStorage;
      await storageService.set(this.storageKey, this.profiles);
    } catch (error) {
      console.error('Failed to persist filter profiles:', error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const getFilterProfileService = (): FilterProfileService => {
  return FilterProfileService.getInstance();
};