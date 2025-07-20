/**
 * Data Export Service - Handles exporting messages and analytics data
 */

import type { ServiceBusMessage, MessageAnalytics, FieldAnalytics } from '../../../services/storage/types';
import type { MessageFilter } from '../../../stores/messageStore';

export interface ExportOptions {
  format: 'json' | 'csv' | 'analytics-report';
  includeBody: boolean;
  includeProperties: boolean;
  includeAnalytics: boolean;
  sanitizeData: boolean;
  customColumns?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  filter?: MessageFilter;
}

export interface ExportResult {
  data: Blob;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ScheduledExport {
  id: string;
  name: string;
  options: ExportOptions;
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // HH:MM format
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
  };
  connectionId: string;
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdAt: Date;
}

export interface AnalyticsReportData {
  summary: {
    totalMessages: number;
    dateRange: {
      start: Date;
      end: Date;
    };
    topMessageTypes: Array<{
      type: string;
      count: number;
      percentage: number;
    }>;
    averageMessageSize: number;
    peakHours: Array<{
      hour: number;
      count: number;
    }>;
  };
  fieldAnalytics: Array<{
    fieldPath: string;
    dataType: string;
    coverage: number;
    uniqueValues: number;
    topValues: Array<{
      value: unknown;
      count: number;
      percentage: number;
    }>;
  }>;
  timeSeriesData: Array<{
    timestamp: Date;
    count: number;
    avgSize: number;
  }>;
  correlations: Array<{
    field1: string;
    field2: string;
    correlation: number;
    significance: number;
  }>;
}

class DataExportService {
  /**
   * Export messages to JSON format
   */
  async exportToJSON(
    messages: ServiceBusMessage[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const sanitizedMessages = options.sanitizeData 
      ? this.sanitizeMessages(messages)
      : messages;

    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalMessages: sanitizedMessages.length,
        format: 'json',
        options: {
          includeBody: options.includeBody,
          includeProperties: options.includeProperties,
          sanitized: options.sanitizeData,
        },
      },
      messages: sanitizedMessages.map(message => ({
        messageId: message.messageId,
        sequenceNumber: message.sequenceNumber,
        enqueuedTimeUtc: message.enqueuedTimeUtc,
        ...(options.includeBody && { body: message.body }),
        ...(options.includeProperties && { properties: message.properties }),
        sessionId: message.sessionId,
        partitionKey: message.partitionKey,
        timeToLive: message.timeToLive,
        deliveryCount: message.deliveryCount,
        queueOrTopicName: message.queueOrTopicName,
      })),
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `messages-export-${new Date().toISOString().split('T')[0]}.json`;

    return {
      data: blob,
      filename,
      mimeType: 'application/json',
      size: blob.size,
    };
  }

  /**
   * Export messages to CSV format
   */
  async exportToCSV(
    messages: ServiceBusMessage[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const sanitizedMessages = options.sanitizeData 
      ? this.sanitizeMessages(messages)
      : messages;

    // Define available columns
    const availableColumns = [
      'messageId',
      'sequenceNumber',
      'enqueuedTimeUtc',
      'body',
      'properties',
      'sessionId',
      'partitionKey',
      'timeToLive',
      'deliveryCount',
      'queueOrTopicName',
    ];

    // Use custom columns if provided, otherwise use default set
    const columns = options.customColumns && options.customColumns.length > 0
      ? options.customColumns.filter(col => availableColumns.includes(col))
      : ['messageId', 'sequenceNumber', 'enqueuedTimeUtc', 'queueOrTopicName'];

    // Add body and properties if requested
    if (options.includeBody && !columns.includes('body')) {
      columns.push('body');
    }
    if (options.includeProperties && !columns.includes('properties')) {
      columns.push('properties');
    }

    // Create CSV header
    const csvRows = [columns.join(',')];

    // Add data rows
    sanitizedMessages.forEach(message => {
      const row = columns.map(column => {
        let value = (message as any)[column];
        
        // Handle special formatting
        if (column === 'body' || column === 'properties') {
          value = typeof value === 'object' ? JSON.stringify(value) : value;
        } else if (column === 'enqueuedTimeUtc') {
          value = new Date(value).toISOString();
        }
        
        // Escape CSV values
        if (value === null || value === undefined) {
          return '';
        }
        
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        return stringValue;
      });
      
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const filename = `messages-export-${new Date().toISOString().split('T')[0]}.csv`;

    return {
      data: blob,
      filename,
      mimeType: 'text/csv',
      size: blob.size,
    };
  }

  /**
   * Generate analytics report
   */
  async generateAnalyticsReport(
    messages: ServiceBusMessage[],
    analytics: MessageAnalytics | null,
    fieldAnalytics: Record<string, FieldAnalytics>,
    options: ExportOptions
  ): Promise<ExportResult> {
    const sanitizedMessages = options.sanitizeData 
      ? this.sanitizeMessages(messages)
      : messages;

    const reportData = this.buildAnalyticsReportData(
      sanitizedMessages,
      analytics,
      fieldAnalytics
    );

    const report = {
      metadata: {
        title: 'Service Bus Analytics Report',
        generatedAt: new Date().toISOString(),
        dateRange: options.dateRange || {
          start: sanitizedMessages.length > 0 
            ? new Date(Math.min(...sanitizedMessages.map(m => new Date(m.enqueuedTimeUtc).getTime())))
            : new Date(),
          end: sanitizedMessages.length > 0
            ? new Date(Math.max(...sanitizedMessages.map(m => new Date(m.enqueuedTimeUtc).getTime())))
            : new Date(),
        },
        totalMessages: sanitizedMessages.length,
        sanitized: options.sanitizeData,
      },
      ...reportData,
    };

    const jsonString = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;

    return {
      data: blob,
      filename,
      mimeType: 'application/json',
      size: blob.size,
    };
  }

  /**
   * Sanitize messages by removing sensitive information
   */
  private sanitizeMessages(messages: ServiceBusMessage[]): ServiceBusMessage[] {
    return messages.map(message => ({
      ...message,
      body: this.sanitizeValue(message.body),
      properties: this.sanitizeObject(message.properties),
      jsonFields: this.sanitizeObject(message.jsonFields),
    }));
  }

  /**
   * Sanitize a single value
   */
  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      // Remove potential sensitive patterns
      return value
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
        .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]')
        .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]');
    }
    
    if (typeof value === 'object' && value !== null) {
      return this.sanitizeObject(value as Record<string, unknown>);
    }
    
    return value;
  }

  /**
   * Sanitize an object recursively
   */
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip potentially sensitive keys
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('token') ||
          lowerKey.includes('key') ||
          lowerKey.includes('auth')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitizeValue(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Build analytics report data
   */
  private buildAnalyticsReportData(
    messages: ServiceBusMessage[],
    analytics: MessageAnalytics | null,
    fieldAnalytics: Record<string, FieldAnalytics>
  ): AnalyticsReportData {
    // Calculate summary statistics
    const totalMessages = messages.length;
    const messageSizes = messages.map(m => JSON.stringify(m.body).length);
    const averageMessageSize = messageSizes.length > 0 
      ? messageSizes.reduce((a, b) => a + b, 0) / messageSizes.length 
      : 0;

    // Calculate message types
    const messageTypes: Record<string, number> = {};
    messages.forEach(message => {
      const type = this.getMessageType(message);
      messageTypes[type] = (messageTypes[type] || 0) + 1;
    });

    const topMessageTypes = Object.entries(messageTypes)
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / totalMessages) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate peak hours
    const hourCounts: Record<number, number> = {};
    messages.forEach(message => {
      const hour = new Date(message.enqueuedTimeUtc).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Build field analytics summary
    const fieldAnalyticsSummary = Object.values(fieldAnalytics)
      .map(field => ({
        fieldPath: field.fieldPath,
        dataType: field.dataType,
        coverage: field.coverage,
        uniqueValues: field.uniqueValues,
        topValues: field.topValues.slice(0, 5),
      }))
      .sort((a, b) => b.coverage - a.coverage);

    // Build time series data
    const timeSeriesData = analytics?.timeSeriesData || [];

    // Build correlations
    const correlations = analytics?.correlationMatrix || [];

    return {
      summary: {
        totalMessages,
        dateRange: {
          start: messages.length > 0 
            ? new Date(Math.min(...messages.map(m => new Date(m.enqueuedTimeUtc).getTime())))
            : new Date(),
          end: messages.length > 0
            ? new Date(Math.max(...messages.map(m => new Date(m.enqueuedTimeUtc).getTime())))
            : new Date(),
        },
        topMessageTypes,
        averageMessageSize,
        peakHours,
      },
      fieldAnalytics: fieldAnalyticsSummary,
      timeSeriesData,
      correlations,
    };
  }

  /**
   * Determine message type from message content
   */
  private getMessageType(message: ServiceBusMessage): string {
    // Try to determine type from properties
    if (message.properties?.messageType) {
      return String(message.properties.messageType);
    }
    
    if (message.properties?.eventType) {
      return String(message.properties.eventType);
    }
    
    // Try to determine from body structure
    if (typeof message.body === 'object' && message.body !== null) {
      const body = message.body as Record<string, unknown>;
      if (body.type) {
        return String(body.type);
      }
      if (body.eventType) {
        return String(body.eventType);
      }
      if (body.messageType) {
        return String(body.messageType);
      }
    }
    
    return 'unknown';
  }

  /**
   * Download export result
   */
  downloadExport(result: ExportResult): void {
    const url = URL.createObjectURL(result.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get available export columns for CSV
   */
  getAvailableColumns(): Array<{ key: string; label: string; description: string }> {
    return [
      { key: 'messageId', label: 'Message ID', description: 'Unique identifier for the message' },
      { key: 'sequenceNumber', label: 'Sequence Number', description: 'Message sequence number' },
      { key: 'enqueuedTimeUtc', label: 'Enqueued Time', description: 'When the message was enqueued' },
      { key: 'body', label: 'Message Body', description: 'The message payload' },
      { key: 'properties', label: 'Properties', description: 'Message properties and metadata' },
      { key: 'sessionId', label: 'Session ID', description: 'Message session identifier' },
      { key: 'partitionKey', label: 'Partition Key', description: 'Message partition key' },
      { key: 'timeToLive', label: 'Time To Live', description: 'Message TTL in seconds' },
      { key: 'deliveryCount', label: 'Delivery Count', description: 'Number of delivery attempts' },
      { key: 'queueOrTopicName', label: 'Queue/Topic', description: 'Source queue or topic name' },
    ];
  }
}

// Singleton instance
let dataExportService: DataExportService | null = null;

export function getDataExportService(): DataExportService {
  if (!dataExportService) {
    dataExportService = new DataExportService();
  }
  return dataExportService;
}

export { DataExportService };