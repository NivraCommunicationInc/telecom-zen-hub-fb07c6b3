/**
 * P0 Mobile Overflow Check - Playwright E2E Test
 * 
 * Tests public pages for horizontal overflow at common mobile widths.
 * No authentication required — only public routes are tested.
 */

import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const MOBILE_WIDTHS = [375, 390, 414];
const SCREENSHOT_WIDTH = 390;
const SCREENSHOT_HEIGHT = 844;

const OUTPUT_DIR = 'e2e/screenshots';
const OVERFLOW_LOG_PATH = `${OUTPUT_DIR}/overflow-logs.txt`;

function logLine(line: string) {
  console.log(line);
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.appendFileSync(OVERFLOW_LOG_PATH, `${line}\n`);
  } catch {
    // If FS isn't available in a given runner, we still keep console output.
  }
}

interface OverflowResult {
  width: number;
  innerWidth: number;
  scrollWidth: number;
  hasOverflow: boolean;
}

async function checkOverflow(page: any, width: number): Promise<OverflowResult> {
  await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
  await page.waitForTimeout(500);
  
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
  test.beforeAll(() => {
    try {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      fs.writeFileSync(OVERFLOW_LOG_PATH, '');
    } catch {
      // ignore
    }
  });

  test('Homepage (/) - no horizontal overflow at mobile widths', async ({ page }) => {
    await page.setViewportSize({ width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: 'e2e/screenshots/homepage-390px.png',
      fullPage: false 
    });
    
    const results: OverflowResult[] = [];
    for (const width of MOBILE_WIDTHS) {
      const result = await checkOverflow(page, width);
      results.push(result);
      logLine(`Homepage @ ${width}px: innerWidth=${result.innerWidth}, scrollWidth=${result.scrollWidth}, overflow=${result.hasOverflow}`);
    }
    
    for (const result of results) {
      expect(result.scrollWidth, `Homepage has horizontal overflow at ${result.width}px`).toBeLessThanOrEqual(result.innerWidth);
    }
  });

  test('Internet page (/internet) - no horizontal overflow at mobile widths', async ({ page }) => {
    await page.setViewportSize({ width: SCREENSHOT_WIDTH, height: SCREENSHOT_HEIGHT });
    await page.goto('/internet');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: 'e2e/screenshots/internet-390px.png',
      fullPage: false 
    });
    
    const results: OverflowResult[] = [];
    for (const width of MOBILE_WIDTHS) {
      const result = await checkOverflow(page, width);
      results.push(result);
      logLine(`Internet @ ${width}px: innerWidth=${result.innerWidth}, scrollWidth=${result.scrollWidth}, overflow=${result.hasOverflow}`);
    }
    
    for (const result of results) {
      expect(result.scrollWidth, `Internet page has horizontal overflow at ${result.width}px`).toBeLessThanOrEqual(result.innerWidth);
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
    
    logLine('');
    logLine('=== OVERFLOW CHECK SUMMARY ===');
    for (const { page: pagePath, results } of allResults) {
      for (const result of results) {
        const status = result.hasOverflow ? 'OVERFLOW' : 'OK';
        logLine(`${pagePath} @ ${result.width}px: ${status} (scrollW=${result.scrollWidth}, innerW=${result.innerWidth})`);
      }
    }
    logLine('==============================');
    logLine('');
    
    for (const { page: pagePath, results } of allResults) {
      for (const result of results) {
        expect(result.scrollWidth, `${pagePath} has horizontal overflow at ${result.width}px`).toBeLessThanOrEqual(result.innerWidth);
      }
    }
  });
});
