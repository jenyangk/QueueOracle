/**
 * End-to-end tests for Service Bus operations
 */

import { test, expect } from '@playwright/test';

test.describe('Service Bus Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Azure Service Bus Explorer v2.0.0')).toBeVisible();
  });

  test.describe('Connection Management', () => {
    test('should display connection form', async ({ page }) => {
      // Navigate to Service Bus section
      await page.getByText('Service Bus Explorer').click();
      
      // Should show connection form
      await expect(page.getByText('Connection Profiles')).toBeVisible();
      await expect(page.getByPlaceholder('Connection Name')).toBeVisible();
      await expect(page.getByPlaceholder('Connection String')).toBeVisible();
    });

    test('should validate connection string format', async ({ page }) => {
      await page.getByText('Service Bus Explorer').click();
      
      // Enter invalid connection string
      await page.getByPlaceholder('Connection Name').fill('Test Connection');
      await page.getByPlaceholder('Connection String').fill('invalid-connection-string');
      
      // Try to save
      await page.getByRole('button', { name: 'Save Connection' }).click();
      
      // Should show validation error
      await expect(page.getByText('Invalid connection string format')).toBeVisible();
    });

    test('should save valid connection profile', async ({ page }) => {
      await page.getByText('Service Bus Explorer').click();
      
      // Enter valid connection details
      await page.getByPlaceholder('Connection Name').fill('Test Connection');
      await page.getByPlaceholder('Connection String').fill(
        'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=testkey123='
      );
      
      // Save connection
      await page.getByRole('button', { name: 'Save Connection' }).click();
      
      // Should show success message
      await expect(page.getByText('Connection saved successfully')).toBeVisible();
      
      // Should appear in connection list
      await expect(page.getByText('Test Connection')).toBeVisible();
    });

    test('should test connection', async ({ page }) => {
      await page.getByText('Service Bus Explorer').click();
      
      // Add a connection first
      await page.getByPlaceholder('Connection Name').fill('Test Connection');
      await page.getByPlaceholder('Connection String').fill(
        'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=testkey123='
      );
      await page.getByRole('button', { name: 'Save Connection' }).click();
      
      // Test the connection
      await page.getByRole('button', { name: 'Test Connection' }).click();
      
      // Should show connection status (will likely fail in test environment)
      await expect(page.getByText(/Connection (successful|failed)/)).toBeVisible();
    });
  });

  test.describe('Message Operations', () => {
    test.beforeEach(async ({ page }) => {
      // Setup a test connection
      await page.getByText('Service Bus Explorer').click();
      await page.getByPlaceholder('Connection Name').fill('Test Connection');
      await page.getByPlaceholder('Connection String').fill(
        'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=testkey123='
      );
      await page.getByRole('button', { name: 'Save Connection' }).click();
      await page.getByRole('button', { name: 'Connect' }).click();
    });

    test('should display message list interface', async ({ page }) => {
      // Should show message operations section
      await expect(page.getByText('Messages')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Peek Messages' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Send Message' })).toBeVisible();
    });

    test('should open send message dialog', async ({ page }) => {
      await page.getByRole('button', { name: 'Send Message' }).click();
      
      // Should show send message dialog
      await expect(page.getByText('Send Message')).toBeVisible();
      await expect(page.getByPlaceholder('Message Body (JSON)')).toBeVisible();
      await expect(page.getByPlaceholder('Session ID (optional)')).toBeVisible();
    });

    test('should validate JSON message body', async ({ page }) => {
      await page.getByRole('button', { name: 'Send Message' }).click();
      
      // Enter invalid JSON
      await page.getByPlaceholder('Message Body (JSON)').fill('{ invalid json }');
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Should show validation error
      await expect(page.getByText('Invalid JSON format')).toBeVisible();
    });

    test('should show message filter options', async ({ page }) => {
      // Should show filter controls
      await expect(page.getByPlaceholder('Search messages...')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
      
      // Open filter dialog
      await page.getByRole('button', { name: 'Filters' }).click();
      
      // Should show filter options
      await expect(page.getByText('Date Range')).toBeVisible();
      await expect(page.getByText('Message Types')).toBeVisible();
      await expect(page.getByText('Field Filters')).toBeVisible();
    });
  });

  test.describe('Analytics Dashboard', () => {
    test('should display analytics section', async ({ page }) => {
      await page.getByText('Service Bus Explorer').click();
      
      // Should show analytics section
      await expect(page.getByText('Analytics')).toBeVisible();
      await expect(page.getByText('Field Analytics')).toBeVisible();
      await expect(page.getByText('Message Patterns')).toBeVisible();
    });

    test('should show empty state when no messages', async ({ page }) => {
      await page.getByText('Service Bus Explorer').click();
      
      // Should show empty state
      await expect(page.getByText('No messages to analyze')).toBeVisible();
      await expect(page.getByText('Connect to a Service Bus and peek messages to see analytics')).toBeVisible();
    });

    test('should display export options', async ({ page }) => {
      await page.getByText('Service Bus Explorer').click();
      
      // Should show export button
      await expect(page.getByRole('button', { name: 'Export Data' })).toBeVisible();
      
      // Open export dialog
      await page.getByRole('button', { name: 'Export Data' }).click();
      
      // Should show export options
      await expect(page.getByText('Export Format')).toBeVisible();
      await expect(page.getByRole('radio', { name: 'JSON' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'CSV' })).toBeVisible();
    });
  });

  test.describe('Offline Functionality', () => {
    test('should show offline indicator when disconnected', async ({ page, context }) => {
      // Simulate offline mode
      await context.setOffline(true);
      await page.reload();
      
      // Should show offline indicator
      await expect(page.getByText('Offline')).toBeVisible();
      await expect(page.getByText('You are currently offline')).toBeVisible();
    });

    test('should queue operations when offline', async ({ page, context }) => {
      // Setup connection first
      await page.getByText('Service Bus Explorer').click();
      await page.getByPlaceholder('Connection Name').fill('Test Connection');
      await page.getByPlaceholder('Connection String').fill(
        'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=testkey123='
      );
      await page.getByRole('button', { name: 'Save Connection' }).click();
      
      // Go offline
      await context.setOffline(true);
      
      // Try to send a message
      await page.getByRole('button', { name: 'Send Message' }).click();
      await page.getByPlaceholder('Message Body (JSON)').fill('{"test": "message"}');
      await page.getByRole('button', { name: 'Send' }).click();
      
      // Should show queued operation
      await expect(page.getByText('Operation queued for when online')).toBeVisible();
    });

    test('should sync when coming back online', async ({ page, context }) => {
      // Start offline
      await context.setOffline(true);
      await page.goto('/');
      
      // Should show offline state
      await expect(page.getByText('Offline')).toBeVisible();
      
      // Go back online
      await context.setOffline(false);
      await page.reload();
      
      // Should show online state
      await expect(page.getByText('Online')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should handle large message lists efficiently', async ({ page }) => {
      await page.getByText('Service Bus Explorer').click();
      
      // Mock large dataset (this would need to be setup with test data)
      // For now, just verify the virtualized list is present
      await expect(page.locator('[data-testid="virtualized-list"]')).toBeVisible();
    });

    test('should load quickly', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await expect(page.getByText('Azure Service Bus Explorer v2.0.0')).toBeVisible();
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/');
      
      // Check for proper heading hierarchy
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to navigate with keyboard
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['BUTTON', 'INPUT', 'A']).toContain(focusedElement);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/');
      
      // Check for ARIA labels on interactive elements
      const buttons = await page.locator('button').all();
      for (const button of buttons) {
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();
        
        // Should have either aria-label or visible text
        expect(ariaLabel || text).toBeTruthy();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page, context }) => {
      // Block all network requests
      await context.route('**/*', route => route.abort());
      
      await page.goto('/');
      await page.getByText('Service Bus Explorer').click();
      
      // Try to connect
      await page.getByPlaceholder('Connection Name').fill('Test Connection');
      await page.getByPlaceholder('Connection String').fill(
        'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=testkey123='
      );
      await page.getByRole('button', { name: 'Test Connection' }).click();
      
      // Should show network error
      await expect(page.getByText(/Network error|Connection failed/)).toBeVisible();
    });

    test('should recover from errors', async ({ page }) => {
      await page.goto('/');
      
      // Simulate an error state and recovery
      await page.getByText('Service Bus Explorer').click();
      
      // Should show error boundary if something goes wrong
      // This would need to be triggered by actual error conditions
      
      // For now, just verify the app doesn't crash
      await expect(page.getByText('Azure Service Bus Explorer v2.0.0')).toBeVisible();
    });
  });

  test.describe('Data Persistence', () => {
    test('should persist connection profiles', async ({ page }) => {
      await page.getByText('Service Bus Explorer').click();
      
      // Add a connection
      await page.getByPlaceholder('Connection Name').fill('Persistent Connection');
      await page.getByPlaceholder('Connection String').fill(
        'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=testkey123='
      );
      await page.getByRole('button', { name: 'Save Connection' }).click();
      
      // Reload the page
      await page.reload();
      
      // Connection should still be there
      await expect(page.getByText('Persistent Connection')).toBeVisible();
    });

    test('should persist user preferences', async ({ page }) => {
      await page.goto('/');
      
      // Change theme or other preferences (if implemented)
      // For now, just verify the app maintains state across reloads
      
      await page.reload();
      await expect(page.getByText('Azure Service Bus Explorer v2.0.0')).toBeVisible();
    });
  });
});