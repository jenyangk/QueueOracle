import { Workbox } from 'workbox-window';

export interface PWAUpdateInfo {
  isUpdateAvailable: boolean;
  skipWaiting: () => Promise<void>;
  reload: () => void;
}

export interface PWAInstallInfo {
  isInstallable: boolean;
  install: () => Promise<void>;
}

export class PWAService {
  private workbox: Workbox | null = null;
  private installPrompt: BeforeInstallPromptEvent | null = null;
  private updateCallbacks: Array<(info: PWAUpdateInfo) => void> = [];
  private installCallbacks: Array<(info: PWAInstallInfo) => void> = [];

  constructor() {
    this.initializeServiceWorker();
    this.setupInstallPrompt();
  }

  private initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
      this.workbox = new Workbox('/sw.js', {
        scope: '/',
        type: 'module'
      });

      // Handle service worker updates
      this.workbox.addEventListener('waiting', () => {
        this.notifyUpdateAvailable();
      });

      // Handle service worker activation
      this.workbox.addEventListener('controlling', () => {
        window.location.reload();
      });

      // Register the service worker
      this.workbox.register().catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    }
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event as BeforeInstallPromptEvent;
      this.notifyInstallAvailable();
    });

    // Handle successful installation
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.notifyInstallAvailable();
    });
  }

  private notifyUpdateAvailable() {
    const updateInfo: PWAUpdateInfo = {
      isUpdateAvailable: true,
      skipWaiting: async () => {
        if (this.workbox) {
          await this.workbox.messageSkipWaiting();
        }
      },
      reload: () => {
        window.location.reload();
      }
    };

    this.updateCallbacks.forEach(callback => callback(updateInfo));
  }

  private notifyInstallAvailable() {
    const installInfo: PWAInstallInfo = {
      isInstallable: this.installPrompt !== null,
      install: async () => {
        if (this.installPrompt) {
          const result = await this.installPrompt.prompt();
          if (result.outcome === 'accepted') {
            this.installPrompt = null;
          }
        }
      }
    };

    this.installCallbacks.forEach(callback => callback(installInfo));
  }

  public onUpdateAvailable(callback: (info: PWAUpdateInfo) => void) {
    this.updateCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  public onInstallAvailable(callback: (info: PWAInstallInfo) => void) {
    this.installCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.installCallbacks.indexOf(callback);
      if (index > -1) {
        this.installCallbacks.splice(index, 1);
      }
    };
  }

  public async checkForUpdates(): Promise<void> {
    if (this.workbox) {
      try {
        await this.workbox.update();
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    }
  }

  public isOnline(): boolean {
    return navigator.onLine;
  }

  public onNetworkChange(callback: (isOnline: boolean) => void) {
    const handleOnline = () => {
      callback(true);
      // Trigger offline service sync when coming back online
      this.handleOnlineReconnection();
    };
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return unsubscribe function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  private async handleOnlineReconnection(): Promise<void> {
    // Notify offline service about reconnection
    try {
      // Import dynamically to avoid circular dependencies
      await import('./OfflineService');
      // The offline service will handle its own reconnection logic
    } catch (error) {
      console.error('Failed to handle online reconnection:', error);
    }
  }

  public async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if ('serviceWorker' in navigator) {
      return (await navigator.serviceWorker.getRegistration()) || null;
    }
    return null;
  }

  public async unregister(): Promise<boolean> {
    const registration = await this.getRegistration();
    if (registration) {
      return await registration.unregister();
    }
    return false;
  }
}

// Global PWA service instance
export const pwaService = new PWAService();

// Type declaration for beforeinstallprompt event
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}