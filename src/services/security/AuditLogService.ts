export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'data-access' | 'configuration' | 'security' | 'system';
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface AuditLogFilter {
  startDate?: number;
  endDate?: number;
  userId?: string;
  action?: string;
  category?: string;
  severity?: string;
  success?: boolean;
}

export interface AuditLogSummary {
  totalEntries: number;
  entriesByCategory: Record<string, number>;
  entriesBySeverity: Record<string, number>;
  failureRate: number;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  recentCriticalEvents: AuditLogEntry[];
}

class AuditLogService {
  private logs: AuditLogEntry[] = [];
  private readonly MAX_LOGS = 10000;
  private readonly STORAGE_KEY = 'audit-logs';
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadLogsFromStorage();
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateLogId(): string {
    return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'sessionId'>): void {
    const logEntry: AuditLogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      ...entry
    };

    this.logs.push(logEntry);

    // Maintain log size limit
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }

    // Store logs persistently
    this.saveLogsToStorage();

    // Handle critical events
    if (entry.severity === 'critical') {
      this.handleCriticalEvent(logEntry);
    }
  }

  private getClientIP(): string {
    // In a browser environment, we can't directly get the client IP
    // This would typically be handled by the server
    return 'client-side';
  }

  private handleCriticalEvent(entry: AuditLogEntry): void {
    console.warn('CRITICAL SECURITY EVENT:', entry);
    
    // In a real application, you might want to:
    // - Send immediate alerts
    // - Trigger additional security measures
    // - Notify administrators
  }

  public logAuthentication(action: string, success: boolean, details: Record<string, unknown> = {}, userId?: string): void {
    this.log({
      userId: userId || 'anonymous',
      action,
      resource: 'authentication',
      details,
      severity: success ? 'low' : 'high',
      category: 'authentication',
      success,
      ...(success ? {} : { errorMessage: 'Authentication failed' })
    });
  }

  public logDataAccess(action: string, resource: string, success: boolean, details: Record<string, unknown> = {}, userId?: string): void {
    this.log({
      userId: userId || 'anonymous',
      action,
      resource,
      details,
      severity: 'medium',
      category: 'data-access',
      success,
      ...(success ? {} : { errorMessage: 'Data access failed' })
    });
  }

  public logConfigurationChange(action: string, resource: string, details: Record<string, unknown> = {}, userId?: string): void {
    this.log({
      userId: userId || 'anonymous',
      action,
      resource,
      details,
      severity: 'high',
      category: 'configuration',
      success: true
    });
  }

  public logSecurityEvent(action: string, resource: string, severity: AuditLogEntry['severity'], details: Record<string, unknown> = {}, userId?: string): void {
    this.log({
      userId: userId || 'anonymous',
      action,
      resource,
      details,
      severity,
      category: 'security',
      success: false,
      errorMessage: 'Security event detected'
    });
  }

  public logSystemEvent(action: string, resource: string, success: boolean, details: Record<string, unknown> = {}): void {
    this.log({
      userId: 'system',
      action,
      resource,
      details,
      severity: success ? 'low' : 'medium',
      category: 'system',
      success,
      ...(success ? {} : { errorMessage: 'System event failed' })
    });
  }

  public getLogs(filter?: AuditLogFilter): AuditLogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startDate!);
      }
      
      if (filter.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endDate!);
      }
      
      if (filter.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
      }
      
      if (filter.action) {
        filteredLogs = filteredLogs.filter(log => log.action.includes(filter.action!));
      }
      
      if (filter.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filter.category);
      }
      
      if (filter.severity) {
        filteredLogs = filteredLogs.filter(log => log.severity === filter.severity);
      }
      
      if (filter.success !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.success === filter.success);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getLogsSummary(filter?: AuditLogFilter): AuditLogSummary {
    const logs = this.getLogs(filter);
    
    const entriesByCategory: Record<string, number> = {};
    const entriesBySeverity: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    
    let failureCount = 0;

    logs.forEach(log => {
      // Count by category
      entriesByCategory[log.category] = (entriesByCategory[log.category] || 0) + 1;
      
      // Count by severity
      entriesBySeverity[log.severity] = (entriesBySeverity[log.severity] || 0) + 1;
      
      // Count actions
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      
      // Count users
      if (log.userId) {
        userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
      }
      
      // Count failures
      if (!log.success) {
        failureCount++;
      }
    });

    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    const topUsers = Object.entries(userCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    const recentCriticalEvents = logs
      .filter(log => log.severity === 'critical')
      .slice(0, 10);

    return {
      totalEntries: logs.length,
      entriesByCategory,
      entriesBySeverity,
      failureRate: logs.length > 0 ? failureCount / logs.length : 0,
      topActions,
      topUsers,
      recentCriticalEvents
    };
  }

  public exportLogs(filter?: AuditLogFilter, format: 'json' | 'csv' = 'json'): string {
    const logs = this.getLogs(filter);
    
    if (format === 'csv') {
      const headers = [
        'ID', 'Timestamp', 'User ID', 'Session ID', 'Action', 'Resource',
        'Category', 'Severity', 'Success', 'IP Address', 'User Agent', 'Error Message'
      ];
      
      const csvRows = [
        headers.join(','),
        ...logs.map(log => [
          log.id,
          new Date(log.timestamp).toISOString(),
          log.userId || '',
          log.sessionId,
          log.action,
          log.resource,
          log.category,
          log.severity,
          log.success.toString(),
          log.ipAddress || '',
          `"${log.userAgent || ''}"`,
          `"${log.errorMessage || ''}"`
        ].join(','))
      ];
      
      return csvRows.join('\n');
    }
    
    return JSON.stringify({
      exportTimestamp: Date.now(),
      totalEntries: logs.length,
      logs
    }, null, 2);
  }

  public clearLogs(olderThan?: number): number {
    const initialCount = this.logs.length;
    
    if (olderThan) {
      this.logs = this.logs.filter(log => log.timestamp > olderThan);
    } else {
      this.logs = [];
    }
    
    this.saveLogsToStorage();
    return initialCount - this.logs.length;
  }

  public searchLogs(query: string): AuditLogEntry[] {
    const lowerQuery = query.toLowerCase();
    
    return this.logs.filter(log => 
      log.action.toLowerCase().includes(lowerQuery) ||
      log.resource.toLowerCase().includes(lowerQuery) ||
      log.category.toLowerCase().includes(lowerQuery) ||
      (log.userId && log.userId.toLowerCase().includes(lowerQuery)) ||
      (log.errorMessage && log.errorMessage.toLowerCase().includes(lowerQuery)) ||
      JSON.stringify(log.details).toLowerCase().includes(lowerQuery)
    ).sort((a, b) => b.timestamp - a.timestamp);
  }

  public getSecurityAlerts(): AuditLogEntry[] {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    return this.logs.filter(log => 
      log.timestamp > oneHourAgo &&
      (log.severity === 'critical' || log.severity === 'high') &&
      !log.success
    ).sort((a, b) => b.timestamp - a.timestamp);
  }

  public detectAnomalies(): {
    suspiciousPatterns: Array<{
      pattern: string;
      count: number;
      severity: string;
      description: string;
    }>;
    recommendations: string[];
  } {
    const recentLogs = this.logs.filter(log => 
      log.timestamp > Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
    );

    const suspiciousPatterns: any[] = [];
    const recommendations: string[] = [];

    // Check for repeated failures from same user
    const userFailures: Record<string, number> = {};
    recentLogs.filter(log => !log.success && log.userId).forEach(log => {
      userFailures[log.userId!] = (userFailures[log.userId!] || 0) + 1;
    });

    Object.entries(userFailures).forEach(([userId, count]) => {
      if (count > 5) {
        suspiciousPatterns.push({
          pattern: 'repeated-failures',
          count,
          severity: 'high',
          description: `User ${userId} has ${count} failed operations in the last 24 hours`
        });
      }
    });

    // Check for unusual activity patterns
    const hourlyActivity: Record<number, number> = {};
    recentLogs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });

    const avgActivity = Object.values(hourlyActivity).reduce((sum, count) => sum + count, 0) / 24;
    Object.entries(hourlyActivity).forEach(([hour, count]) => {
      if (count > avgActivity * 3) {
        suspiciousPatterns.push({
          pattern: 'unusual-activity-spike',
          count,
          severity: 'medium',
          description: `Unusual activity spike at hour ${hour} with ${count} events (avg: ${avgActivity.toFixed(1)})`
        });
      }
    });

    // Generate recommendations
    if (suspiciousPatterns.length > 0) {
      recommendations.push('Review recent security events and consider implementing additional monitoring');
    }

    const criticalEvents = recentLogs.filter(log => log.severity === 'critical').length;
    if (criticalEvents > 0) {
      recommendations.push(`${criticalEvents} critical security events detected - immediate review recommended`);
    }

    const failureRate = recentLogs.length > 0 ? 
      recentLogs.filter(log => !log.success).length / recentLogs.length : 0;
    if (failureRate > 0.1) {
      recommendations.push(`High failure rate detected (${(failureRate * 100).toFixed(1)}%) - investigate system issues`);
    }

    return { suspiciousPatterns, recommendations };
  }

  private saveLogsToStorage(): void {
    try {
      // Only store recent logs to avoid storage limits
      const recentLogs = this.logs.slice(-1000); // Keep last 1000 logs
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentLogs));
    } catch (error) {
      console.warn('Failed to save audit logs to storage:', error);
    }
  }

  private loadLogsFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load audit logs from storage:', error);
      this.logs = [];
    }
  }
}

export const auditLogService = new AuditLogService();