/**
 * Analytics Web Worker for JSON message analysis
 * Handles message parsing, field extraction, and analytics computation
 */

import type {
  WorkerMessage,
  WorkerResponse,
  AnalyzeMessagesRequest,
  AnalyzeMessagesResponse,
  UpdateAnalyticsRequest,
  UpdateAnalyticsResponse,
  ExportDataRequest,
  ExportDataResponse,
  FieldInfo,
  FieldStatistics,
  FieldFrequency,
  AnalyticsWorkerConfig,
} from './types';

import { DEFAULT_ANALYTICS_CONFIG } from './types';

import type {
  ServiceBusMessage,
  FieldAnalytics,
  MessageAnalytics,
  TimeSeriesPoint,
  CorrelationData,
} from '../storage/types';

class AnalyticsWorker {
  private config: AnalyticsWorkerConfig = DEFAULT_ANALYTICS_CONFIG;

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
  }

  private async handleMessage(event: MessageEvent<WorkerMessage>) {
    const { id, type, payload } = event.data;

    try {
      let response: WorkerResponse;

      switch (type) {
        case 'ANALYZE_MESSAGES':
          response = await this.analyzeMessages(id, payload as AnalyzeMessagesRequest);
          break;
        case 'UPDATE_ANALYTICS':
          response = await this.updateAnalytics(id, payload as UpdateAnalyticsRequest);
          break;
        case 'EXPORT_DATA':
          response = await this.exportData(id, payload as ExportDataRequest);
          break;
        case 'UPDATE_CONFIG':
          response = this.updateConfig(id, payload as Partial<AnalyticsWorkerConfig>);
          break;
        default:
          response = {
            id,
            type: 'ERROR',
            success: false,
            error: `Unknown message type: ${type}`,
          };
      }

      self.postMessage(response);
    } catch (error) {
      self.postMessage({
        id,
        type: 'ERROR',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async analyzeMessages(
    id: string,
    request: AnalyzeMessagesRequest
  ): Promise<WorkerResponse<AnalyzeMessagesResponse>> {
    const { messages, connectionId } = request;

    // Extract all fields from messages
    const allFields = this.extractAllFields(messages);
    
    // Analyze field statistics
    const fieldStatistics = this.analyzeFields(allFields, messages);
    
    // Convert to FieldAnalytics format
    const fieldAnalytics: Record<string, FieldAnalytics> = {};
    fieldStatistics.forEach(stat => {
      fieldAnalytics[stat.path] = this.convertToFieldAnalytics(stat, connectionId);
    });

    // Generate time series data
    const timeSeriesData = this.generateTimeSeries(messages);

    // Detect correlations
    const correlationMatrix = this.calculateCorrelations(fieldStatistics);

    // Create message analytics
    const analytics: MessageAnalytics = {
      id: `analytics_${connectionId}_${Date.now()}`,
      connectionId,
      totalMessages: messages.length,
      messageTypes: this.analyzeMessageTypes(messages),
      fieldAnalytics,
      timeSeriesData,
      correlationMatrix,
      lastUpdated: new Date(),
    };

    return {
      id,
      type: 'ANALYZE_MESSAGES_RESPONSE',
      success: true,
      payload: {
        analytics,
        fieldAnalytics,
      },
    };
  }

  private async updateAnalytics(
    id: string,
    request: UpdateAnalyticsRequest
  ): Promise<WorkerResponse<UpdateAnalyticsResponse>> {
    const { existingAnalytics, newMessages, connectionId } = request;

    if (!existingAnalytics) {
      // If no existing analytics, perform full analysis
      const analyzeRequest: AnalyzeMessagesRequest = { messages: newMessages, connectionId };
      const result = await this.analyzeMessages(id, analyzeRequest);
      
      if (result.success && result.payload) {
        return {
          id,
          type: 'UPDATE_ANALYTICS_RESPONSE',
          success: true,
          payload: {
            analytics: result.payload.analytics,
            updatedFields: Object.values(result.payload.fieldAnalytics),
          },
        };
      }
      
      // Fallback if analysis failed
      return {
        id,
        type: 'UPDATE_ANALYTICS_RESPONSE',
        success: false,
        error: 'Failed to analyze messages',
      };
    }

    // Merge new messages with existing analytics
    const allFields = this.extractAllFields(newMessages);
    const updatedFieldStats = this.updateFieldStatistics(existingAnalytics.fieldAnalytics, allFields, newMessages);
    
    const updatedFields: FieldAnalytics[] = [];
    const updatedFieldAnalytics: Record<string, FieldAnalytics> = { ...existingAnalytics.fieldAnalytics };

    updatedFieldStats.forEach(stat => {
      const fieldAnalytics = this.convertToFieldAnalytics(stat, connectionId);
      updatedFieldAnalytics[stat.path] = fieldAnalytics;
      updatedFields.push(fieldAnalytics);
    });

    // Update time series
    const newTimeSeriesData = this.generateTimeSeries(newMessages);
    const mergedTimeSeries = this.mergeTimeSeries(existingAnalytics.timeSeriesData, newTimeSeriesData);

    // Update correlations
    const allFieldStats = Object.values(updatedFieldAnalytics).map(fa => 
      this.convertFromFieldAnalytics(fa)
    );
    const updatedCorrelations = this.calculateCorrelations(allFieldStats);

    const updatedAnalytics: MessageAnalytics = {
      ...existingAnalytics,
      totalMessages: existingAnalytics.totalMessages + newMessages.length,
      messageTypes: this.mergeMessageTypes(existingAnalytics.messageTypes, this.analyzeMessageTypes(newMessages)),
      fieldAnalytics: updatedFieldAnalytics,
      timeSeriesData: mergedTimeSeries,
      correlationMatrix: updatedCorrelations,
      lastUpdated: new Date(),
    };

    return {
      id,
      type: 'UPDATE_ANALYTICS_RESPONSE',
      success: true,
      payload: {
        analytics: updatedAnalytics,
        updatedFields,
      },
    };
  }

  private async exportData(
    id: string,
    request: ExportDataRequest
  ): Promise<WorkerResponse<ExportDataResponse>> {
    const { messages, format, fieldAnalytics, includeAnalytics } = request;

    let data: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      const exportData = {
        messages,
        ...(includeAnalytics && fieldAnalytics && { analytics: fieldAnalytics }),
        exportedAt: new Date().toISOString(),
      };
      data = JSON.stringify(exportData, null, 2);
      filename = `service-bus-export-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    } else {
      // CSV format
      data = this.convertToCSV(messages, fieldAnalytics);
      filename = `service-bus-export-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    }

    return {
      id,
      type: 'EXPORT_DATA_RESPONSE',
      success: true,
      payload: {
        data,
        filename,
        mimeType,
      },
    };
  }

  private updateConfig(
    id: string,
    configUpdate: Partial<AnalyticsWorkerConfig>
  ): WorkerResponse {
    this.config = { ...this.config, ...configUpdate };
    
    return {
      id,
      type: 'UPDATE_CONFIG_RESPONSE',
      success: true,
      payload: this.config,
    };
  }

  // Field extraction and analysis methods
  private extractAllFields(messages: ServiceBusMessage[]): FieldInfo[] {
    const allFields: FieldInfo[] = [];

    messages.forEach(message => {
      const fields = this.extractFieldsFromObject(message.jsonFields, '');
      allFields.push(...fields);
    });

    return allFields;
  }

  private extractFieldsFromObject(obj: unknown, prefix: string, depth = 0): FieldInfo[] {
    if (depth > this.config.maxFieldDepth) {
      return [];
    }

    const fields: FieldInfo[] = [];

    if (obj === null || obj === undefined) {
      return fields;
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        
        fields.push({
          path: fieldPath,
          type: this.getValueType(value),
          value,
          size: this.getValueSize(value),
        });

        // Recursively extract nested fields
        if (typeof value === 'object' && value !== null) {
          fields.push(...this.extractFieldsFromObject(value, fieldPath, depth + 1));
        }
      });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const fieldPath = `${prefix}[${index}]`;
        fields.push({
          path: fieldPath,
          type: this.getValueType(item),
          value: item,
          size: this.getValueSize(item),
        });

        if (typeof item === 'object' && item !== null) {
          fields.push(...this.extractFieldsFromObject(item, fieldPath, depth + 1));
        }
      });
    }

    return fields;
  }

  private analyzeFields(fields: FieldInfo[], messages: ServiceBusMessage[]): FieldStatistics[] {
    const fieldGroups = new Map<string, FieldInfo[]>();

    // Group fields by path
    fields.forEach(field => {
      if (!fieldGroups.has(field.path)) {
        fieldGroups.set(field.path, []);
      }
      fieldGroups.get(field.path)!.push(field);
    });

    const statistics: FieldStatistics[] = [];

    fieldGroups.forEach((fieldList, path) => {
      const stat = this.calculateFieldStatistics(path, fieldList, messages);
      statistics.push(stat);
    });

    return statistics;
  }

  private calculateFieldStatistics(path: string, fields: FieldInfo[], messages: ServiceBusMessage[]): FieldStatistics {
    const valueFrequencies = new Map<string, FieldFrequency>();
    const dataTypes = new Set<string>();

    fields.forEach(field => {
      dataTypes.add(field.type);
      
      const valueKey = JSON.stringify(field.value);
      if (!valueFrequencies.has(valueKey)) {
        valueFrequencies.set(valueKey, {
          value: field.value,
          count: 0,
          percentage: 0,
          firstSeen: new Date(),
          lastSeen: new Date(),
        });
      }
      
      const freq = valueFrequencies.get(valueKey)!;
      freq.count++;
      freq.lastSeen = new Date();
    });

    // Calculate percentages
    const totalCount = fields.length;
    valueFrequencies.forEach(freq => {
      freq.percentage = (freq.count / totalCount) * 100;
    });

    // Sort by frequency and limit
    const sortedFrequencies = Array.from(valueFrequencies.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, this.config.maxUniqueValues);

    // Generate trend data
    const trend = this.generateFieldTrend(path, messages);

    return {
      path,
      dataType: Array.from(dataTypes).join('|'),
      totalCount,
      uniqueValues: valueFrequencies.size,
      coverage: (totalCount / messages.length) * 100,
      frequencies: sortedFrequencies,
      trend,
      correlations: [], // Will be calculated separately
    };
  }

  private generateFieldTrend(fieldPath: string, messages: ServiceBusMessage[]): TimeSeriesPoint[] {
    const timeGroups = new Map<string, { count: number; totalSize: number; values: unknown[] }>();

    messages.forEach(message => {
      const timestamp = new Date(message.enqueuedTimeUtc);
      const timeKey = this.getTimeKey(timestamp, this.config.timeSeriesInterval);
      
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, { count: 0, totalSize: 0, values: [] });
      }

      const fieldValue = this.getNestedValue(message.jsonFields, fieldPath);
      if (fieldValue !== undefined) {
        const group = timeGroups.get(timeKey)!;
        group.count++;
        group.totalSize += this.getValueSize(fieldValue);
        group.values.push(fieldValue);
      }
    });

    return Array.from(timeGroups.entries())
      .map(([timeKey, data]) => ({
        timestamp: new Date(timeKey),
        count: data.count,
        avgSize: data.totalSize / data.count,
        fieldValues: { [fieldPath]: data.values },
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private generateTimeSeries(messages: ServiceBusMessage[]): TimeSeriesPoint[] {
    const timeGroups = new Map<string, { count: number; totalSize: number }>();

    messages.forEach(message => {
      const timestamp = new Date(message.enqueuedTimeUtc);
      const timeKey = this.getTimeKey(timestamp, this.config.timeSeriesInterval);
      
      if (!timeGroups.has(timeKey)) {
        timeGroups.set(timeKey, { count: 0, totalSize: 0 });
      }

      const group = timeGroups.get(timeKey)!;
      group.count++;
      group.totalSize += this.getValueSize(message.body);
    });

    return Array.from(timeGroups.entries())
      .map(([timeKey, data]) => ({
        timestamp: new Date(timeKey),
        count: data.count,
        avgSize: data.totalSize / data.count,
        fieldValues: {},
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateCorrelations(fieldStats: FieldStatistics[]): CorrelationData[] {
    if (!this.config.enableCorrelationAnalysis) {
      return [];
    }

    const correlations: CorrelationData[] = [];

    for (let i = 0; i < fieldStats.length; i++) {
      for (let j = i + 1; j < fieldStats.length; j++) {
        const field1 = fieldStats[i];
        const field2 = fieldStats[j];

        const correlation = this.calculatePearsonCorrelation(field1, field2);
        const significance = this.calculateSignificance(correlation, Math.min(field1.totalCount, field2.totalCount));

        if (Math.abs(correlation) >= this.config.correlationThreshold) {
          correlations.push({
            field1: field1.path,
            field2: field2.path,
            correlation,
            significance,
          });
        }
      }
    }

    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  private calculatePearsonCorrelation(field1: FieldStatistics, field2: FieldStatistics): number {
    // Simplified correlation calculation based on value frequencies
    const values1 = field1.frequencies.map(f => typeof f.value === 'number' ? f.value : f.count);
    const values2 = field2.frequencies.map(f => typeof f.value === 'number' ? f.value : f.count);

    if (values1.length === 0 || values2.length === 0) {
      return 0;
    }

    const n = Math.min(values1.length, values2.length);
    const sum1 = values1.slice(0, n).reduce((a, b) => a + b, 0);
    const sum2 = values2.slice(0, n).reduce((a, b) => a + b, 0);
    const sum1Sq = values1.slice(0, n).reduce((a, b) => a + b * b, 0);
    const sum2Sq = values2.slice(0, n).reduce((a, b) => a + b * b, 0);
    const pSum = values1.slice(0, n).reduce((acc, val, i) => acc + val * values2[i], 0);

    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

    return den === 0 ? 0 : num / den;
  }

  private calculateSignificance(correlation: number, sampleSize: number): number {
    // Simplified significance calculation
    const t = correlation * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
    return Math.abs(t);
  }

  // Utility methods
  private getValueType(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    return typeof value;
  }

  private getValueSize(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') return value.length;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 1;
    if (typeof value === 'object') return JSON.stringify(value).length;
    return 0;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;
    
    return path.split('.').reduce((current: any, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private getTimeKey(timestamp: Date, interval: 'minute' | 'hour' | 'day'): string {
    const date = new Date(timestamp);
    
    switch (interval) {
      case 'minute':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      case 'day':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      default:
        return date.toISOString();
    }
  }

  private analyzeMessageTypes(messages: ServiceBusMessage[]): Record<string, number> {
    const types: Record<string, number> = {};

    messages.forEach(message => {
      const messageType = this.inferMessageType(message);
      types[messageType] = (types[messageType] || 0) + 1;
    });

    return types;
  }

  private inferMessageType(message: ServiceBusMessage): string {
    // Try to infer message type from properties or body structure
    if (message.properties.messageType) {
      return String(message.properties.messageType);
    }

    if (message.properties.eventType) {
      return String(message.properties.eventType);
    }

    if (typeof message.body === 'object' && message.body !== null) {
      const bodyObj = message.body as Record<string, unknown>;
      if (bodyObj.type) return String(bodyObj.type);
      if (bodyObj.eventType) return String(bodyObj.eventType);
      if (bodyObj.messageType) return String(bodyObj.messageType);
    }

    return 'unknown';
  }

  private convertToFieldAnalytics(stat: FieldStatistics, connectionId: string): FieldAnalytics {
    return {
      id: `field_${connectionId}_${stat.path}_${Date.now()}`,
      fieldPath: stat.path,
      dataType: stat.dataType,
      count: stat.totalCount,
      uniqueValues: stat.uniqueValues,
      coverage: stat.coverage,
      topValues: stat.frequencies.map(f => ({
        value: f.value,
        count: f.count,
        percentage: f.percentage,
      })),
      trend: stat.trend,
      connectionId,
      lastUpdated: new Date(),
    };
  }

  private convertFromFieldAnalytics(fieldAnalytics: FieldAnalytics): FieldStatistics {
    return {
      path: fieldAnalytics.fieldPath,
      dataType: fieldAnalytics.dataType,
      totalCount: fieldAnalytics.count,
      uniqueValues: fieldAnalytics.uniqueValues,
      coverage: fieldAnalytics.coverage,
      frequencies: fieldAnalytics.topValues.map(tv => ({
        value: tv.value,
        count: tv.count,
        percentage: tv.percentage,
        firstSeen: new Date(),
        lastSeen: fieldAnalytics.lastUpdated,
      })),
      trend: fieldAnalytics.trend,
      correlations: [],
    };
  }

  private updateFieldStatistics(
    existingAnalytics: Record<string, FieldAnalytics>,
    newFields: FieldInfo[],
    newMessages: ServiceBusMessage[]
  ): FieldStatistics[] {
    const updatedStats: FieldStatistics[] = [];
    const fieldGroups = new Map<string, FieldInfo[]>();

    // Group new fields by path
    newFields.forEach(field => {
      if (!fieldGroups.has(field.path)) {
        fieldGroups.set(field.path, []);
      }
      fieldGroups.get(field.path)!.push(field);
    });

    fieldGroups.forEach((fieldList, path) => {
      const existingAnalytic = existingAnalytics[path];
      
      if (existingAnalytic) {
        // Update existing field statistics
        const existingStat = this.convertFromFieldAnalytics(existingAnalytic);
        const newStat = this.calculateFieldStatistics(path, fieldList, newMessages);
        const mergedStat = this.mergeFieldStatistics(existingStat, newStat);
        updatedStats.push(mergedStat);
      } else {
        // New field
        const newStat = this.calculateFieldStatistics(path, fieldList, newMessages);
        updatedStats.push(newStat);
      }
    });

    return updatedStats;
  }

  private mergeFieldStatistics(existing: FieldStatistics, newStat: FieldStatistics): FieldStatistics {
    // Merge frequency data
    const mergedFrequencies = new Map<string, FieldFrequency>();

    existing.frequencies.forEach(freq => {
      const key = JSON.stringify(freq.value);
      mergedFrequencies.set(key, { ...freq });
    });

    newStat.frequencies.forEach(freq => {
      const key = JSON.stringify(freq.value);
      if (mergedFrequencies.has(key)) {
        const existing = mergedFrequencies.get(key)!;
        existing.count += freq.count;
        existing.lastSeen = freq.lastSeen;
      } else {
        mergedFrequencies.set(key, { ...freq });
      }
    });

    const totalCount = existing.totalCount + newStat.totalCount;
    const frequencies = Array.from(mergedFrequencies.values());

    // Recalculate percentages
    frequencies.forEach(freq => {
      freq.percentage = (freq.count / totalCount) * 100;
    });

    return {
      ...existing,
      totalCount,
      uniqueValues: frequencies.length,
      frequencies: frequencies.sort((a, b) => b.count - a.count).slice(0, this.config.maxUniqueValues),
      trend: [...existing.trend, ...newStat.trend].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    };
  }

  private mergeTimeSeries(existing: TimeSeriesPoint[], newPoints: TimeSeriesPoint[]): TimeSeriesPoint[] {
    const merged = new Map<string, TimeSeriesPoint>();

    [...existing, ...newPoints].forEach(point => {
      const key = point.timestamp.toISOString();
      if (merged.has(key)) {
        const existingPoint = merged.get(key)!;
        existingPoint.count += point.count;
        existingPoint.avgSize = (existingPoint.avgSize + point.avgSize) / 2;
        existingPoint.fieldValues = { ...existingPoint.fieldValues, ...point.fieldValues };
      } else {
        merged.set(key, { ...point });
      }
    });

    return Array.from(merged.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private mergeMessageTypes(existing: Record<string, number>, newTypes: Record<string, number>): Record<string, number> {
    const merged = { ...existing };

    Object.entries(newTypes).forEach(([type, count]) => {
      merged[type] = (merged[type] || 0) + count;
    });

    return merged;
  }

  private convertToCSV(messages: ServiceBusMessage[], _fieldAnalytics?: Record<string, FieldAnalytics>): string {
    if (messages.length === 0) {
      return 'No messages to export';
    }

    // Extract all unique field paths
    const allFieldPaths = new Set<string>();
    messages.forEach(message => {
      this.extractFieldPaths(message.jsonFields, '').forEach(path => allFieldPaths.add(path));
    });

    const fieldPaths = Array.from(allFieldPaths).sort();
    
    // Create CSV headers
    const headers = [
      'messageId',
      'sequenceNumber',
      'enqueuedTimeUtc',
      'deliveryCount',
      'sessionId',
      'partitionKey',
      'timeToLive',
      ...fieldPaths,
    ];

    // Create CSV rows
    const rows = messages.map(message => {
      const row: string[] = [
        this.escapeCsvValue(message.messageId),
        this.escapeCsvValue(message.sequenceNumber),
        this.escapeCsvValue(message.enqueuedTimeUtc.toISOString()),
        this.escapeCsvValue(message.deliveryCount.toString()),
        this.escapeCsvValue(message.sessionId || ''),
        this.escapeCsvValue(message.partitionKey || ''),
        this.escapeCsvValue(message.timeToLive?.toString() || ''),
      ];

      fieldPaths.forEach(path => {
        const value = this.getNestedValue(message.jsonFields, path);
        row.push(this.escapeCsvValue(value !== undefined ? JSON.stringify(value) : ''));
      });

      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  private extractFieldPaths(obj: unknown, prefix: string): string[] {
    const paths: string[] = [];

    if (obj === null || obj === undefined) {
      return paths;
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj as Record<string, unknown>).forEach(key => {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        paths.push(fieldPath);
        
        const value = (obj as Record<string, unknown>)[key];
        if (typeof value === 'object' && value !== null) {
          paths.push(...this.extractFieldPaths(value, fieldPath));
        }
      });
    }

    return paths;
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

// Initialize the worker
new AnalyticsWorker();