import React from 'react';
import { usePWAUpdate } from '../../hooks/usePWA';
import { Button } from '../ui/button';

export function PWAUpdateNotification() {
  const updateInfo = usePWAUpdate();

  if (!updateInfo?.isUpdateAvailable) {
    return null;
  }

  const handleUpdate = async () => {
    await updateInfo.skipWaiting();
    updateInfo.reload();
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-green-900 border border-green-400 text-green-100 p-4 rounded-md shadow-lg max-w-sm">
      <div className="flex items-start space-x-3">
        <div className="text-green-400 text-xl">⚡</div>
        <div className="flex-1">
          <h3 className="font-mono text-sm font-bold mb-1">UPDATE AVAILABLE</h3>
          <p className="font-mono text-xs text-green-200 mb-3">
            A new version of QueueOracle is ready to install.
          </p>
          <div className="flex space-x-2">
            <Button
              onClick={handleUpdate}
              size="sm"
              className="bg-green-600 hover:bg-green-500 text-green-100 font-mono text-xs"
            >
              [UPDATE NOW]
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}