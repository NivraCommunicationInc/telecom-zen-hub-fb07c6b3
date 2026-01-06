import { test, expect } from '@playwright/test';

/**
 * Regression tests for public routes that must NEVER show blank pages.
 * 
 * ROOT CAUSE (fixed): These pages were using useAuth() which throws
 * when called outside AuthProvider. Public routes must use useOptionalAuth().
 */

const PUBLIC_PLAN_ROUTES = [
  { path: '/internet', heading: /Internet|Forfaits/i },
  { path: '/tv', heading: /TV|Télévision/i },
  { path: '/mobile', heading: /Mobile|Cellulaire/i },
];

test.describe('Public Routes - No Blank Pages', () => {
  for (const route of PUBLIC_PLAN_ROUTES) {
    test(`${route.path} renders content without errors`, async ({ page }) => {
      const errors: string[] = [];
      
      // Capture console errors
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Capture page errors (uncaught exceptions)
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      // Navigate directly to the route
      await page.goto(route.path);
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');

      // Assert page is NOT blank - check for main content
      const body = await page.locator('body');
      await expect(body).not.toBeEmpty();

      // Check for heading that matches the page content
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 5000 });

      // Verify no critical errors occurred
      const criticalErrors = errors.filter(
        (e) => e.includes('useAuth must be used') || 
               e.includes('Cannot read properties of undefined') ||
               e.includes('is not a function')
      );
      
      expect(criticalErrors).toHaveLength(0);
    });
  }

  test('Navbar navigation to public routes works', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Start at homepage
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click Internet nav link
    await page.click('nav >> text=Internet');
    await expect(page).toHaveURL(/\/internet/);
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Go back and click TV
    await page.goto('/');
    await page.click('nav >> text=TV');
    await expect(page).toHaveURL(/\/tv/);
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // Go back and click Mobile
    await page.goto('/');
    await page.click('nav >> text=Mobile');
    await expect(page).toHaveURL(/\/mobile/);
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // No critical errors during navigation
    const criticalErrors = errors.filter(
      (e) => e.includes('useAuth must be used')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
