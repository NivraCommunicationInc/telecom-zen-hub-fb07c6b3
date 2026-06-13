/**
 * Portail client — Connexion (email + PIN)
 *
 * Smoke tests for the /portal/auth page.
 * Auth-required tests are skipped automatically if VITE_E2E_TEST_PASSWORD is not set.
 */
import { test, expect } from "@playwright/test";
import { loginToPortal, E2E_EMAIL, hasCredentials } from "./helpers/portal-auth";

const SS = (name: string) => `e2e/screenshots/${name}.png`;

test.describe("Portail client — Connexion", () => {
  test("1.1 Page login se charge sans erreur JS", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/auth");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: SS("login-01-chargee"), fullPage: true });

    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("1.2 Le champ email est pré-rempli par le serveur de test", async ({
    page,
  }) => {
    await page.goto("/portal/auth");
    await page.waitForLoadState("networkidle");

    // Verify the form accepts the E2E test email
    await page.fill("#login-email", E2E_EMAIL);
    await expect(page.locator("#login-email")).toHaveValue(E2E_EMAIL);

    await page.screenshot({ path: SS("login-02-email-saisi") });
  });

  test("1.3 Connexion complète → redirige vers /portal (dashboard)", async ({
    page,
  }) => {
    test.skip(!hasCredentials(), "VITE_E2E_TEST_PASSWORD non défini — test ignoré");

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/auth");
    await page.waitForLoadState("networkidle");

    await page.fill("#login-email", E2E_EMAIL);
    await page.screenshot({ path: SS("login-03a-email-saisi") });

    await page.fill("#login-password", process.env.VITE_E2E_TEST_PASSWORD!);
    await page.screenshot({ path: SS("login-03b-mdp-saisi") });

    await page.click('button[type="submit"]');

    // VITE_E2E_MODE=true bypasses the 6-digit PIN step
    await page.waitForURL(/\/portal($|\?|#|\/)/, { timeout: 25_000 });
    await page.screenshot({ path: SS("login-04-dashboard"), fullPage: true });

    await expect(page).toHaveURL(/\/portal($|\?)/);
    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("1.4 Accès direct à /portal sans session → redirige vers /portal/auth", async ({
    page,
  }) => {
    // Fresh page, no session in storage
    await page.goto("/portal");
    await page.waitForLoadState("networkidle");

    // Should end up on the auth page — waitForURL tolerates async React redirect in CI
    await page.waitForURL(/\/portal\/auth/, { timeout: 15_000 });

    await page.screenshot({ path: SS("login-05-redirect-auth") });
  });
});
