/**
 * E2E — Public status page (/status)
 *
 * The status page MUST be reachable without authentication and even when the
 * rest of the site is in maintenance mode. These tests guard against:
 *  - Accidental auth wrapping (would break for anonymous customers)
 *  - RLS regressions on service_status / service_incidents tables
 *  - Console errors that would break observability
 *
 * The actual UI is in src/pages/StatusPage.tsx (bilingual FR/EN, react-query).
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

    // The H1 must render — Lovable's UI shows "État des systèmes" (FR) or
    // "System Status" (EN) depending on the user's language preference.
    await expect(
      page.getByRole("heading", {
        name: /État des systèmes|System Status/i,
        level: 1,
      }),
    ).toBeVisible({ timeout: 15_000 });

    // Refresh button must be present
    await expect(page.getByRole("button", { name: /Actualiser|Refresh/i })).toBeVisible();

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
      page.getByRole("heading", {
        name: /État des systèmes|System Status/i,
        level: 1,
      }),
    ).toBeVisible();
  });

  test("services section renders at least one status badge", async ({ page }) => {
    await page.goto("/status");
    await page.waitForLoadState("networkidle");

    // At least one of the service status labels must appear on the page.
    // Lovable's UI uses these exact labels per status:
    //   Opérationnel / Operational
    //   Performance dégradée / Degraded
    //   Panne partielle / Partial Outage
    //   Panne majeure / Major Outage
    //   Maintenance en cours / Under Maintenance
    const anyStatusLabel = page.locator(
      "text=/Opérationnel|Operational|Performance dégradée|Degraded|Panne|Outage|Maintenance/i",
    );
    await expect(anyStatusLabel.first()).toBeVisible({ timeout: 10_000 });
  });

  test("incidents section renders (history or positive empty state)", async ({ page }) => {
    await page.goto("/status");
    await page.waitForLoadState("networkidle");

    // Either resolved incidents list OR "no incidents in the last 30 days"
    // The page must show one of the two — never blank.
    const incidentsHeading = page.getByRole("heading", {
      name: /Incidents récents.*30|Recent incidents.*30/i,
    });
    await expect(incidentsHeading).toBeVisible({ timeout: 10_000 });

    const positiveEmpty = page.locator(
      "text=/Aucun incident résolu|No resolved incidents/i",
    );
    const anyResolvedBadge = page.locator("text=/Résolu|Resolved/i");
    await expect(positiveEmpty.or(anyResolvedBadge).first()).toBeVisible();
  });

  test("refresh button works without breaking the page", async ({ page }) => {
    await page.goto("/status");
    await page.waitForLoadState("networkidle");

    const refreshBtn = page.getByRole("button", { name: /Actualiser|Refresh/i });
    await refreshBtn.click();

    // After refresh, page still works — heading still visible.
    await expect(
      page.getByRole("heading", {
        name: /État des systèmes|System Status/i,
        level: 1,
      }),
    ).toBeVisible();
  });
});
