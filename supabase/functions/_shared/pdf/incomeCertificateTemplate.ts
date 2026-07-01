/**
 * Income Certificate (Attestation de revenus) — Nivra HR
 * Navy #0A2540 + gold trim. For financial institutions / landlords.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import {
  NAVY,
  fmtCAD, fmtDate,
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawHeroBox, drawInfoBox, drawSignatureBlock, wrapText,
} from "./_baseTemplate.ts";

const GOLD: [number, number, number] = [176, 141, 87];

export interface IncomeCertificateData {
  document_number: string;
  issue_date: string;
  employee_name: string;
  employee_email?: string;
  agent_number?: string;
  role_title: string;
  hire_date: string;
  employment_status: string;         // "Actif — temps plein"
  monthly_gross_avg: number;
  annual_gross_ytd: number;
  annual_gross_previous_year?: number;
  requested_by?: string;             // "Banque XYZ", "Propriétaire", etc.
  purpose?: string;                  // "Demande de prêt hypothécaire"
  hr_officer_name?: string;
  hr_officer_title?: string;
}

export function buildIncomeCertificatePdf(data: IncomeCertificateData): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  let y = drawHeaderV2(doc, {
    title: "ATTESTATION DE REVENUS",
    subtitle: "Certificat officiel d'emploi et de rémunération",
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
    ["Poste", data.role_title],
    ["Statut d'emploi", data.employment_status],
    ["Date d'embauche", fmtDate(data.hire_date)],
    ["Ancienneté", ancienneteFrom(data.hire_date, data.issue_date)],
    ["Demandé par", data.requested_by || "—"],
    ["Motif", data.purpose || "Attestation générale"],
  ]);

  y = drawHeroBox(doc, y, {
    label: "Revenu mensuel brut moyen",
    value: fmtCAD(data.monthly_gross_avg),
    sublabel: "Basé sur les 12 derniers mois d'activité",
    bg: NAVY,
  });

  y = drawSectionTitle(doc, "Sommaire des revenus", y, NAVY);
  const rows: Array<[string, string]> = [
    ["Revenu brut cumulatif année en cours (YTD)", fmtCAD(data.annual_gross_ytd)],
  ];
  if ((data.annual_gross_previous_year ?? 0) > 0) {
    rows.push(["Revenu brut année précédente", fmtCAD(data.annual_gross_previous_year!)]);
  }
  rows.push(["Revenu mensuel moyen (12 mois)", fmtCAD(data.monthly_gross_avg)]);
  rows.push(["Revenu annuel projeté", fmtCAD(data.monthly_gross_avg * 12)]);
  y = drawZebraTable(doc, y, ["Élément", "Montant"], rows, [pw - 30 - 50, 50], NAVY);

  y = drawInfoBox(doc, y, {
    title: "Déclaration officielle",
    body:
      `Nivra Communications Inc., inscrite au Registre des entreprises du Québec (NEQ 2291249786), atteste ` +
      `par la présente que ${data.employee_name} occupe le poste de ${data.role_title} au sein de notre organisation ` +
      `depuis le ${fmtDate(data.hire_date)}. Les revenus indiqués ci-dessus reflètent la rémunération brute réelle ` +
      `versée par l'employeur, incluant salaire, commissions et bonus.`,
    bg: [251, 247, 240], border: GOLD, accent: NAVY,
  });

  y = drawSignatureBlock(doc, y + 4, {
    leftLabel: `${data.hr_officer_title || "Directeur RH"} — Nivra Communications Inc.`,
    rightLabel: "Sceau électronique",
    autoSignName: data.hr_officer_name || "Nivra Telecom",
    autoSignDate: `Émis le ${fmtDate(data.issue_date)}`,
  });

  drawFooterV2(doc, 1, 1);
  return new Uint8Array(doc.output("arraybuffer"));
}

function ancienneteFrom(hire: string, ref: string): string {
  try {
    const h = new Date(hire); const r = new Date(ref);
    const months = (r.getFullYear() - h.getFullYear()) * 12 + (r.getMonth() - h.getMonth());
    const y = Math.floor(months / 12), m = months % 12;
    if (y > 0 && m > 0) return `${y} an${y > 1 ? "s" : ""} et ${m} mois`;
    if (y > 0) return `${y} an${y > 1 ? "s" : ""}`;
    return `${m} mois`;
  } catch { return "—"; }
}
