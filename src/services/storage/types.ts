/**
 * Storage types and interfaces for the application
 */

// Connection Profile Types
export interface ConnectionProfile {
  id: string;
  name: string;
  connectionString: string; // Encrypted
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

// Service Bus Message Types
export interface ServiceBusMessage {
  messageId: string;
  sequenceNumber: string;
  enqueuedTimeUtc: Date;
  body: unknown;
  properties: Record<string, unknown>;
  sessionId?: string;
  partitionKey?: string;
  timeToLive?: number;
  deliveryCount: number;
  jsonFields: Record<string, unknown>;
  analyzedAt: Date;
  connectionId: string;
  queueOrTopicName: string;
}

// Analytics Types
export interface FieldAnalytics {
  id: string;
  fieldPath: string;
  dataType: string;
  count: number;
  uniqueValues: number;
  coverage: number;
  topValues: Array<{
    value: unknown;
    count: number;
    percentage: number;
  }>;
  trend: TimeSeriesPoint[];
  connectionId: string;
  lastUpdated: Date;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  count: number;
  avgSize: number;
  fieldValues: Record<string, unknown>;
}

export interface MessageAnalytics {
  id: string;
  connectionId: string;
  totalMessages: number;
  messageTypes: Record<string, number>;
  fieldAnalytics: Record<string, FieldAnalytics>;
  timeSeriesData: TimeSeriesPoint[];
  correlationMatrix: CorrelationData[];
  lastUpdated: Date;
}

export interface CorrelationData {
  field1: string;
  field2: string;
  correlation: number;
  significance: number;
}

// Application Settings Types
export interface AppSettings {
  id: string;
  theme: 'green' | 'amber' | 'blue';
  autoRefresh: boolean;
  refreshInterval: number;
  maxMessagesCache: number;
  enableAnalytics: boolean;
  enableNotifications: boolean;
  lastBackup?: Date;
  version: string;
}

// Chirpstack Types
export interface ChirpstackGateway {
  id: string;
  gatewayId: string;
  name: string;
  description?: string;
  location?: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt?: Date;
  isOnline: boolean;
  connectionId: string;
}

export interface ChirpstackConnection {
  id: string;
  name: string;
  serverUrl: string;
  apiKey: string; // Encrypted
  tenantId?: string;
  createdAt: Date;
  lastUsed: Date;
  isActive?: boolean;
}

// Storage Interface
export interface SecureStorage {
  // Connection Profiles
  storeConnectionProfile(profile: ConnectionProfile): Promise<void>;
  getConnectionProfile(id: string): Promise<ConnectionProfile | null>;
  getAllConnectionProfiles(): Promise<ConnectionProfile[]>;
  updateConnectionProfile(profile: ConnectionProfile): Promise<void>;
  deleteConnectionProfile(id: string): Promise<void>;

  // Service Bus Messages
  storeMessages(messages: ServiceBusMessage[]): Promise<void>;
  getMessages(connectionId: string, limit?: number, offset?: number): Promise<ServiceBusMessage[]>;
  getMessagesByDateRange(connectionId: string, startDate: Date, endDate: Date): Promise<ServiceBusMessage[]>;
  deleteMessages(connectionId: string, messageIds?: string[]): Promise<void>;
  clearAllMessages(connectionId: string): Promise<void>;

  // Analytics
  storeAnalytics(analytics: MessageAnalytics): Promise<void>;
  getAnalytics(connectionId: string): Promise<MessageAnalytics | null>;
  updateFieldAnalytics(connectionId: string, fieldAnalytics: FieldAnalytics[]): Promise<void>;
  deleteAnalytics(connectionId: string): Promise<void>;

  // App Settings
  storeSettings(settings: AppSettings): Promise<void>;
  getSettings(): Promise<AppSettings | null>;
  updateSettings(settings: Partial<AppSettings>): Promise<void>;

  // Chirpstack
  storeChirpstackConnection(connection: ChirpstackConnection): Promise<void>;
  getChirpstackConnection(id: string): Promise<ChirpstackConnection | null>;
  getAllChirpstackConnections(): Promise<ChirpstackConnection[]>;
  updateChirpstackConnection(connection: ChirpstackConnection): Promise<void>;
  deleteChirpstackConnection(id: string): Promise<void>;

  storeGateways(gateways: ChirpstackGateway[]): Promise<void>;
  getGateways(connectionId: string): Promise<ChirpstackGateway[]>;
  updateGateway(gateway: ChirpstackGateway): Promise<void>;
  deleteGateways(connectionId: string): Promise<void>;

  // Utility
  clearAllData(): Promise<void>;
  exportData(): Promise<unknown>;
  importData(data: unknown): Promise<void>;
  getStorageStats(): Promise<{
    totalSize: number;
    messageCount: number;
    connectionCount: number;
    analyticsCount: number;
  }>;
}