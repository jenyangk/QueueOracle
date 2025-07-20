# Frequently Asked Questions (FAQ)

## General Questions

### What is the Azure Service Bus Explorer PWA?

The Azure Service Bus Explorer PWA is a Progressive Web Application that provides a comprehensive interface for managing Azure Service Bus operations. It features advanced JSON analytics, offline capabilities, and a unique terminal-inspired user interface.

### What browsers are supported?

The application supports modern browsers including:
- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

### Is my data secure?

Yes, security is a top priority:
- All connection strings are encrypted using Web Crypto API
- Data is stored locally on your device using IndexedDB
- No credentials or message data are sent to external servers
- The application follows security best practices and OWASP guidelines

### Can I use this application offline?

Yes, the PWA includes comprehensive offline capabilities:
- View and analyze previously cached messages
- Browse connection profiles (read-only)
- Export cached data
- Automatic synchronization when reconnecting

## Installation and Setup

### How do I install the PWA?

**Desktop:**
1. Open the application in your browser
2. Look for the install icon in the address bar
3. Click "Install" and follow the prompts

**Mobile:**
1. Open the application in your mobile browser
2. Tap "Add to Home Screen"
3. Follow the installation prompts

### Why can't I install the PWA?

Common reasons include:
- Using an unsupported browser
- Not accessing the app over HTTPS
- Service worker registration issues
- Browser settings blocking PWA installation

Try updating your browser or using a different one.

### How much storage space does the app use?

The application typically uses:
- Base app: ~10-15MB
- Cached messages: Varies based on usage (configurable)
- Connection profiles: <1MB
- Analytics data: 5-50MB depending on message volume

## Connection and Authentication

### What connection methods are supported?

The application supports two authentication methods:
1. **Connection String**: Direct connection using Service Bus connection string
2. **Azure AD**: OAuth authentication using Azure Active Directory

### How do I get a Service Bus connection string?

1. Go to the Azure Portal
2. Navigate to your Service Bus namespace
3. Go to "Shared access policies"
4. Select or create a policy with appropriate permissions
5. Copy the connection string

### What permissions do I need?

Required permissions depend on your use case:
- **Listen**: To peek and receive messages
- **Send**: To send messages
- **Manage**: For administrative operations

### Can I connect to multiple Service Bus namespaces?

Yes, you can create multiple connection profiles and switch between them easily. Each profile stores its own credentials securely.

### Why does my connection keep dropping?

Common causes include:
- Network instability
- Service Bus throttling
- Firewall restrictions
- Browser tab becoming inactive

Try using a stable network connection and check for any firewall restrictions.

## Message Operations

### What's the difference between peek and receive?

- **Peek**: Views messages without removing them from the queue (non-destructive)
- **Receive**: Retrieves and removes messages from the queue (destructive)

### How many messages can I view at once?

The application uses virtualized scrolling to handle large message sets efficiently. You can typically view thousands of messages without performance issues.

### Can I send messages with custom properties?

Yes, you can add custom properties, session IDs, partition keys, and schedule message delivery when sending messages.

### How do I handle dead letter queue messages?

Dead letter queues appear in the queue dropdown with a "DLQ" suffix. You can:
- View failed messages and failure reasons
- Reprocess messages back to the main queue
- Analyze failure patterns using the analytics dashboard

### What message formats are supported?

The application works with any message format, but JSON messages receive enhanced analytics capabilities including:
- Automatic field discovery
- Statistical analysis
- Pattern detection
- Correlation analysis

## Analytics Features

### How does the analytics engine work?

The analytics engine:
1. Automatically parses JSON message bodies
2. Discovers all field paths recursively
3. Calculates statistics and frequencies
4. Identifies patterns and correlations
5. Updates in real-time as new messages arrive

### What analytics are available?

The system provides:
- Field frequency analysis
- Data type detection
- Value distribution charts
- Time series analysis
- Correlation matrices
- Pattern detection
- Anomaly identification

### Can I export analytics data?

Yes, you can export analytics in multiple formats:
- JSON (complete data structure)
- CSV (tabular format)
- PDF reports (formatted with charts)
- Excel spreadsheets

### How do I improve analytics performance?

To optimize performance:
- Use filters to reduce dataset size
- Apply appropriate time ranges
- Process messages in smaller batches
- Clear old analytics data regularly

### Why are my analytics not updating?

Common causes:
- Web Worker issues (check browser console)
- Memory limitations
- Browser performance issues
- Cached data not refreshing

Try refreshing the analytics dashboard or restarting the application.

## Performance and Troubleshooting

### The application is running slowly. What can I do?

Performance optimization tips:
- Reduce the number of messages loaded at once
- Apply filters to limit data processing
- Clear browser cache and old data
- Close unnecessary browser tabs
- Use a more powerful device if possible

### I'm getting "out of memory" errors. How do I fix this?

Memory management solutions:
- Reduce the number of cached messages
- Use smaller time ranges for analysis
- Clear analytics data regularly
- Restart the browser
- Close other applications

### Why can't I see my messages?

Check the following:
- Correct queue/topic is selected
- No active filters are hiding messages
- You have proper permissions (Listen)
- The queue/topic actually contains messages
- Connection is active and stable

### The app won't work offline. What's wrong?

Offline issues are usually caused by:
- Service worker not registered properly
- Data not cached while online
- Browser storage limitations
- Cache corruption

Try clearing the cache and refreshing while online.

## Data Management

### How is my data stored?

Data is stored locally on your device using:
- **IndexedDB**: For messages, analytics, and settings
- **Local Storage**: For user preferences
- **Session Storage**: For temporary data

### Can I backup my settings?

Yes, you can export your connection profiles and settings. However, for security reasons, connection strings are not included in exports.

### How do I clear all application data?

You can clear data through:
1. Application settings (recommended)
2. Browser developer tools (Application tab)
3. Browser settings (Clear site data)

### What happens to my data when I uninstall the PWA?

Uninstalling the PWA removes the application but may leave data in browser storage. To completely remove all data, clear the site data through browser settings.

## Chirpstack Integration

### What is Chirpstack integration?

Chirpstack integration provides gateway monitoring capabilities for LoRaWAN networks, including:
- Gateway status monitoring
- Location mapping
- Performance analytics
- Alert systems

### How do I set up Chirpstack integration?

1. Navigate to the Chirpstack module
2. Click "Add Chirpstack Connection"
3. Enter your Chirpstack server URL and credentials
4. Test and save the connection

### Can I use Chirpstack without Service Bus?

Yes, the Chirpstack module operates independently and can be used without Service Bus connections.

## Security and Privacy

### Is my data sent to external servers?

No, all data processing happens locally on your device. The application only communicates with:
- Your Azure Service Bus namespace
- Your Chirpstack server (if configured)
- Microsoft authentication endpoints (for Azure AD)

### How are my credentials protected?

Credentials are protected through:
- Web Crypto API encryption
- Local storage only (never transmitted)
- Automatic session timeouts
- Secure deletion when removed

### Can I use this in a corporate environment?

Yes, the application is designed for enterprise use:
- No external data transmission
- Supports corporate authentication (Azure AD)
- Complies with security best practices
- Can work behind corporate firewalls

### What data is included in exports?

Exports include:
- Message data (filtered as specified)
- Analytics results
- Connection profile names (not credentials)
- Application settings

Sensitive information like connection strings and passwords are never included in exports.

## Technical Questions

### What technologies are used?

The application is built with:
- React 18 with TypeScript
- Vite build tool
- TailwindCSS and Shadcn/ui
- Zustand for state management
- IndexedDB with Dexie.js
- Web Workers for background processing
- Workbox for PWA capabilities

### Can I contribute to the project?

The application is designed to be extensible. Check the project documentation for contribution guidelines and development setup instructions.

### Are there any API limits?

The application respects Azure Service Bus limits and quotas:
- Message size limits (256KB Standard, 1MB Premium)
- Connection limits
- Throughput limits
- Storage quotas

### How do I report bugs or request features?

Please refer to the project's issue tracking system or contact information provided in the application documentation.

## Best Practices

### What are the recommended usage patterns?

Best practices include:
- Use appropriate batch sizes for your use case
- Apply filters to reduce data processing
- Regularly clean up old cached data
- Use least-privilege connection strings
- Monitor system performance and adjust settings accordingly

### How should I organize my connection profiles?

Recommended organization:
- Use descriptive names for connections
- Separate development, staging, and production environments
- Group related connections logically
- Regularly review and update credentials

### What security practices should I follow?

Security recommendations:
- Use Azure AD authentication when possible
- Regularly rotate access keys
- Use least-privilege access policies
- Keep the application and browser updated
- Ensure your device is secure and encrypted