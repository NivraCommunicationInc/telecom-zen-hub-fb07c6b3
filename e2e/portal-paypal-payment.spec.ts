/**
 * Portail client — Paiement PayPal (/portal/invoices → PayInvoiceDialog)
 *
 * Vérifie que le flow de paiement PayPal est accessible depuis la page des factures.
 * On NE complète PAS le paiement (sandbox PayPal non connecté en E2E).
 * On vérifie : le dialog s'ouvre, le bouton PayPal / carte de crédit est visible,
 * et aucune erreur JS ne se produit.
 */
import { test, expect } from "@playwright/test";
import { loginToPortal, hasCredentials } from "./helpers/portal-auth";

const SS = (name: string) => `e2e/screenshots/${name}.png`;

test.describe("Portail client — Paiement PayPal", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials(), "VITE_E2E_TEST_PASSWORD non défini — tests ignorés");
    await loginToPortal(page);
  });

  test("3.1 Page /portal/invoices se charge sans erreur JS", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/invoices");
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: SS("paypal-01-invoices-chargee"), fullPage: true });

    await expect(page.getByText("Mes factures")).toBeVisible({ timeout: 15_000 });

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("3.2 Si facture en attente: cliquer sur Payer ouvre le dialog PayPal", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/invoices");
    await page.waitForLoadState("networkidle");

    // Look for a "Payer" button (pending invoice)
    const payerBtn = page.getByRole("button", { name: /^payer$/i }).first();
    const hasPendingInvoice = (await payerBtn.count()) > 0;

    if (!hasPendingInvoice) {
      test.info().annotations.push({
        type: "info",
        description:
          "Aucune facture en attente pour le compte de test — dialog PayPal non testable.",
      });
      await page.screenshot({ path: SS("paypal-02-pas-de-facture-en-attente") });
      return;
    }

    await payerBtn.first().click();
    await page.screenshot({ path: SS("paypal-03-dialog-ouvert") });

    // Dialog "Payer la facture" should appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText(/payer la facture/i)).toBeVisible();

    // PayPal / credit card option should be visible
    await expect(dialog.getByText(/paypal\s*\/\s*carte de crédit/i)).toBeVisible();

    await page.screenshot({ path: SS("paypal-04-dialog-complet"), fullPage: true });

    // Close dialog without paying
    await page.keyboard.press("Escape");

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("3.3 Le mode de paiement PayPal est l'unique option proposée", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/invoices");
    await page.waitForLoadState("networkidle");

    const payerBtn = page.getByRole("button", { name: /^payer$/i }).first();
    if ((await payerBtn.count()) === 0) {
      test.info().annotations.push({ type: "info", description: "Aucune facture en attente." });
      return;
    }

    await payerBtn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Interac / virement should NOT be present (removed per business decision)
    const interacText = dialog.getByText(/interac|virement/i);
    expect(await interacText.count()).toBe(0);

    await page.screenshot({ path: SS("paypal-05-seul-mode-paypal") });

    await page.keyboard.press("Escape");

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });
});
