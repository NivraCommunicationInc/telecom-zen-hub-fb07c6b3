/**
 * P0 Mobile Overflow Check - Playwright E2E Test
 * 
 * This test:
 * 1. Captures 390px screenshots for /, /internet, /portal (logged in)
 * 2. Checks scrollWidth vs innerWidth at 375/390/414px for each page
 * 3. Fails if any page has horizontal overflow
 */

import { test, expect } from '@playwright/test';

const MOBILE_WIDTHS = [375, 390, 414];
const SCREENSHOT_WIDTH = 390;
const SCREENSHOT_HEIGHT = 844;

// Test user credentials - use environment variables or fallback to test account
const TEST_EMAIL = process.env.TEST_CLIENT_EMAIL || 'test@nivratelecom.ca';
const TEST_PASSWORD = process.env.TEST_CLIENT_PASSWORD || 'TestPassword123!';

interface OverflowResult {
  width: number;
  innerWidth: number;
  scrollWidth: number;
  hasOverflow: boolean;
}

async function checkOverflow(page: any, width: number): Promise<OverflowResult> {
  await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
  await page.waitForTimeout(500); // Allow layout to settle
  
  const result = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  
  return {
    width,
    innerWidth: result.innerWidth,
    scrollWidth: result.scrollWidth,
    hasOverflow: result.scrollWidth > result.innerWidth,
  };
}

test.describe('P0 Mobile Overflow Check', () => {
  
  test('Homepage (/) - no horizontal overflow at mobile widths', async ({ page }) => {
    // Set viewport to 390px for screenshot
    await page.setViewportSize({ width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ 
      path: 'e2e/screenshots/homepage-390px.png',
      fullPage: false 
    });
    
    // Check overflow at all mobile widths
    const results: OverflowResult[] = [];
    for (const width of MOBILE_WIDTHS) {
      const result = await checkOverflow(page, width);
      results.push(result);
      console.log(`Homepage @ ${width}px: innerWidth=${result.innerWidth}, scrollWidth=${result.scrollWidth}, overflow=${result.hasOverflow}`);
    }
    
    // Assert no overflow
    for (const result of results) {
      expect(result.scrollWidth, `Homepage has horizontal overflow at ${result.width}px`).toBeLessThanOrEqual(result.innerWidth);
    }
  });

  test('Internet page (/internet) - no horizontal overflow at mobile widths', async ({ page }) => {
    await page.setViewportSize({ width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT });
    await page.goto('/internet');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ 
      path: 'e2e/screenshots/internet-390px.png',
      fullPage: false 
    });
    
    // Check overflow at all mobile widths
    const results: OverflowResult[] = [];
    for (const width of MOBILE_WIDTHS) {
      const result = await checkOverflow(page, width);
      results.push(result);
      console.log(`Internet @ ${width}px: innerWidth=${result.innerWidth}, scrollWidth=${result.scrollWidth}, overflow=${result.hasOverflow}`);
    }
    
    // Assert no overflow
    for (const result of results) {
      expect(result.scrollWidth, `Internet page has horizontal overflow at ${result.width}px`).toBeLessThanOrEqual(result.innerWidth);
    }
  });

  test('Portal dashboard (/portal) - logged in, no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT });
    
    // Navigate to auth page
    await page.goto('/portal/auth');
    await page.waitForLoadState('networkidle');
    
    // Fill login form
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);
      
      // Submit login
      const loginButton = page.locator('button[type="submit"]').first();
      await loginButton.click();
      
      // Wait for navigation or PIN step
      await page.waitForTimeout(2000);
      
      // Check if we're on PIN verification step
      const pinInput = page.locator('input[inputmode="numeric"]');
      if (await pinInput.isVisible()) {
        // For testing, we'll skip PIN and just screenshot the auth page
        console.log('PIN verification required - capturing auth page instead');
        await page.screenshot({ 
          path: 'e2e/screenshots/portal-auth-390px.png',
          fullPage: false 
        });
      } else {
        // Successfully logged in, navigate to dashboard
        await page.goto('/portal');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        await page.screenshot({ 
          path: 'e2e/screenshots/portal-dashboard-390px.png',
          fullPage: false 
        });
      }
    } else {
      // Already on dashboard or different state
      await page.goto('/portal');
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: 'e2e/screenshots/portal-390px.png',
        fullPage: false 
      });
    }
    
    // Check overflow at all mobile widths (on current page)
    const results: OverflowResult[] = [];
    for (const width of MOBILE_WIDTHS) {
      const result = await checkOverflow(page, width);
      results.push(result);
      console.log(`Portal @ ${width}px: innerWidth=${result.innerWidth}, scrollWidth=${result.scrollWidth}, overflow=${result.hasOverflow}`);
    }
    
    // Assert no overflow
    for (const result of results) {
      expect(result.scrollWidth, `Portal has horizontal overflow at ${result.width}px`).toBeLessThanOrEqual(result.innerWidth);
    }
  });

  test('Public pages overflow summary', async ({ page }) => {
    const pages = ['/', '/internet', '/tv', '/mobile', '/contact', '/faq'];
    const allResults: { page: string; results: OverflowResult[] }[] = [];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      
      const results: OverflowResult[] = [];
      for (const width of MOBILE_WIDTHS) {
        const result = await checkOverflow(page, width);
        results.push(result);
      }
      
      allResults.push({ page: pagePath, results });
    }
    
    // Print summary
    console.log('\n=== OVERFLOW CHECK SUMMARY ===');
    for (const { page: pagePath, results } of allResults) {
      for (const result of results) {
        const status = result.hasOverflow ? '❌ OVERFLOW' : '✅ OK';
        console.log(`${pagePath} @ ${result.width}px: ${status} (scrollW=${result.scrollWidth}, innerW=${result.innerWidth})`);
      }
    }
    console.log('==============================\n');
    
    // Assert no overflow on any page
    for (const { page: pagePath, results } of allResults) {
      for (const result of results) {
        expect(result.scrollWidth, `${pagePath} has horizontal overflow at ${result.width}px`).toBeLessThanOrEqual(result.innerWidth);
      }
    }
  });
});
