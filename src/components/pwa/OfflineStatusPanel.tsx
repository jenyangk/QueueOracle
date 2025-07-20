/**
 * Offline Status Panel - Shows offline status and pending operations
 */

import React, { useState } from 'react';
import { useOffline } from '../../hooks/useOffline';
import { Button } from '../ui/button';
import { formatDistanceToNow } from 'date-fns';

export function OfflineStatusPanel() {
  const {
    status,
    isOnline,
    pendingOperations,
    conflicts,
    syncOperations,
    cancelOperation,
    retryOperation,
    manageStorage,
    exportData,
    importData,
    isSyncing
  } = useOffline();

  const [showDetails, setShowDetails] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  if (!status) {
    return null;
  }

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const blob = await exportData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `offline-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await importData(file);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-md p-4 font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
          <span className="text-gray-100 font-bold">
            {isOnline ? 'ONLINE' : 'OFFLINE MODE'}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="font-mono text-xs"
        >
          {showDetails ? '[-]' : '[+]'} DETAILS
        </Button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
        <div className="space-y-1">
          <div className="text-gray-400">PENDING OPS:</div>
          <div className="text-yellow-400 font-bold">{status.pendingOperations}</div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">CONFLICTS:</div>
          <div className="text-red-400 font-bold">{status.conflicts}</div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">STORAGE:</div>
          <div className="text-blue-400 font-bold">
            {Math.round(status.storageUsage.totalSize / 1024 / 1024)}MB
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">LAST SYNC:</div>
          <div className="text-green-400 font-bold">
            {status.lastSync ? formatDistanceToNow(status.lastSync, { addSuffix: true }) : 'NEVER'}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={syncOperations}
          disabled={!isOnline || isSyncing}
          className="font-mono text-xs"
        >
          {isSyncing ? '[SYNCING...]' : '[SYNC NOW]'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={manageStorage}
          className="font-mono text-xs"
        >
          [CLEANUP]
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportData}
          disabled={isExporting}
          className="font-mono text-xs"
        >
          {isExporting ? '[EXPORTING...]' : '[EXPORT]'}
        </Button>
        <label className="inline-block">
          <Button
            variant="secondary"
            size="sm"
            disabled={isImporting}
            className="font-mono text-xs cursor-pointer"
            asChild
          >
            <span>{isImporting ? '[IMPORTING...]' : '[IMPORT]'}</span>
          </Button>
          <input
            type="file"
            accept=".json"
            onChange={handleImportData}
            className="hidden"
          />
        </label>
      </div>

      {/* Detailed View */}
      {showDetails && (
        <div className="space-y-4">
          {/* Pending Operations */}
          {pendingOperations.length > 0 && (
            <div>
              <div className="text-yellow-400 font-bold mb-2 text-xs">PENDING OPERATIONS:</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pendingOperations.map((op) => (
                  <div key={op.id} className="bg-gray-800 border border-gray-600 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300">
                        {op.type.toUpperCase()} → {op.entityName}
                      </span>
                      <span className={`text-xs font-bold ${
                        op.status === 'pending' ? 'text-yellow-400' :
                        op.status === 'failed' ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {op.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {formatDistanceToNow(op.timestamp, { addSuffix: true })}
                      {op.retryCount > 0 && ` • Retries: ${op.retryCount}/${op.maxRetries}`}
                    </div>
                    {op.error && (
                      <div className="text-xs text-red-400 mb-2 truncate">
                        Error: {op.error}
                      </div>
                    )}
                    <div className="flex gap-1">
                      {op.status === 'failed' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => retryOperation(op.id)}
                          className="font-mono text-xs h-6"
                        >
                          RETRY
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => cancelOperation(op.id)}
                        className="font-mono text-xs h-6"
                      >
                        CANCEL
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div>
              <div className="text-red-400 font-bold mb-2 text-xs">SYNC CONFLICTS:</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {conflicts.map((conflict) => (
                  <div key={conflict.id} className="bg-gray-800 border border-red-600 rounded p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300">
                        {conflict.type.toUpperCase()} CONFLICT
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(conflict.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-xs text-red-400 mb-2">
                      Local and remote data differ
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="font-mono text-xs h-6"
                      >
                        RESOLVE
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storage Details */}
          <div>
            <div className="text-blue-400 font-bold mb-2 text-xs">STORAGE USAGE:</div>
            <div className="bg-gray-800 border border-gray-600 rounded p-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>Messages: {status.storageUsage.messageCount}</div>
                <div>Analytics: {status.storageUsage.analyticsCount}</div>
                <div>Total Size: {Math.round(status.storageUsage.totalSize / 1024)}KB</div>
                <div>Available: {100 - Math.round(status.storageUsage.totalSize / 1024 / 1024)}MB</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}