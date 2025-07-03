import "dotenv/config";
import { Agent } from "undici";

const baseURL = process.env.CHIRPSTACK_BASE_URL || "https://www.chirpstack.io/application-server/api";
const apiKey = process.env.CHIRPSTACK_API_KEY || "";

class ChirpStackClient {
  constructor() {
    this.baseURL = baseURL;
    this.headers = {
      'Content-Type': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
    };
    this.gatewayCache = null;
    this.cacheExpiry = 0;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  async makeRequest(endpoint) {
    const httpsAgent = new Agent({
      connect: {
        rejectUnauthorized: false
      }
    })

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: this.headers,
        dispatcher: httpsAgent
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorBody = await response.json();
          if (errorBody.error || errorBody.message) {
            errorMessage += ` - ${errorBody.error || errorBody.message}`;
          }
        } catch (jsonError) {
          // If we can't parse JSON, just use the status text
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      // Don't throw error, just log it and return empty result
      if (this.onError) {
        this.onError(`API Error [${endpoint}]: ${error.message}`);
      }
      return { result: [] };
    }
  }

  async getGateways() {
    const now = Date.now();

    // Return cached data if still valid
    if (this.gatewayCache && now < this.cacheExpiry) {
      return this.gatewayCache;
    }

    const queryParams = new URLSearchParams({
      limit: 2000
    });

    // Fetch fresh data
    const data = await this.makeRequest(`/api/gateways?${queryParams}`);
    const gateways = data.result || [];

    // Update cache
    this.gatewayCache = gateways;
    this.cacheExpiry = now + this.cacheTimeout;

    return gateways;
  }

  async getGatewayStats(gatewayId) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Format timestamps in the required format
    const endTimestamp = this.formatTimestamp(now);
    const startTimestamp = this.formatTimestamp(oneHourAgo);

    const queryParams = new URLSearchParams({
      startTimestamp,
      endTimestamp,
      interval: 'hour'
    });

    const data = await this.makeRequest(`/api/gateways/${gatewayId}/stats?${queryParams}`);
    return data.result || [];
  }

  formatTimestamp(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    const timezone = date.getTimezoneOffset();
    const tzHours = String(Math.floor(Math.abs(timezone) / 60)).padStart(2, '0');
    const tzMinutes = String(Math.abs(timezone) % 60).padStart(2, '0');
    const tzSign = timezone <= 0 ? '+' : '-';

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${tzSign}${tzHours}:${tzMinutes}`;
  }

  async startMonitoring(onGatewayUpdate, onError = null) {
    this.onError = onError;

    const poll = async () => {
      try {
        const gateways = await this.getGateways();
        const gatewayData = [];

        for (const gateway of gateways) {
          // Only get stats for gateways seen within 2 hours
          if (this.isActiveGateway(gateway.lastSeenAt)) {
            const stats = await this.getGatewayStats(gateway.id);
            gatewayData.push({
              ...gateway,
              stats: stats
            });
          } else {
            // Include gateway without stats for inactive ones
            gatewayData.push({
              ...gateway,
              stats: []
            });
          }
        }

        onGatewayUpdate(gatewayData);
      } catch (error) {
        if (onError) {
          onError(`Monitoring Error: ${error.message}`);
        }
      }

      setTimeout(poll, 10000); // Poll every 10 seconds
    };

    poll();
  }

  isActiveGateway(lastSeenAt) {
    if (!lastSeenAt) return false;
    const lastSeen = new Date(lastSeenAt);
    const now = new Date();
    const diffMinutes = (now - lastSeen) / (1000 * 60);
    return diffMinutes < 120; // Active if seen within 2 hours
  }
}

export { ChirpStackClient };