# User Guide - Azure Service Bus Explorer PWA

## Table of Contents

1. [Getting Started](#getting-started)
2. [Connection Management](#connection-management)
3. [Message Operations](#message-operations)
4. [Analytics Dashboard](#analytics-dashboard)
5. [Offline Usage](#offline-usage)
6. [Chirpstack Integration](#chirpstack-integration)
7. [Data Export](#data-export)
8. [Settings and Preferences](#settings-and-preferences)

## Getting Started

### Installing the PWA

1. **Desktop Installation**:
   - Open the application in your browser
   - Look for the install icon in the address bar
   - Click "Install" and follow the prompts
   - The app will appear in your applications menu

2. **Mobile Installation**:
   - Open the application in your mobile browser
   - Tap the "Add to Home Screen" option
   - Follow the installation prompts
   - Access the app from your home screen

### First Launch

When you first open the application:

1. You'll see the main terminal-style interface
2. Click "Add Connection" to set up your first Service Bus connection
3. The app will guide you through the connection process
4. Once connected, you can start exploring your queues and topics

## Connection Management

### Adding a New Connection

1. **Using Connection String**:
   ```
   Click [Add Connection] → Select "Connection String"
   Enter your connection string → Click [Test Connection]
   Provide a name for the connection → Click [Save]
   ```

2. **Using Azure AD**:
   ```
   Click [Add Connection] → Select "Azure AD"
   Enter Tenant ID, Client ID, and Scopes
   Click [Authenticate] → Complete OAuth flow
   Provide a name for the connection → Click [Save]
   ```

### Managing Connections

- **Switch Connections**: Use the connection dropdown in the header
- **Edit Connection**: Click the edit icon next to the connection name
- **Delete Connection**: Click the delete icon (requires confirmation)
- **Test Connection**: Use the test button to verify connectivity

### Security Features

- All connection strings are encrypted using Web Crypto API
- Credentials are stored locally in IndexedDB
- No credentials are sent to external servers
- Automatic session timeout for security

## Message Operations

### Browsing Messages

1. **Select Queue/Topic**: Choose from the dropdown list
2. **View Messages**: Messages appear in the main terminal window
3. **Expand Details**: Click on any message to view full JSON content
4. **Navigate**: Use pagination controls for large message sets

### Message Actions

#### Peek Messages
```
Click [Peek Messages] → Select count (1-100)
Messages are retrieved without removal from queue
Use for inspection without affecting message flow
```

#### Receive Messages
```
Click [Receive Messages] → Select count and timeout
Messages are removed from the queue
Confirmation dialog prevents accidental operations
```

#### Send Messages
```
Click [Send Message] → Enter message body (JSON format)
Add custom properties if needed
Set session ID or partition key (optional)
Schedule delivery time (optional)
```

#### Delete Messages
```
Select messages using checkboxes
Click [Delete Selected] → Confirm deletion
Batch operations available for multiple messages
```

### Dead Letter Queue Management

1. Access dead letter queues from the queue dropdown
2. View failed messages with failure reasons
3. Reprocess messages back to main queue
4. Analyze failure patterns using analytics

## Analytics Dashboard

### Field Analytics

The analytics engine automatically analyzes JSON message payloads:

1. **Field Discovery**: All JSON paths are automatically detected
2. **Frequency Analysis**: Shows how often each field appears
3. **Data Type Detection**: Identifies field data types
4. **Value Distribution**: Top values and their frequencies

### Viewing Analytics

1. **Field List**: Browse all discovered fields in the left panel
2. **Field Details**: Click any field to see detailed statistics
3. **Time Series**: View field usage over time
4. **Correlation Matrix**: Understand relationships between fields

### Analytics Features

- **Real-time Updates**: Analytics update as new messages arrive
- **Historical Data**: View trends over custom time ranges
- **Pattern Detection**: Identify message patterns and anomalies
- **Performance Optimized**: Uses Web Workers for background processing

## Offline Usage

### Offline Capabilities

When offline, you can:
- View previously cached messages
- Analyze cached data using the analytics dashboard
- Browse connection profiles (read-only)
- Export cached data

### Sync Behavior

When reconnecting:
- Pending operations are automatically synced
- New messages are fetched and analyzed
- Conflicts are resolved automatically
- User is notified of sync status

### Managing Offline Data

1. **Cache Settings**: Configure how much data to cache
2. **Storage Usage**: Monitor local storage consumption
3. **Clear Cache**: Remove old data to free space
4. **Sync Status**: View current synchronization state

## Chirpstack Integration

### Setting Up Chirpstack

1. Navigate to the Chirpstack module
2. Click "Add Chirpstack Connection"
3. Enter your Chirpstack server URL and credentials
4. Test the connection and save

### Gateway Monitoring

- **Gateway List**: View all registered gateways
- **Status Monitoring**: Real-time gateway status
- **Location Mapping**: Geographic view of gateway locations
- **Performance Charts**: Historical gateway statistics
- **Alert System**: Notifications for gateway issues

### Chirpstack Analytics

- Gateway uptime statistics
- Message throughput analysis
- Geographic coverage analysis
- Performance trend monitoring

## Data Export

### Export Options

1. **Message Export**:
   - JSON format with full message data
   - CSV format with selected fields
   - Filtered exports based on criteria

2. **Analytics Export**:
   - Field statistics reports
   - Time series data
   - Correlation analysis results

### Export Process

```
Click [Export Data] → Select format and options
Choose date range and filters
Click [Generate Export] → Download file
```

### Scheduled Exports

1. Set up recurring export schedules
2. Configure export parameters
3. Automatic generation and download
4. Email notifications (if configured)

## Settings and Preferences

### Application Settings

- **Theme**: Choose terminal color scheme (green, amber, blue)
- **Performance**: Configure message batch sizes
- **Security**: Set session timeout and encryption options
- **Notifications**: Configure alert preferences

### Data Management

- **Storage Limits**: Set maximum cache sizes
- **Cleanup Policies**: Automatic data cleanup rules
- **Backup/Restore**: Export/import application settings
- **Reset**: Clear all data and start fresh

### Accessibility

- **Font Size**: Adjust terminal font size
- **Contrast**: High contrast mode for better visibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Compatible with assistive technologies

## Tips and Best Practices

### Performance Tips

1. **Batch Operations**: Use batch operations for multiple messages
2. **Filtering**: Apply filters to reduce data processing
3. **Pagination**: Use appropriate page sizes for your use case
4. **Cache Management**: Regularly clean up old cached data

### Security Best Practices

1. **Connection Strings**: Use least-privilege connection strings
2. **Azure AD**: Prefer Azure AD over connection strings when possible
3. **Session Management**: Log out when finished
4. **Device Security**: Ensure your device is secure and updated

### Analytics Best Practices

1. **Time Ranges**: Use appropriate time ranges for analysis
2. **Field Selection**: Focus on relevant fields for better performance
3. **Export Regularly**: Export important analytics data
4. **Monitor Trends**: Set up regular monitoring of key metrics