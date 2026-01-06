import { test, expect } from '@playwright/test';

/**
 * Payment Disputes E2E Tests
 * 
 * Smoke tests for the payment disputes feature.
 * These tests verify pages render without errors.
 */

test.describe('Payment Disputes - Admin Page', () => {
  test('/admin/payment-disputes renders without errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    // Navigate to page (will redirect to login if not authenticated)
    await page.goto('/admin/payment-disputes');
    await page.waitForLoadState('networkidle');

    // Should either show login or the disputes page
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    // Check we're either on login or disputes page
    const currentUrl = page.url();
    expect(
      currentUrl.includes('/admin/login') || 
      currentUrl.includes('/admin/payment-disputes')
    ).toBeTruthy();

    // Filter critical errors (ignore expected auth redirects)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('401') && 
             !e.includes('not authenticated') &&
             e.includes('is not a function') ||
             e.includes('Cannot read properties of undefined')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Payment Disputes - Portal Integration', () => {
  test('/portal/invoices page loads correctly', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto('/portal/invoices');
    await page.waitForLoadState('networkidle');

    // Should redirect to auth or show invoices
    const currentUrl = page.url();
    expect(
      currentUrl.includes('/portal/auth') || 
      currentUrl.includes('/portal/invoices') ||
      currentUrl.includes('/portal')
    ).toBeTruthy();

    // No critical JS errors
    const criticalErrors = consoleErrors.filter(
      (e) => e.includes('is not a function') ||
             e.includes('Cannot read properties of undefined')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});
