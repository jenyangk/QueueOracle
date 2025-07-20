import { useState, useEffect, useCallback } from 'react';
import type { ConnectionProfile, ConnectionFormData, ConnectionTestResult } from '../types/connection';
import { ConnectionProfileService } from '../services/ConnectionProfileService';
import { ConnectionService } from '../services/ConnectionService';
import { useNotifications } from '@/components/layout';

export interface UseConnectionProfilesReturn {
  // State
  profiles: ConnectionProfile[];
  activeProfile: ConnectionProfile | null;
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;

  // Actions
  loadProfiles: () => Promise<void>;
  saveProfile: (formData: ConnectionFormData) => Promise<void>;
  updateProfile: (id: string, formData: ConnectionFormData) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  connectToProfile: (profile: ConnectionProfile) => Promise<void>;
  disconnect: () => Promise<void>;
  testConnection: (formData: ConnectionFormData) => Promise<ConnectionTestResult>;
  
  // Utilities
  getProfileById: (id: string) => ConnectionProfile | undefined;
  getRecentProfiles: (limit?: number) => ConnectionProfile[];
}

export const useConnectionProfiles = (): UseConnectionProfilesReturn => {
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<ConnectionProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { success, error: notifyError, info } = useNotifications();

  // Load all profiles from storage
  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [allProfiles, currentActive] = await Promise.all([
        ConnectionProfileService.getAllProfiles(),
        ConnectionProfileService.getActiveProfile()
      ]);
      
      setProfiles(allProfiles);
      setActiveProfile(currentActive);
    } catch {
      const errorMessage = 'Failed to load connection profiles';
      setError(errorMessage);
      notifyError('Load Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [notifyError]);

  // Save a new profile
  const saveProfile = useCallback(async (formData: ConnectionFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const newProfile = ConnectionService.createConnectionProfile(formData);
      
      // Validate the profile
      const validationErrors = ConnectionService.validateConnectionProfile(newProfile);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }
      
      await ConnectionProfileService.saveProfile(newProfile);
      await loadProfiles(); // Refresh the list
      
      success('Profile Saved', `Connection profile "${formData.name}" has been saved`);
    } catch (err) {
      const errorMessage = `Failed to save profile: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Save Error', errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles, success, notifyError]);

  // Update an existing profile
  const updateProfile = useCallback(async (id: string, formData: ConnectionFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const existingProfile = await ConnectionProfileService.getProfile(id);
      if (!existingProfile) {
        throw new Error('Profile not found');
      }
      
      const updatedProfile = ConnectionService.updateConnectionProfile(existingProfile, formData);
      
      // Validate the updated profile
      const validationErrors = ConnectionService.validateConnectionProfile(updatedProfile);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }
      
      await ConnectionProfileService.updateProfile(updatedProfile);
      await loadProfiles(); // Refresh the list
      
      success('Profile Updated', `Connection profile "${formData.name}" has been updated`);
    } catch (err) {
      const errorMessage = `Failed to update profile: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Update Error', errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadProfiles, success, notifyError]);

  // Delete a profile
  const deleteProfile = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const profile = profiles.find(p => p.id === id);
      if (!profile) {
        throw new Error('Profile not found');
      }
      
      // Don't allow deleting the active profile
      if (profile.isActive) {
        throw new Error('Cannot delete the active connection profile');
      }
      
      await ConnectionProfileService.deleteProfile(id);
      await loadProfiles(); // Refresh the list
      
      success('Profile Deleted', `Connection profile "${profile.name}" has been deleted`);
    } catch (err) {
      const errorMessage = `Failed to delete profile: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Delete Error', errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [profiles, loadProfiles, success, notifyError]);

  // Connect to a profile
  const connectToProfile = useCallback(async (profile: ConnectionProfile) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // First test the connection
      const formData: ConnectionFormData = {
        name: profile.name,
        connectionString: profile.connectionString,
        type: profile.type,
        ...(profile.azureConfig && { azureConfig: profile.azureConfig })
      };
      
      const testResult = await ConnectionService.testConnection(formData);
      if (!testResult.success) {
        throw new Error(testResult.message);
      }
      
      // Set as active profile
      await ConnectionProfileService.setActiveProfile(profile.id);
      await loadProfiles(); // Refresh to get updated active status
      
      success('Connected', `Successfully connected to "${profile.name}"`);
      info('Connection Details', testResult.message);
    } catch (err) {
      const errorMessage = `Failed to connect: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Connection Error', errorMessage);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [loadProfiles, success, info, notifyError]);

  // Disconnect from current profile
  const disconnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await ConnectionProfileService.deactivateAllProfiles();
      await loadProfiles(); // Refresh to get updated active status
      
      info('Disconnected', 'Successfully disconnected from Service Bus');
    } catch (err) {
      const errorMessage = `Failed to disconnect: ${(err as Error).message}`;
      setError(errorMessage);
      notifyError('Disconnect Error', errorMessage);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [loadProfiles, info, notifyError]);

  // Test a connection configuration
  const testConnection = useCallback(async (formData: ConnectionFormData): Promise<ConnectionTestResult> => {
    try {
      return await ConnectionService.testConnection(formData);
    } catch (err) {
      return {
        success: false,
        message: `Connection test failed: ${(err as Error).message}`
      };
    }
  }, []);

  // Utility functions
  const getProfileById = useCallback((id: string): ConnectionProfile | undefined => {
    return profiles.find(profile => profile.id === id);
  }, [profiles]);

  const getRecentProfiles = useCallback((limit: number = 5): ConnectionProfile[] => {
    return [...profiles]
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .slice(0, limit);
  }, [profiles]);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  return {
    // State
    profiles,
    activeProfile,
    isLoading,
    isConnecting,
    error,

    // Actions
    loadProfiles,
    saveProfile,
    updateProfile,
    deleteProfile,
    connectToProfile,
    disconnect,
    testConnection,

    // Utilities
    getProfileById,
    getRecentProfiles
  };
};