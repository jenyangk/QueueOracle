export interface ConnectionProfile {
  id: string;
  name: string;
  connectionString: string; // Will be encrypted when stored
  type: 'connectionString' | 'azureAD';
  azureConfig?: {
    tenantId: string;
    clientId: string;
    scopes: string[];
  };
  createdAt: Date;
  lastUsed: Date;
  isActive?: boolean;
}

export interface ConnectionFormData {
  name: string;
  connectionString: string;
  type: 'connectionString' | 'azureAD';
  azureConfig?: {
    tenantId: string;
    clientId: string;
    scopes: string[];
  };
}

export interface ConnectionValidationResult {
  isValid: boolean;
  errors: {
    field: keyof ConnectionFormData;
    message: string;
  }[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    endpoint?: string;
    entityPath?: string;
    permissions?: string[];
  };
}