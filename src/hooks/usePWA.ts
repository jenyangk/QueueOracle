import { useState, useEffect } from 'react';
import { pwaService, type PWAUpdateInfo, type PWAInstallInfo } from '../services/pwa/PWAService';

export interface PWAState {
  isOnline: boolean;
  updateInfo: PWAUpdateInfo | null;
  installInfo: PWAInstallInfo | null;
  checkForUpdates: () => Promise<void>;
}

export function usePWA(): PWAState {
  const [isOnline, setIsOnline] = useState(pwaService.isOnline());
  const [updateInfo, setUpdateInfo] = useState<PWAUpdateInfo | null>(null);
  const [installInfo, setInstallInfo] = useState<PWAInstallInfo | null>(null);

  useEffect(() => {
    // Set up network status monitoring
    const unsubscribeNetwork = pwaService.onNetworkChange(setIsOnline);

    // Set up update monitoring
    const unsubscribeUpdate = pwaService.onUpdateAvailable((info) => {
      setUpdateInfo(info);
    });

    // Set up install monitoring
    const unsubscribeInstall = pwaService.onInstallAvailable((info) => {
      setInstallInfo(info);
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeNetwork();
      unsubscribeUpdate();
      unsubscribeInstall();
    };
  }, []);

  const checkForUpdates = async () => {
    await pwaService.checkForUpdates();
  };

  return {
    isOnline,
    updateInfo,
    installInfo,
    checkForUpdates
  };
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(pwaService.isOnline());

  useEffect(() => {
    const unsubscribe = pwaService.onNetworkChange(setIsOnline);
    return unsubscribe;
  }, []);

  return isOnline;
}

export function usePWAInstall() {
  const [installInfo, setInstallInfo] = useState<PWAInstallInfo | null>(null);

  useEffect(() => {
    const unsubscribe = pwaService.onInstallAvailable(setInstallInfo);
    return unsubscribe;
  }, []);

  return installInfo;
}

export function usePWAUpdate() {
  const [updateInfo, setUpdateInfo] = useState<PWAUpdateInfo | null>(null);

  useEffect(() => {
    const unsubscribe = pwaService.onUpdateAvailable(setUpdateInfo);
    return unsubscribe;
  }, []);

  return updateInfo;
}