import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PWAService } from '../PWAService';

// Mock Workbox
vi.mock('workbox-window', () => ({
  Workbox: vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    register: vi.fn().mockResolvedValue(undefined),
    messageSkipWaiting: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined)
  }))
}));

// Mock navigator
const mockNavigator = {
  onLine: true,
  serviceWorker: {
    getRegistration: vi.fn().mockResolvedValue({
      unregister: vi.fn().mockResolvedValue(true)
    })
  }
};

Object.defineProperty(window, 'navigator', {
  value: mockNavigator,
  writable: true
});

describe('PWAService', () => {
  let pwaService: PWAService;
  let mockAddEventListener: ReturnType<typeof vi.fn>;
  let mockRemoveEventListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAddEventListener = vi.fn();
    mockRemoveEventListener = vi.fn();
    
    Object.defineProperty(window, 'addEventListener', {
      value: mockAddEventListener,
      writable: true
    });
    
    Object.defineProperty(window, 'removeEventListener', {
      value: mockRemoveEventListener,
      writable: true
    });

    pwaService = new PWAService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Status', () => {
    it('should return current online status', () => {
      expect(pwaService.isOnline()).toBe(true);
    });

    it('should register network change listeners', () => {
      const callback = vi.fn();
      const unsubscribe = pwaService.onNetworkChange(callback);

      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));

      // Test unsubscribe
      unsubscribe();
      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Update Management', () => {
    it('should register update callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = pwaService.onUpdateAvailable(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should check for updates', async () => {
      await expect(pwaService.checkForUpdates()).resolves.toBeUndefined();
    });
  });

  describe('Install Management', () => {
    it('should register install callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = pwaService.onInstallAvailable(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle beforeinstallprompt event', () => {
      expect(mockAddEventListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('appinstalled', expect.any(Function));
    });
  });

  describe('Service Worker Management', () => {
    it('should get service worker registration', async () => {
      const registration = await pwaService.getRegistration();
      expect(registration).toBeDefined();
      expect(mockNavigator.serviceWorker.getRegistration).toHaveBeenCalled();
    });

    it('should unregister service worker', async () => {
      const result = await pwaService.unregister();
      expect(result).toBe(true);
    });
  });
});