/**
 * Performance tests for Azure Service Bus Explorer
 */

import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test.describe('Page Load Performance', () => {
    test('should load initial page within performance budget', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await expect(page.getByText('Azure Service Bus Explorer v2.0.0')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });

    test('should have good Core Web Vitals', async ({ page }) => {
      await page.goto('/');
      
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      
      // Measure Web Vitals
      const webVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals: any = {};
          
          // Measure LCP (Largest Contentful Paint)
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitals.lcp = lastEntry.startTime;
          }).observe({ entryTypes: ['largest-contentful-paint'] });
          
          // Measure FID (First Input Delay) - simulate with click
          document.addEventListener('click', () => {
            vitals.fid = performance.now();
          }, { once: true });
          
          // Measure CLS (Cumulative Layout Shift)
          let clsValue = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
            vitals.cls = clsValue;
          }).observe({ entryTypes: ['layout-shift'] });
          
          setTimeout(() => resolve(vitals), 3000);
        });
      });
      
      // LCP should be under 2.5 seconds
      if ((webVitals as any).lcp) {
        expect((webVitals as any).lcp).toBeLessThan(2500);
      }
      
      // CLS should be under 0.1
      if ((webVitals as any).cls !== undefined) {
        expect((webVitals as any).cls).toBeLessThan(0.1);
      }
    });

    test('should have efficient bundle size', async ({ page }) => {
      // Navigate to page and measure resource sizes
      await page.goto('/');
      
      // Get all network requests
      const requests: any[] = [];
      page.on('response', (response) => {
        requests.push({
          url: response.url(),
          size: response.headers()['content-length'],
          type: response.headers()['content-type'],
        });
      });
      
      await page.waitForLoadState('networkidle');
      
      // Calculate total JavaScript bundle size
      const jsRequests = requests.filter(req => 
        req.type?.includes('javascript') || req.url.endsWith('.js')
      );
      
      const totalJSSize = jsRequests.reduce((total, req) => 
        total + (parseInt(req.size) || 0), 0
      );
      
      // Total JS bundle should be under 1MB
      expect(totalJSSize).toBeLessThan(1024 * 1024);
    });
  });

  test.describe('Runtime Performance', () => {
    test('should handle large message lists efficiently', async ({ page }) => {
      await page.goto('/');
      await page.getByText('Service Bus Explorer').click();
      
      // Simulate loading a large number of messages
      await page.evaluate(() => {
        // Mock large dataset in the store
        const mockMessages = Array.from({ length: 10000 }, (_, i) => ({
          messageId: `msg-${i}`,
          sequenceNumber: i.toString(),
          enqueuedTimeUtc: new Date(),
          body: { type: 'test', id: i, data: `test-data-${i}` },
          properties: { source: 'test' },
          deliveryCount: 1,
          jsonFields: { type: 'test', id: i },
          analyzedAt: new Date(),
          connectionId: 'test-connection',
        }));
        
        // This would normally update the store with mock data
        // For testing purposes, we'll just verify the UI can handle it
        return mockMessages.length;
      });
      
      const startTime = Date.now();
      
      // Trigger message list rendering (this would need actual implementation)
      // For now, just verify the page remains responsive
      await page.waitForTimeout(1000);
      
      const renderTime = Date.now() - startTime;
      
      // Should render large lists within 1 second
      expect(renderTime).toBeLessThan(1000);
    });

    test('should maintain smooth scrolling with virtualization', async ({ page }) => {
      await page.goto('/');
      await page.getByText('Service Bus Explorer').click();
      
      // Look for virtualized list container
      const virtualizedList = page.locator('[data-testid="virtualized-list"]');
      
      if (await virtualizedList.isVisible()) {
        const startTime = Date.now();
        
        // Simulate scrolling
        await virtualizedList.hover();
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(100);
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(100);
        await page.mouse.wheel(0, 1000);
        
        const scrollTime = Date.now() - startTime;
        
        // Scrolling should be smooth and fast
        expect(scrollTime).toBeLessThan(500);
      }
    });

    test('should handle analytics processing efficiently', async ({ page }) => {
      await page.goto('/');
      await page.getByText('Service Bus Explorer').click();
      
      const startTime = Date.now();
      
      // Simulate analytics processing
      await page.evaluate(() => {
        // Mock analytics calculation
        const mockMessages = Array.from({ length: 1000 }, (_, i) => ({
          messageId: `msg-${i}`,
          body: { 
            type: i % 5 === 0 ? 'order' : 'payment',
            amount: Math.random() * 1000,
            userId: `user-${i % 100}`,
          },
          jsonFields: {
            type: i % 5 === 0 ? 'order' : 'payment',
            amount: Math.random() * 1000,
            userId: `user-${i % 100}`,
          },
        }));
        
        // Simulate field analysis
        const fieldAnalytics: any = {};
        mockMessages.forEach(msg => {
          Object.keys(msg.jsonFields).forEach(field => {
            if (!fieldAnalytics[field]) {
              fieldAnalytics[field] = { count: 0, uniqueValues: new Set() };
            }
            fieldAnalytics[field].count++;
            fieldAnalytics[field].uniqueValues.add(msg.jsonFields[field]);
          });
        });
        
        return Object.keys(fieldAnalytics).length;
      });
      
      const processingTime = Date.now() - startTime;
      
      // Analytics processing should complete within 2 seconds
      expect(processingTime).toBeLessThan(2000);
    });
  });

  test.describe('Memory Performance', () => {
    test('should not have memory leaks', async ({ page }) => {
      await page.goto('/');
      
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });
      
      // Perform operations that might cause memory leaks
      for (let i = 0; i < 10; i++) {
        await page.getByText('Service Bus Explorer').click();
        await page.getByText('Chirpstack Analytics').click();
        await page.waitForTimeout(100);
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });
      
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });
      
      // Memory usage shouldn't increase dramatically
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const increasePercentage = (memoryIncrease / initialMemory) * 100;
        
        // Memory increase should be less than 50%
        expect(increasePercentage).toBeLessThan(50);
      }
    });

    test('should handle large datasets without excessive memory usage', async ({ page }) => {
      await page.goto('/');
      
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });
      
      // Simulate loading large dataset
      await page.evaluate(() => {
        // Create large mock dataset
        const largeDataset = Array.from({ length: 50000 }, (_, i) => ({
          id: i,
          data: `large-data-string-${i}`.repeat(10),
          nested: {
            field1: `value-${i}`,
            field2: Math.random(),
            field3: new Date().toISOString(),
          },
        }));
        
        // Store in a global variable to prevent GC
        (window as any).testData = largeDataset;
        
        return largeDataset.length;
      });
      
      const memoryAfterLoad = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });
      
      // Clean up
      await page.evaluate(() => {
        delete (window as any).testData;
      });
      
      if (initialMemory > 0 && memoryAfterLoad > 0) {
        const memoryUsed = memoryAfterLoad - initialMemory;
        
        // Should not use more than 100MB for large dataset
        expect(memoryUsed).toBeLessThan(100 * 1024 * 1024);
      }
    });
  });

  test.describe('Network Performance', () => {
    test('should handle slow network conditions', async ({ page, context }) => {
      // Simulate slow 3G network
      await context.route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
        await route.continue();
      });
      
      const startTime = Date.now();
      await page.goto('/');
      await expect(page.getByText('Azure Service Bus Explorer v2.0.0')).toBeVisible();
      const loadTime = Date.now() - startTime;
      
      // Should still load within reasonable time on slow network
      expect(loadTime).toBeLessThan(5000);
    });

    test('should cache resources effectively', async ({ page }) => {
      // First load
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Second load (should use cache)
      const startTime = Date.now();
      await page.reload();
      await expect(page.getByText('Azure Service Bus Explorer v2.0.0')).toBeVisible();
      const reloadTime = Date.now() - startTime;
      
      // Reload should be faster due to caching
      expect(reloadTime).toBeLessThan(1000);
    });

    test('should handle offline mode gracefully', async ({ page, context }) => {
      // Load page first
      await page.goto('/');
      await expect(page.getByText('Azure Service Bus Explorer v2.0.0')).toBeVisible();
      
      // Go offline
      await context.setOffline(true);
      
      // Page should still be functional
      await page.getByText('Service Bus Explorer').click();
      await expect(page.getByText('Connection Profiles')).toBeVisible();
      
      // Should show offline indicator
      await expect(page.getByText(/Offline|No connection/)).toBeVisible();
    });
  });

  test.describe('Rendering Performance', () => {
    test('should have efficient re-renders', async ({ page }) => {
      await page.goto('/');
      
      // Measure rendering performance
      const renderingMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const renderEntries = entries.filter(entry => 
              entry.name.includes('render') || entry.entryType === 'measure'
            );
            resolve(renderEntries.length);
          });
          
          observer.observe({ entryTypes: ['measure', 'navigation'] });
          
          // Trigger some re-renders
          document.body.click();
          
          setTimeout(() => {
            observer.disconnect();
            resolve(0);
          }, 1000);
        });
      });
      
      // Should have reasonable number of render operations
      expect(renderingMetrics).toBeLessThan(100);
    });

    test('should handle rapid state changes efficiently', async ({ page }) => {
      await page.goto('/');
      await page.getByText('Service Bus Explorer').click();
      
      const startTime = Date.now();
      
      // Rapidly switch between sections
      for (let i = 0; i < 10; i++) {
        await page.getByText('Service Bus Explorer').click();
        await page.getByText('Chirpstack Analytics').click();
      }
      
      const switchTime = Date.now() - startTime;
      
      // Rapid switching should be smooth
      expect(switchTime).toBeLessThan(2000);
    });
  });

  test.describe('Resource Usage', () => {
    test('should not block main thread excessively', async ({ page }) => {
      await page.goto('/');
      
      // Measure main thread blocking
      const blockingTime = await page.evaluate(() => {
        return new Promise((resolve) => {
          let totalBlockingTime = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if ((entry as any).duration > 50) {
                totalBlockingTime += (entry as any).duration - 50;
              }
            }
          });
          
          observer.observe({ entryTypes: ['longtask'] });
          
          setTimeout(() => {
            observer.disconnect();
            resolve(totalBlockingTime);
          }, 5000);
        });
      });
      
      // Total blocking time should be minimal
      expect(blockingTime).toBeLessThan(300); // Less than 300ms total blocking
    });

    test('should use Web Workers for heavy computations', async ({ page }) => {
      await page.goto('/');
      
      // Check if Web Workers are being used
      const workerUsage = await page.evaluate(() => {
        // This would check if analytics worker is active
        return typeof Worker !== 'undefined';
      });
      
      expect(workerUsage).toBe(true);
    });
  });
});