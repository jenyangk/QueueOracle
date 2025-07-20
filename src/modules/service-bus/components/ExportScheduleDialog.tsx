/**
 * Export Schedule Dialog - UI for managing scheduled exports
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../components/ui/button';
import type { ScheduledExport, ExportOptions } from '../services/DataExportService';
import { getExportSchedulerService } from '../services/ExportSchedulerService';
import { getDataExportService } from '../services/DataExportService';

interface ExportScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  editingExport?: ScheduledExport | null;
}

export function ExportScheduleDialog({
  isOpen,
  onClose,
  connectionId,
  editingExport,
}: ExportScheduleDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    format: 'json' as ExportOptions['format'],
    includeBody: true,
    includeProperties: true,
    includeAnalytics: false,
    sanitizeData: true,
    customColumns: [] as string[],
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    time: '09:00',
    dayOfWeek: 1, // Monday
    dayOfMonth: 1,
  });

  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'messageId',
    'sequenceNumber',
    'enqueuedTimeUtc',
    'queueOrTopicName',
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduledExports, setScheduledExports] = useState<ScheduledExport[]>([]);

  const schedulerService = getExportSchedulerService();
  const exportService = getDataExportService();
  const availableColumns = exportService.getAvailableColumns();

  const loadScheduledExports = useCallback(() => {
    const exports = schedulerService.getScheduledExportsForConnection(connectionId);
    setScheduledExports(exports);
  }, [schedulerService, connectionId]);

  useEffect(() => {
    if (isOpen) {
      loadScheduledExports();
      
      if (editingExport) {
        setFormData({
          name: editingExport.name,
          format: editingExport.options.format,
          includeBody: editingExport.options.includeBody,
          includeProperties: editingExport.options.includeProperties,
          includeAnalytics: editingExport.options.includeAnalytics,
          sanitizeData: editingExport.options.sanitizeData,
          customColumns: editingExport.options.customColumns || [],
          frequency: editingExport.schedule.frequency,
          time: editingExport.schedule.time,
          dayOfWeek: editingExport.schedule.dayOfWeek || 1,
          dayOfMonth: editingExport.schedule.dayOfMonth || 1,
        });
        setSelectedColumns(editingExport.options.customColumns || selectedColumns);
      }
    }
  }, [isOpen, editingExport, loadScheduledExports, selectedColumns]);

  useEffect(() => {
    if (formData.format === 'csv') {
      setFormData(prev => ({
        ...prev,
        customColumns: selectedColumns,
      }));
    }
  }, [selectedColumns, formData.format]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const exportOptions: ExportOptions = {
        format: formData.format,
        includeBody: formData.includeBody,
        includeProperties: formData.includeProperties,
        includeAnalytics: formData.includeAnalytics,
        sanitizeData: formData.sanitizeData,
        customColumns: formData.format === 'csv' ? selectedColumns : undefined,
      };

      const schedule = {
        frequency: formData.frequency,
        time: formData.time,
        ...(formData.frequency === 'weekly' && { dayOfWeek: formData.dayOfWeek }),
        ...(formData.frequency === 'monthly' && { dayOfMonth: formData.dayOfMonth }),
      };

      if (editingExport) {
        await schedulerService.updateScheduledExport(editingExport.id, {
          name: formData.name,
          options: exportOptions,
          schedule,
        });
      } else {
        await schedulerService.createScheduledExport(
          formData.name,
          exportOptions,
          schedule,
          connectionId
        );
      }

      loadScheduledExports();
      resetForm();
    } catch (error) {
      console.error('Failed to save scheduled export:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExport = async (exportId: string) => {
    if (confirm('Are you sure you want to delete this scheduled export?')) {
      try {
        await schedulerService.deleteScheduledExport(exportId);
        loadScheduledExports();
      } catch (error) {
        console.error('Failed to delete scheduled export:', error);
      }
    }
  };

  const handleToggleExport = async (exportId: string, isActive: boolean) => {
    try {
      await schedulerService.toggleScheduledExport(exportId, isActive);
      loadScheduledExports();
    } catch (error) {
      console.error('Failed to toggle scheduled export:', error);
    }
  };

  const handleTriggerExport = async (exportId: string) => {
    try {
      const success = await schedulerService.triggerExport(exportId);
      if (success) {
        console.log('Export triggered successfully');
        // TODO: Show success notification
      }
    } catch (error) {
      console.error('Failed to trigger export:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      format: 'json',
      includeBody: true,
      includeProperties: true,
      includeAnalytics: false,
      sanitizeData: true,
      customColumns: [],
      frequency: 'daily',
      time: '09:00',
      dayOfWeek: 1,
      dayOfMonth: 1,
    });
    setSelectedColumns([
      'messageId',
      'sequenceNumber',
      'enqueuedTimeUtc',
      'queueOrTopicName',
    ]);
  };

  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnKey)
        ? prev.filter(col => col !== columnKey)
        : [...prev, columnKey]
    );
  };

  const formatNextRun = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-green-500 p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-mono text-green-400">
            ┌─ EXPORT SCHEDULER ─┐
          </h2>
          <Button
            onClick={onClose}
            className="text-green-400 hover:text-green-300 bg-transparent border-none p-1"
          >
            ✕
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create/Edit Form */}
          <div>
            <h3 className="text-green-400 font-mono mb-4">
              {editingExport ? 'Edit Scheduled Export' : 'Create Scheduled Export'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Export Name */}
              <div>
                <label className="block text-green-400 font-mono mb-1 text-sm">
                  Export Name:
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-green-700 text-green-300 font-mono p-2 rounded"
                  placeholder="Daily Message Export"
                  required
                />
              </div>

              {/* Export Format */}
              <div>
                <label className="block text-green-400 font-mono mb-1 text-sm">
                  Format:
                </label>
                <select
                  value={formData.format}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    format: e.target.value as ExportOptions['format'] 
                  }))}
                  className="w-full bg-gray-800 border border-green-700 text-green-300 font-mono p-2 rounded"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="analytics-report">Analytics Report</option>
                </select>
              </div>

              {/* CSV Columns */}
              {formData.format === 'csv' && (
                <div>
                  <label className="block text-green-400 font-mono mb-1 text-sm">
                    CSV Columns:
                  </label>
                  <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto border border-green-700 p-2 rounded">
                    {availableColumns.map(column => (
                      <label key={column.key} className="flex items-center space-x-1 text-green-300">
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(column.key)}
                          onChange={() => handleColumnToggle(column.key)}
                          className="text-green-400"
                        />
                        <span className="font-mono text-xs">{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Options */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-green-300">
                  <input
                    type="checkbox"
                    checked={formData.includeBody}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      includeBody: e.target.checked 
                    }))}
                    className="text-green-400"
                  />
                  <span className="font-mono text-sm">Include Body</span>
                </label>
                <label className="flex items-center space-x-2 text-green-300">
                  <input
                    type="checkbox"
                    checked={formData.includeProperties}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      includeProperties: e.target.checked 
                    }))}
                    className="text-green-400"
                  />
                  <span className="font-mono text-sm">Include Properties</span>
                </label>
                <label className="flex items-center space-x-2 text-green-300">
                  <input
                    type="checkbox"
                    checked={formData.sanitizeData}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      sanitizeData: e.target.checked 
                    }))}
                    className="text-green-400"
                  />
                  <span className="font-mono text-sm">Sanitize Data</span>
                </label>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-green-400 font-mono mb-1 text-sm">
                  Frequency:
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    frequency: e.target.value as 'daily' | 'weekly' | 'monthly' 
                  }))}
                  className="w-full bg-gray-800 border border-green-700 text-green-300 font-mono p-2 rounded"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-green-400 font-mono mb-1 text-sm">
                  Time:
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full bg-gray-800 border border-green-700 text-green-300 font-mono p-2 rounded"
                />
              </div>

              {formData.frequency === 'weekly' && (
                <div>
                  <label className="block text-green-400 font-mono mb-1 text-sm">
                    Day of Week:
                  </label>
                  <select
                    value={formData.dayOfWeek}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      dayOfWeek: parseInt(e.target.value) 
                    }))}
                    className="w-full bg-gray-800 border border-green-700 text-green-300 font-mono p-2 rounded"
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
              )}

              {formData.frequency === 'monthly' && (
                <div>
                  <label className="block text-green-400 font-mono mb-1 text-sm">
                    Day of Month:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dayOfMonth}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      dayOfMonth: parseInt(e.target.value) 
                    }))}
                    className="w-full bg-gray-800 border border-green-700 text-green-300 font-mono p-2 rounded"
                  />
                </div>
              )}

              <div className="flex space-x-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.name.trim()}
                  className="bg-green-700 hover:bg-green-600 text-black font-mono"
                >
                  {isSubmitting ? 'Saving...' : (editingExport ? 'Update' : 'Create')}
                </Button>
                {editingExport && (
                  <Button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-700 hover:bg-gray-600 text-green-400 border border-green-700 font-mono"
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>
          </div>

          {/* Scheduled Exports List */}
          <div>
            <h3 className="text-green-400 font-mono mb-4">
              Scheduled Exports ({scheduledExports.length})
            </h3>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {scheduledExports.length === 0 ? (
                <div className="text-green-300 font-mono text-sm text-center py-4">
                  No scheduled exports configured
                </div>
              ) : (
                scheduledExports.map(exportConfig => (
                  <div
                    key={exportConfig.id}
                    className="border border-green-700 p-3 rounded bg-gray-800"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-green-400 font-mono font-semibold">
                        {exportConfig.name}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={exportConfig.isActive}
                            onChange={(e) => handleToggleExport(exportConfig.id, e.target.checked)}
                            className="text-green-400"
                          />
                          <span className="text-green-300 font-mono text-xs">Active</span>
                        </label>
                      </div>
                    </div>
                    
                    <div className="text-green-300 font-mono text-xs space-y-1">
                      <div>Format: {exportConfig.options.format.toUpperCase()}</div>
                      <div>
                        Schedule: {exportConfig.schedule.frequency} at {exportConfig.schedule.time}
                      </div>
                      <div>Next run: {formatNextRun(exportConfig.nextRun)}</div>
                      {exportConfig.lastRun && (
                        <div>Last run: {formatNextRun(exportConfig.lastRun)}</div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 mt-3">
                      <Button
                        onClick={() => handleTriggerExport(exportConfig.id)}
                        className="bg-blue-700 hover:bg-blue-600 text-white font-mono text-xs px-2 py-1"
                      >
                        Run Now
                      </Button>
                      <Button
                        onClick={() => handleDeleteExport(exportConfig.id)}
                        className="bg-red-700 hover:bg-red-600 text-white font-mono text-xs px-2 py-1"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}