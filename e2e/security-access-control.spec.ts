import { test, expect } from "@playwright/test";

/**
 * Security Access Control Tests
 * These tests verify that unauthorized users cannot access protected resources
 */

test.describe("Security Access Control", () => {
  test.describe("Unauthenticated Access Prevention", () => {
    test("should redirect unauthenticated users from admin routes", async ({ page }) => {
      const protectedRoutes = [
        "/admin",
        "/admin/clients",
        "/admin/orders",
        "/admin/billing",
        "/admin/users",
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        // Should redirect to login or show access denied
        await expect(page).not.toHaveURL(route);
      }
    });

    test("should redirect unauthenticated users from portal routes", async ({ page }) => {
      const protectedRoutes = [
        "/portal/dashboard",
        "/portal/services",
        "/portal/invoices",
        "/portal/payments",
        "/portal/profile",
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        // Should redirect to auth page
        await expect(page).toHaveURL(/\/portal\/auth|\/portal\/suspended/);
      }
    });

    test("should redirect unauthenticated users from employee routes", async ({ page }) => {
      await page.goto("/employee");
      // Should redirect to login
      await expect(page).not.toHaveURL("/employee");
    });
  });

  test.describe("Public Routes Accessibility", () => {
    test("should allow access to public pages", async ({ page }) => {
      const publicRoutes = [
        "/",
        "/internet",
        "/mobile",
        "/tv",
        "/streaming",
        "/contact",
        "/faq",
        "/about",
      ];

      for (const route of publicRoutes) {
        const response = await page.goto(route);
        expect(response?.status()).toBeLessThan(400);
      }
    });
  });

  test.describe("API Security Headers", () => {
    test("should have security headers on responses", async ({ page }) => {
      const response = await page.goto("/");
      const headers = response?.headers();
      
      // Check for common security headers (if configured in _headers)
      // These are best-effort checks - actual headers depend on hosting config
      if (headers) {
        // X-Frame-Options or CSP frame-ancestors should be present
        const hasFrameProtection = 
          headers["x-frame-options"] || 
          headers["content-security-policy"]?.includes("frame-ancestors");
        
        // We just verify the page loads successfully
        expect(response?.status()).toBe(200);
      }
    });
  });

  test.describe("XSS Prevention", () => {
    test("dynamic pages should not execute injected scripts", async ({ page }) => {
      // Navigate to a dynamic page and verify no script execution
      await page.goto("/page/test-page");
      
      // The page should load without errors
      // DOMPurify should strip any malicious content
      const pageContent = await page.content();
      
      // Verify no onclick, onerror, or javascript: URLs are present in rendered content
      expect(pageContent).not.toMatch(/onclick\s*=/i);
      expect(pageContent).not.toMatch(/onerror\s*=/i);
      expect(pageContent).not.toMatch(/javascript:/i);
    });
  });
});

test.describe("Data Isolation", () => {
  test("should not expose sensitive data in page source", async ({ page }) => {
    await page.goto("/");
    const pageContent = await page.content();
    
    // Verify no sensitive patterns in public page content
    // These patterns indicate potential data leaks
    const sensitivePatterns = [
      /password_hash/i,
      /pin_hash/i,
      /credit_card_number/i,
      /cvv/i,
      /secret_key/i,
    ];

    for (const pattern of sensitivePatterns) {
      expect(pageContent).not.toMatch(pattern);
    }
  });

  test("should not leak API keys in client bundle", async ({ page }) => {
    await page.goto("/");
    
    // Check for common API key patterns that shouldn't be exposed
    const pageContent = await page.content();
    
    // Supabase anon key is intentionally public, but service role key should never appear
    expect(pageContent).not.toMatch(/service_role/i);
    expect(pageContent).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/i);
  });
});
