import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePWA, useNetworkStatus, usePWAInstall, usePWAUpdate } from '../usePWA';

// Mock PWA Service
vi.mock('../../services/pwa/PWAService', () => ({
  pwaService: {
    isOnline: vi.fn(() => true),
    onNetworkChange: vi.fn(() => vi.fn()),
    onUpdateAvailable: vi.fn(() => vi.fn()),
    onInstallAvailable: vi.fn(() => vi.fn()),
    checkForUpdates: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('PWA Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('usePWA', () => {
    it('should return PWA state and functions', () => {
      const { result } = renderHook(() => usePWA());

      expect(result.current).toEqual({
        isOnline: true,
        updateInfo: null,
        installInfo: null,
        checkForUpdates: expect.any(Function)
      });
    });

    it('should call checkForUpdates', async () => {
      const { result } = renderHook(() => usePWA());

      await act(async () => {
        await result.current.checkForUpdates();
      });

      // The function should be callable without errors
      expect(result.current.checkForUpdates).toBeDefined();
    });
  });

  describe('useNetworkStatus', () => {
    it('should return network status', () => {
      const { result } = renderHook(() => useNetworkStatus());
      expect(result.current).toBe(true);
    });
  });

  describe('usePWAInstall', () => {
    it('should return install info', () => {
      const { result } = renderHook(() => usePWAInstall());
      expect(result.current).toBeNull();
    });
  });

  describe('usePWAUpdate', () => {
    it('should return update info', () => {
      const { result } = renderHook(() => usePWAUpdate());
      expect(result.current).toBeNull();
    });
  });
});