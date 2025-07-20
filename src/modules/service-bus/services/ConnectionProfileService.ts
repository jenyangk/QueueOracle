import type { ConnectionProfile } from '../types/connection';
import { SecureStorageService } from '../../../services/storage/SecureStorageService';
import { db } from '../../../services/storage/Database';
import { encryptionService } from '../../../services/crypto/EncryptionService';
import { secureKeyStorage } from '../../../services/crypto/SecureKeyStorage';

export class ConnectionProfileService {
  // private static readonly STORAGE_KEY = 'service-bus-connections'; // Unused for now
  private static storageService: SecureStorageService;
  private static database: any;

  /**
   * Initialize the service with storage dependencies
   */
  static async initialize(): Promise<void> {
    if (!this.storageService) {
      this.storageService = new SecureStorageService(db, encryptionService, secureKeyStorage);
      await this.storageService.initialize();
    }
    
    if (!this.database) {
      this.database = db;
      await this.database.open();
    }
  }

  /**
   * Get all connection profiles
   */
  static async getAllProfiles(): Promise<ConnectionProfile[]> {
    await this.initialize();
    
    try {
      const profiles = await this.database.connectionProfiles.toArray();
      return profiles.map((profile: any) => ({
        ...profile,
        createdAt: new Date(profile.createdAt),
        lastUsed: new Date(profile.lastUsed)
      }));
    } catch (error) {
      console.error('Failed to load connection profiles:', error);
      return [];
    }
  }

  /**
   * Get a specific connection profile by ID
   */
  static async getProfile(id: string): Promise<ConnectionProfile | null> {
    await this.initialize();
    
    try {
      const profile = await this.database.connectionProfiles.get(id);
      if (!profile) return null;
      
      return {
        ...profile,
        createdAt: new Date(profile.createdAt),
        lastUsed: new Date(profile.lastUsed)
      };
    } catch (error) {
      console.error('Failed to load connection profile:', error);
      return null;
    }
  }

  /**
   * Save a new connection profile
   */
  static async saveProfile(profile: ConnectionProfile): Promise<void> {
    await this.initialize();
    
    try {
      // Encrypt the connection string before storing
      const encryptedProfile = {
        ...profile,
        connectionString: await this.encryptConnectionString(profile.connectionString)
      };
      
      await this.database.connectionProfiles.add(encryptedProfile);
    } catch (error) {
      console.error('Failed to save connection profile:', error);
      throw new Error('Failed to save connection profile');
    }
  }

  /**
   * Update an existing connection profile
   */
  static async updateProfile(profile: ConnectionProfile): Promise<void> {
    await this.initialize();
    
    try {
      // Encrypt the connection string before storing
      const encryptedProfile = {
        ...profile,
        connectionString: await this.encryptConnectionString(profile.connectionString),
        lastUsed: new Date()
      };
      
      await this.database.connectionProfiles.put(encryptedProfile);
    } catch (error) {
      console.error('Failed to update connection profile:', error);
      throw new Error('Failed to update connection profile');
    }
  }

  /**
   * Delete a connection profile
   */
  static async deleteProfile(id: string): Promise<void> {
    await this.initialize();
    
    try {
      await this.database.connectionProfiles.delete(id);
    } catch (error) {
      console.error('Failed to delete connection profile:', error);
      throw new Error('Failed to delete connection profile');
    }
  }

  /**
   * Get the currently active connection profile
   */
  static async getActiveProfile(): Promise<ConnectionProfile | null> {
    const profiles = await this.getAllProfiles();
    return profiles.find(profile => profile.isActive) || null;
  }

  /**
   * Set a connection profile as active (and deactivate others)
   */
  static async setActiveProfile(id: string): Promise<void> {
    await this.initialize();
    
    try {
      // First, deactivate all profiles
      const profiles = await this.getAllProfiles();
      for (const profile of profiles) {
        if (profile.isActive) {
          await this.database.connectionProfiles.update(profile.id, { 
            isActive: false 
          });
        }
      }
      
      // Then activate the selected profile
      await this.database.connectionProfiles.update(id, { 
        isActive: true,
        lastUsed: new Date()
      });
    } catch (error) {
      console.error('Failed to set active profile:', error);
      throw new Error('Failed to set active profile');
    }
  }

  /**
   * Deactivate all connection profiles
   */
  static async deactivateAllProfiles(): Promise<void> {
    await this.initialize();
    
    try {
      const profiles = await this.getAllProfiles();
      for (const profile of profiles) {
        if (profile.isActive) {
          await this.database.connectionProfiles.update(profile.id, { 
            isActive: false 
          });
        }
      }
    } catch (error) {
      console.error('Failed to deactivate profiles:', error);
      throw new Error('Failed to deactivate profiles');
    }
  }

  /**
   * Get connection profiles sorted by last used
   */
  static async getRecentProfiles(limit: number = 5): Promise<ConnectionProfile[]> {
    const profiles = await this.getAllProfiles();
    return profiles
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .slice(0, limit);
  }

  /**
   * Search connection profiles by name
   */
  static async searchProfiles(query: string): Promise<ConnectionProfile[]> {
    const profiles = await this.getAllProfiles();
    const lowerQuery = query.toLowerCase();
    
    return profiles.filter(profile => 
      profile.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Export connection profiles (without sensitive data)
   */
  static async exportProfiles(): Promise<Partial<ConnectionProfile>[]> {
    const profiles = await this.getAllProfiles();
    
    return profiles.map(profile => {
      const exported: Partial<ConnectionProfile> = {
        id: profile.id,
        name: profile.name,
        type: profile.type,
        createdAt: profile.createdAt,
        lastUsed: profile.lastUsed
        // Exclude connectionString for security
      };

      if (profile.azureConfig) {
        exported.azureConfig = profile.azureConfig;
      }

      return exported;
    });
  }

  /**
   * Get connection statistics
   */
  static async getConnectionStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    recentlyUsed: number;
  }> {
    const profiles = await this.getAllProfiles();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      total: profiles.length,
      byType: profiles.reduce((acc, profile) => {
        acc[profile.type] = (acc[profile.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentlyUsed: profiles.filter(profile => profile.lastUsed > oneWeekAgo).length
    };
  }

  /**
   * Encrypt connection string for secure storage
   */
  private static async encryptConnectionString(connectionString: string): Promise<string> {
    try {
      // For now, return as-is since we need to implement proper key management
      return connectionString;
    } catch (error) {
      console.error('Failed to encrypt connection string:', error);
      // For now, return the original string
      // In production, this should fail securely
      return connectionString;
    }
  }


}