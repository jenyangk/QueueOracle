import { ChirpStackClient } from './chirpstack-client.js';
import { WebServer } from './web-server.js';

const webServer = new WebServer();
const chirpStackClient = new ChirpStackClient();

const gatewayAnalytics = {};
const gatewayLastSeen = {};
let totalGateways = 0;
let lastUpdateTime = Date.now();

function calculateReportingFrequency(lastSeenAt) {
  if (!lastSeenAt) return 0;
  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  const diffMinutes = (now - lastSeen) / (1000 * 60);
  
  // Return frequency score (higher = more recent)
  if (diffMinutes < 1) return 100;
  if (diffMinutes < 5) return 80;
  if (diffMinutes < 15) return 60;
  if (diffMinutes < 60) return 40;
  if (diffMinutes < 240) return 20;
  return 5;
}

function isActiveGateway(lastSeenAt) {
  if (!lastSeenAt) return false;
  const lastSeen = new Date(lastSeenAt);
  const now = new Date();
  const diffMinutes = (now - lastSeen) / (1000 * 60);
  return diffMinutes < 120; // Active if seen within 2 hours
}

chirpStackClient.startMonitoring((gatewayData) => {
  const activeGateways = gatewayData.filter(gateway => isActiveGateway(gateway.lastSeenAt));
  totalGateways = activeGateways.length;
  
  // Clear previous markers
  webServer.clearMarkers();
  
  // Process each active gateway
  activeGateways.forEach(gateway => {
    const frequency = calculateReportingFrequency(gateway.lastSeenAt);
    gatewayAnalytics[gateway.id] = {
      name: gateway.name || gateway.id,
      frequency: frequency,
      lastSeen: gateway.lastSeenAt,
      location: gateway.location,
      rxPackets: gateway.stats.length > 0 ? gateway.stats[0].rxPacketsReceived : 0,
      txPackets: gateway.stats.length > 0 ? gateway.stats[0].txPacketsEmitted : 0
    };
    
    // Track changes in last seen time
    if (gatewayLastSeen[gateway.id] !== gateway.lastSeenAt) {
      gatewayLastSeen[gateway.id] = gateway.lastSeenAt;
      webServer.addLog(`Gateway ${gateway.name || gateway.id} last seen: ${new Date(gateway.lastSeenAt).toLocaleString()}`);
    }
    
    // Add markers for gateways with location data
    if (gateway.location && gateway.location.latitude && gateway.location.longitude) {
      const color = frequency > 80 ? 'green' : frequency > 40 ? 'yellow' : 'red';
      webServer.addMarker(gateway.location.latitude, gateway.location.longitude, color, 'G', gatewayAnalytics[gateway.id]);
    }
  });
  
  webServer.updateGatewayTable(gatewayAnalytics, totalGateways);
  
  const currentTime = Date.now();
  if (currentTime - lastUpdateTime > 30000) { // Log every 30 seconds
    webServer.addLog(`Monitoring ${totalGateways} active gateways`);
    lastUpdateTime = currentTime;
  }
}, (errorMessage) => {
  // Handle API errors gracefully in the UI log
  webServer.addLog(`ERROR: ${errorMessage}`);
});

// Start the web server
webServer.start(3000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});

console.log('Starting ChirpStack gateway monitoring...');
