/**
 * Message Filter Service - Advanced message filtering with performance optimization
 */

import type { ServiceBusMessage } from '../../../services/storage/types';
import type { FilterGroup, FilterCondition } from '../components/FilterBuilder';

export interface FilterPerformanceMetrics {
  totalMessages: number;
  filteredMessages: number;
  filterTime: number;
  conditionsEvaluated: number;
  cacheHits: number;
  cacheMisses: number;
}

export class MessageFilterService {
  private static instance: MessageFilterService;
  private fieldValueCache = new Map<string, Map<string, any>>();
  private filterResultCache = new Map<string, boolean>();
  private performanceMetrics: FilterPerformanceMetrics = {
    totalMessages: 0,
    filteredMessages: 0,
    filterTime: 0,
    conditionsEvaluated: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  private constructor() {}

  public static getInstance(): MessageFilterService {
    if (!MessageFilterService.instance) {
      MessageFilterService.instance = new MessageFilterService();
    }
    return MessageFilterService.instance;
  }

  /**
   * Apply complex filter to messages with performance optimization
   */
  public filterMessages(messages: ServiceBusMessage[], filter: FilterGroup): {
    filteredMessages: ServiceBusMessage[];
    metrics: FilterPerformanceMetrics;
  } {
    const startTime = performance.now();
    
    // Reset metrics for this filter operation
    this.resetMetrics();
    this.performanceMetrics.totalMessages = messages.length;

    // Pre-build field value cache for better performance
    this.buildFieldValueCache(messages, filter);

    // Apply filter
    const filteredMessages = messages.filter(message => {
      const result = this.evaluateFilterGroup(message, filter);
      if (result) {
        this.performanceMetrics.filteredMessages++;
      }
      return result;
    });

    this.performanceMetrics.filterTime = performance.now() - startTime;

    return {
      filteredMessages,
      metrics: { ...this.performanceMetrics },
    };
  }

  /**
   * Evaluate a filter group against a message
   */
  private evaluateFilterGroup(message: ServiceBusMessage, group: FilterGroup): boolean {
    if (!group.enabled) return true;

    const conditionResults: boolean[] = [];
    const groupResults: boolean[] = [];

    // Evaluate conditions
    for (const condition of group.conditions) {
      if (condition.enabled) {
        const result = this.evaluateCondition(message, condition);
        conditionResults.push(result);
        this.performanceMetrics.conditionsEvaluated++;
      }
    }

    // Evaluate nested groups
    for (const subGroup of group.groups) {
      if (subGroup.enabled) {
        const result = this.evaluateFilterGroup(message, subGroup);
        groupResults.push(result);
      }
    }

    // Combine all results based on group operator
    const allResults = [...conditionResults, ...groupResults];
    
    if (allResults.length === 0) return true;

    return group.operator === 'AND' 
      ? allResults.every(result => result)
      : allResults.some(result => result);
  }

  /**
   * Evaluate a single condition against a message
   */
  private evaluateCondition(message: ServiceBusMessage, condition: FilterCondition): boolean {
    const cacheKey = `${message.messageId}:${condition.id}`;
    
    // Check cache first
    if (this.filterResultCache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      return this.filterResultCache.get(cacheKey)!;
    }

    this.performanceMetrics.cacheMisses++;

    const fieldValue = this.getFieldValue(message, condition.fieldPath);
    let result = false;

    switch (condition.operator) {
      case 'equals':
        result = this.compareValues(fieldValue, condition.value, 'equals');
        break;
      case 'not_equals':
        result = !this.compareValues(fieldValue, condition.value, 'equals');
        break;
      case 'contains':
        result = this.compareValues(fieldValue, condition.value, 'contains');
        break;
      case 'not_contains':
        result = !this.compareValues(fieldValue, condition.value, 'contains');
        break;
      case 'regex':
        result = this.compareValues(fieldValue, condition.value, 'regex');
        break;
      case 'not_regex':
        result = !this.compareValues(fieldValue, condition.value, 'regex');
        break;
      case 'exists':
        result = fieldValue !== undefined && fieldValue !== null;
        break;
      case 'not_exists':
        result = fieldValue === undefined || fieldValue === null;
        break;
      case 'greater_than':
        result = this.compareValues(fieldValue, condition.value, 'greater_than');
        break;
      case 'less_than':
        result = this.compareValues(fieldValue, condition.value, 'less_than');
        break;
      case 'between':
        result = this.compareValues(fieldValue, condition.value, 'between', condition.secondaryValue);
        break;
      case 'in':
        result = this.compareValues(fieldValue, condition.value, 'in');
        break;
      case 'not_in':
        result = !this.compareValues(fieldValue, condition.value, 'in');
        break;
      default:
        result = true;
    }

    // Cache the result
    this.filterResultCache.set(cacheKey, result);
    return result;
  }

  /**
   * Get field value from message with caching
   */
  private getFieldValue(message: ServiceBusMessage, fieldPath: string): any {
    const cacheKey = message.messageId;
    
    if (!this.fieldValueCache.has(cacheKey)) {
      this.fieldValueCache.set(cacheKey, new Map());
    }

    const messageCache = this.fieldValueCache.get(cacheKey)!;
    
    if (messageCache.has(fieldPath)) {
      return messageCache.get(fieldPath);
    }

    // Extract field value
    let value: any;
    
    // Check different sources for the field
    if (fieldPath.startsWith('properties.')) {
      const propPath = fieldPath.substring('properties.'.length);
      value = this.getNestedValue(message.properties, propPath);
    } else if (fieldPath.startsWith('body.')) {
      const bodyPath = fieldPath.substring('body.'.length);
      value = this.getNestedValue(message.body, bodyPath);
    } else if (fieldPath.startsWith('jsonFields.')) {
      const jsonPath = fieldPath.substring('jsonFields.'.length);
      value = this.getNestedValue(message.jsonFields, jsonPath);
    } else {
      // Direct message property
      value = this.getNestedValue(message, fieldPath);
    }

    messageCache.set(fieldPath, value);
    return value;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;

    return path.split('.').reduce((current, key) => {
      if (current === null || current === undefined) return undefined;
      
      // Handle array indices
      if (Array.isArray(current) && /^\d+$/.test(key)) {
        const index = parseInt(key, 10);
        return current[index];
      }
      
      return current[key];
    }, obj);
  }

  /**
   * Compare values based on operator
   */
  private compareValues(fieldValue: any, conditionValue: any, operator: string, secondaryValue?: any): boolean {
    switch (operator) {
      case 'equals':
        return this.isEqual(fieldValue, conditionValue);
      
      case 'contains':
        if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
          return fieldValue.toLowerCase().includes(conditionValue.toLowerCase());
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(item => this.isEqual(item, conditionValue));
        }
        return false;
      
      case 'regex':
        try {
          const regex = new RegExp(String(conditionValue), 'i');
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
      
      case 'greater_than':
        return this.compareNumeric(fieldValue, conditionValue) > 0;
      
      case 'less_than':
        return this.compareNumeric(fieldValue, conditionValue) < 0;
      
      case 'between': {
        if (secondaryValue === undefined) return false;
        const numValue = this.toNumber(fieldValue);
        const minValue = this.toNumber(conditionValue);
        const maxValue = this.toNumber(secondaryValue);
        return numValue >= minValue && numValue <= maxValue;
      }
      
      case 'in': {
        const values = this.parseArrayValue(conditionValue);
        return values.some(value => this.isEqual(fieldValue, value));
      }
      
      default:
        return false;
    }
  }

  /**
   * Check if two values are equal (with type coercion)
   */
  private isEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    // Handle null/undefined
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    
    // Handle numbers
    if (typeof a === 'number' || typeof b === 'number') {
      return this.toNumber(a) === this.toNumber(b);
    }
    
    // Handle strings (case-insensitive)
    if (typeof a === 'string' || typeof b === 'string') {
      return String(a).toLowerCase() === String(b).toLowerCase();
    }
    
    // Handle booleans
    if (typeof a === 'boolean' || typeof b === 'boolean') {
      return Boolean(a) === Boolean(b);
    }
    
    return false;
  }

  /**
   * Compare numeric values
   */
  private compareNumeric(a: any, b: any): number {
    const numA = this.toNumber(a);
    const numB = this.toNumber(b);
    
    if (isNaN(numA) || isNaN(numB)) return 0;
    
    return numA - numB;
  }

  /**
   * Convert value to number
   */
  private toNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.getTime();
    return 0;
  }

  /**
   * Parse array value from string
   */
  private parseArrayValue(value: any): any[] {
    if (Array.isArray(value)) return value;
    
    if (typeof value === 'string') {
      // Try to parse as JSON array first
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fall back to comma-separated values
        return value.split(',').map(v => v.trim());
      }
    }
    
    return [value];
  }

  /**
   * Build field value cache for better performance
   */
  private buildFieldValueCache(messages: ServiceBusMessage[], filter: FilterGroup): void {
    const fieldsToCache = new Set<string>();
    this.collectFieldPaths(filter, fieldsToCache);

    // Pre-cache frequently accessed fields
    messages.forEach(message => {
      fieldsToCache.forEach(fieldPath => {
        this.getFieldValue(message, fieldPath);
      });
    });
  }

  /**
   * Collect all field paths from filter
   */
  private collectFieldPaths(group: FilterGroup, fieldPaths: Set<string>): void {
    group.conditions.forEach(condition => {
      if (condition.enabled && condition.fieldPath) {
        fieldPaths.add(condition.fieldPath);
      }
    });

    group.groups.forEach(subGroup => {
      this.collectFieldPaths(subGroup, fieldPaths);
    });
  }

  /**
   * Reset performance metrics
   */
  private resetMetrics(): void {
    this.performanceMetrics = {
      totalMessages: 0,
      filteredMessages: 0,
      filterTime: 0,
      conditionsEvaluated: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Clear caches to free memory
   */
  public clearCaches(): void {
    this.fieldValueCache.clear();
    this.filterResultCache.clear();
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): FilterPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Analyze field usage in messages for filter suggestions
   */
  public analyzeFieldUsage(messages: ServiceBusMessage[]): Array<{
    path: string;
    type: string;
    sampleValues: unknown[];
    frequency: number;
  }> {
    const fieldAnalysis = new Map<string, {
      type: string;
      values: Set<unknown>;
      count: number;
    }>();

    messages.forEach(message => {
      this.analyzeObject(message.jsonFields || {}, '', fieldAnalysis);
      this.analyzeObject(message.properties || {}, 'properties', fieldAnalysis);
      this.analyzeObject(message.body, 'body', fieldAnalysis);
    });

    return Array.from(fieldAnalysis.entries()).map(([path, analysis]) => ({
      path,
      type: analysis.type,
      sampleValues: Array.from(analysis.values).slice(0, 10), // Top 10 sample values
      frequency: analysis.count / messages.length,
    })).sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Recursively analyze object structure
   */
  private analyzeObject(obj: any, prefix: string, analysis: Map<string, any>, depth = 0): void {
    if (depth > 5 || !obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(key => {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      const type = this.getValueType(value);

      if (!analysis.has(fullPath)) {
        analysis.set(fullPath, {
          type,
          values: new Set(),
          count: 0,
        });
      }

      const fieldAnalysis = analysis.get(fullPath)!;
      fieldAnalysis.count++;
      
      if (fieldAnalysis.values.size < 100) { // Limit sample values
        fieldAnalysis.values.add(value);
      }

      // Recursively analyze nested objects
      if (type === 'object' && !Array.isArray(value)) {
        this.analyzeObject(value, fullPath, analysis, depth + 1);
      }
    });
  }

  /**
   * Get value type for analysis
   */
  private getValueType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    return typeof value;
  }
}

// Export singleton instance
export const getMessageFilterService = (): MessageFilterService => {
  return MessageFilterService.getInstance();
};