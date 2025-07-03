import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ServiceBusMessageClient } from './service-bus-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class WebServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.clients = new Set();
    this.messageClient = new ServiceBusMessageClient();
    this.isMessageMonitoringActive = false;
    
    // WebSocket batching configuration
    this.pendingBroadcasts = [];
    this.batchTimeout = null;
    this.batchDelay = 100; // ms
    
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupRoutes() {
    // Serve static files from public directory
    this.app.use(express.static(join(__dirname, '../public')));
    
    // Main dashboard route
    this.app.get('/', (req, res) => {
      res.sendFile(join(__dirname, '../public/index.html'));
    });

    // Message monitor route
    this.app.get('/messages', (req, res) => {
      res.sendFile(join(__dirname, '../public/messages.html'));
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log('Client connected');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(data, ws);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('Client disconnected');
      });
    });
  }

  handleWebSocketMessage(data, ws) {
    switch (data.action) {
      case 'startMessageMonitoring':
        this.startMessageMonitoring();
        break;
      case 'refreshMessages':
        this.refreshMessages();
        break;
      case 'clearMessages':
        this.clearMessages();
        break;
      case 'forceMemoryCleanup':
        this.forceMemoryCleanup();
        break;
      case 'getMemoryStats':
        this.getMemoryStats();
        break;
    }
  }

  startMessageMonitoring() {
    if (this.isMessageMonitoringActive) return;
    
    this.isMessageMonitoringActive = true;
    
    // Start memory monitoring
    this.messageClient.startMemoryMonitoring();
    
    this.messageClient.startMessagePeeking(
      (messages) => {
        const statistics = this.messageClient.getMessageStatistics();
        const memoryStats = this.messageClient.getMemoryUsage();
        
        this.broadcast({
          type: 'messagesUpdate',
          messages: messages,
          statistics: { ...statistics, memoryStats }
        });
      },
      (error) => {
        this.broadcast({
          type: 'messageError',
          error: error
        });
      }
    );
  }

  refreshMessages() {
    if (this.messageClient.isConfigured) {
      const messages = this.messageClient.getAllProcessedMessages();
      const statistics = this.messageClient.getMessageStatistics();
      const memoryStats = this.messageClient.getMemoryUsage();
      
      this.broadcast({
        type: 'messagesUpdate',
        messages: messages,
        statistics: { ...statistics, memoryStats }
      });
    }
  }

  clearMessages() {
    this.messageClient.clearMessages();
    this.broadcast({
      type: 'messagesUpdate',
      messages: [],
      statistics: {
        totalMessages: 0,
        chirpStackMessages: 0,
        messageTypes: {},
        uniqueGateways: 0,
        uniqueDevices: 0,
        averageSize: 0,
        memoryStats: this.messageClient.getMemoryUsage()
      }
    });
  }

  forceMemoryCleanup() {
    if (this.messageClient.isConfigured) {
      const cleanup = this.messageClient.forceMemoryCleanup();
      const messages = this.messageClient.getAllProcessedMessages();
      const statistics = this.messageClient.getMessageStatistics();
      const memoryStats = this.messageClient.getMemoryUsage();
      
      this.broadcast({
        type: 'messagesUpdate',
        messages: messages,
        statistics: { ...statistics, memoryStats }
      });
      
      this.broadcast({
        type: 'memoryCleanupComplete',
        cleanup: cleanup
      });
    }
  }

  getMemoryStats() {
    if (this.messageClient.isConfigured) {
      const memoryStats = this.messageClient.getMemoryUsage();
      this.broadcast({
        type: 'memoryStats',
        memoryStats: memoryStats
      });
    }
  }

  broadcast(data) {
    // Add to pending broadcasts for batching
    this.pendingBroadcasts.push(data);
    
    // Clear existing timeout and set new one
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = setTimeout(() => {
      this.flushBroadcasts();
    }, this.batchDelay);
  }

  flushBroadcasts() {
    if (this.pendingBroadcasts.length === 0) return;
    
    // Create batched message
    const batchedData = {
      type: 'batch',
      messages: [...this.pendingBroadcasts],
      timestamp: Date.now()
    };
    
    const message = JSON.stringify(batchedData);
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
    
    // Clear pending broadcasts
    this.pendingBroadcasts = [];
    this.batchTimeout = null;
  }

  // Immediate broadcast for critical messages
  broadcastImmediate(data) {
    const message = JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  updateGatewayTable(data, totalGateways) {
    this.broadcast({
      type: 'gatewayUpdate',
      data: data,
      totalGateways: totalGateways
    });
  }

  addLog(message) {
    this.broadcast({
      type: 'log',
      message: message,
      timestamp: new Date().toLocaleTimeString()
    });
  }

  addMarker(lat, lon, color, char, gatewayInfo) {
    this.broadcast({
      type: 'marker',
      lat: lat,
      lon: lon,
      color: color,
      char: char,
      gatewayInfo: gatewayInfo
    });
  }

  clearMarkers() {
    this.broadcast({
      type: 'clearMarkers'
    });
  }

  start(port = 3000) {
    this.server.listen(port, () => {
      console.log(`Web dashboard available at http://localhost:${port}`);
    });
  }
}

export { WebServer };