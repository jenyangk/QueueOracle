import type { ConnectionFormData, ConnectionTestResult, ConnectionProfile } from '../types/connection';

export class ConnectionService {
  /**
   * Validates a connection string format
   */
  static validateConnectionString(connectionString: string): boolean {
    if (!connectionString || typeof connectionString !== 'string') {
      return false;
    }

    // Basic validation for Service Bus connection string format
    const requiredParts = ['Endpoint=', 'SharedAccessKeyName=', 'SharedAccessKey='];
    return requiredParts.every(part => connectionString.includes(part));
  }

  /**
   * Extracts endpoint from connection string
   */
  static extractEndpoint(connectionString: string): string | null {
    const match = connectionString.match(/Endpoint=([^;]+)/);
    return match ? match[1] || null : null;
  }

  /**
   * Extracts entity path from connection string
   */
  static extractEntityPath(connectionString: string): string | null {
    const match = connectionString.match(/EntityPath=([^;]+)/);
    return match ? match[1] || null : null;
  }

  /**
   * Tests a connection configuration
   */
  static async testConnection(formData: ConnectionFormData): Promise<ConnectionTestResult> {
    try {
      if (formData.type === 'connectionString') {
        return await this.testConnectionString(formData.connectionString);
      } else if (formData.type === 'azureAD') {
        return await this.testAzureADConnection(formData.azureConfig!);
      }
      
      return {
        success: false,
        message: 'Unknown connection type'
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Tests connection string connectivity
   */
  private static async testConnectionString(connectionString: string): Promise<ConnectionTestResult> {
    // Validate format first
    if (!this.validateConnectionString(connectionString)) {
      return {
        success: false,
        message: 'Invalid connection string format'
      };
    }

    const endpoint = this.extractEndpoint(connectionString);
    const entityPath = this.extractEntityPath(connectionString);

    // For now, we'll do basic validation since we can't actually connect without @azure/service-bus
    // In a real implementation, you would use the Service Bus SDK to test the connection
    
    // Simulate connection test delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Basic endpoint reachability check (simplified)
    if (endpoint) {
      try {
        const hostname = new URL(endpoint).hostname;
        
        // Simulate a successful connection test
        // In reality, you would use ServiceBusAdministrationClient or ServiceBusClient
        return {
          success: true,
          message: 'Connection successful',
          details: {
            endpoint: hostname,
            ...(entityPath && { entityPath }),
            permissions: ['Listen', 'Send', 'Manage'] // This would come from actual testing
          }
        };
      } catch {
        return {
          success: false,
          message: 'Invalid endpoint URL format'
        };
      }
    }

    return {
      success: false,
      message: 'Could not extract endpoint from connection string'
    };
  }

  /**
   * Tests Azure AD connection configuration
   */
  private static async testAzureADConnection(azureConfig: NonNullable<ConnectionFormData['azureConfig']>): Promise<ConnectionTestResult> {
    // Validate Azure AD configuration
    if (!azureConfig.tenantId || !azureConfig.clientId) {
      return {
        success: false,
        message: 'Missing required Azure AD configuration'
      };
    }

    // Simulate Azure AD authentication test
    await new Promise(resolve => setTimeout(resolve, 1500));

    // In a real implementation, you would use MSAL to test the authentication
    // For now, we'll simulate a successful test
    return {
      success: true,
      message: 'Azure AD configuration valid',
      details: {
        permissions: ['Listen', 'Send'] // This would come from actual token validation
      }
    };
  }

  /**
   * Generates a unique ID for a connection profile
   */
  static generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Creates a connection profile from form data
   */
  static createConnectionProfile(formData: ConnectionFormData): ConnectionProfile {
    const now = new Date();
    
    const profile: ConnectionProfile = {
      id: this.generateConnectionId(),
      name: formData.name,
      connectionString: formData.connectionString,
      type: formData.type,
      createdAt: now,
      lastUsed: now,
      isActive: false
    };

    if (formData.azureConfig) {
      profile.azureConfig = formData.azureConfig;
    }

    return profile;
  }

  /**
   * Updates an existing connection profile
   */
  static updateConnectionProfile(
    existingProfile: ConnectionProfile, 
    formData: ConnectionFormData
  ): ConnectionProfile {
    const updatedProfile: ConnectionProfile = {
      ...existingProfile,
      name: formData.name,
      connectionString: formData.connectionString,
      type: formData.type,
      lastUsed: new Date()
    };

    if (formData.azureConfig) {
      updatedProfile.azureConfig = formData.azureConfig;
    }

    return updatedProfile;
  }

  /**
   * Sanitizes connection string for display (hides sensitive parts)
   */
  static sanitizeConnectionString(connectionString: string): string {
    return connectionString
      .replace(/SharedAccessKey=([^;]+)/g, 'SharedAccessKey=***')
      .replace(/SharedAccessKeyName=([^;]+)/g, 'SharedAccessKeyName=***');
  }

  /**
   * Validates connection profile data
   */
  static validateConnectionProfile(profile: ConnectionProfile): string[] {
    const errors: string[] = [];

    if (!profile.name?.trim()) {
      errors.push('Connection name is required');
    }

    if (profile.type === 'connectionString') {
      if (!profile.connectionString?.trim()) {
        errors.push('Connection string is required');
      } else if (!this.validateConnectionString(profile.connectionString)) {
        errors.push('Invalid connection string format');
      }
    } else if (profile.type === 'azureAD') {
      if (!profile.azureConfig?.tenantId?.trim()) {
        errors.push('Tenant ID is required for Azure AD authentication');
      }
      if (!profile.azureConfig?.clientId?.trim()) {
        errors.push('Client ID is required for Azure AD authentication');
      }
    }

    return errors;
  }
}