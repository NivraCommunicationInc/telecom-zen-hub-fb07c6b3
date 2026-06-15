/**
 * Welcome Letter â€” Lettre de bienvenue (envoyée après activation du service).
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import { drawHeader, drawFooter, drawClientBlock, drawSectionTitle, drawBoxedText, drawKeyValue, fmtDate, fmtCAD, NAVY, TEAL } from "./_baseTemplate.ts";

export interface WelcomeLetterData {
  letter_number: string;          // ex: BVN-2026-0001
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
  service_name: string;           // ex: "Internet Fibre 1 Gbps"
  activation_date: string;
  monthly_amount: number;
  next_billing_date?: string;
  portal_url?: string;
}

export function generateWelcomeLetterPDF(data: WelcomeLetterData): PDFGenerationResult {
  try {
    if (!data.client_name) data = { ...data, client_name: "â€”" };
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    drawHeader(doc, "LETTRE DE BIENVENUE", data.letter_number);
    let y = 50;
    y = drawClientBlock(doc, y, {
      name: data.client_name, email: data.client_email, phone: data.client_phone,
      address: data.client_address, city: data.client_city, province: data.client_province,
      postal: data.client_postal, account_number: data.account_number,
    });

    doc.setFontSize(9);
    doc.text(`Date d'emission: ${fmtDate(data.issue_date)}`, 15, y);
    y += 10;

    // Greeting
    y = drawSectionTitle(doc, `Bienvenue chez Nivra Telecom, ${data.client_name.split(" ")[0]} !`, y);
    y = drawBoxedText(
      doc,
      `Nous sommes ravis de vous compter parmi nos clients. Votre service ${data.service_name} a ete active avec succes le ${fmtDate(data.activation_date)}. Ce document confirme les details de votre nouveau service et vous indique comment gerer votre compte au quotidien.`,
      y,
      { fillColor: [240, 253, 244], borderColor: TEAL }
    );

    // Service summary
    y = drawSectionTitle(doc, "Recapitulatif de votre service", y);
    y = drawKeyValue(doc, "Service active", data.service_name, y);
    y = drawKeyValue(doc, "Date d'activation", fmtDate(data.activation_date), y);
    y = drawKeyValue(doc, "Numero de compte", data.account_number, y);
    y = drawKeyValue(doc, "Frais mensuels", fmtCAD(data.monthly_amount) + " (taxes incluses)", y);
    if (data.next_billing_date) y = drawKeyValue(doc, "Prochaine facturation", fmtDate(data.next_billing_date), y);
    y += 4;

    // Next steps
    y = drawSectionTitle(doc, "Prochaines etapes", y);
    const steps = [
      "1. Conservez votre numero de compte pour toute communication.",
      "2. Acceder a votre portail client pour consulter vos factures et gerer vos preferences.",
      "3. Activez le paiement automatique pour eviter tout retard (recommande).",
      "4. Communiquez avec notre equipe par courriel pour toute question.",
    ];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    for (const s of steps) {
      const lines = doc.splitTextToSize(s, 165) as string[];
      for (const l of lines) { doc.text(l, 17, y); y += 4.5; }
      y += 1;
    }
    y += 4;

    // Portal callout
    if (data.portal_url) {
      y = drawBoxedText(doc, `Acces portail client : ${data.portal_url}`, y, { fillColor: [240, 248, 255], borderColor: NAVY, textColor: NAVY });
    }

    // Closing
    y += 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Toute l'equipe Nivra Telecom vous remercie de votre confiance.", 15, y);

    drawFooter(doc);
    return { success: true, blob: doc.output("blob"), filename: `Lettre_Bienvenue_${data.letter_number}_Nivra.pdf` };
  } catch (e) {
    return { success: false, error: e?.message || "Erreur de generation" };
  }
}

export default generateWelcomeLetterPDF;
