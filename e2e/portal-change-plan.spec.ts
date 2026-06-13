/**
 * Portail client — Changement de forfait (/portal/change-plan)
 *
 * Vérifie que la page de changement de plan charge, affiche les forfaits,
 * et que le dialog de confirmation s'ouvre correctement.
 * Tests ignorés si VITE_E2E_TEST_PASSWORD non défini.
 */
import { test, expect } from "@playwright/test";
import { loginToPortal, hasCredentials } from "./helpers/portal-auth";

const SS = (name: string) => `e2e/screenshots/${name}.png`;

test.describe("Portail client — Changement de forfait", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials(), "VITE_E2E_TEST_PASSWORD non défini — tests ignorés");
    await loginToPortal(page);
  });

  test("2.1 Page /portal/change-plan se charge sans erreur JS", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/change-plan");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: SS("plan-01-chargee"), fullPage: true });

    // Page title
    await expect(page.getByText("Changer de forfait")).toBeVisible({ timeout: 15_000 });

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("2.2 Au moins un forfait disponible est affiché", async ({ page }) => {
    await page.goto("/portal/change-plan");
    await page.waitForLoadState("networkidle");

    // Wait for plan cards to render (Loader2 disappears + plans appear)
    await page.waitForSelector("h2 ~ div button", { timeout: 20_000 });

    const planCards = page.locator("main button, [role='main'] button").filter({
      hasText: /mettre à niveau|passer à ce forfait|forfait actuel/i,
    });

    const count = await planCards.count();
    expect(count, "Aucun forfait trouvé dans la page").toBeGreaterThan(0);

    await page.screenshot({ path: SS("plan-02-forfaits-visibles"), fullPage: true });
  });

  test("2.3 Cliquer sur un forfait non-actuel ouvre le dialog de confirmation", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/change-plan");
    await page.waitForLoadState("networkidle");

    // Wait for plan buttons
    await page.waitForSelector("button", { timeout: 20_000 });

    // Click the first non-current plan (either upgrade or downgrade)
    const actionBtn = page
      .locator("button")
      .filter({ hasText: /mettre à niveau|passer à ce forfait/i })
      .first();

    const found = await actionBtn.count();
    if (found === 0) {
      test.info().annotations.push({
        type: "info",
        description:
          "Aucun forfait alternatif disponible (compte test n'a peut-être qu'un seul forfait).",
      });
      return;
    }

    await actionBtn.click();
    await page.screenshot({ path: SS("plan-03-apres-clic") });

    // Dialog "Confirmer le changement" should appear
    await expect(
      page.getByRole("dialog").filter({ hasText: /confirmer le changement/i }),
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: SS("plan-04-dialog-confirmation"), fullPage: true });

    // Confirm or cancel button present
    const confirmBtn = page.getByRole("button", {
      name: /confirmer|confirmer et payer/i,
    });
    await expect(confirmBtn).toBeVisible();

    // Cancel without submitting to avoid side-effects
    const cancelBtn = page.getByRole("button", { name: /annuler/i });
    if (await cancelBtn.isVisible()) await cancelBtn.click();

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });
});
