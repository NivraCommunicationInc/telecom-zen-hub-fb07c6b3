import { test, expect } from '@playwright/test';

/**
 * Regression test: Support contact single source of truth
 * Ensures header/footer display 438-544-2233 and no 1-800/1-888 placeholders appear
 */
test.describe('Support Contact Regression', () => {
  
  test('homepage header shows correct phone number 438-544-2233', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check header phone link
    const headerPhone = page.locator('[data-testid="header-phone"]');
    await expect(headerPhone).toBeVisible();
    await expect(headerPhone).toContainText('438-544-2233');
    
    // Verify href contains the correct phone
    const href = await headerPhone.getAttribute('href');
    expect(href).toContain('4385442233');
  });

  test('homepage footer shows correct contact info from site_settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // Check footer phone
    const footerPhone = page.locator('[data-testid="footer-phone"]');
    await expect(footerPhone).toBeVisible();
    await expect(footerPhone).toContainText('438-544-2233');
    
    // Check footer email
    const footerEmail = page.locator('[data-testid="footer-email"]');
    await expect(footerEmail).toBeVisible();
    // Email should contain nivra-telecom.ca (case-insensitive check)
    const emailText = await footerEmail.textContent();
    expect(emailText?.toLowerCase()).toContain('nivra-telecom.ca');
    
    // Check footer address
    const footerAddress = page.locator('[data-testid="footer-address"]');
    await expect(footerAddress).toBeVisible();
    await expect(footerAddress).toContainText('1799');
    await expect(footerAddress).toContainText('Laval');
    
    // Check footer hours
    const footerHours = page.locator('[data-testid="footer-hours"]');
    await expect(footerHours).toBeVisible();
  });

  test('no 1-800 or 1-888 placeholder numbers appear on homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Get full page text
    const pageText = await page.textContent('body');
    
    // Assert no 1-800 or 1-888 patterns
    expect(pageText).not.toMatch(/1-800/i);
    expect(pageText).not.toMatch(/1-888/i);
    expect(pageText).not.toMatch(/XXX-XXXX/); // No placeholder in visible text (input placeholders are okay)
  });

  test('no 1-800 or 1-888 placeholder numbers appear on /aide page', async ({ page }) => {
    await page.goto('/aide');
    await page.waitForLoadState('networkidle');
    
    // Scroll to see contact section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(300);
    
    const pageText = await page.textContent('body');
    
    // Assert no 1-800 or 1-888 patterns
    expect(pageText).not.toMatch(/1-800/i);
    expect(pageText).not.toMatch(/1-888/i);
    
    // Should show correct phone
    expect(pageText).toContain('438-544-2233');
  });

  test('no 1-800 or 1-888 placeholder numbers appear on /contact page', async ({ page }) => {
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    
    const pageText = await page.textContent('body');
    
    // Assert no 1-800 or 1-888 patterns
    expect(pageText).not.toMatch(/1-800/i);
    expect(pageText).not.toMatch(/1-888/i);
    
    // Should show correct phone
    expect(pageText).toContain('438-544-2233');
  });

  test('dynamic page footer shows correct contact info', async ({ page }) => {
    // Test a dynamic page from site_pages
    await page.goto('/page/politique-remboursement');
    await page.waitForLoadState('networkidle');
    
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    // Check footer phone
    const footerPhone = page.locator('[data-testid="footer-phone"]');
    await expect(footerPhone).toContainText('438-544-2233');
    
    // Ensure no placeholders
    const pageText = await page.textContent('body');
    expect(pageText).not.toMatch(/1-800/i);
    expect(pageText).not.toMatch(/1-888/i);
  });
});
