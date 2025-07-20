/**
 * SecureKeyStorage - Manages secure storage and retrieval of encryption keys
 * Uses IndexedDB for persistent storage with additional security measures
 */

import { encryptionService, type EncryptionService } from './EncryptionService';

export interface SecureKeyStorage {
  storeKey(keyId: string, key: CryptoKey, password?: string): Promise<void>;
  retrieveKey(keyId: string, password?: string): Promise<CryptoKey | null>;
  deleteKey(keyId: string): Promise<void>;
  listKeys(): Promise<string[]>;
  clearAll(): Promise<void>;
  hasKey(keyId: string): Promise<boolean>;
}

interface StoredKeyData {
  keyId: string;
  encryptedKey: ArrayBuffer;
  salt: Uint8Array;
  derivedFromPassword: boolean;
  createdAt: Date;
  lastAccessed: Date;
}

export class IndexedDBSecureKeyStorage implements SecureKeyStorage {
  private readonly dbName = 'SecureKeyStorage';
  private readonly dbVersion = 1;
  private readonly storeName = 'keys';
  private db: IDBDatabase | null = null;
  private readonly encryption: EncryptionService;

  constructor(encryptionService: EncryptionService) {
    this.encryption = encryptionService;
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'keyId' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
      };
    });
  }

  /**
   * Store a key securely in IndexedDB
   */
  async storeKey(keyId: string, key: CryptoKey, password?: string): Promise<void> {
    try {
      const db = await this.initDB();
      const exportedKey = await this.encryption.exportKey(key);
      
      let encryptedKey: ArrayBuffer;
      let salt: Uint8Array;
      let derivedFromPassword = false;

      if (password) {
        // Derive encryption key from password
        salt = this.encryption.generateSalt();
        const derivedKey = await this.encryption.deriveKey(password, salt);
        encryptedKey = await this.encryption.encrypt(
          new TextDecoder().decode(exportedKey),
          derivedKey
        );
        derivedFromPassword = true;
      } else {
        // Use a generated key for encryption
        salt = this.encryption.generateSalt();
        const storageKey = await this.encryption.generateKey();
        encryptedKey = await this.encryption.encrypt(
          new TextDecoder().decode(exportedKey),
          storageKey
        );
        
        // Store the storage key in a separate location (this is a simplified approach)
        // In a real implementation, you might use additional security measures
        localStorage.setItem(`storage_key_${keyId}`, JSON.stringify({
          key: Array.from(new Uint8Array(await this.encryption.exportKey(storageKey))),
          salt: Array.from(salt)
        }));
      }

      const keyData: StoredKeyData = {
        keyId,
        encryptedKey,
        salt,
        derivedFromPassword,
        createdAt: new Date(),
        lastAccessed: new Date(),
      };

      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(keyData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to store key: ${request.error?.message}`));
      });
    } catch (error) {
      throw new Error(`Key storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a key from secure storage
   */
  async retrieveKey(keyId: string, password?: string): Promise<CryptoKey | null> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const keyData = await new Promise<StoredKeyData | null>((resolve, reject) => {
        const request = store.get(keyId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(new Error(`Failed to retrieve key: ${request.error?.message}`));
      });

      if (!keyData) {
        return null;
      }

      // Update last accessed time
      keyData.lastAccessed = new Date();
      store.put(keyData);

      let decryptionKey: CryptoKey;

      if (keyData.derivedFromPassword) {
        if (!password) {
          throw new Error('Password required for key retrieval');
        }
        decryptionKey = await this.encryption.deriveKey(password, keyData.salt);
      } else {
        // Retrieve storage key from localStorage (simplified approach)
        const storageKeyData = localStorage.getItem(`storage_key_${keyId}`);
        if (!storageKeyData) {
          throw new Error('Storage key not found');
        }
        
        const { key: keyArray } = JSON.parse(storageKeyData);
        const keyBuffer = new Uint8Array(keyArray).buffer;
        decryptionKey = await this.encryption.importKey(keyBuffer);
      }

      const decryptedKeyData = await this.encryption.decrypt(keyData.encryptedKey, decryptionKey);
      const keyBuffer = new TextEncoder().encode(decryptedKeyData).buffer;
      
      return await this.encryption.importKey(keyBuffer);
    } catch (error) {
      throw new Error(`Key retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a key from storage
   */
  async deleteKey(keyId: string): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(keyId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to delete key: ${request.error?.message}`));
      });

      // Also remove storage key if it exists
      localStorage.removeItem(`storage_key_${keyId}`);
    } catch (error) {
      throw new Error(`Key deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all stored key IDs
   */
  async listKeys(): Promise<string[]> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(new Error(`Failed to list keys: ${request.error?.message}`));
      });
    } catch (error) {
      throw new Error(`Key listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a key exists in storage
   */
  async hasKey(keyId: string): Promise<boolean> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      return new Promise((resolve, reject) => {
        const request = store.count(keyId);
        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => reject(new Error(`Failed to check key existence: ${request.error?.message}`));
      });
    } catch (error) {
      throw new Error(`Key existence check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all stored keys
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.initDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Get all keys first to clean up localStorage
      const keyIds = await this.listKeys();
      
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to clear keys: ${request.error?.message}`));
      });

      // Clean up localStorage storage keys
      keyIds.forEach(keyId => {
        localStorage.removeItem(`storage_key_${keyId}`);
      });
    } catch (error) {
      throw new Error(`Key clearing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
export const secureKeyStorage = new IndexedDBSecureKeyStorage(encryptionService);