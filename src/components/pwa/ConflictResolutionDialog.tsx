/**
 * Conflict Resolution Dialog - Handle sync conflicts
 */

import React, { useState } from 'react';
import { useOfflineConflicts } from '../../hooks/useOffline';
import { Button } from '../ui/button';
import type { SyncConflict } from '../../services/pwa/OfflineService';
import { formatDistanceToNow } from 'date-fns';

interface ConflictResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: SyncConflict | null;
}

export function ConflictResolutionDialog({ 
  isOpen, 
  onClose, 
  conflict 
}: ConflictResolutionDialogProps) {
  const { resolveConflict } = useOfflineConflicts();
  const [isResolving, setIsResolving] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'merge' | null>(null);

  if (!isOpen || !conflict) {
    return null;
  }

  const handleResolve = async () => {
    if (!selectedResolution) return;

    setIsResolving(true);
    try {
      await resolveConflict(conflict.id, selectedResolution);
      onClose();
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const formatData = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-red-400 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-red-400 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
              <h2 className="text-red-400 font-mono font-bold text-lg">
                SYNC CONFLICT DETECTED
              </h2>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="font-mono text-xs"
            >
              [X] CLOSE
            </Button>
          </div>
          <div className="mt-2 text-gray-400 font-mono text-sm">
            {conflict.type.toUpperCase()} • {formatDistanceToNow(conflict.timestamp, { addSuffix: true })}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            {/* Conflict Description */}
            <div className="bg-gray-800 border border-gray-600 rounded p-4">
              <h3 className="text-yellow-400 font-mono font-bold mb-2">CONFLICT DETAILS:</h3>
              <p className="text-gray-300 font-mono text-sm">
                Local and remote versions of {conflict.type} data have diverged. 
                Choose how to resolve this conflict:
              </p>
            </div>

            {/* Resolution Options */}
            <div className="space-y-4">
              <h3 className="text-blue-400 font-mono font-bold">RESOLUTION OPTIONS:</h3>
              
              {/* Keep Local */}
              <div className="border border-gray-600 rounded p-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="resolution"
                    value="local"
                    checked={selectedResolution === 'local'}
                    onChange={(e) => setSelectedResolution(e.target.value as 'local')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-green-400 font-mono font-bold mb-2">
                      [1] KEEP LOCAL VERSION
                    </div>
                    <div className="text-gray-400 font-mono text-sm mb-3">
                      Discard remote changes and keep your local data
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded p-3 max-h-32 overflow-y-auto">
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                        {formatData(conflict.localData)}
                      </pre>
                    </div>
                  </div>
                </label>
              </div>

              {/* Keep Remote */}
              <div className="border border-gray-600 rounded p-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="resolution"
                    value="remote"
                    checked={selectedResolution === 'remote'}
                    onChange={(e) => setSelectedResolution(e.target.value as 'remote')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-blue-400 font-mono font-bold mb-2">
                      [2] KEEP REMOTE VERSION
                    </div>
                    <div className="text-gray-400 font-mono text-sm mb-3">
                      Discard local changes and use remote data
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded p-3 max-h-32 overflow-y-auto">
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                        {formatData(conflict.remoteData)}
                      </pre>
                    </div>
                  </div>
                </label>
              </div>

              {/* Merge */}
              <div className="border border-gray-600 rounded p-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="resolution"
                    value="merge"
                    checked={selectedResolution === 'merge'}
                    onChange={(e) => setSelectedResolution(e.target.value as 'merge')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-purple-400 font-mono font-bold mb-2">
                      [3] ATTEMPT MERGE
                    </div>
                    <div className="text-gray-400 font-mono text-sm mb-3">
                      Try to automatically merge both versions (may not always be possible)
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded p-3">
                      <div className="text-xs text-gray-400 font-mono">
                        Automatic merge will be attempted based on data structure
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-600 p-4">
          <div className="flex items-center justify-between">
            <div className="text-gray-400 font-mono text-xs">
              Choose a resolution method to continue
            </div>
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={isResolving}
                className="font-mono text-xs"
              >
                CANCEL
              </Button>
              <Button
                onClick={handleResolve}
                disabled={!selectedResolution || isResolving}
                className="font-mono text-xs bg-red-600 hover:bg-red-700"
              >
                {isResolving ? 'RESOLVING...' : 'RESOLVE CONFLICT'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Conflict List Component
export function ConflictList() {
  const { conflicts, clearResolvedConflicts } = useOfflineConflicts();
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  if (conflicts.length === 0) {
    return null;
  }

  const handleResolveConflict = (conflict: SyncConflict) => {
    setSelectedConflict(conflict);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setSelectedConflict(null);
  };

  return (
    <>
      <div className="bg-gray-900 border border-red-400 rounded-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-red-400 font-mono font-bold">
            SYNC CONFLICTS ({conflicts.length})
          </h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={clearResolvedConflicts}
            className="font-mono text-xs"
          >
            CLEAR RESOLVED
          </Button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="bg-gray-800 border border-red-600 rounded p-3 cursor-pointer hover:bg-gray-750"
              onClick={() => handleResolveConflict(conflict)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-400 font-mono font-bold text-sm">
                  {conflict.type.toUpperCase()} CONFLICT
                </span>
                <span className="text-gray-400 font-mono text-xs">
                  {formatDistanceToNow(conflict.timestamp, { addSuffix: true })}
                </span>
              </div>
              <div className="text-gray-300 font-mono text-xs">
                Click to resolve this conflict
              </div>
              {conflict.resolution && (
                <div className="text-green-400 font-mono text-xs mt-1">
                  Resolved: {conflict.resolution.toUpperCase()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConflictResolutionDialog
        isOpen={showDialog}
        onClose={handleCloseDialog}
        conflict={selectedConflict}
      />
    </>
  );
}