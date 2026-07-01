/**
 * Contract Amendment - Corporate blue Lot1 layout.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawInfoBox, drawSignatureBlock, fmtDate, fmtCAD,
  BLUE, BLUE_LIGHT,
} from "./_baseTemplate.ts";

export interface ContractAmendmentData {
  amendment_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
  original_contract_number: string;
  original_contract_date: string;
  effective_date: string;
  changes: Array<{ field: string; old_value: string; new_value: string; }>;
  reason?: string;
  new_monthly_amount?: number;
  amendment_type?: string;
  proration_lines?: Array<{ description: string; calc?: string; amount: number }>;
  proration_total?: number;
  notes?: string;
}

export function generateContractAmendmentPDF(data: ContractAmendmentData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "Avenant",
      subtitle: "Avenant au contrat de service",
      docNumber: data.amendment_number,
      docDate: fmtDate(data.issue_date),
    });

    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name || "--"],
      ["N° de compte", data.account_number || "--"],
      ["Contrat original", data.original_contract_number || "--"],
      ["Type de modification", data.amendment_type || data.reason || "Modification"],
      ["Date effective", fmtDate(data.effective_date)],
      ["Contrat original signé", fmtDate(data.original_contract_date)],
    ]);

    y = drawSectionTitle(doc, "Modifications apportées", y);
    const changeRows = (data.changes || []).map(c => [c.field, c.old_value, c.new_value, "-"]);
    y = drawZebraTable(doc, y,
      ["Élément", "Avant", "Après", "Impact"],
      changeRows.length ? changeRows : [["Voir contrat", "-", "-", "-"]],
      [55, 45, 45, 35],
    );

    if (data.proration_lines && data.proration_lines.length > 0) {
      y = drawSectionTitle(doc, "Ajustement de prorata (cycle en cours)", y);
      const proRows = data.proration_lines.map(p => [
        p.description, p.calc || "", fmtCAD(p.amount),
      ]);
      if (data.proration_total !== undefined) {
        proRows.push(["Total prorata facturé aujourd'hui", "", fmtCAD(data.proration_total)]);
      }
      y = drawZebraTable(doc, y,
        ["Description", "Calcul", "Montant"],
        proRows,
        [95, 50, 35],
      );
    }

    if (data.new_monthly_amount !== undefined) {
      y = drawInfoBox(doc, y, {
        title: "Nouveau montant mensuel",
        body: `À compter du ${fmtDate(data.effective_date)}: ${fmtCAD(data.new_monthly_amount)} par mois (taxes en sus).`,
        bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
      });
    }

    y = drawInfoBox(doc, y, {
      title: "Conditions",
      body: `Cet avenant fait partie intégrante du contrat ${data.original_contract_number}. Toutes les clauses du contrat original demeurent en vigueur, à l'exception des modifications précisées ci-dessus. Le prorata, s'il y a lieu, est facturé immédiatement sur votre méthode de paiement enregistrée.`,
      bg: BLUE_LIGHT, border: BLUE, accent: BLUE,
    });

    y = drawSignatureBlock(doc, y + 2, {
      leftLabel: "Nivra Communications Inc. - Signé automatiquement",
      rightLabel: "Signature du client",
      autoSignName: "Nivra Telecom",
      autoSignDate: `Signé le ${fmtDate(data.issue_date)}`,
    });

    drawFooterV2(doc, 1, 1);
    return { success: true, blob: doc.output("blob"), filename: `Avenant_Contrat_${(data.client_name || "").replace(/\s+/g,"-")}_${data.amendment_number}.pdf` };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || "Erreur de génération" };
  }
}

export default generateContractAmendmentPDF;
