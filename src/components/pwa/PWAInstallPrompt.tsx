import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWA';
import { Button } from '../ui/button';

export function PWAInstallPrompt() {
  const installInfo = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!installInfo?.isInstallable || isDismissed) {
    return null;
  }

  const handleInstall = async () => {
    try {
      await installInfo.install();
      setIsDismissed(true);
    } catch (error) {
      console.error('Failed to install PWA:', error);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-blue-900 border border-blue-400 text-blue-100 p-4 rounded-md shadow-lg">
      <div className="flex items-start space-x-3">
        <div className="text-blue-400 text-xl">📱</div>
        <div className="flex-1">
          <h3 className="font-mono text-sm font-bold mb-1">INSTALL APP</h3>
          <p className="font-mono text-xs text-blue-200 mb-3">
            Install QueueOracle for quick access and offline capabilities.
          </p>
          <div className="flex space-x-2">
            <Button
              onClick={handleInstall}
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-blue-100 font-mono text-xs"
            >
              [INSTALL]
            </Button>
            <Button
              onClick={handleDismiss}
              variant="outline"
              size="sm"
              className="border-blue-400 text-blue-200 hover:bg-blue-800 font-mono text-xs"
            >
              [DISMISS]
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}