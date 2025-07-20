/**
 * Web Worker types and interfaces for JSON analytics
 */

import type { ServiceBusMessage, FieldAnalytics, MessageAnalytics, TimeSeriesPoint, CorrelationData } from '../storage/types';

// Worker Message Types
export interface WorkerMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
}

export interface WorkerResponse<T = unknown> {
  id: string;
  type: string;
  success: boolean;
  payload?: T;
  error?: string;
}

// Analytics Worker Messages
export interface AnalyzeMessagesRequest {
  messages: ServiceBusMessage[];
  connectionId: string;
}

export interface AnalyzeMessagesResponse {
  analytics: MessageAnalytics;
  fieldAnalytics: Record<string, FieldAnalytics>;
}

export interface UpdateAnalyticsRequest {
  existingAnalytics: MessageAnalytics | null;
  newMessages: ServiceBusMessage[];
  connectionId: string;
}

export interface UpdateAnalyticsResponse {
  analytics: MessageAnalytics;
  updatedFields: FieldAnalytics[];
}

export interface ExportDataRequest {
  messages: ServiceBusMessage[];
  format: 'json' | 'csv';
  fieldAnalytics?: Record<string, FieldAnalytics>;
  includeAnalytics: boolean;
}

export interface ExportDataResponse {
  data: string;
  filename: string;
  mimeType: string;
}

// Field Analysis Types
export interface FieldInfo {
  path: string;
  type: string;
  value: unknown;
  size: number;
}

export interface FieldFrequency {
  value: unknown;
  count: number;
  percentage: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface FieldStatistics {
  path: string;
  dataType: string;
  totalCount: number;
  uniqueValues: number;
  coverage: number;
  frequencies: FieldFrequency[];
  trend: TimeSeriesPoint[];
  correlations: Array<{
    field: string;
    correlation: number;
    significance: number;
  }>;
}

// Message Pattern Types
export interface MessagePattern {
  id: string;
  pattern: Record<string, unknown>;
  count: number;
  percentage: number;
  examples: string[];
  firstSeen: Date;
  lastSeen: Date;
}

export interface PatternAnalysis {
  patterns: MessagePattern[];
  totalMessages: number;
  uniquePatterns: number;
  patternCoverage: number;
}

// Time Series Analysis Types
export interface TimeSeriesConfig {
  interval: 'minute' | 'hour' | 'day';
  fieldPath?: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

export interface TimeSeriesAnalysis {
  config: TimeSeriesConfig;
  points: TimeSeriesPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: boolean;
  anomalies: Array<{
    timestamp: Date;
    value: number;
    expected: number;
    deviation: number;
  }>;
}

// Correlation Analysis Types
export interface CorrelationAnalysis {
  matrix: CorrelationData[];
  strongCorrelations: Array<{
    field1: string;
    field2: string;
    correlation: number;
    significance: number;
    relationship: 'positive' | 'negative';
  }>;
  fieldClusters: Array<{
    fields: string[];
    avgCorrelation: number;
  }>;
}

// Worker Configuration
export interface AnalyticsWorkerConfig {
  maxFieldDepth: number;
  maxUniqueValues: number;
  correlationThreshold: number;
  timeSeriesInterval: 'minute' | 'hour' | 'day';
  enablePatternDetection: boolean;
  enableCorrelationAnalysis: boolean;
  enableTimeSeriesAnalysis: boolean;
}

// Default configuration
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsWorkerConfig = {
  maxFieldDepth: 10,
  maxUniqueValues: 1000,
  correlationThreshold: 0.5,
  timeSeriesInterval: 'hour',
  enablePatternDetection: true,
  enableCorrelationAnalysis: true,
  enableTimeSeriesAnalysis: true,
};