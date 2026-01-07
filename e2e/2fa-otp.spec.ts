import { test, expect } from "@playwright/test";

/**
 * 2FA OTP Verification E2E Tests
 * Tests for staff two-factor authentication
 */

test.describe("2FA OTP Verification", () => {
  test("Admin login page loads correctly", async ({ page }) => {
    await page.goto("/admin/login");
    
    // Verify login form is visible
    await expect(page.getByLabel(/Adresse courriel/i)).toBeVisible();
    await expect(page.getByLabel(/Mot de passe/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Se connecter/i })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: "e2e/screenshots/admin-login.png" });
  });

  test("Employee login page loads correctly", async ({ page }) => {
    await page.goto("/employee/login");
    
    // Verify login form is visible
    await expect(page.getByLabel(/Adresse courriel/i)).toBeVisible();
    await expect(page.getByLabel(/Mot de passe/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Se connecter/i })).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: "e2e/screenshots/employee-login.png" });
  });

  test.skip("OTP dialog appears after valid login", async ({ page }) => {
    // This test requires a valid admin account
    await page.goto("/admin/login");
    
    // Enter credentials
    await page.getByLabel(/Adresse courriel/i).fill("admin@test.nivra.ca");
    await page.getByLabel(/Mot de passe/i).fill("testpassword123");
    
    // Click login
    await page.getByRole("button", { name: /Se connecter/i }).click();
    
    // Wait for OTP dialog
    await expect(page.getByText(/Vérification en deux étapes/i)).toBeVisible({ timeout: 10000 });
    
    // Verify OTP input is visible
    await expect(page.getByRole("textbox")).toBeVisible();
    
    // Take screenshot of OTP dialog
    await page.screenshot({ path: "e2e/screenshots/admin-otp-dialog.png" });
  });

  test("Invalid login shows error", async ({ page }) => {
    await page.goto("/admin/login");
    
    // Enter invalid credentials
    await page.getByLabel(/Adresse courriel/i).fill("invalid@test.com");
    await page.getByLabel(/Mot de passe/i).fill("wrongpassword");
    
    // Click login
    await page.getByRole("button", { name: /Se connecter/i }).click();
    
    // Wait for error toast
    await expect(page.getByText(/Erreur|Identifiants invalides/i)).toBeVisible({ timeout: 10000 });
    
    // Take screenshot
    await page.screenshot({ path: "e2e/screenshots/admin-login-error.png" });
  });
});
