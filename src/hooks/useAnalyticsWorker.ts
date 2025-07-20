/**
 * React hook for analytics worker integration
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAnalyticsWorkerService } from '../services/worker/AnalyticsWorkerService';
import type { ServiceBusMessage, MessageAnalytics, FieldAnalytics } from '../services/storage/types';
import type { AnalyticsWorkerConfig } from '../services/worker/types';

interface UseAnalyticsWorkerReturn {
  // State
  isAnalyzing: boolean;
  isExporting: boolean;
  workerStatus: {
    available: boolean;
    pendingRequests: number;
  };
  error: string | null;

  // Methods
  analyzeMessages: (messages: ServiceBusMessage[], connectionId: string) => Promise<{
    analytics: MessageAnalytics;
    fieldAnalytics: Record<string, FieldAnalytics>;
  } | null>;
  updateAnalytics: (
    existingAnalytics: MessageAnalytics | null,
    newMessages: ServiceBusMessage[],
    connectionId: string
  ) => Promise<{
    analytics: MessageAnalytics;
    updatedFields: FieldAnalytics[];
  } | null>;
  exportData: (
    messages: ServiceBusMessage[],
    format: 'json' | 'csv',
    options?: {
      fieldAnalytics?: Record<string, FieldAnalytics>;
      includeAnalytics?: boolean;
    }
  ) => Promise<{
    data: string;
    filename: string;
    mimeType: string;
  } | null>;
  updateConfig: (config: Partial<AnalyticsWorkerConfig>) => Promise<AnalyticsWorkerConfig | null>;
  restartWorker: () => void;
  clearError: () => void;
}

export function useAnalyticsWorker(): UseAnalyticsWorkerReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [workerStatus, setWorkerStatus] = useState({
    available: false,
    pendingRequests: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const workerServiceRef = useRef(getAnalyticsWorkerService());
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update worker status periodically
  useEffect(() => {
    const updateStatus = () => {
      const status = workerServiceRef.current.getStatus();
      setWorkerStatus(status);
    };

    updateStatus();
    statusIntervalRef.current = setInterval(updateStatus, 1000);

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, []);

  const handleError = useCallback((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    setError(errorMessage);
    console.error('Analytics worker error:', err);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const analyzeMessages = useCallback(async (
    messages: ServiceBusMessage[],
    connectionId: string
  ) => {
    if (!workerServiceRef.current.isAvailable()) {
      setError('Analytics worker is not available');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await workerServiceRef.current.analyzeMessages(messages, connectionId);
      return result;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [handleError]);

  const updateAnalytics = useCallback(async (
    existingAnalytics: MessageAnalytics | null,
    newMessages: ServiceBusMessage[],
    connectionId: string
  ) => {
    if (!workerServiceRef.current.isAvailable()) {
      setError('Analytics worker is not available');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await workerServiceRef.current.updateAnalytics(
        existingAnalytics,
        newMessages,
        connectionId
      );
      return result;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [handleError]);

  const exportData = useCallback(async (
    messages: ServiceBusMessage[],
    format: 'json' | 'csv',
    options: {
      fieldAnalytics?: Record<string, FieldAnalytics>;
      includeAnalytics?: boolean;
    } = {}
  ) => {
    if (!workerServiceRef.current.isAvailable()) {
      setError('Analytics worker is not available');
      return null;
    }

    setIsExporting(true);
    setError(null);

    try {
      const result = await workerServiceRef.current.exportData(messages, format, options);
      return result;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [handleError]);

  const updateConfig = useCallback(async (config: Partial<AnalyticsWorkerConfig>) => {
    if (!workerServiceRef.current.isAvailable()) {
      setError('Analytics worker is not available');
      return null;
    }

    setError(null);

    try {
      const result = await workerServiceRef.current.updateConfig(config);
      return result;
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [handleError]);

  const restartWorker = useCallback(() => {
    setError(null);
    workerServiceRef.current.restart();
  }, []);

  return {
    // State
    isAnalyzing,
    isExporting,
    workerStatus,
    error,

    // Methods
    analyzeMessages,
    updateAnalytics,
    exportData,
    updateConfig,
    restartWorker,
    clearError,
  };
}

// Hook for analytics worker status only (lighter weight)
export function useAnalyticsWorkerStatus() {
  const [status, setStatus] = useState({
    available: false,
    pendingRequests: 0,
  });

  useEffect(() => {
    const workerService = getAnalyticsWorkerService();
    const updateStatus = () => {
      setStatus(workerService.getStatus());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  return status;
}