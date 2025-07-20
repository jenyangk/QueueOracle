# Design Document

## Overview

This design document outlines the technical architecture for the Azure Service Bus Explorer PWA. The application will be built as a client-side React application with TypeScript, featuring a modular architecture that separates Service Bus operations from Chirpstack analytics while maintaining a cohesive user experience.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PWA Shell                                │
├─────────────────────────────────────────────────────────────┤
│  React App (TypeScript)                                     │
│  ├── Service Bus Explorer Module                            │
│  ├── Chirpstack Analytics Module                            │
│  ├── Shared Components & Services                           │
│  └── PWA Infrastructure                                     │
├─────────────────────────────────────────────────────────────┤
│  Browser APIs                                               │
│  ├── Web Crypto API (Credential Encryption)                │
│  ├── IndexedDB (Local Storage)                             │
│  ├── Service Worker (Offline Support)                      │
│  └── Web Workers (Background Processing)                   │
├─────────────────────────────────────────────────────────────┤
│  External Services                                          │
│  ├── Azure Service Bus (@azure/service-bus)                │
│  ├── Azure AD (MSAL)                                       │
│  └── Chirpstack API (REST)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite with PWA plugin
- **Styling**: TailwindCSS + Shadcn/ui components
- **State Management**: Zustand for global state
- **Data Visualization**: Apache ECharts
- **Azure Integration**: @azure/service-bus, @azure/msal-browser
- **Storage**: IndexedDB with Dexie.js wrapper
- **Background Processing**: Web Workers
- **PWA**: Workbox for service worker management

## Components and Interfaces

### Core Application Structure

```typescript
src/
├── app/                          # Main application setup
│   ├── App.tsx                   # Root component
│   ├── store/                    # Zustand stores
│   └── providers/                # Context providers
├── modules/
│   ├── service-bus/              # Service Bus Explorer module
│   │   ├── components/           # SB-specific components
│   │   ├── services/             # SB API services
│   │   ├── hooks/                # SB custom hooks
│   │   └── types/                # SB TypeScript types
│   ├── chirpstack/               # Chirpstack Analytics module
│   │   ├── components/           # CS-specific components
│   │   ├── services/             # CS API services
│   │   ├── hooks/                # CS custom hooks
│   │   └── types/                # CS TypeScript types
│   └── shared/                   # Shared components and utilities
├── components/                   # Global UI components
│   ├── ui/                       # Shadcn/ui components
│   ├── terminal/                 # ASCII-style components
│   └── layout/                   # Layout components
├── services/                     # Core services
│   ├── storage/                  # IndexedDB services
│   ├── crypto/                   # Encryption services
│   ├── worker/                   # Web Worker services
│   └── pwa/                      # PWA utilities
├── hooks/                        # Global custom hooks
├── utils/                        # Utility functions
└── types/                        # Global TypeScript types
```

### Key Component Interfaces

#### Service Bus Explorer Components

```typescript
// Message List Component
interface MessageListProps {
  messages: ServiceBusMessage[];
  onMessageSelect: (message: ServiceBusMessage) => void;
  onMessageDelete: (messageId: string) => void;
  virtualizedHeight: number;
  filterCriteria: MessageFilter;
}

// Analytics Dashboard Component
interface AnalyticsDashboardProps {
  messages: ServiceBusMessage[];
  fieldAnalytics: FieldAnalytics;
  onFieldSelect: (fieldPath: string) => void;
  timeRange: TimeRange;
}

// Connection Manager Component
interface ConnectionManagerProps {
  connections: ConnectionProfile[];
  activeConnection: string | null;
  onConnect: (profile: ConnectionProfile) => void;
  onDisconnect: () => void;
  onSaveProfile: (profile: ConnectionProfile) => void;
}
```

#### Terminal-Style UI Components

```typescript
// Terminal Window Component
interface TerminalWindowProps {
  title: string;
  children: React.ReactNode;
  actions?: TerminalAction[];
  status: 'connected' | 'disconnected' | 'error';
}

// ASCII Table Component
interface ASCIITableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  virtualizedRows: number;
  onRowSelect?: (row: T) => void;
  sortable?: boolean;
}

// Command Button Component
interface CommandButtonProps {
  command: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  variant: 'primary' | 'secondary' | 'danger';
}
```

## Data Models

### Service Bus Data Models

```typescript
interface ServiceBusMessage {
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
}

interface ConnectionProfile {
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
}

interface FieldAnalytics {
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
}
```

### Analytics Data Models

```typescript
interface MessageAnalytics {
  totalMessages: number;
  messageTypes: Record<string, number>;
  fieldAnalytics: Record<string, FieldAnalytics>;
  timeSeriesData: TimeSeriesPoint[];
  correlationMatrix: CorrelationData[];
  lastUpdated: Date;
}

interface TimeSeriesPoint {
  timestamp: Date;
  count: number;
  avgSize: number;
  fieldValues: Record<string, unknown>;
}

interface MessageFilter {
  dateRange: {
    start: Date;
    end: Date;
  };
  fieldFilters: Array<{
    fieldPath: string;
    operator: 'equals' | 'contains' | 'regex' | 'exists';
    value: unknown;
  }>;
  messageTypes: string[];
  textSearch: string;
}
```

## Error Handling

### Error Boundary Strategy

```typescript
// Global Error Boundary
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Service-Specific Error Handling
interface ServiceBusError {
  type: 'connection' | 'authentication' | 'operation' | 'quota';
  message: string;
  details: unknown;
  timestamp: Date;
  retryable: boolean;
}

// User-Friendly Error Display
interface ErrorDisplayProps {
  error: ServiceBusError;
  onRetry?: () => void;
  onDismiss: () => void;
  showDetails?: boolean;
}
```

### Error Recovery Mechanisms

1. **Connection Errors**: Automatic retry with exponential backoff
2. **Authentication Errors**: Redirect to credential management
3. **Quota Errors**: Display usage information and suggestions
4. **Network Errors**: Offline mode activation
5. **Data Corruption**: Fallback to cached data with user notification

## Testing Strategy

### Unit Testing
- **Components**: React Testing Library for component behavior
- **Services**: Jest for business logic and API interactions
- **Utilities**: Jest for pure function testing
- **Hooks**: React Hooks Testing Library

### Integration Testing
- **Service Bus Integration**: Mock Azure Service Bus SDK
- **Storage Integration**: In-memory IndexedDB simulation
- **Worker Integration**: Mock Web Worker APIs

### End-to-End Testing
- **User Workflows**: Playwright for complete user journeys
- **PWA Features**: Lighthouse CI for PWA compliance
- **Performance**: Web Vitals monitoring

### Performance Testing
- **Message Volume**: Test with 10,000+ messages
- **Memory Usage**: Monitor memory leaks and cleanup
- **Rendering Performance**: Virtual scrolling validation
- **Worker Performance**: Background processing benchmarks

## Security Considerations

### Credential Security
```typescript
// Encryption Service
interface EncryptionService {
  encrypt(data: string, key: CryptoKey): Promise<ArrayBuffer>;
  decrypt(encryptedData: ArrayBuffer, key: CryptoKey): Promise<string>;
  generateKey(): Promise<CryptoKey>;
  deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;
}

// Secure Storage
interface SecureStorage {
  store(key: string, value: unknown, encrypt: boolean): Promise<void>;
  retrieve(key: string, decrypt: boolean): Promise<unknown>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

### Data Protection
1. **Encryption at Rest**: All sensitive data encrypted in IndexedDB
2. **Memory Protection**: Sensitive data cleared from memory after use
3. **Network Security**: HTTPS enforcement and certificate validation
4. **Input Sanitization**: All user inputs validated and sanitized
5. **Audit Logging**: Security events logged for monitoring

## Performance Optimizations

### Client-Side Optimizations
1. **Virtual Scrolling**: React Window for large message lists
2. **Memoization**: React.memo and useMemo for expensive computations
3. **Code Splitting**: Lazy loading for modules and components
4. **Bundle Optimization**: Tree shaking and dynamic imports
5. **Caching Strategy**: Intelligent caching with cache invalidation

### Background Processing
```typescript
// Web Worker for JSON Analysis
interface AnalyticsWorker {
  analyzeMessages(messages: ServiceBusMessage[]): Promise<MessageAnalytics>;
  updateAnalytics(newMessages: ServiceBusMessage[]): Promise<FieldAnalytics[]>;
  exportData(format: 'json' | 'csv', filter: MessageFilter): Promise<Blob>;
}

// Service Worker for Offline Support
interface OfflineStrategy {
  cacheStrategy: 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate';
  cacheName: string;
  maxAge: number;
  maxEntries: number;
}
```

### Memory Management
1. **Message Pagination**: Load messages in chunks
2. **Cleanup Strategies**: Automatic cleanup of old data
3. **Weak References**: Use WeakMap for temporary associations
4. **Garbage Collection**: Manual cleanup triggers for large operations