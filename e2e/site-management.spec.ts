import { test, expect } from "@playwright/test";

/**
 * Site Management Module E2E Tests
 * Tests for site_settings, site_pages, site_offers CRUD operations
 */

test.describe("Site Management Module", () => {
  // Skip authentication for now - these tests assume admin is logged in
  test.skip("Admin can view site settings page", async ({ page }) => {
    await page.goto("/admin/site");
    
    // Take screenshot
    await page.screenshot({ path: "e2e/screenshots/admin-site-settings.png", fullPage: true });
    
    // Verify page loads with tabs
    await expect(page.getByRole("tab", { name: /Paramètres/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Pages/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Offres/i })).toBeVisible();
  });

  test.skip("Admin can update site settings", async ({ page }) => {
    await page.goto("/admin/site");
    
    // Fill in settings form
    await page.getByLabel(/Email de support/i).fill("support@test.nivra.ca");
    await page.getByLabel(/Téléphone de support/i).fill("514-555-0123");
    
    // Save settings
    await page.getByRole("button", { name: /Enregistrer/i }).click();
    
    // Verify toast appears
    await expect(page.getByText(/Paramètres mis à jour/i)).toBeVisible();
    
    // Take screenshot after save
    await page.screenshot({ path: "e2e/screenshots/admin-site-settings-saved.png" });
    
    // Refresh and verify persistence
    await page.reload();
    await expect(page.getByLabel(/Email de support/i)).toHaveValue("support@test.nivra.ca");
  });

  test.skip("Admin can create and manage pages", async ({ page }) => {
    await page.goto("/admin/site");
    
    // Navigate to Pages tab
    await page.getByRole("tab", { name: /Pages/i }).click();
    
    // Click add new page
    await page.getByRole("button", { name: /Nouvelle page/i }).click();
    
    // Fill in page details
    await page.getByLabel(/Slug/i).fill("test-page");
    await page.getByLabel(/Titre FR/i).fill("Page de Test");
    await page.getByLabel(/Titre EN/i).fill("Test Page");
    
    // Save the page
    await page.getByRole("button", { name: /Créer/i }).click();
    
    // Verify creation
    await expect(page.getByText(/Page créée/i)).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: "e2e/screenshots/admin-site-pages.png", fullPage: true });
  });

  test.skip("Admin can create and manage offers", async ({ page }) => {
    await page.goto("/admin/site");
    
    // Navigate to Offers tab
    await page.getByRole("tab", { name: /Offres/i }).click();
    
    // Click add new offer
    await page.getByRole("button", { name: /Nouvelle offre/i }).click();
    
    // Fill in offer details
    await page.getByLabel(/Nom/i).fill("Promo Été 2026");
    await page.getByLabel(/Type/i).selectOption("plan");
    await page.getByLabel(/Prix/i).fill("49.99");
    
    // Save the offer
    await page.getByRole("button", { name: /Créer/i }).click();
    
    // Verify creation
    await expect(page.getByText(/Offre créée/i)).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: "e2e/screenshots/admin-site-offers.png", fullPage: true });
  });
});

test.describe("Audit Logging Verification", () => {
  test.skip("Mutations are logged in activity_logs", async ({ page }) => {
    await page.goto("/admin/activity");
    
    // Verify recent activity is visible
    await expect(page.getByText(/Activité/i)).toBeVisible();
    
    // Take screenshot of audit log
    await page.screenshot({ path: "e2e/screenshots/admin-activity-log.png", fullPage: true });
  });
});
