/**
 * EncryptionService - Handles encryption/decryption using Web Crypto API
 * Provides secure credential storage and key management
 */

export interface EncryptionService {
  encrypt(data: string, key: CryptoKey): Promise<ArrayBuffer>;
  decrypt(encryptedData: ArrayBuffer, key: CryptoKey): Promise<string>;
  generateKey(): Promise<CryptoKey>;
  deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;
  generateSalt(): Uint8Array;
  exportKey(key: CryptoKey): Promise<ArrayBuffer>;
  importKey(keyData: ArrayBuffer): Promise<CryptoKey>;
}

export class WebCryptoEncryptionService implements EncryptionService {
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;
  private readonly ivLength = 12; // 96 bits for GCM
  private readonly saltLength = 16; // 128 bits
  private readonly iterations = 100000; // PBKDF2 iterations

  /**
   * Encrypts data using AES-GCM with the provided key
   */
  async encrypt(data: string, key: CryptoKey): Promise<ArrayBuffer> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      // Generate random IV for each encryption
      const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));
      
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv,
        },
        key,
        dataBuffer
      );

      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encryptedData.byteLength);
      result.set(iv, 0);
      result.set(new Uint8Array(encryptedData), iv.length);
      
      return result.buffer;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypts data using AES-GCM with the provided key
   */
  async decrypt(encryptedData: ArrayBuffer, key: CryptoKey): Promise<string> {
    try {
      const dataArray = new Uint8Array(encryptedData);
      
      // Extract IV and encrypted data
      const iv = dataArray.slice(0, this.ivLength);
      const encrypted = dataArray.slice(this.ivLength);
      
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv,
        },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates a new AES-GCM key
   */
  async generateKey(): Promise<CryptoKey> {
    try {
      return await crypto.subtle.generateKey(
        {
          name: this.algorithm,
          length: this.keyLength,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new Error(`Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Derives a key from a password using PBKDF2
   */
  async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    try {
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(password);
      
      // Import password as key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // Derive the actual encryption key
      return await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: this.iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        {
          name: this.algorithm,
          length: this.keyLength,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates a cryptographically secure random salt
   */
  generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.saltLength));
  }

  /**
   * Exports a key to raw format for storage
   */
  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    try {
      return await crypto.subtle.exportKey('raw', key);
    } catch (error) {
      throw new Error(`Key export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Imports a key from raw format
   */
  async importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    try {
      return await crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: this.algorithm,
          length: this.keyLength,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new Error(`Key import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
export const encryptionService = new WebCryptoEncryptionService();