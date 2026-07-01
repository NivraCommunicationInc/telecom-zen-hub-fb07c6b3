/**
 * Termination Notice / Record of Employment (Cessation d'emploi) — Nivra HR
 * Navy #0A2540 + gold trim.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import {
  NAVY, GREEN,
  fmtCAD, fmtDate,
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawHeroBox, drawInfoBox, drawSignatureBlock, wrapText,
} from "./_baseTemplate.ts";

const GOLD: [number, number, number] = [176, 141, 87];

export interface TerminationNoticeData {
  document_number: string;
  issue_date: string;
  employee_name: string;
  employee_email?: string;
  agent_number?: string;
  role_title?: string;
  hire_date: string;
  last_day_worked: string;
  reason_code: string;             // "K = Departure", "A = Shortage of work"
  reason_label: string;            // human label
  final_gross: number;
  vacation_pay?: number;
  severance?: number;
  other_amounts?: number;
  final_deductions: number;
  final_net: number;
  ytd_gross?: number;
  ytd_deductions?: number;
  payment_date: string;
  payment_method: string;
  hr_officer_name?: string;
  hr_officer_title?: string;
}

const METHOD: Record<string, string> = {
  interac: "Virement Interac",
  direct_deposit: "Dépôt direct",
  paypal: "PayPal",
};

export function buildTerminationNoticePdf(data: TerminationNoticeData): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  let y = drawHeaderV2(doc, {
    title: "CESSATION D'EMPLOI",
    subtitle: "Relevé d'emploi et solde final",
    docNumber: data.document_number,
    docDate: fmtDate(data.issue_date),
    accent: NAVY,
  });

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 38, pw, 1.2, "F");
  y += 2;

  y = drawMetaGrid(doc, y, [
    ["Employé", data.employee_name],
    ["N° agent", data.agent_number || "—"],
    ["Poste", data.role_title || "—"],
    ["Date d'embauche", fmtDate(data.hire_date)],
    ["Dernier jour travaillé", fmtDate(data.last_day_worked)],
    ["Motif (code)", data.reason_code],
    ["Motif", data.reason_label],
    ["Méthode paiement final", METHOD[data.payment_method] || data.payment_method],
  ]);

  // Hero — Solde final versé
  y = drawHeroBox(doc, y, {
    label: "Solde final versé",
    value: fmtCAD(data.final_net),
    sublabel: `Payé le ${fmtDate(data.payment_date)} par ${METHOD[data.payment_method] || data.payment_method}`,
    bg: GREEN,
  });

  // Détail du solde
  y = drawSectionTitle(doc, "Détail du solde final", y, NAVY);
  const rows: Array<[string, string]> = [
    ["Salaire / commissions dues", fmtCAD(data.final_gross)],
  ];
  if ((data.vacation_pay ?? 0) > 0) rows.push(["Indemnité de vacances (4%)", fmtCAD(data.vacation_pay!)]);
  if ((data.severance ?? 0) > 0)    rows.push(["Indemnité de départ", fmtCAD(data.severance!)]);
  if ((data.other_amounts ?? 0) > 0) rows.push(["Autres montants dus", fmtCAD(data.other_amounts!)]);
  rows.push(["Déductions légales et retenues", `- ${fmtCAD(data.final_deductions)}`]);
  rows.push(["Net versé", fmtCAD(data.final_net)]);
  y = drawZebraTable(doc, y,
    ["Élément", "Montant"],
    rows,
    [pw - 30 - 45, 45],
    NAVY,
  );

  if ((data.ytd_gross ?? 0) > 0) {
    y = drawSectionTitle(doc, "Cumul annuel à ce jour", y, NAVY);
    y = drawZebraTable(doc, y,
      ["Élément", "Montant"],
      [
        ["Brut YTD", fmtCAD(data.ytd_gross!)],
        ["Déductions YTD", `- ${fmtCAD(data.ytd_deductions ?? 0)}`],
        ["Net YTD", fmtCAD((data.ytd_gross ?? 0) - (data.ytd_deductions ?? 0))],
      ],
      [pw - 30 - 45, 45],
      NAVY,
    );
  }

  y = drawInfoBox(doc, y, {
    title: "Relevé d'emploi (RE)",
    body:
      "Le Relevé d'emploi officiel sera transmis à Service Canada dans les 5 jours ouvrables suivant la date " +
      "d'émission de ce document. Une copie électronique sera envoyée à votre courriel. Conservez ce document " +
      "pour toute demande d'assurance-emploi ou d'attestation auprès d'un organisme financier.",
    bg: [251, 247, 240], border: GOLD, accent: NAVY,
  });

  y = drawSignatureBlock(doc, y + 4, {
    leftLabel: `${data.hr_officer_title || "Ressources humaines"} — Nivra Communications Inc.`,
    rightLabel: "Signature de l'employé (accusé)",
    autoSignName: data.hr_officer_name || "Nivra Telecom",
    autoSignDate: `Signé le ${fmtDate(data.issue_date)}`,
  });

  drawFooterV2(doc, 1, 1);
  return new Uint8Array(doc.output("arraybuffer"));
}
