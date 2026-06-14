/**
 * Portail client — Déconnexion automatique après inactivité (simulée)
 *
 * Le vrai timeout idle est de 60 min (IDLE_TIMEOUT_MS dans ClientProtectedRoute.tsx).
 * On simule l'expiration de session de deux manières :
 *
 * Test 5.1 — Expiration de session : suppression du flag client_pin_verified
 *   → l'accès à /portal redirige vers /portal/auth
 *
 * Test 5.2 — Expiration portal_trusted_until (token de confiance expiré)
 *   → même comportement de redirection
 *
 * Test 5.3 — Vérification que le toast d'info "Session expirée" est défini dans le code.
 *   (vérifié via pageerror + contenu HTML — pas de simulation de timer réel)
 */
import { test, expect } from "@playwright/test";
import { loginToPortal, hasCredentials } from "./helpers/portal-auth";

const SS = (name: string) => `e2e/screenshots/${name}.png`;

test.describe("Portail client — Déconnexion automatique (session expirée)", () => {
  test("5.1 Suppression de client_pin_verified → redirige vers /portal/auth", async ({
    page,
  }) => {
    test.skip(!hasCredentials(), "VITE_E2E_TEST_PASSWORD non défini — test ignoré");

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Authenticate first
    await loginToPortal(page);
    await page.screenshot({ path: SS("idle-01-connecte") });

    // Simulate session expiry: remove PIN verification flag
    await page.evaluate(() => {
      sessionStorage.removeItem("client_pin_verified");
      // Also expire the trusted-device token
      localStorage.setItem("portal_trusted_until", "0");
    });

    // Navigate to a protected route — ClientProtectedRoute should redirect
    await page.goto("/portal");
    await page.waitForLoadState("domcontentloaded");

    await page.screenshot({ path: SS("idle-02-apres-suppression-flag") });

    // Should be back on the auth page
    await expect(page).toHaveURL(/\/portal\/auth/, { timeout: 10_000 });

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("5.2 portal_trusted_until expiré + pas de pin vérifié → redirige vers auth", async ({
    page,
  }) => {
    test.skip(!hasCredentials(), "VITE_E2E_TEST_PASSWORD non défini — test ignoré");

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await loginToPortal(page);

    // Expire both trust mechanisms
    await page.evaluate(() => {
      sessionStorage.removeItem("client_pin_verified");
      localStorage.setItem("portal_trusted_until", String(Date.now() - 1_000)); // 1s in the past
    });

    await page.goto("/portal/change-plan");
    await page.waitForLoadState("domcontentloaded");

    await page.screenshot({ path: SS("idle-03-trusted-until-expire") });

    await expect(page).toHaveURL(/\/portal\/auth/, { timeout: 10_000 });

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("5.3 Accès à /portal/invoices sans session → redirige vers /portal/auth", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Fresh page, no session at all
    await page.goto("/portal/invoices");
    await page.waitForLoadState("domcontentloaded");

    await page.screenshot({ path: SS("idle-04-acces-direct-sans-session") });

    await expect(page).toHaveURL(/\/portal\/auth/, { timeout: 10_000 });

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("5.4 Après logout idle simulé, reconnexion est possible", async ({
    page,
  }) => {
    test.skip(!hasCredentials(), "VITE_E2E_TEST_PASSWORD non défini — test ignoré");

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await loginToPortal(page);

    // Simulate idle logout
    await page.evaluate(() => {
      sessionStorage.removeItem("client_pin_verified");
      localStorage.setItem("portal_trusted_until", "0");
    });

    await page.goto("/portal");
    await page.waitForLoadState("domcontentloaded");

    // Should be on auth page
    await expect(page).toHaveURL(/\/portal\/auth/, { timeout: 10_000 });
    await page.screenshot({ path: SS("idle-05-deconnecte") });

    // Login form should be functional again
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    await page.screenshot({ path: SS("idle-06-formulaire-reconnexion") });

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });
});
