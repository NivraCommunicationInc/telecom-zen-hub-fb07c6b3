/**
 * Nivra Late Notice Template V1.0 — PRODUCTION
 *
 * Canonical layout (matches LOCKED_TEMPLATES.md V4.0 standard):
 * ┌─────────────────────────────────────────────┐
 * │ RED/ORANGE HEADER per stage                 │
 * │ AVIS DE RETARD - Stage label                │
 * ├─────────────────────────────────────────────┤
 * │ Client info          Adresse de service     │
 * │ Compte / Facture en retard                  │
 * ├─────────────────────────────────────────────┤
 * │ Resume facture en retard (encadre)          │
 * │   Montant du / Date echeance / Jours retard │
 * ├─────────────────────────────────────────────┤
 * │ Action requise (encadre rouge)              │
 * │ Consequences si non-paiement                │
 * ├─────────────────────────────────────────────┤
 * │ Footer canonique                            │
 * └─────────────────────────────────────────────┘
 */

import jsPDF from "jspdf";
import type { PDFGenerationResult } from "./types";
import { NIVRA } from "./companyInfo";

export type LateNoticeStage = "first" | "second" | "final" | "collections";

export interface LateNoticeData {
  notice_number: string;
  issue_date: string;
  stage: LateNoticeStage;

  // Invoice in arrears
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount_due: number;
  days_overdue: number;

  // Late fees applied (if any)
  late_fee_amount?: number;
  total_with_fees?: number; // amount_due + late_fee_amount

  // Client
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;

  // Optional payment deadline (next escalation date)
  pay_by_date?: string;
}

const fmt = (amount: number): string =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(amount || 0);

const fmtDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  const ymd = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return `${d.getDate()} ${d.toLocaleString("fr-CA", { month: "long" })} ${d.getFullYear()}`;
  }
  return "—";
};

interface StageConfig {
  title: string;
  color: [number, number, number];
  badgeColor: [number, number, number];
  message: string;
  consequences: string;
}

const STAGE_CONFIG: Record<LateNoticeStage, StageConfig> = {
  first: {
    title: "AVIS DE RETARD - 1er rappel",
    color: [240, 160, 40],
    badgeColor: [240, 160, 40],
    message:
      "Votre facture n'a pas encore ete reglee. Veuillez proceder au paiement dans les meilleurs delais pour eviter des frais supplementaires et la suspension de vos services.",
    consequences:
      "A defaut de paiement sous 15 jours, des frais de retard seront ajoutes a votre compte.",
  },
  second: {
    title: "AVIS DE RETARD - 2e rappel",
    color: [220, 100, 30],
    badgeColor: [220, 100, 30],
    message:
      "Votre paiement est toujours en attente. Des frais de retard ont ete appliques a votre compte. Un paiement immediat est requis pour maintenir vos services actifs.",
    consequences:
      "A defaut de paiement sous 15 jours, vos services seront suspendus sans autre preavis.",
  },
  final: {
    title: "AVIS DE RETARD - Avis final",
    color: [180, 50, 50],
    badgeColor: [180, 50, 50],
    message:
      "Ceci est notre dernier avis avant suspension de vos services. Le paiement doit etre recu immediatement pour eviter l'interruption complete de votre forfait.",
    consequences:
      "A defaut de paiement immediat, vos services seront suspendus et le dossier sera transfere au recouvrement.",
  },
  collections: {
    title: "AVIS DE RECOUVREMENT",
    color: [120, 30, 30],
    badgeColor: [120, 30, 30],
    message:
      "Votre dossier a ete transfere au departement de recouvrement. Une action immediate est requise pour eviter d'autres consequences sur votre dossier de credit.",
    consequences:
      "Le non-paiement peut entrainer des frais de recouvrement supplementaires et un signalement aux agences de credit.",
  },
};

function drawHeader(doc: jsPDF, title: string, docNumber: string, color: [number, number, number]) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(0, 0, pw, 40, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("NIVRA TELECOM", 15, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(title, 15, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`No ${docNumber}`, pw - 15, 18, { align: "right" });
}

function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${NIVRA.tradeName} Inc. | ${NIVRA.email} | ${NIVRA.website}`,
    pw / 2, ph - 18, { align: "center" }
  );
  doc.text(
    `${NIVRA.tpsLabel} | ${NIVRA.tvqLabel}`,
    pw / 2, ph - 13, { align: "center" }
  );
}

export function generateLateNoticePDF(data: LateNoticeData): PDFGenerationResult {
  try {
    if (!data.notice_number) return { success: false, error: "Numero d'avis manquant" };
    if (!data.client_name || !data.client_email) return { success: false, error: "Informations client incompletes" };
    if (!data.invoice_number) return { success: false, error: "Facture liee manquante" };
    if (!data.amount_due || data.amount_due <= 0) return { success: false, error: "Montant du invalide" };

    const config = STAGE_CONFIG[data.stage];
    if (!config) return { success: false, error: `Palier inconnu: ${data.stage}` };

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    drawHeader(doc, config.title, data.notice_number, config.color);

    // CLIENT BLOCK
    let y = 50;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Client", 15, y);
    doc.text("Adresse de service", 110, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(data.client_name, 15, y);
    if (data.client_address) doc.text(data.client_address, 110, y);
    y += 5;
    doc.text(data.client_email, 15, y);
    if (data.client_city) {
      doc.text(`${data.client_city}, ${data.client_province || "QC"} ${data.client_postal || ""}`, 110, y);
    }
    y += 5;
    if (data.client_phone) { doc.text(data.client_phone, 15, y); y += 5; }

    doc.setFontSize(8);
    doc.text(`Compte: ${data.account_number}  |  Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    y += 12;

    // INVOICE SUMMARY BOX
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Facture en retard", 15, y);
    y += 5;

    const total = data.total_with_fees ?? data.amount_due;
    const boxHeight = data.late_fee_amount && data.late_fee_amount > 0 ? 50 : 40;

    doc.setFillColor(255, 248, 240);
    doc.setDrawColor(config.color[0], config.color[1], config.color[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, y, 170, boxHeight, 2, 2, "FD");
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Facture No ${data.invoice_number}`, 22, y + 8);
    doc.text(`Emise le ${fmtDate(data.invoice_date)}`, 22, y + 14);
    doc.text(`Echue le ${fmtDate(data.due_date)}`, 22, y + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Montant initial:", 22, y + 30);
    doc.text(fmt(data.amount_due), 100, y + 30);

    if (data.late_fee_amount && data.late_fee_amount > 0) {
      doc.text("Frais de retard:", 22, y + 36);
      doc.text(fmt(data.late_fee_amount), 100, y + 36);
    }

    // Big total at right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(config.color[0], config.color[1], config.color[2]);
    doc.text(fmt(total), 178, y + 20, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text("TOTAL DU", 178, y + 26, { align: "right" });
    doc.setTextColor(0, 0, 0);

    // Days overdue badge
    doc.setFillColor(config.badgeColor[0], config.badgeColor[1], config.badgeColor[2]);
    doc.roundedRect(125, y + 32, 53, 8, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`${data.days_overdue} jour${data.days_overdue > 1 ? "s" : ""} de retard`, 151.5, y + 37.5, { align: "center" });
    doc.setTextColor(0, 0, 0);

    y += boxHeight + 8;

    // ACTION REQUIRED MESSAGE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Action requise", 15, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const msgLines = doc.splitTextToSize(config.message, 165) as string[];
    const msgHeight = msgLines.length * 4.5 + 4;

    doc.setFillColor(255, 235, 235);
    doc.setDrawColor(config.color[0], config.color[1], config.color[2]);
    doc.roundedRect(15, y, 170, msgHeight, 1, 1, "FD");
    doc.setTextColor(40, 40, 40);
    let my = y + 5;
    for (const line of msgLines) {
      doc.text(line, 17, my);
      my += 4.5;
    }
    y += msgHeight + 6;

    // PAY BY DATE
    if (data.pay_by_date) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(config.color[0], config.color[1], config.color[2]);
      doc.text(`Date limite de paiement: ${fmtDate(data.pay_by_date)}`, 15, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
    }

    // CONSEQUENCES
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Consequences en cas de non-paiement", 15, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const consLines = doc.splitTextToSize(config.consequences, 170) as string[];
    doc.setTextColor(60, 60, 60);
    for (const line of consLines) {
      doc.text(line, 15, y);
      y += 4.5;
    }
    y += 4;

    // CONTACT
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Si vous avez deja effectue le paiement, ignorez cet avis. Pour toute question: ${NIVRA.email}`,
      15, y
    );
    doc.setTextColor(0, 0, 0);

    drawFooter(doc);

    const blob = doc.output("blob");
    return {
      success: true,
      blob,
      filename: `Avis_de_retard_${data.notice_number}_Nivra.pdf`,
    };
  } catch (error: any) {
    console.error("[LateNotice] Generation error:", error);
    return { success: false, error: error?.message || "Erreur de generation" };
  }
}

export default generateLateNoticePDF;
