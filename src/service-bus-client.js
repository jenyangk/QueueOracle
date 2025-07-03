import { ServiceBusClient } from "@azure/service-bus";
import Long from 'long';
import "dotenv/config";

const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING || "";
const queueName = process.env.QUEUE_NAME || "";

class ServiceBusMessageClient {
  constructor() {
    if (!connectionString || !queueName) {
      console.warn('Service Bus connection string or queue name not configured');
      this.isConfigured = false;
      return;
    }
    
    this.sbClient = new ServiceBusClient(connectionString);
    this.isConfigured = true;
    this.isMonitoring = false;
    this.lastSequenceNumber = new Long(0);
    this.allMessages = [];
    
    // Performance optimization settings
    this.maxBufferSize = parseInt(process.env.MAX_MESSAGE_BUFFER_SIZE) || 5000;
    this.messageRetentionHours = parseInt(process.env.MESSAGE_RETENTION_HOURS) || 24;
    this.pollingInterval = parseInt(process.env.POLLING_INTERVAL_MS) || 1000;
    this.maxMessagesPerPeek = parseInt(process.env.MAX_MESSAGES_PER_PEEK) || 100;
    
    // Track processed messages to avoid reprocessing
    this.processedMessages = new Map();
    this.lastProcessedIndex = 0;
  }

  async startMessagePeeking(onMessagesUpdate, onError = null) {
    if (!this.isConfigured) {
      if (onError) {
        onError('Service Bus not configured. Please check environment variables.');
      }
      return;
    }

    this.isMonitoring = true;
    const receiver = this.sbClient.createReceiver(queueName);
    let consecutiveEmptyPeeks = 0;

    const peekMessages = async () => {
      if (!this.isMonitoring) return;

      try {
        // Peek messages from the queue (non-destructive)
        const messages = await receiver.peekMessages(this.maxMessagesPerPeek, { fromSequenceNumber: this.lastSequenceNumber });
        
        if (messages.length > 0) {
          consecutiveEmptyPeeks = 0;
          
          // Add new messages to the accumulated list
          this.allMessages = this.allMessages.concat(messages);
          
          // Update sequence number for next peek
          this.lastSequenceNumber = messages[messages.length - 1].sequenceNumber.add(1);
          
          // Apply buffer management
          this.manageMessageBuffer();
          
          // Process only new messages for efficiency
          const newProcessedMessages = this.processNewMessages(messages);
          if (newProcessedMessages.length > 0) {
            onMessagesUpdate(this.getAllProcessedMessages());
          }
        } else {
          consecutiveEmptyPeeks++;
        }
      } catch (error) {
        if (onError) {
          onError(`Service Bus peek error: ${error.message}`);
        }
      }

      // Adaptive polling - increase interval when no new messages
      const adaptiveInterval = this.pollingInterval + (consecutiveEmptyPeeks * 500);
      const maxInterval = this.pollingInterval * 5;
      const nextInterval = Math.min(adaptiveInterval, maxInterval);
      
      setTimeout(peekMessages, nextInterval);
    };

    peekMessages();
  }

  manageMessageBuffer() {
    // Remove old messages based on retention time
    const cutoffTime = new Date(Date.now() - (this.messageRetentionHours * 60 * 60 * 1000));
    this.allMessages = this.allMessages.filter(message => 
      new Date(message.enqueuedTimeUtc) > cutoffTime
    );
    
    // Limit buffer size (keep most recent messages)
    if (this.allMessages.length > this.maxBufferSize) {
      const excess = this.allMessages.length - this.maxBufferSize;
      this.allMessages = this.allMessages.slice(excess);
      
      // Update processed messages cache to remove old entries
      const oldestSequenceNumber = this.allMessages[0]?.sequenceNumber.toString();
      if (oldestSequenceNumber) {
        for (const [key] of this.processedMessages) {
          if (key < oldestSequenceNumber) {
            this.processedMessages.delete(key);
          }
        }
      }
    }
  }

  processNewMessages(newMessages) {
    const processed = newMessages.map(message => {
      const sequenceNumber = message.sequenceNumber.toString();
      
      // Check if already processed
      if (this.processedMessages.has(sequenceNumber)) {
        return this.processedMessages.get(sequenceNumber);
      }
      
      const body = message.body;
      const isChirpStackMessage = this.isChirpStackMessage(body);
      
      const processedMessage = {
        sequenceNumber: sequenceNumber,
        messageId: message.messageId,
        enqueuedTimeUtc: message.enqueuedTimeUtc,
        deliveryCount: message.deliveryCount,
        timeToLive: message.timeToLive,
        size: JSON.stringify(body).length,
        isChirpStack: isChirpStackMessage,
        gatewayInfo: isChirpStackMessage ? this.extractGatewayInfo(body) : null,
        deviceInfo: isChirpStackMessage ? this.extractDeviceInfo(body) : null,
        messageType: this.determineMessageType(body),
        body: body,
        preview: this.createPreview(body)
      };
      
      // Cache the processed message
      this.processedMessages.set(sequenceNumber, processedMessage);
      return processedMessage;
    });

    return processed;
  }

  getAllProcessedMessages() {
    // Return all processed messages sorted by sequence number
    return Array.from(this.processedMessages.values())
      .sort((a, b) => parseInt(b.sequenceNumber) - parseInt(a.sequenceNumber));
  }

  processMessages(messages) {
    const processed = messages.map(message => {
      const body = message.body;
      const isChirpStackMessage = this.isChirpStackMessage(body);
      
      return {
        sequenceNumber: message.sequenceNumber.toString(),
        messageId: message.messageId,
        enqueuedTimeUtc: message.enqueuedTimeUtc,
        deliveryCount: message.deliveryCount,
        timeToLive: message.timeToLive,
        size: JSON.stringify(body).length,
        isChirpStack: isChirpStackMessage,
        gatewayInfo: isChirpStackMessage ? this.extractGatewayInfo(body) : null,
        deviceInfo: isChirpStackMessage ? this.extractDeviceInfo(body) : null,
        messageType: this.determineMessageType(body),
        body: body,
        preview: this.createPreview(body)
      };
    });

    return processed;
  }

  isChirpStackMessage(body) {
    return body && (
      body.rxInfo || 
      body.txInfo || 
      body.deviceInfo || 
      body.gatewayId ||
      body.devEui ||
      body.applicationId
    );
  }

  extractGatewayInfo(body) {
    if (body.rxInfo) {
      // Handle both array and single object formats
      const rxInfo = Array.isArray(body.rxInfo) ? body.rxInfo[0] : body.rxInfo;
      const gatewayId = rxInfo.gatewayID || rxInfo.gatewayId;
      
      
      return {
        gatewayId: gatewayId,
        rssi: rxInfo.rssi,
        snr: rxInfo.loRaSNR || rxInfo.snr,
        location: rxInfo.location
      };
    }
    return null;
  }

  extractDeviceInfo(body) {
    return {
      devEui: body.devEUI || body.devEui,
      deviceName: body.deviceName,
      applicationId: body.applicationID || body.applicationId,
      applicationName: body.applicationName,
      fCnt: body.fCnt,
      fPort: body.fPort
    };
  }

  determineMessageType(body) {
    if (!body) return 'Unknown';
    
    if (body.rxInfo) return 'Uplink';
    if (body.txInfo) return 'Downlink';
    if (body.deviceInfo) return 'Device Event';
    if (body.gatewayId) return 'Gateway Event';
    if (body.event) return body.event;
    
    return 'Data Message';
  }

  createPreview(body) {
    if (!body) return 'Empty message';
    
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length <= 100) return bodyStr;
    
    return bodyStr.substring(0, 97) + '...';
  }

  getMessageStatistics() {
    const processedMessages = Array.from(this.processedMessages.values());
    
    const stats = {
      totalMessages: processedMessages.length,
      chirpStackMessages: 0,
      messageTypes: {},
      gateways: new Set(),
      devices: new Set(),
      gatewayMessageCounts: {},
      averageSize: 0,
      bufferSize: this.allMessages.length,
      maxBufferSize: this.maxBufferSize
    };

    let totalSize = 0;

    processedMessages.forEach(processed => {
      if (processed.isChirpStack) {
        stats.chirpStackMessages++;
        
        if (processed.gatewayInfo && processed.gatewayInfo.gatewayId) {
          const gatewayId = processed.gatewayInfo.gatewayId;
          stats.gateways.add(gatewayId);
          stats.gatewayMessageCounts[gatewayId] = (stats.gatewayMessageCounts[gatewayId] || 0) + 1;
        }
        
        if (processed.deviceInfo && processed.deviceInfo.devEui) {
          stats.devices.add(processed.deviceInfo.devEui);
        }
      }
      
      const type = processed.messageType;
      stats.messageTypes[type] = (stats.messageTypes[type] || 0) + 1;
      
      totalSize += processed.size;
    });


    stats.averageSize = stats.totalMessages > 0 ? Math.round(totalSize / stats.totalMessages) : 0;
    stats.uniqueGateways = stats.gateways.size;
    stats.uniqueDevices = stats.devices.size;

    return stats;
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  clearMessages() {
    this.allMessages = [];
    this.processedMessages.clear();
    this.lastSequenceNumber = new Long(0);
    this.lastProcessedIndex = 0;
  }

  getMemoryUsage() {
    const memoryStats = {
      totalMessages: this.allMessages.length,
      processedMessagesCache: this.processedMessages.size,
      bufferUsagePercent: Math.round((this.allMessages.length / this.maxBufferSize) * 100),
      estimatedMemoryMB: this.estimateMemoryUsage()
    };
    return memoryStats;
  }

  estimateMemoryUsage() {
    // Rough estimation of memory usage in MB
    let totalSize = 0;
    
    // Raw messages size
    this.allMessages.forEach(message => {
      totalSize += JSON.stringify(message).length;
    });
    
    // Processed messages cache size
    this.processedMessages.forEach(message => {
      totalSize += JSON.stringify(message).length;
    });
    
    // Convert bytes to MB
    return Math.round(totalSize / (1024 * 1024) * 100) / 100;
  }

  forceMemoryCleanup() {
    // Force cleanup of old messages beyond retention period
    const cutoffTime = new Date(Date.now() - (this.messageRetentionHours * 60 * 60 * 1000));
    
    const beforeCount = this.allMessages.length;
    this.allMessages = this.allMessages.filter(message => 
      new Date(message.enqueuedTimeUtc) > cutoffTime
    );
    
    // Clean up processed messages cache
    const validSequenceNumbers = new Set(this.allMessages.map(m => m.sequenceNumber.toString()));
    for (const [key] of this.processedMessages) {
      if (!validSequenceNumbers.has(key)) {
        this.processedMessages.delete(key);
      }
    }
    
    const afterCount = this.allMessages.length;
    return {
      messagesRemoved: beforeCount - afterCount,
      remainingMessages: afterCount
    };
  }

  // Start periodic memory monitoring
  startMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    
    this.memoryMonitorInterval = setInterval(() => {
      const memoryStats = this.getMemoryUsage();
      
      // Auto-cleanup if memory usage is too high
      if (memoryStats.bufferUsagePercent > 90) {
        console.warn('High memory usage detected, forcing cleanup...');
        const cleanup = this.forceMemoryCleanup();
        console.log(`Memory cleanup completed: ${cleanup.messagesRemoved} messages removed, ${cleanup.remainingMessages} remaining`);
      }
    }, 60000); // Check every minute
  }

  stopMemoryMonitoring() {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }
  }
}

export { ServiceBusMessageClient };