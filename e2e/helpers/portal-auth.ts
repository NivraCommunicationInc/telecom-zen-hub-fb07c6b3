import { Page } from "@playwright/test";

export const E2E_EMAIL =
  process.env.VITE_E2E_TEST_EMAIL || "test@nivra-telecom.ca";
export const E2E_PASSWORD = process.env.VITE_E2E_TEST_PASSWORD || "";

/** Returns true if credentials are available for auth-required tests. */
export const hasCredentials = () => Boolean(E2E_PASSWORD);

/**
 * Log into the client portal via the login UI.
 * playwright.config.ts starts the dev server with VITE_E2E_MODE=true which
 * automatically bypasses the 6-digit PIN step when the test email is used.
 */
export async function loginToPortal(page: Page): Promise<void> {
  await page.goto("/portal/auth");
  await page.waitForLoadState("networkidle");

  await page.fill("#login-email", E2E_EMAIL);
  await page.fill("#login-password", E2E_PASSWORD);
  await page.click('button[type="submit"]');

  // After Supabase auth, VITE_E2E_MODE triggers the PIN bypass in handleVerifyPin.
  // The PIN input may still briefly render; clicking submit there triggers bypass immediately.
  try {
    await page.waitForSelector("#pin-input", { timeout: 8_000 });
    await page.fill("#pin-input", "123456");
    const pinBtn = page
      .locator("button:not([disabled])")
      .filter({ hasText: /vérif|confirm|connect|soumet/i })
      .first();
    if (await pinBtn.isVisible({ timeout: 2_000 })) await pinBtn.click();
  } catch {
    // PIN step bypassed automatically — no action needed
  }

  await page.waitForURL(/\/portal($|\?|#|\/)/, { timeout: 25_000 });
  await page.waitForLoadState("networkidle");
}
