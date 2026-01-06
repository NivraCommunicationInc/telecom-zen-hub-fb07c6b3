import { test, expect } from '@playwright/test';

/**
 * QA Block Status E2E Tests
 * 
 * Regression tests to ensure BlockedActionWrapper correctly disables
 * actions when account is blocked.
 * 
 * DEV-ONLY route: /qa/block-status/:mode
 */

test.describe('QA Block Status - BlockedActionWrapper Enforcement', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];

    // Capture all console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });
  });

  test.afterEach(() => {
    // Fail if ANY console error occurred
    expect(consoleErrors, 'No console errors should occur').toHaveLength(0);
  });

  test('/qa/block-status/active - buttons are enabled', async ({ page }) => {
    await page.goto('/qa/block-status/active');
    await page.waitForLoadState('networkidle');

    // Assert ACTIVE badge exists
    const activeBadge = page.locator('text=ACTIVE');
    await expect(activeBadge).toBeVisible({ timeout: 10000 });

    // Assert buttons are enabled and clickable
    const submitRequestBtn = page.locator('button:has-text("Soumettre la demande")');
    await expect(submitRequestBtn).toBeVisible();
    await expect(submitRequestBtn).toBeEnabled();

    const modifyBtn = page.locator('button:has-text("Modifier")');
    await expect(modifyBtn).toBeVisible();
    await expect(modifyBtn).toBeEnabled();

    const confirmOrderBtn = page.locator('button:has-text("Confirmer la commande")');
    await expect(confirmOrderBtn).toBeVisible();
    await expect(confirmOrderBtn).toBeEnabled();

    // Verify no blocked messages appear
    const blockedMessage = page.locator('text=Compte bloqué');
    await expect(blockedMessage).toHaveCount(0);
  });

  test('/qa/block-status/blocked - buttons are disabled', async ({ page }) => {
    await page.goto('/qa/block-status/blocked');
    await page.waitForLoadState('networkidle');

    // Assert BLOCKED badge exists
    const blockedBadge = page.locator('text=BLOCKED');
    await expect(blockedBadge).toBeVisible({ timeout: 10000 });

    // Assert buttons are NOT actionable
    // BlockedActionWrapper applies pointer-events-none and opacity-50 via wrapper div

    // Check "Soumettre la demande" button wrapper has disabled styling
    const submitSection = page.locator('[class*="pointer-events-none"]').filter({
      has: page.locator('button:has-text("Soumettre la demande")')
    });
    await expect(submitSection).toBeVisible();

    // Check "Modifier" button wrapper has disabled styling
    const modifySection = page.locator('[class*="pointer-events-none"]').filter({
      has: page.locator('button:has-text("Modifier")')
    });
    await expect(modifySection).toBeVisible();

    // Check "Confirmer la commande" button wrapper has disabled styling
    const confirmSection = page.locator('[class*="pointer-events-none"]').filter({
      has: page.locator('button:has-text("Confirmer la commande")')
    });
    await expect(confirmSection).toBeVisible();

    // Assert blocked inline notices exist
    const requestDisabledNotice = page.locator('text=Compte bloqué — les demandes sont désactivées.');
    await expect(requestDisabledNotice).toBeVisible();

    const ordersDisabledNotice = page.locator('text=Compte bloqué — les nouvelles commandes sont désactivées.');
    await expect(ordersDisabledNotice).toBeVisible();
  });

  test('/qa/block-status/blocked - clicking disabled buttons does nothing', async ({ page }) => {
    await page.goto('/qa/block-status/blocked');
    await page.waitForLoadState('networkidle');

    // Wait for page to fully render
    const blockedBadge = page.locator('text=BLOCKED');
    await expect(blockedBadge).toBeVisible({ timeout: 10000 });

    // Try to click on the disabled button areas - they should not trigger any action
    // Because pointer-events-none is applied, clicks should not reach the buttons
    
    // Get initial URL
    const initialUrl = page.url();

    // Attempt to click on disabled button (will hit the wrapper with pointer-events-none)
    const submitBtnWrapper = page.locator('div[class*="pointer-events-none"]').first();
    if (await submitBtnWrapper.isVisible()) {
      // Force click on the wrapper - this should not trigger any navigation
      await submitBtnWrapper.click({ force: true }).catch(() => {
        // Click might fail due to pointer-events-none, which is expected
      });
    }

    // Verify no navigation occurred
    expect(page.url()).toBe(initialUrl);

    // Verify page still shows blocked state
    await expect(blockedBadge).toBeVisible();
  });
});
