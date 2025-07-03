class DashboardApp {
    constructor() {
        this.ws = null;
        this.map = null;
        this.markers = new Map();
        this.logs = [];
        this.maxLogs = 100;
        this.gatewayData = {};
        
        this.initWebSocket();
        this.initMap();
        this.updateConnectionStatus('CONNECTING...');
    }

    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus('CONNECTED', true);
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus('DISCONNECTED', false);
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.initWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('ERROR', false);
        };
    }

    initMap() {
        // Initialize Leaflet map centered on North America
        this.map = L.map('map').setView([45.0, -100.0], 4);
        
        // Use a dark theme tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);
    }

    handleMessage(data) {
        switch (data.type) {
            case 'gatewayUpdate':
                this.updateGatewayTable(data.data, data.totalGateways);
                this.updateStatistics(data.data, data.totalGateways);
                break;
            case 'log':
                this.addLog(data.message, data.timestamp);
                break;
            case 'marker':
                this.addMarker(data.lat, data.lon, data.color, data.char, data.gatewayInfo);
                break;
            case 'clearMarkers':
                this.clearMarkers();
                break;
        }
    }

    updateConnectionStatus(status, connected = false) {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.textContent = status;
        statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    }

    updateGatewayTable(data, totalGateways) {
        this.gatewayData = data;
        const tbody = document.getElementById('gatewayTableBody');
        const totalEl = document.getElementById('totalGateways');
        
        totalEl.textContent = totalGateways;
        
        // Sort by RX packets (highest first)
        const sortedEntries = Object.entries(data).sort(([,a], [,b]) => b.rxPackets - a.rxPackets);
        
        tbody.innerHTML = '';
        
        // Show all gateways, not just 20
        sortedEntries.forEach(([gatewayId, info]) => {
            const row = document.createElement('tr');
            
            const frequencyClass = info.frequency > 80 ? 'frequency-high' : 
                                 info.frequency > 40 ? 'frequency-medium' : 'frequency-low';
            
            const name = info.name.length > 18 ? info.name.substring(0, 15) + '...' : info.name;
            const lastSeen = info.lastSeen ? new Date(info.lastSeen).toLocaleTimeString() : 'N/A';
            
            row.innerHTML = `
                <td>${name}</td>
                <td class="${frequencyClass}">${info.frequency}</td>
                <td style="color: #6666ff">${info.rxPackets}</td>
                <td style="color: #ff66ff">${info.txPackets}</td>
                <td style="color: #888">${lastSeen}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    updateStatistics(data, totalGateways) {
        const entries = Object.values(data);
        const highFreq = entries.filter(g => g.frequency > 80).length;
        const mediumFreq = entries.filter(g => g.frequency > 40 && g.frequency <= 80).length;
        const lowFreq = entries.filter(g => g.frequency <= 40).length;
        
        document.getElementById('statTotalGateways').textContent = Object.keys(data).length;
        document.getElementById('statActiveGateways').textContent = totalGateways;
        document.getElementById('statHighFreq').textContent = highFreq;
        document.getElementById('statMediumFreq').textContent = mediumFreq;
        document.getElementById('statLowFreq').textContent = lowFreq;
        document.getElementById('statLastUpdate').textContent = new Date().toLocaleTimeString();
    }

    addLog(message, timestamp) {
        const logContainer = document.getElementById('logContainer');
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const isError = message.includes('ERROR');
        const messageClass = isError ? 'log-error' : '';
        
        logEntry.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span> 
            <span class="${messageClass}">${message}</span>
        `;
        
        logContainer.appendChild(logEntry);
        
        // Keep only the last 100 log entries
        while (logContainer.children.length > this.maxLogs) {
            logContainer.removeChild(logContainer.firstChild);
        }
        
        // Auto-scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    addMarker(lat, lon, color, char, gatewayInfo) {
        const markerId = `${lat}-${lon}`;
        
        // Remove existing marker if it exists
        if (this.markers.has(markerId)) {
            this.map.removeLayer(this.markers.get(markerId));
        }
        
        // Create marker with appropriate color
        const markerColor = color === 'green' ? '#00ff00' : 
                           color === 'yellow' ? '#ffff00' : '#ff6666';
        
        const marker = L.circleMarker([lat, lon], {
            radius: 6,
            fillColor: markerColor,
            color: markerColor,
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.6
        }).addTo(this.map);
        
        // Add popup with gateway info
        if (gatewayInfo) {
            marker.bindPopup(`
                <div style="color: #000; font-family: 'Courier New', monospace; font-size: 11px;">
                    <strong>${gatewayInfo.name}</strong><br>
                    Frequency: ${gatewayInfo.frequency}<br>
                    RX Packets: ${gatewayInfo.rxPackets}<br>
                    TX Packets: ${gatewayInfo.txPackets}<br>
                    Last Seen: ${gatewayInfo.lastSeen ? new Date(gatewayInfo.lastSeen).toLocaleString() : 'N/A'}
                </div>
            `);
        }
        
        this.markers.set(markerId, marker);
        this.updateMarkerCount();
    }

    clearMarkers() {
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers.clear();
        this.updateMarkerCount();
    }

    updateMarkerCount() {
        document.getElementById('markerCount').textContent = this.markers.size;
    }
}

// Initialize the dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new DashboardApp();
});