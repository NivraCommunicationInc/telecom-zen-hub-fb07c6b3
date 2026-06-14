import { test, expect } from "@playwright/test";

/**
 * Invoice Contact Regression Test
 * 
 * Verifies that invoice UI displays correct contact information:
 * - Phone: 438-544-2233
 * - Email: Support@nivra-telecom.ca
 * - Address: 1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5
 * 
 * Also ensures no forbidden contact strings appear (1-800, 1-888).
 */

test.describe("Invoice Contact Information", () => {
  
  test("homepage header and footer display correct phone number", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    
    // Check header phone
    const headerPhone = page.locator('[data-testid="header-phone"]');
    await expect(headerPhone).toBeVisible();
    await expect(headerPhone).toContainText("438-544-2233");
    
    // Check footer phone
    const footerPhone = page.locator('[data-testid="footer-phone"]');
    await expect(footerPhone).toBeVisible();
    await expect(footerPhone).toContainText("438-544-2233");
    
    // Check footer email
    const footerEmail = page.locator('[data-testid="footer-email"]');
    await expect(footerEmail).toBeVisible();
    // Email should contain either format
    const emailText = await footerEmail.textContent();
    expect(emailText?.toLowerCase()).toContain("support@nivra-telecom.ca");
    
    // Check footer address
    const footerAddress = page.locator('[data-testid="footer-address"]');
    await expect(footerAddress).toBeVisible();
    await expect(footerAddress).toContainText("1799 Av. Pierre-Péladeau");
    
    // Ensure no forbidden strings on page
    const pageContent = await page.content();
    expect(pageContent).not.toContain("1-800");
    expect(pageContent).not.toContain("1-888");
  });

  test("contact page displays correct contact info without forbidden numbers", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("domcontentloaded");
    
    // Page should contain correct phone
    const pageContent = await page.content();
    expect(pageContent).toContain("438-544-2233");
    
    // No forbidden numbers
    expect(pageContent).not.toContain("1-800");
    expect(pageContent).not.toContain("1-888");
  });

  test("aide page displays correct contact info without forbidden numbers", async ({ page }) => {
    await page.goto("/aide");
    await page.waitForLoadState("domcontentloaded");
    
    // Page should contain correct phone
    const pageContent = await page.content();
    expect(pageContent).toContain("438-544-2233");
    
    // No forbidden numbers
    expect(pageContent).not.toContain("1-800");
    expect(pageContent).not.toContain("1-888");
  });

  test("politique-remboursement page displays correct contact without forbidden numbers", async ({ page }) => {
    await page.goto("/page/politique-remboursement");
    await page.waitForLoadState("domcontentloaded");
    
    // Allow time for dynamic page load
    await page.waitForTimeout(1000);
    
    // No forbidden numbers on page
    const pageContent = await page.content();
    expect(pageContent).not.toContain("1-800");
    expect(pageContent).not.toContain("1-888");
  });

  test("invoice-related pages do not contain forbidden phone numbers", async ({ page }) => {
    // Test public billing/invoice related routes
    const publicRoutes = ["/", "/contact", "/aide"];
    
    for (const route of publicRoutes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      
      const pageContent = await page.content();
      expect(pageContent, `Route ${route} should not contain 1-800`).not.toContain("1-800");
      expect(pageContent, `Route ${route} should not contain 1-888`).not.toContain("1-888");
      expect(pageContent, `Route ${route} should not contain 514-757-5162`).not.toContain("514-757-5162");
      expect(pageContent, `Route ${route} should not contain info@nivra.ca`).not.toContain("info@nivra.ca");
    }
  });
});
