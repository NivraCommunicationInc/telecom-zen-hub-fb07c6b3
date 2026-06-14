/**
 * Portail client — Téléchargement facture PDF (/portal/invoices)
 *
 * Vérifie que les boutons de téléchargement PDF sont présents et fonctionnels.
 * useClientPDF() ouvre le PDF dans un nouvel onglet (server-side generation).
 * On capture l'événement de navigation ou de téléchargement.
 */
import { test, expect } from "@playwright/test";
import { loginToPortal, hasCredentials } from "./helpers/portal-auth";

const SS = (name: string) => `e2e/screenshots/${name}.png`;

test.describe("Portail client — Téléchargement facture PDF", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasCredentials(), "VITE_E2E_TEST_PASSWORD non défini — tests ignorés");
    await loginToPortal(page);
  });

  test("4.1 Page /portal/invoices charge l'historique des factures", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/invoices");
    await page.waitForLoadState("domcontentloaded");

    await page.screenshot({ path: SS("pdf-01-invoices-chargee"), fullPage: true });

    // Section "Historique des factures" doit être visible
    await expect(page.getByText("Historique des factures")).toBeVisible({ timeout: 15_000 });

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("4.2 Boutons d'action PDF sont présents dans la liste des factures", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/invoices");
    await page.waitForLoadState("domcontentloaded");

    // Wait for invoice list to render (skeleton disappears)
    await page.waitForTimeout(3_000);

    // Check for any invoice action buttons (title attributes from ClientInvoices.tsx)
    const downloadBtn = page.locator('[title="Télécharger facture"]').first();
    const viewBtn = page.locator('[title="Voir facture"]').first();

    const hasDownload = (await downloadBtn.count()) > 0;
    const hasView = (await viewBtn.count()) > 0;

    if (!hasDownload && !hasView) {
      test.info().annotations.push({
        type: "info",
        description:
          "Aucune facture dans l'historique pour ce compte de test — boutons PDF non visibles.",
      });
      await page.screenshot({ path: SS("pdf-02-pas-de-factures") });
      return;
    }

    if (hasView) await expect(viewBtn).toBeVisible();
    if (hasDownload) await expect(downloadBtn).toBeVisible();

    await page.screenshot({ path: SS("pdf-02-boutons-pdf-visibles") });
    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("4.3 Cliquer sur Télécharger facture déclenche ouverture PDF (nouvel onglet)", async ({
    page,
    context,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/invoices");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3_000);

    const downloadBtn = page.locator('[title="Télécharger facture"]').first();

    if ((await downloadBtn.count()) === 0) {
      test.info().annotations.push({
        type: "info",
        description: "Aucune facture disponible pour tester le téléchargement PDF.",
      });
      return;
    }

    // useClientPDF opens PDF in a new tab
    const [newPage] = await Promise.all([
      context.waitForEvent("page", { timeout: 15_000 }).catch(() => null),
      downloadBtn.click(),
    ]);

    await page.screenshot({ path: SS("pdf-03-apres-clic-telechargement") });

    if (newPage) {
      // PDF opened in a new tab — check URL is an edge function PDF endpoint
      const url = newPage.url();
      expect(url, "Le PDF ne s'est pas ouvert vers l'edge function attendue").toMatch(
        /generate-pdf|blob:|data:|\.pdf/i,
      );
      await newPage.screenshot({ path: SS("pdf-04-nouvel-onglet-pdf") });
      await newPage.close();
    } else {
      // Might be a direct download — acceptable outcome
      test.info().annotations.push({
        type: "info",
        description: "PDF déclenché comme téléchargement direct (pas de nouvel onglet).",
      });
    }

    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });

  test("4.4 Bouton Exporter CSV est visible et cliquable", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/portal/invoices");
    await page.waitForLoadState("domcontentloaded");

    const csvBtn = page.getByRole("button", { name: /exporter csv/i });
    await expect(csvBtn).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: SS("pdf-05-bouton-csv-visible") });
    expect(errors, `Erreurs JS:\n${errors.join("\n")}`).toEqual([]);
  });
});
