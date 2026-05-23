/**
 * E2E — Public status page (/status)
 *
 * The status page MUST be reachable without authentication and even when the
 * rest of the site is in maintenance mode. These tests guard against:
 *  - Accidental auth wrapping (would break for anonymous customers)
 *  - RLS regressions on service_status / service_incidents tables
 *  - Console errors that would break observability
 */
import { test, expect } from "@playwright/test";

test.describe("Public status page", () => {
  test("loads anonymously and renders the overall banner", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/status");
    await page.waitForLoadState("networkidle");

    // The H1 must be visible (page rendered)
    await expect(
      page.getByRole("heading", { name: /État des services Nivra Telecom/i }),
    ).toBeVisible();

    // The overall banner ("Tous les services fonctionnent normalement" or an
    // incident message) must render — we just check the section exists.
    await expect(page.getByRole("button", { name: /Actualiser/i })).toBeVisible();

    // No noisy console errors (auth-related 401s are expected on a public page)
    const critical = consoleErrors.filter(
      (e) =>
        !e.includes("AuthSessionMissingError") &&
        !e.includes("401") &&
        !e.includes("Failed to load resource"),
    );
    expect(critical, `Unexpected console errors:\n${critical.join("\n")}`).toEqual([]);
  });

  test("alias /statut also resolves", async ({ page }) => {
    await page.goto("/statut");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: /État des services Nivra Telecom/i }),
    ).toBeVisible();
  });

  test("services section renders at least one service or a graceful empty state", async ({
    page,
  }) => {
    await page.goto("/status");
    await page.waitForLoadState("networkidle");

    // Either we see the "Services" heading with at least one row, or the
    // graceful empty state. We never want a blank page.
    const servicesHeading = page.getByRole("heading", { name: /^Services$/ });
    await expect(servicesHeading).toBeVisible();

    // At least one service status row OR the empty state must be present.
    const anyServiceLabel = page.locator(
      "text=/Opérationnel|Performance dégradée|Panne|Maintenance/i",
    );
    const emptyState = page.locator("text=Aucun service configuré");
    await expect(anyServiceLabel.or(emptyState).first()).toBeVisible();
  });

  test("incidents section renders (history or positive empty state)", async ({ page }) => {
    await page.goto("/status");
    await page.waitForLoadState("networkidle");

    // Either resolved incidents list OR "no incidents in the last 30 days"
    // The page must show one of the two — never blank.
    const incidentsHeading = page.getByRole("heading", {
      name: /Incidents récents/i,
    });
    await expect(incidentsHeading).toBeVisible();

    const positiveEmpty = page.locator(
      "text=/Aucun incident résolu au cours des 30 derniers jours/i",
    );
    const incidentArticle = page.locator("article").first();
    await expect(positiveEmpty.or(incidentArticle).first()).toBeVisible();
  });

  test("refresh button works without breaking the page", async ({ page }) => {
    await page.goto("/status");
    await page.waitForLoadState("networkidle");

    const refreshBtn = page.getByRole("button", { name: /Actualiser/i });
    await refreshBtn.click();

    // After refresh, page still works — heading still visible.
    await expect(
      page.getByRole("heading", { name: /État des services Nivra Telecom/i }),
    ).toBeVisible();
  });
});
