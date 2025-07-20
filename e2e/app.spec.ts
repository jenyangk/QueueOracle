import { test, expect } from '@playwright/test'

test('has title', async ({ page }) => {
  await page.goto('/')
  
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Azure Service Bus Explorer/)
})

test('displays main interface', async ({ page }) => {
  await page.goto('/')

  // Check for main title
  await expect(page.getByText('Azure Service Bus Explorer v2.0.0')).toBeVisible()
  
  // Check for service bus section
  await expect(page.getByText('Service Bus Explorer')).toBeVisible()
  
  // Check for chirpstack section
  await expect(page.getByText('Chirpstack Analytics')).toBeVisible()
  
  // Check for system status
  await expect(page.getByText('System Status')).toBeVisible()
})

test('has terminal aesthetic', async ({ page }) => {
  await page.goto('/')
  
  // Check that the page has dark background (terminal style)
  const body = page.locator('body')
  await expect(body).toHaveCSS('background-color', 'rgb(10, 10, 10)')
})