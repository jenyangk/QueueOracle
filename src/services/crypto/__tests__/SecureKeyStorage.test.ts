/**
 * Unit tests for SecureKeyStorage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IndexedDBSecureKeyStorage, type SecureKeyStorage } from '../SecureKeyStorage';

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

const mockTransaction = {
  objectStore: vi.fn(),
  oncomplete: null,
  onerror: null,
  onabort: null,
};

const mockObjectStore = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
};

const mockRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
};

const mockDB = {
  transaction: vi.fn(() => mockTransaction),
  close: vi.fn(),
};

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

describe('SecureKeyStorage', () => {
  let secureKeyStorage: SecureKeyStorage;

  beforeEach(() => {
    const mockEncryptionService = {
      exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      importKey: vi.fn().mockResolvedValue({} as CryptoKey),
      generateKey: vi.fn().mockResolvedValue({} as CryptoKey),
      generateSalt: vi.fn().mockReturnValue(new Uint8Array(16)),
      deriveKey: vi.fn().mockResolvedValue({} as CryptoKey),
      encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      decrypt: vi.fn().mockResolvedValue('decrypted-data')
    };
    secureKeyStorage = new IndexedDBSecureKeyStorage(mockEncryptionService as any);
    vi.clearAllMocks();
    
    // Setup default mocks
    mockIndexedDB.open.mockReturnValue({
      ...mockRequest,
      result: mockDB,
    });
    
    mockTransaction.objectStore.mockReturnValue(mockObjectStore);
    mockObjectStore.put.mockReturnValue(mockRequest);
    mockObjectStore.get.mockReturnValue(mockRequest);
    mockObjectStore.delete.mockReturnValue(mockRequest);
    mockObjectStore.clear.mockReturnValue(mockRequest);
  });

  describe('storeKey', () => {
    it('should store a key with metadata', async () => {
      const keyData = new ArrayBuffer(32);
      const keyId = 'test-key-id';
      
      // Mock successful database operations
      const openRequest = { ...mockRequest };
      mockIndexedDB.open.mockReturnValue(openRequest);
      
      // Simulate successful database opening
      setTimeout(() => {
        openRequest.result = mockDB;
        openRequest.onsuccess?.({ target: openRequest } as any);
      }, 0);
      
      // Mock successful put operation
      const putRequest = { ...mockRequest };
      mockObjectStore.put.mockReturnValue(putRequest);
      
      setTimeout(() => {
        putRequest.onsuccess?.({ target: putRequest } as any);
      }, 0);

      await secureKeyStorage.storeKey(keyId, keyData, { purpose: 'encryption' });

      expect(mockIndexedDB.open).toHaveBeenCalledWith('SecureKeyStorage', 1);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: keyId,
          keyData: keyData,
          metadata: { purpose: 'encryption' },
          createdAt: expect.any(Date),
        })
      );
    });

    it('should throw error when storage fails', async () => {
      const keyData = new ArrayBuffer(32);
      const keyId = 'test-key-id';
      
      const openRequest = { ...mockRequest };
      mockIndexedDB.open.mockReturnValue(openRequest);
      
      setTimeout(() => {
        openRequest.error = new Error('Database error');
        openRequest.onerror?.({ target: openRequest } as any);
      }, 0);

      await expect(
        secureKeyStorage.storeKey(keyId, keyData, { purpose: 'encryption' })
      ).rejects.toThrow('Failed to store key: Database error');
    });
  });

  describe('retrieveKey', () => {
    it('should retrieve a stored key', async () => {
      const keyId = 'test-key-id';
      const storedKeyData = new ArrayBuffer(32);
      
      const openRequest = { ...mockRequest };
      mockIndexedDB.open.mockReturnValue(openRequest);
      
      setTimeout(() => {
        openRequest.result = mockDB;
        openRequest.onsuccess?.({ target: openRequest } as any);
      }, 0);
      
      const getRequest = { ...mockRequest };
      mockObjectStore.get.mockReturnValue(getRequest);
      
      setTimeout(() => {
        getRequest.result = {
          id: keyId,
          keyData: storedKeyData,
          metadata: { purpose: 'encryption' },
          createdAt: new Date(),
        };
        getRequest.onsuccess?.({ target: getRequest } as any);
      }, 0);

      const result = await secureKeyStorage.retrieveKey(keyId);

      expect(result).toEqual({
        keyData: storedKeyData,
        metadata: { purpose: 'encryption' },
        createdAt: expect.any(Date),
      });
    });

    it('should return null for non-existent key', async () => {
      const keyId = 'non-existent-key';
      
      const openRequest = { ...mockRequest };
      mockIndexedDB.open.mockReturnValue(openRequest);
      
      setTimeout(() => {
        openRequest.result = mockDB;
        openRequest.onsuccess?.({ target: openRequest } as any);
      }, 0);
      
      const getRequest = { ...mockRequest };
      mockObjectStore.get.mockReturnValue(getRequest);
      
      setTimeout(() => {
        getRequest.result = undefined;
        getRequest.onsuccess?.({ target: getRequest } as any);
      }, 0);

      const result = await secureKeyStorage.retrieveKey(keyId);
      expect(result).toBeNull();
    });
  });

  describe('deleteKey', () => {
    it('should delete a stored key', async () => {
      const keyId = 'test-key-id';
      
      const openRequest = { ...mockRequest };
      mockIndexedDB.open.mockReturnValue(openRequest);
      
      setTimeout(() => {
        openRequest.result = mockDB;
        openRequest.onsuccess?.({ target: openRequest } as any);
      }, 0);
      
      const deleteRequest = { ...mockRequest };
      mockObjectStore.delete.mockReturnValue(deleteRequest);
      
      setTimeout(() => {
        deleteRequest.onsuccess?.({ target: deleteRequest } as any);
      }, 0);

      await secureKeyStorage.deleteKey(keyId);

      expect(mockObjectStore.delete).toHaveBeenCalledWith(keyId);
    });
  });

  describe('clearAllKeys', () => {
    it('should clear all stored keys', async () => {
      const openRequest = { ...mockRequest };
      mockIndexedDB.open.mockReturnValue(openRequest);
      
      setTimeout(() => {
        openRequest.result = mockDB;
        openRequest.onsuccess?.({ target: openRequest } as any);
      }, 0);
      
      const clearRequest = { ...mockRequest };
      mockObjectStore.clear.mockReturnValue(clearRequest);
      
      setTimeout(() => {
        clearRequest.onsuccess?.({ target: clearRequest } as any);
      }, 0);

      await secureKeyStorage.clearAllKeys();

      expect(mockObjectStore.clear).toHaveBeenCalled();
    });
  });

  describe('listKeys', () => {
    it('should list all stored key IDs', async () => {
      const openRequest = { ...mockRequest };
      mockIndexedDB.open.mockReturnValue(openRequest);
      
      setTimeout(() => {
        openRequest.result = mockDB;
        openRequest.onsuccess?.({ target: openRequest } as any);
      }, 0);
      
      // Mock cursor for getAllKeys
      const getAllKeysRequest = { ...mockRequest };
      mockObjectStore.getAllKeys = vi.fn(() => getAllKeysRequest);
      
      setTimeout(() => {
        getAllKeysRequest.result = ['key1', 'key2', 'key3'];
        getAllKeysRequest.onsuccess?.({ target: getAllKeysRequest } as any);
      }, 0);

      const keys = await secureKeyStorage.listKeys();

      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });
  });

  describe('database initialization', () => {
    it('should create object store on upgrade', async () => {
      const openRequest = { ...mockRequest };
      mockIndexedDB.open.mockReturnValue(openRequest);
      
      const mockUpgradeDB = {
        createObjectStore: vi.fn(),
      };
      
      setTimeout(() => {
        openRequest.result = mockUpgradeDB;
        openRequest.onupgradeneeded?.({ 
          target: openRequest,
          oldVersion: 0,
          newVersion: 1 
        } as any);
      }, 0);

      // Trigger database initialization
      await secureKeyStorage.storeKey('test', new ArrayBuffer(32), {});

      expect(mockUpgradeDB.createObjectStore).toHaveBeenCalledWith('keys', {
        keyPath: 'id'
      });
    });
  });
});