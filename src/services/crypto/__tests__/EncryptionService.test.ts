/**
 * Unit tests for EncryptionService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebCryptoEncryptionService } from '../EncryptionService';

// Mock Web Crypto API for testing environment
const mockCrypto = {
  subtle: {
    generateKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    importKey: vi.fn(),
    exportKey: vi.fn(),
    deriveKey: vi.fn(),
    digest: vi.fn(),
  },
  getRandomValues: vi.fn(),
};

// Setup global crypto mock
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
});

describe('WebCryptoEncryptionService', () => {
  let encryptionService: WebCryptoEncryptionService;
  let mockKey: CryptoKey;

  beforeEach(() => {
    encryptionService = new WebCryptoEncryptionService();
    mockKey = {} as CryptoKey;
    vi.clearAllMocks();
  });

  describe('generateKey', () => {
    it('should generate an AES-GCM key with correct parameters', async () => {
      mockCrypto.subtle.generateKey.mockResolvedValue(mockKey);

      const result = await encryptionService.generateKey();

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
      expect(result).toBe(mockKey);
    });

    it('should throw error when key generation fails', async () => {
      const error = new Error('Key generation failed');
      mockCrypto.subtle.generateKey.mockRejectedValue(error);

      await expect(encryptionService.generateKey()).rejects.toThrow(
        'Key generation failed: Key generation failed'
      );
    });
  });

  describe('encrypt', () => {
    it('should encrypt data with AES-GCM', async () => {
      const testData = 'test data';
      const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const mockEncryptedData = new ArrayBuffer(16);
      
      mockCrypto.getRandomValues.mockReturnValue(mockIV);
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncryptedData);

      const result = await encryptionService.encrypt(testData, mockKey);

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: mockIV,
        }),
        mockKey,
        expect.any(Object) // Accept any buffer-like object
      );
      
      // Result should contain IV + encrypted data
      const resultArray = new Uint8Array(result);
      expect(resultArray.length).toBe(mockIV.length + mockEncryptedData.byteLength);
    });

    it('should throw error when encryption fails', async () => {
      const error = new Error('Encryption failed');
      mockCrypto.getRandomValues.mockReturnValue(new Uint8Array(12));
      mockCrypto.subtle.encrypt.mockRejectedValue(error);

      await expect(encryptionService.encrypt('test', mockKey)).rejects.toThrow(
        'Encryption failed: Encryption failed'
      );
    });
  });

  describe('decrypt', () => {
    it('should decrypt data with AES-GCM', async () => {
      const testData = 'decrypted data';
      const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const mockEncryptedData = new Uint8Array([13, 14, 15, 16]);
      const mockDecryptedData = new TextEncoder().encode(testData);
      
      // Create combined buffer (IV + encrypted data)
      const combinedBuffer = new Uint8Array(mockIV.length + mockEncryptedData.length);
      combinedBuffer.set(mockIV, 0);
      combinedBuffer.set(mockEncryptedData, mockIV.length);
      
      mockCrypto.subtle.decrypt.mockResolvedValue(mockDecryptedData.buffer);

      const result = await encryptionService.decrypt(combinedBuffer.buffer, mockKey);

      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledWith(
        {
          name: 'AES-GCM',
          iv: mockIV,
        },
        mockKey,
        expect.any(Uint8Array)
      );
      expect(result).toBe(testData);
    });

    it('should throw error when decryption fails', async () => {
      const error = new Error('Decryption failed');
      const mockData = new Uint8Array(20); // 12 bytes IV + 8 bytes data
      mockCrypto.subtle.decrypt.mockRejectedValue(error);

      await expect(encryptionService.decrypt(mockData.buffer, mockKey)).rejects.toThrow(
        'Decryption failed: Decryption failed'
      );
    });
  });

  describe('deriveKey', () => {
    it('should derive key from password using PBKDF2', async () => {
      const password = 'test-password';
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const mockKeyMaterial = {} as CryptoKey;
      
      mockCrypto.subtle.importKey.mockResolvedValue(mockKeyMaterial);
      mockCrypto.subtle.deriveKey.mockResolvedValue(mockKey);

      const result = await encryptionService.deriveKey(password, salt);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Object), // Accept any buffer-like object
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        mockKeyMaterial,
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
      
      expect(result).toBe(mockKey);
    });

    it('should throw error when key derivation fails', async () => {
      const error = new Error('Key derivation failed');
      const salt = new Uint8Array(16);
      mockCrypto.subtle.importKey.mockRejectedValue(error);

      await expect(encryptionService.deriveKey('password', salt)).rejects.toThrow(
        'Key derivation failed: Key derivation failed'
      );
    });
  });

  describe('generateSalt', () => {
    it('should generate a 16-byte salt', () => {
      const mockSalt = new Uint8Array(16);
      mockCrypto.getRandomValues.mockReturnValue(mockSalt);

      const result = encryptionService.generateSalt();

      expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(result).toBe(mockSalt);
      expect(result.length).toBe(16);
    });
  });

  describe('exportKey', () => {
    it('should export key to raw format', async () => {
      const mockExportedKey = new ArrayBuffer(32);
      mockCrypto.subtle.exportKey.mockResolvedValue(mockExportedKey);

      const result = await encryptionService.exportKey(mockKey);

      expect(mockCrypto.subtle.exportKey).toHaveBeenCalledWith('raw', mockKey);
      expect(result).toBe(mockExportedKey);
    });

    it('should throw error when key export fails', async () => {
      const error = new Error('Export failed');
      mockCrypto.subtle.exportKey.mockRejectedValue(error);

      await expect(encryptionService.exportKey(mockKey)).rejects.toThrow(
        'Key export failed: Export failed'
      );
    });
  });

  describe('importKey', () => {
    it('should import key from raw format', async () => {
      const keyData = new ArrayBuffer(32);
      mockCrypto.subtle.importKey.mockResolvedValue(mockKey);

      const result = await encryptionService.importKey(keyData);

      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        keyData,
        {
          name: 'AES-GCM',
          length: 256,
        },
        true,
        ['encrypt', 'decrypt']
      );
      expect(result).toBe(mockKey);
    });

    it('should throw error when key import fails', async () => {
      const error = new Error('Import failed');
      const keyData = new ArrayBuffer(32);
      mockCrypto.subtle.importKey.mockRejectedValue(error);

      await expect(encryptionService.importKey(keyData)).rejects.toThrow(
        'Key import failed: Import failed'
      );
    });
  });

  describe('integration tests', () => {
    it('should have proper method signatures for integration', () => {
      // Test that all required methods exist and have proper signatures
      expect(typeof encryptionService.generateKey).toBe('function');
      expect(typeof encryptionService.encrypt).toBe('function');
      expect(typeof encryptionService.decrypt).toBe('function');
      expect(typeof encryptionService.deriveKey).toBe('function');
      expect(typeof encryptionService.generateSalt).toBe('function');
      expect(typeof encryptionService.exportKey).toBe('function');
      expect(typeof encryptionService.importKey).toBe('function');
    });

    it('should handle error cases gracefully', async () => {
      // Test error handling without relying on real crypto
      const error = new Error('Test error');
      mockCrypto.subtle.generateKey.mockRejectedValue(error);
      
      await expect(encryptionService.generateKey()).rejects.toThrow('Key generation failed: Test error');
    });
  });
});