/**
 * Hiring Letter (Lettre d'embauche) — Nivra HR
 * Navy #0A2540 + gold trim. v2 layout helpers.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import {
  NAVY, BORDER,
  fmtCAD, fmtDate,
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawInfoBox, drawSignatureBlock, wrapText,
} from "./_baseTemplate.ts";

const GOLD: [number, number, number] = [176, 141, 87]; // #B08D57

export interface HiringLetterData {
  document_number: string;
  issue_date: string;
  employee_name: string;
  employee_email?: string;
  employee_address?: string;
  role_title: string;              // "Représentant terrain"
  department?: string;             // "Ventes terrain"
  start_date: string;
  employment_type: string;         // "Contractuel", "Employé permanent"
  reporting_to?: string;
  work_location?: string;          // "Télétravail / Grand Montréal"
  base_salary?: number;            // annual $
  hourly_rate?: number;
  commission_structure?: string;   // free text
  bonus_structure?: string;
  probation_months?: number;       // 3
  notice_period_days?: number;     // 14
  benefits?: string[];             // ["RRQ","AE","RQAP","Assurance invalidité"]
  supervisor_name?: string;
  supervisor_title?: string;       // "Directeur RH"
}

export function buildHiringLetterPdf(data: HiringLetterData): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  let y = drawHeaderV2(doc, {
    title: "LETTRE D'EMBAUCHE",
    subtitle: "Offre d'emploi — Nivra Communications Inc.",
    docNumber: data.document_number,
    docDate: fmtDate(data.issue_date),
    accent: NAVY,
  });

  // Gold trim under header
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 38, pw, 1.2, "F");
  y += 2;

  // Meta grid
  y = drawMetaGrid(doc, y, [
    ["Candidat", data.employee_name],
    ["Poste", data.role_title],
    ["Type d'emploi", data.employment_type],
    ["Date d'entrée", fmtDate(data.start_date)],
    ["Département", data.department || "—"],
    ["Lieu de travail", data.work_location || "—"],
    ["Superviseur", data.reporting_to || data.supervisor_name || "—"],
    ["Période d'essai", `${data.probation_months ?? 3} mois`],
  ]);

  // Salutation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(`Cher/Chère ${data.employee_name},`, 15, y);
  y += 6;

  const intro =
    `Nous avons le plaisir de vous confirmer votre embauche chez Nivra Communications Inc. ` +
    `au poste de ${data.role_title}. Cette lettre constitue une offre officielle sous réserve ` +
    `des conditions décrites ci-dessous et de la signature du présent document.`;
  for (const line of wrapText(doc, intro, pw - 30)) {
    doc.text(line, 15, y); y += 4.5;
  }
  y += 3;

  // Rémunération
  y = drawSectionTitle(doc, "Rémunération", y, NAVY);
  const rem: Array<[string, string]> = [];
  if (data.base_salary && data.base_salary > 0) rem.push(["Salaire annuel", `${fmtCAD(data.base_salary)} / an`]);
  if (data.hourly_rate && data.hourly_rate > 0) rem.push(["Taux horaire", `${fmtCAD(data.hourly_rate)} / h`]);
  if (data.commission_structure) rem.push(["Commissions", data.commission_structure]);
  if (data.bonus_structure) rem.push(["Bonus", data.bonus_structure]);
  rem.push(["Fréquence de paie", "Bimensuelle — vendredi"]);
  rem.push(["Méthode de paiement", "Virement Interac ou dépôt direct"]);
  if (rem.length) y = drawMetaGrid(doc, y, rem);

  // Déductions & avantages
  y = drawSectionTitle(doc, "Déductions & avantages", y, NAVY);
  const benefits = data.benefits && data.benefits.length > 0
    ? data.benefits
    : ["Impôt fédéral", "Impôt provincial (Québec)", "RRQ", "Assurance-emploi (AE)", "RQAP"];
  const rows = benefits.map((b) => [b, "Retenue légale ou avantage inclus"]);
  y = drawZebraTable(doc, y, ["Élément", "Détail"], rows, [70, pw - 30 - 70], NAVY);

  // Conditions
  y = drawInfoBox(doc, y, {
    title: "Conditions d'emploi",
    body:
      `Période d'essai de ${data.probation_months ?? 3} mois durant laquelle chaque partie peut mettre fin ` +
      `à l'emploi sans préavis. Après cette période, un préavis écrit de ${data.notice_period_days ?? 14} jours ` +
      `est requis pour toute cessation d'emploi à l'initiative de l'employé. La confidentialité, la non-concurrence ` +
      `dans le domaine télécom pour 6 mois post-emploi et la propriété intellectuelle sont régies par les politiques internes ` +
      `Nivra remises à l'entrée en poste.`,
    bg: [251, 247, 240], border: GOLD, accent: NAVY,
  });

  // Signature
  y = drawSignatureBlock(doc, y + 4, {
    leftLabel: `${data.supervisor_title || "Directeur RH"} — Nivra Communications Inc.`,
    rightLabel: "Signature du nouvel employé",
    autoSignName: data.supervisor_name || "Nivra Telecom",
    autoSignDate: `Signé le ${fmtDate(data.issue_date)}`,
  });

  drawFooterV2(doc, 1, 1);
  return new Uint8Array(doc.output("arraybuffer"));
}
