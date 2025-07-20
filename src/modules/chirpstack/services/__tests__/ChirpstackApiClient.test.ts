/**
 * Unit tests for ChirpstackApiClient
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChirpstackApiClient } from '../ChirpstackApiClient';

// Mock fetch
global.fetch = vi.fn();

describe('ChirpstackApiClient', () => {
  let apiClient: ChirpstackApiClient;
  const mockConfig = {
    baseUrl: 'https://chirpstack.example.com',
    apiKey: 'test-api-key',
    timeout: 5000,
  };

  beforeEach(() => {
    apiClient = new ChirpstackApiClient(mockConfig);
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(apiClient).toBeInstanceOf(ChirpstackApiClient);
      expect((apiClient as any).config).toEqual(mockConfig);
    });

    it('should throw error for invalid configuration', () => {
      expect(() => {
        new ChirpstackApiClient({
          baseUrl: '',
          apiKey: '',
          timeout: 0,
        });
      }).toThrow('Invalid Chirpstack configuration');
    });
  });

  describe('authentication', () => {
    it('should include API key in request headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ gateways: [] }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await apiClient.getGateways();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/gateways'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle authentication errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ error: 'Invalid API key' }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(apiClient.getGateways()).rejects.toThrow('Authentication failed: Invalid API key');
    });
  });

  describe('gateway operations', () => {
    const mockGateway = {
      gatewayId: 'gateway-1',
      name: 'Test Gateway',
      description: 'Test gateway description',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        altitude: 10,
      },
      metadata: {
        region: 'us-east-1',
        model: 'RAK7258',
      },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    };

    describe('getGateways', () => {
      it('should fetch all gateways', async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            result: [mockGateway],
            totalCount: 1,
          }),
        };
        vi.mocked(fetch).mockResolvedValue(mockResponse as any);

        const result = await apiClient.getGateways();

        expect(fetch).toHaveBeenCalledWith(
          'https://chirpstack.example.com/api/gateways?limit=100&offset=0',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-api-key',
            }),
          })
        );

        expect(result).toEqual({
          gateways: [mockGateway],
          totalCount: 1,
        });
      });

      it('should handle pagination parameters', async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            result: [mockGateway],
            totalCount: 50,
          }),
        };
        vi.mocked(fetch).mockResolvedValue(mockResponse as any);

        await apiClient.getGateways({ limit: 25, offset: 25 });

        expect(fetch).toHaveBeenCalledWith(
          'https://chirpstack.example.com/api/gateways?limit=25&offset=25',
          expect.any(Object)
        );
      });

      it('should handle search parameters', async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            result: [mockGateway],
            totalCount: 1,
          }),
        };
        vi.mocked(fetch).mockResolvedValue(mockResponse as any);

        await apiClient.getGateways({ search: 'test-gateway' });

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('search=test-gateway'),
          expect.any(Object)
        );
      });
    });

    describe('getGateway', () => {
      it('should fetch single gateway by ID', async () => {
        const mockResponse = {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            gateway: mockGateway,
          }),
        };
        vi.mocked(fetch).mockResolvedValue(mockResponse as any);

        const result = await apiClient.getGateway('gateway-1');

        expect(fetch).toHaveBeenCalledWith(
          'https://chirpstack.example.com/api/gateways/gateway-1',
          expect.objectContaining({
            method: 'GET',
          })
        );

        expect(result).toEqual(mockGateway);
      });

      it('should handle gateway not found', async () => {
        const mockResponse = {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: vi.fn().mockResolvedValue({ error: 'Gateway not found' }),
        };
        vi.mocked(fetch).mockResolvedValue(mockResponse as any);

        await expect(apiClient.getGateway('non-existent')).rejects.toThrow('Gateway not found');
      });
    });

    describe('getGatewayStats', () => {
      it('should fetch gateway statistics', async () => {
        const mockStats = {
          rxPacketsReceived: 1000,
          rxPacketsReceivedOK: 950,
          txPacketsReceived: 500,
          txPacketsEmitted: 480,
          timestamp: '2023-01-01T12:00:00Z',
        };

        const mockResponse = {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({
            result: [mockStats],
          }),
        };
        vi.mocked(fetch).mockResolvedValue(mockResponse as any);

        const result = await apiClient.getGatewayStats('gateway-1');

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/gateways/gateway-1/stats'),
          expect.any(Object)
        );

        expect(result).toEqual([mockStats]);
      });

      it('should handle date range parameters', async () => {
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-01-31');

        const mockResponse = {
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ result: [] }),
        };
        vi.mocked(fetch).mockResolvedValue(mockResponse as any);

        await apiClient.getGatewayStats('gateway-1', startDate, endDate);

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('start=2023-01-01T00:00:00.000Z'),
          expect.any(Object)
        );
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('end=2023-01-31T00:00:00.000Z'),
          expect.any(Object)
        );
      });
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await expect(apiClient.getGateways()).rejects.toThrow('Network error occurred: Network error');
    });

    it('should handle timeout errors', async () => {
      vi.mocked(fetch).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(apiClient.getGateways()).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(apiClient.getGateways()).rejects.toThrow('Invalid JSON response');
    });

    it('should handle HTTP error status codes', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({ error: 'Server error' }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(apiClient.getGateways()).rejects.toThrow('Server error');
    });
  });

  describe('request configuration', () => {
    it('should apply timeout to requests', async () => {
      const shortTimeoutClient = new ChirpstackApiClient({
        ...mockConfig,
        timeout: 100,
      });

      // Mock a slow response
      vi.mocked(fetch).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(shortTimeoutClient.getGateways()).rejects.toThrow();
    });

    it('should handle custom headers', async () => {
      const clientWithHeaders = new ChirpstackApiClient({
        ...mockConfig,
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: [] }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await clientWithHeaders.getGateways();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'custom-value',
          }),
        })
      );
    });
  });

  describe('URL construction', () => {
    it('should construct correct URLs with base URL', () => {
      const url = (apiClient as any).buildUrl('/gateways');
      expect(url).toBe('https://chirpstack.example.com/api/gateways');
    });

    it('should handle base URL with trailing slash', () => {
      const clientWithSlash = new ChirpstackApiClient({
        ...mockConfig,
        baseUrl: 'https://chirpstack.example.com/',
      });

      const url = (clientWithSlash as any).buildUrl('/gateways');
      expect(url).toBe('https://chirpstack.example.com/api/gateways');
    });

    it('should construct URLs with query parameters', () => {
      const url = (apiClient as any).buildUrl('/gateways', { limit: 50, search: 'test' });
      expect(url).toBe('https://chirpstack.example.com/api/gateways?limit=50&search=test');
    });

    it('should handle empty query parameters', () => {
      const url = (apiClient as any).buildUrl('/gateways', {});
      expect(url).toBe('https://chirpstack.example.com/api/gateways');
    });
  });

  describe('response parsing', () => {
    it('should parse successful responses correctly', async () => {
      const mockData = { gateways: [mockGateway] };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await (apiClient as any).makeRequest('/gateways');
      expect(result).toEqual(mockData);
    });

    it('should handle empty responses', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        json: vi.fn().mockResolvedValue(null),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await (apiClient as any).makeRequest('/gateways');
      expect(result).toBeNull();
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed requests', async () => {
      const mockFailResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({ error: 'Temporary error' }),
      };
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: [] }),
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockFailResponse as any)
        .mockResolvedValueOnce(mockSuccessResponse as any);

      const clientWithRetry = new ChirpstackApiClient({
        ...mockConfig,
        retryAttempts: 2,
      });

      const result = await clientWithRetry.getGateways();
      expect(result).toEqual({ gateways: [], totalCount: 0 });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry authentication errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ error: 'Invalid API key' }),
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const clientWithRetry = new ChirpstackApiClient({
        ...mockConfig,
        retryAttempts: 3,
      });

      await expect(clientWithRetry.getGateways()).rejects.toThrow('Authentication failed');
      expect(fetch).toHaveBeenCalledTimes(1); // Should not retry auth errors
    });
  });
});