import React, { useState } from 'react';
import { useNetworkStatus } from '../../hooks/usePWA';
import { useOfflineStatus } from '../../hooks/useOffline';

export function NetworkStatusIndicator() {
  const isOnline = useNetworkStatus();
  const { status } = useOfflineStatus();
  const [showDetails, setShowDetails] = useState(false);

  if (isOnline && (!status || (status.pendingOperations === 0 && status.conflicts === 0))) {
    return null; // Don't show anything when online and no issues
  }

  const hasIssues = status && (status.pendingOperations > 0 || status.conflicts > 0);

  return (
    <div className="fixed top-4 left-4 z-50">
      <div 
        className={`border rounded-md shadow-lg transition-all duration-200 ${
          isOnline 
            ? 'bg-yellow-900 border-yellow-400 text-yellow-100' 
            : 'bg-red-900 border-red-400 text-red-100'
        } ${showDetails ? 'w-80' : 'w-auto'}`}
      >
        {/* Main Status Bar */}
        <div 
          className="flex items-center justify-between px-3 py-2 cursor-pointer"
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              isOnline ? 'bg-yellow-400' : 'bg-red-400'
            }`}></div>
            <span className="font-mono text-xs font-bold">
              {isOnline ? 'SYNC ISSUES' : 'OFFLINE MODE'}
            </span>
            {hasIssues && (
              <span className="font-mono text-xs">
                ({status.pendingOperations + status.conflicts})
              </span>
            )}
          </div>
          <span className="font-mono text-xs">
            {showDetails ? '[-]' : '[+]'}
          </span>
        </div>

        {/* Detailed Status */}
        {showDetails && status && (
          <div className="border-t border-gray-600 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-gray-400">PENDING:</span>
                <span className="ml-1 text-yellow-400 font-bold">
                  {status.pendingOperations}
                </span>
              </div>
              <div>
                <span className="text-gray-400">CONFLICTS:</span>
                <span className="ml-1 text-red-400 font-bold">
                  {status.conflicts}
                </span>
              </div>
            </div>
            
            {status.lastSync && (
              <div className="text-xs font-mono text-gray-400">
                Last sync: {new Date(status.lastSync).toLocaleTimeString()}
              </div>
            )}

            {!isOnline && (
              <div className="text-xs font-mono text-gray-300">
                Some features are limited while offline. 
                Data will sync when connection is restored.
              </div>
            )}

            {status.syncInProgress && (
              <div className="text-xs font-mono text-blue-400 animate-pulse">
                Synchronizing...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}