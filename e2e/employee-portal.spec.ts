import { test, expect, Page } from '@playwright/test';

// Helper to collect console errors
async function setupConsoleErrorCollection(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

test.describe('Employee Portal Routes', () => {
  test('/employee redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/login page renders without console errors', async ({ page }) => {
    const errors = await setupConsoleErrorCollection(page);
    await page.goto('/employee/login');
    await page.waitForLoadState('networkidle');
    
    // Check page content
    await expect(page.locator('text=Portail Employé')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // No console errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('/employee/clients redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/clients');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/orders redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/orders');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/billing redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/billing');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/cancellations redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/cancellations');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/payment-disputes redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/payment-disputes');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });

  test('/employee/tickets redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/employee/tickets');
    await page.waitForURL(/\/employee\/login/);
    expect(page.url()).toContain('/employee/login');
  });
});
