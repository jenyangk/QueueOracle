# Troubleshooting Guide

## Common Issues and Solutions

### Connection Issues

#### Cannot Connect to Service Bus

**Symptoms:**
- Connection test fails
- "Authentication failed" error
- "Network error" messages

**Solutions:**

1. **Check Connection String**:
   ```
   Verify the connection string format:
   Endpoint=sb://[namespace].servicebus.windows.net/;SharedAccessKeyName=[key-name];SharedAccessKey=[key-value]
   ```

2. **Network Connectivity**:
   - Ensure internet connection is stable
   - Check if corporate firewall blocks Service Bus ports (443, 5671, 5672)
   - Try connecting from a different network

3. **Azure AD Authentication**:
   - Verify Tenant ID, Client ID, and scopes are correct
   - Ensure the app registration has proper permissions
   - Check if multi-factor authentication is required

4. **Service Bus Namespace**:
   - Verify the namespace exists and is active
   - Check if the namespace is in the correct Azure region
   - Ensure you have proper access permissions

#### Connection Drops Frequently

**Symptoms:**
- Frequent disconnection messages
- Operations fail intermittently
- "Connection lost" notifications

**Solutions:**

1. **Network Stability**:
   - Check network connection quality
   - Try using a wired connection instead of Wi-Fi
   - Contact your network administrator about connection stability

2. **Service Bus Throttling**:
   - Reduce message operation frequency
   - Implement exponential backoff in retry logic
   - Check Service Bus metrics for throttling indicators

3. **Browser Issues**:
   - Clear browser cache and cookies
   - Try a different browser
   - Disable browser extensions that might interfere

### Message Operations Issues

#### Messages Not Appearing

**Symptoms:**
- Message list is empty
- "No messages found" despite knowing messages exist
- Peek operations return no results

**Solutions:**

1. **Queue/Topic Selection**:
   - Verify you've selected the correct queue or topic
   - Check if you're looking at the main queue vs. dead letter queue
   - Refresh the queue/topic list

2. **Message Filters**:
   - Clear all active filters
   - Check date range filters
   - Verify field-based filters are correct

3. **Permissions**:
   - Ensure you have "Listen" permissions on the queue/topic
   - Check if the connection string has appropriate access rights
   - Verify Azure AD permissions if using Azure AD authentication

#### Cannot Send Messages

**Symptoms:**
- "Send failed" error messages
- Messages appear to send but don't arrive
- Permission denied errors

**Solutions:**

1. **Permissions Check**:
   - Verify "Send" permissions on the queue/topic
   - Check connection string access rights
   - Ensure proper Azure AD permissions

2. **Message Format**:
   - Verify JSON format is valid
   - Check message size limits (256KB for Standard, 1MB for Premium)
   - Ensure required properties are included

3. **Queue/Topic Status**:
   - Check if the queue/topic is active
   - Verify the queue/topic hasn't reached its size limit
   - Check for any Service Bus service issues

### Analytics Issues

#### Analytics Not Updating

**Symptoms:**
- Field statistics remain static
- New messages don't appear in analytics
- Charts show old data

**Solutions:**

1. **Refresh Analytics**:
   - Click the refresh button in the analytics dashboard
   - Clear analytics cache and reload
   - Restart the application

2. **Web Worker Issues**:
   - Check browser console for Web Worker errors
   - Try disabling and re-enabling analytics
   - Restart the browser

3. **Memory Issues**:
   - Check available system memory
   - Clear browser cache
   - Reduce the number of messages being analyzed

#### Slow Analytics Performance

**Symptoms:**
- Analytics take a long time to load
- UI becomes unresponsive during analysis
- Browser shows "Page unresponsive" warnings

**Solutions:**

1. **Reduce Dataset Size**:
   - Apply filters to reduce message count
   - Use shorter time ranges
   - Analyze smaller batches of messages

2. **Browser Performance**:
   - Close other browser tabs
   - Restart the browser
   - Try using a different browser

3. **System Resources**:
   - Close other applications
   - Check available RAM
   - Consider using a more powerful device

### PWA and Offline Issues

#### PWA Won't Install

**Symptoms:**
- No install prompt appears
- Install button is grayed out
- Installation fails with error

**Solutions:**

1. **Browser Compatibility**:
   - Use a supported browser (Chrome 88+, Firefox 85+, Safari 14+, Edge 88+)
   - Update your browser to the latest version
   - Try a different browser

2. **HTTPS Requirement**:
   - Ensure the app is served over HTTPS
   - Check for SSL certificate issues
   - Try accessing from a different domain

3. **Service Worker Issues**:
   - Clear browser cache and service workers
   - Check browser console for service worker errors
   - Try hard refresh (Ctrl+F5 or Cmd+Shift+R)

#### Offline Mode Not Working

**Symptoms:**
- App doesn't work when offline
- "No internet connection" errors
- Cached data not available

**Solutions:**

1. **Service Worker Registration**:
   - Check if service worker is registered (Developer Tools > Application > Service Workers)
   - Clear and re-register service worker
   - Verify service worker is active

2. **Cache Issues**:
   - Clear application cache
   - Force cache update by refreshing while online
   - Check cache storage in Developer Tools

3. **Data Synchronization**:
   - Ensure data was cached while online
   - Check offline storage limits
   - Verify sync settings are enabled

### Performance Issues

#### Slow Loading Times

**Symptoms:**
- App takes long time to load
- Components render slowly
- Laggy user interactions

**Solutions:**

1. **Network Optimization**:
   - Check internet connection speed
   - Try using a faster network connection
   - Clear browser cache

2. **Browser Performance**:
   - Close unnecessary browser tabs
   - Disable browser extensions
   - Restart the browser

3. **Application Optimization**:
   - Reduce the number of messages loaded at once
   - Use pagination for large datasets
   - Clear old cached data

#### High Memory Usage

**Symptoms:**
- Browser becomes slow or unresponsive
- System memory usage is high
- "Out of memory" errors

**Solutions:**

1. **Data Management**:
   - Reduce the number of cached messages
   - Clear analytics data regularly
   - Use smaller time ranges for analysis

2. **Browser Settings**:
   - Increase browser memory limits if possible
   - Close other browser tabs and applications
   - Restart the browser periodically

### Security and Authentication Issues

#### Credentials Not Saving

**Symptoms:**
- Connection profiles disappear after browser restart
- Need to re-enter credentials frequently
- "Authentication required" errors

**Solutions:**

1. **Browser Storage**:
   - Check if browser allows local storage
   - Ensure cookies and local storage are enabled
   - Check if browser is in private/incognito mode

2. **Encryption Issues**:
   - Verify Web Crypto API is supported
   - Check for browser security settings that block encryption
   - Try using a different browser

3. **Storage Limits**:
   - Check available storage space
   - Clear old data to free up space
   - Increase browser storage limits if possible

#### Azure AD Authentication Fails

**Symptoms:**
- OAuth flow doesn't complete
- "Authentication failed" errors
- Redirect issues during login

**Solutions:**

1. **App Registration**:
   - Verify app registration settings in Azure AD
   - Check redirect URIs are correctly configured
   - Ensure proper API permissions are granted

2. **Browser Issues**:
   - Allow pop-ups for the authentication domain
   - Clear browser cookies for Microsoft domains
   - Try using a different browser

3. **Network Issues**:
   - Check if corporate firewall blocks Microsoft authentication endpoints
   - Verify DNS resolution for Microsoft domains
   - Try from a different network

## Error Messages Reference

### Connection Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Invalid connection string" | Malformed connection string | Verify connection string format |
| "Authentication failed" | Invalid credentials | Check access keys or Azure AD settings |
| "Namespace not found" | Incorrect namespace | Verify Service Bus namespace name |
| "Access denied" | Insufficient permissions | Check access policies and permissions |
| "Connection timeout" | Network issues | Check network connectivity |

### Message Operation Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Queue not found" | Queue doesn't exist | Verify queue name and existence |
| "Message too large" | Message exceeds size limit | Reduce message size |
| "Quota exceeded" | Service Bus quota reached | Check Service Bus metrics and limits |
| "Lock lost" | Message lock expired | Retry operation with fresh lock |
| "Invalid message format" | Malformed JSON | Validate JSON format |

### Analytics Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Analysis failed" | Web Worker error | Check browser console and restart |
| "Out of memory" | Insufficient memory | Reduce dataset size |
| "Invalid JSON" | Malformed message body | Check message format |
| "Field not found" | Field path doesn't exist | Verify field path syntax |

## Getting Help

### Self-Service Resources

1. **Documentation**: Review the complete user guide and analytics documentation
2. **FAQ**: Check the frequently asked questions section
3. **Browser Console**: Check for error messages in the browser developer tools
4. **Network Tab**: Monitor network requests for connection issues

### Diagnostic Information

When reporting issues, please include:

1. **Browser Information**:
   - Browser name and version
   - Operating system
   - Device type (desktop/mobile)

2. **Error Details**:
   - Exact error messages
   - Steps to reproduce the issue
   - Screenshots if applicable

3. **Environment Information**:
   - Service Bus namespace and region
   - Authentication method used
   - Network configuration (if relevant)

### Browser Developer Tools

Use browser developer tools to diagnose issues:

1. **Console Tab**: Check for JavaScript errors
2. **Network Tab**: Monitor network requests and responses
3. **Application Tab**: Check service worker and storage status
4. **Performance Tab**: Analyze performance issues

### Common Browser Console Commands

```javascript
// Check service worker status
navigator.serviceWorker.getRegistrations()

// Check local storage usage
navigator.storage.estimate()

// Clear all application data
localStorage.clear()
sessionStorage.clear()
indexedDB.deleteDatabase('azure-service-bus-explorer')

// Check Web Crypto API support
console.log('Web Crypto API supported:', !!window.crypto.subtle)
```

## Prevention Tips

### Regular Maintenance

1. **Clear Cache**: Regularly clear browser cache and application data
2. **Update Browser**: Keep your browser updated to the latest version
3. **Monitor Storage**: Check local storage usage and clean up old data
4. **Review Connections**: Periodically review and update connection profiles

### Best Practices

1. **Use Appropriate Batch Sizes**: Don't load too many messages at once
2. **Apply Filters**: Use filters to reduce data processing load
3. **Monitor Performance**: Keep an eye on memory and CPU usage
4. **Regular Backups**: Export important connection profiles and settings

### Security Practices

1. **Secure Connections**: Always use HTTPS
2. **Regular Password Updates**: Update Service Bus access keys regularly
3. **Principle of Least Privilege**: Use connection strings with minimal required permissions
4. **Secure Devices**: Ensure your devices are secure and updated