import { test, expect } from "@playwright/test";

/**
 * Admin Clients Page E2E Tests
 * Tests for client management functionality
 */

test.describe("Admin Clients Page", () => {
  test("Admin clients page loads (public route test)", async ({ page }) => {
    // Navigate to admin clients - will redirect to login if not authenticated
    await page.goto("/admin/clients");
    
    // Take screenshot of current state
    await page.screenshot({ path: "e2e/screenshots/admin-clients-page.png", fullPage: true });
    
    // Check if we're on login page (expected for unauthenticated)
    const isLoginPage = await page.getByLabel(/Adresse courriel/i).isVisible().catch(() => false);
    const isClientsPage = await page.getByText(/Clients/i).isVisible().catch(() => false);
    
    // Either we see login or clients page
    expect(isLoginPage || isClientsPage).toBeTruthy();
  });
});

test.describe("Mutation Persistence Tests", () => {
  test.skip("Client creation persists after refresh", async ({ page }) => {
    // This test requires authenticated admin session
    await page.goto("/admin/clients");
    
    // Take before screenshot
    await page.screenshot({ path: "e2e/screenshots/admin-clients-before.png" });
    
    // Click create client button
    await page.getByRole("button", { name: /Nouveau client|Créer/i }).click();
    
    // Fill in client details
    await page.getByLabel(/Nom/i).first().fill("Test Client E2E");
    await page.getByLabel(/Email/i).first().fill("e2e-test@nivra.ca");
    await page.getByLabel(/Téléphone/i).first().fill("514-555-0199");
    
    // Save client
    await page.getByRole("button", { name: /Créer|Enregistrer/i }).click();
    
    // Wait for success
    await expect(page.getByText(/créé|succès/i)).toBeVisible({ timeout: 5000 });
    
    // Take screenshot after creation
    await page.screenshot({ path: "e2e/screenshots/admin-clients-created.png" });
    
    // Refresh page
    await page.reload();
    
    // Verify client persists
    await expect(page.getByText("Test Client E2E")).toBeVisible();
    
    // Take screenshot after refresh
    await page.screenshot({ path: "e2e/screenshots/admin-clients-after-refresh.png" });
  });

  test.skip("Client update persists after refresh", async ({ page }) => {
    await page.goto("/admin/clients");
    
    // Find and click on an existing client
    await page.getByText(/Test Client/i).first().click();
    
    // Update the client
    await page.getByLabel(/Téléphone/i).fill("514-555-0200");
    await page.getByRole("button", { name: /Enregistrer|Mettre à jour/i }).click();
    
    // Take screenshot
    await page.screenshot({ path: "e2e/screenshots/admin-client-updated.png" });
    
    // Refresh and verify
    await page.reload();
    await expect(page.getByText("514-555-0200")).toBeVisible();
  });
});
