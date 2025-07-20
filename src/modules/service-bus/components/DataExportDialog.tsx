/**
 * Data Export Dialog - UI for configuring and triggering data exports
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/button';
import type { ExportOptions, ExportResult } from '../services/DataExportService';
import { getDataExportService } from '../services/DataExportService';
import type { ServiceBusMessage, MessageAnalytics, FieldAnalytics } from '../../../services/storage/types';

interface DataExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ServiceBusMessage[];
  analytics: MessageAnalytics | null;
  fieldAnalytics: Record<string, FieldAnalytics>;
}

export function DataExportDialog({
  isOpen,
  onClose,
  messages,
  analytics,
  fieldAnalytics,
}: DataExportDialogProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeBody: true,
    includeProperties: true,
    includeAnalytics: false,
    sanitizeData: true,
    customColumns: [],
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'messageId',
    'sequenceNumber',
    'enqueuedTimeUtc',
    'queueOrTopicName',
  ]);

  const exportService = getDataExportService();
  const availableColumns = exportService.getAvailableColumns();

  useEffect(() => {
    if (exportOptions.format === 'csv') {
      setExportOptions(prev => ({
        ...prev,
        customColumns: selectedColumns,
      }));
    }
  }, [selectedColumns, exportOptions.format]);

  const handleExport = async () => {
    if (messages.length === 0) {
      return;
    }

    setIsExporting(true);
    setExportResult(null);

    try {
      let result: ExportResult;

      switch (exportOptions.format) {
        case 'json':
          result = await exportService.exportToJSON(messages, exportOptions);
          break;
        case 'csv':
          result = await exportService.exportToCSV(messages, exportOptions);
          break;
        case 'analytics-report':
          result = await exportService.generateAnalyticsReport(
            messages,
            analytics,
            fieldAnalytics,
            exportOptions
          );
          break;
        default:
          throw new Error('Unsupported export format');
      }

      setExportResult(result);
    } catch (error) {
      console.error('Export failed:', error);
      // TODO: Show error notification
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (exportResult) {
      exportService.downloadExport(exportResult);
      onClose();
    }
  };

  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnKey)
        ? prev.filter(col => col !== columnKey)
        : [...prev, columnKey]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-green-500 p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-mono text-green-400">
            ┌─ DATA EXPORT ─┐
          </h2>
          <Button
            onClick={onClose}
            className="text-green-400 hover:text-green-300 bg-transparent border-none p-1"
          >
            ✕
          </Button>
        </div>

        {!exportResult ? (
          <div className="space-y-6">
            {/* Export Format */}
            <div>
              <label className="block text-green-400 font-mono mb-2">
                Export Format:
              </label>
              <div className="space-y-2">
                {[
                  { value: 'json', label: 'JSON - Structured data format' },
                  { value: 'csv', label: 'CSV - Spreadsheet compatible' },
                  { value: 'analytics-report', label: 'Analytics Report - Comprehensive analysis' },
                ].map(option => (
                  <label key={option.value} className="flex items-center space-x-2 text-green-300">
                    <input
                      type="radio"
                      name="format"
                      value={option.value}
                      checked={exportOptions.format === option.value}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        format: e.target.value as ExportOptions['format'],
                      }))}
                      className="text-green-400"
                    />
                    <span className="font-mono text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* CSV Column Selection */}
            {exportOptions.format === 'csv' && (
              <div>
                <label className="block text-green-400 font-mono mb-2">
                  Select Columns:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-green-700 p-3 rounded">
                  {availableColumns.map(column => (
                    <label key={column.key} className="flex items-center space-x-2 text-green-300">
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(column.key)}
                        onChange={() => handleColumnToggle(column.key)}
                        className="text-green-400"
                      />
                      <span className="font-mono text-sm" title={column.description}>
                        {column.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Content Options */}
            <div>
              <label className="block text-green-400 font-mono mb-2">
                Content Options:
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-green-300">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeBody}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      includeBody: e.target.checked,
                    }))}
                    className="text-green-400"
                  />
                  <span className="font-mono text-sm">Include Message Body</span>
                </label>
                <label className="flex items-center space-x-2 text-green-300">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeProperties}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      includeProperties: e.target.checked,
                    }))}
                    className="text-green-400"
                  />
                  <span className="font-mono text-sm">Include Message Properties</span>
                </label>
                {exportOptions.format === 'analytics-report' && (
                  <label className="flex items-center space-x-2 text-green-300">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeAnalytics}
                      onChange={(e) => setExportOptions(prev => ({
                        ...prev,
                        includeAnalytics: e.target.checked,
                      }))}
                      className="text-green-400"
                    />
                    <span className="font-mono text-sm">Include Detailed Analytics</span>
                  </label>
                )}
              </div>
            </div>

            {/* Security Options */}
            <div>
              <label className="block text-green-400 font-mono mb-2">
                Security Options:
              </label>
              <label className="flex items-center space-x-2 text-green-300">
                <input
                  type="checkbox"
                  checked={exportOptions.sanitizeData}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    sanitizeData: e.target.checked,
                  }))}
                  className="text-green-400"
                />
                <span className="font-mono text-sm">
                  Sanitize sensitive data (emails, phones, etc.)
                </span>
              </label>
            </div>

            {/* Export Summary */}
            <div className="border border-green-700 p-3 rounded bg-gray-800">
              <h3 className="text-green-400 font-mono mb-2">Export Summary:</h3>
              <div className="text-green-300 font-mono text-sm space-y-1">
                <div>Messages to export: {messages.length}</div>
                <div>Format: {exportOptions.format.toUpperCase()}</div>
                <div>Include body: {exportOptions.includeBody ? 'Yes' : 'No'}</div>
                <div>Include properties: {exportOptions.includeProperties ? 'Yes' : 'No'}</div>
                <div>Sanitize data: {exportOptions.sanitizeData ? 'Yes' : 'No'}</div>
                {exportOptions.format === 'csv' && (
                  <div>Columns: {selectedColumns.length} selected</div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <Button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-green-400 border border-green-700 font-mono"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting || messages.length === 0}
                className="bg-green-700 hover:bg-green-600 text-black font-mono"
              >
                {isExporting ? 'Exporting...' : 'Export Data'}
              </Button>
            </div>
          </div>
        ) : (
          /* Export Result */
          <div className="space-y-4">
            <div className="border border-green-700 p-4 rounded bg-gray-800">
              <h3 className="text-green-400 font-mono mb-3">Export Complete!</h3>
              <div className="text-green-300 font-mono text-sm space-y-1">
                <div>File: {exportResult.filename}</div>
                <div>Size: {(exportResult.size / 1024).toFixed(2)} KB</div>
                <div>Type: {exportResult.mimeType}</div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-green-400 border border-green-700 font-mono"
              >
                Close
              </Button>
              <Button
                onClick={handleDownload}
                className="bg-green-700 hover:bg-green-600 text-black font-mono"
              >
                Download File
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}