/**
 * Commissions Statement (Relevé de commissions) — Nivra HR
 * Navy #0A2540 + gold trim. Detailed per-activation breakdown.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import {
  NAVY, GREEN,
  fmtCAD, fmtDate,
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawHeroBox, drawInfoBox,
} from "./_baseTemplate.ts";

const GOLD: [number, number, number] = [176, 141, 87];

export interface CommissionActivation {
  order_id: string;
  activation_date: string;         // YYYY-MM-DD
  client_name: string;             // masked ok
  plan_name: string;
  commission_amount: number;
  status: string;                  // "Approuvée", "En attente", "Rejetée"
}

export interface CommissionsStatementData {
  document_number: string;
  issue_date: string;
  period_start: string;
  period_end: string;
  employee_name: string;
  agent_number?: string;
  role_title?: string;
  activations: CommissionActivation[];
  total_approved: number;
  total_pending: number;
  total_rejected: number;
  bonus_amount?: number;
  clawback_amount?: number;
  net_payable: number;
  payment_date?: string;
  payment_method?: string;
}

export function buildCommissionsStatementPdf(data: CommissionsStatementData): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  let y = drawHeaderV2(doc, {
    title: "RELEVÉ DE COMMISSIONS",
    subtitle: `Période du ${fmtDate(data.period_start)} au ${fmtDate(data.period_end)}`,
    docNumber: data.document_number,
    docDate: fmtDate(data.issue_date),
    accent: NAVY,
  });

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 38, pw, 1.2, "F");
  y += 2;

  y = drawMetaGrid(doc, y, [
    ["Agent", data.employee_name],
    ["N° agent", data.agent_number || "—"],
    ["Poste", data.role_title || "Représentant terrain"],
    ["Activations", String(data.activations.length)],
    ["Période — du", fmtDate(data.period_start)],
    ["Période — au", fmtDate(data.period_end)],
    ["Date de paiement", data.payment_date ? fmtDate(data.payment_date) : "À venir"],
    ["Méthode", data.payment_method || "Virement Interac"],
  ]);

  y = drawHeroBox(doc, y, {
    label: "Net payable pour la période",
    value: fmtCAD(data.net_payable),
    sublabel: `${data.activations.length} activation(s) — ${fmtCAD(data.total_approved)} approuvées`,
    bg: GREEN,
  });

  // Table of activations
  y = drawSectionTitle(doc, `Détail des activations (${data.activations.length})`, y, NAVY);
  const tableRows = data.activations.slice(0, 22).map((a) => [
    fmtDate(a.activation_date),
    a.order_id,
    truncate(a.client_name, 22),
    truncate(a.plan_name, 20),
    a.status,
    fmtCAD(a.commission_amount),
  ]);
  const colW = [22, 24, 40, 40, 30, 24];
  // Pad to match page width
  const total = colW.reduce((s, w) => s + w, 0);
  const target = pw - 30;
  if (total !== target) colW[2] += (target - total);
  y = drawZebraTable(
    doc, y,
    ["Date", "N° cmd", "Client", "Forfait", "Statut", "Commission"],
    tableRows,
    colW,
    NAVY,
  );

  // Sommaire
  y = drawSectionTitle(doc, "Sommaire de la période", y, NAVY);
  const sum: Array<[string, string]> = [
    ["Commissions approuvées", fmtCAD(data.total_approved)],
    ["Commissions en attente", fmtCAD(data.total_pending)],
    ["Commissions rejetées", fmtCAD(data.total_rejected)],
  ];
  if ((data.bonus_amount ?? 0) > 0) sum.push(["Bonus mensuel", fmtCAD(data.bonus_amount!)]);
  if ((data.clawback_amount ?? 0) > 0) sum.push(["Reprises (clawback)", `- ${fmtCAD(data.clawback_amount!)}`]);
  sum.push(["Net payable", fmtCAD(data.net_payable)]);
  y = drawZebraTable(doc, y, ["Élément", "Montant"], sum, [pw - 30 - 45, 45], NAVY);

  y = drawInfoBox(doc, y, {
    title: "Politique de commissions",
    body:
      "Les commissions ne sont approuvées et payables qu'après activation confirmée du service et vérification " +
      "KYC du client. Une commission peut être reprise (clawback) si le client annule dans les 30 jours suivant " +
      "l'activation ou en cas de fraude confirmée. Toute contestation doit être soumise dans les 15 jours suivant " +
      "l'émission du présent relevé.",
    bg: [251, 247, 240], border: GOLD, accent: NAVY,
  });

  drawFooterV2(doc, 1, 1);
  return new Uint8Array(doc.output("arraybuffer"));
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
