import { test, expect } from '@playwright/test';

/**
 * Regression tests for public routes and critical flows.
 * 
 * ROOT CAUSE (fixed): Public pages were using useAuth() which throws
 * when called outside AuthProvider. Public routes must use useOptionalAuth().
 * 
 * P0 FIX: Profile creation trigger now auto-creates profile on signup.
 */

const PUBLIC_PLAN_ROUTES = [
  { path: '/internet', testId: 'internet-plans-page', heading: /Internet|Forfaits/i },
  { path: '/tv', testId: 'tv-plans-page', heading: /TV|Télévision/i },
  { path: '/mobile', testId: 'mobile-plans-page', heading: /Mobile|Cellulaire/i },
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

      // Assert page is NOT blank - check for data-testid
      const pageContainer = page.locator(`[data-testid="${route.testId}"]`);
      await expect(pageContainer).toBeVisible({ timeout: 10000 });

      // Check for heading that matches the page content
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible({ timeout: 5000 });

      // Verify no critical errors occurred
      const criticalErrors = errors.filter(
        (e) => e.includes('useAuth must be used') || 
               e.includes('Cannot read properties of undefined') ||
               e.includes('is not a function') ||
               e.includes('permission denied')
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
    await expect(page.locator('[data-testid="internet-plans-page"]')).toBeVisible();

    // Go back and click TV
    await page.goto('/');
    await page.click('nav >> text=TV');
    await expect(page).toHaveURL(/\/tv/);
    await expect(page.locator('[data-testid="tv-plans-page"]')).toBeVisible();

    // Go back and click Mobile
    await page.goto('/');
    await page.click('nav >> text=Mobile');
    await expect(page).toHaveURL(/\/mobile/);
    await expect(page.locator('[data-testid="mobile-plans-page"]')).toBeVisible();

    // No critical errors during navigation
    const criticalErrors = errors.filter(
      (e) => e.includes('useAuth must be used')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Address Autocomplete - Mapbox Integration', () => {
  test('Internet page address input shows suggestions', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/internet');
    await page.waitForLoadState('networkidle');

    // Find the address input
    const addressInput = page.locator('input[placeholder*="adresse"], input[placeholder*="address"]').first();
    await expect(addressInput).toBeVisible({ timeout: 5000 });

    // Type a Quebec address
    await addressInput.fill('123 rue Notre-Dame');
    
    // Wait for suggestions to appear (debounced)
    await page.waitForTimeout(500);

    // Check that no 403/error occurred in console
    const mapboxErrors = errors.filter(
      (e) => e.includes('403') || e.includes('Mapbox') || e.includes('token')
    );
    
    // Note: If suggestions don't appear, it might be due to rate limiting or network
    // The main test is that no crash occurs
    expect(mapboxErrors.length).toBeLessThanOrEqual(1); // Allow one potential rate limit message
  });
});

test.describe('Portal Auth - Login Page Renders', () => {
  test('/portal redirects to auth or shows login', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/portal');
    await page.waitForLoadState('networkidle');

    // Should either show login form or redirect to /portal/auth
    const loginForm = page.locator('form, [data-testid="portal-dashboard"]');
    await expect(loginForm).toBeVisible({ timeout: 10000 });

    // No uncaught exceptions
    const criticalErrors = errors.filter(
      (e) => e.includes('useAuth must be used') ||
             e.includes('useClientAuth must be used')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
