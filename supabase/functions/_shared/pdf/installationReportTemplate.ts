/**
 * Technician Installation Report - Corporate blue Lot1 layout.
 */
import { jsPDF } from "npm:jspdf@2.5.2";
import type { PDFGenerationResult } from "./types.ts";
import {
  drawHeaderV2, drawFooterV2, drawMetaGrid, drawSectionTitle,
  drawZebraTable, drawInfoBox, drawSignatureBlock, fmtDate,
  BLUE, BLUE_LIGHT, GREEN, AMBER, RED,
} from "./_baseTemplate.ts";

export interface InstallationReportData {
  report_number: string;
  issue_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  account_number: string;
  service_address: string;
  service_city?: string;
  service_province?: string;
  service_postal?: string;
  technician_name: string;
  technician_id?: string;
  appointment_date: string;
  start_time?: string;
  end_time?: string;
  service_installed: string;
  equipment_installed: Array<{ description: string; serial_number?: string; }>;
  outcome: "success" | "partial" | "failed";
  notes?: string;
  client_signature_required?: boolean;
  tests?: Array<{ name: string; target?: string; measured?: string; passed: boolean }>;
}

export function generateInstallationReportPDF(data: InstallationReportData): PDFGenerationResult {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = drawHeaderV2(doc, {
      title: "Installation",
      subtitle: "Rapport d'installation technicien",
      docNumber: data.report_number,
      docDate: fmtDate(data.issue_date),
    });

    const addr = [data.service_address, data.service_city, data.service_province].filter(Boolean).join(", ");
    y = drawMetaGrid(doc, y, [
      ["Client", data.client_name || "--"],
      ["N° de compte", data.account_number || "--"],
      ["Adresse", addr || "--"],
      ["Technicien", `${data.technician_name}${data.technician_id ? ` (${data.technician_id})` : ""}`],
      ["Début intervention", `${fmtDate(data.appointment_date)}${data.start_time ? ` - ${data.start_time}` : ""}`],
      ["Fin intervention", `${fmtDate(data.appointment_date)}${data.end_time ? ` - ${data.end_time}` : ""}`],
    ]);

    y = drawSectionTitle(doc, "Équipements installés", y);
    const eqRows = (data.equipment_installed || []).map(e => [
      e.description, e.serial_number || "-", "-", "Neuf",
    ]);
    if (eqRows.length === 0) eqRows.push(["Service installé: " + data.service_installed, "-", "-", "OK"]);
    y = drawZebraTable(doc, y,
      ["Équipement", "N° de série", "Emplacement", "État"],
      eqRows,
      [65, 45, 45, 25],
    );

    if (data.tests && data.tests.length > 0) {
      y = drawSectionTitle(doc, "Tests de conformité", y);
      const testRows = data.tests.map(t => [
        t.name, t.target || "-", t.measured || "-", t.passed ? "PASS" : "FAIL",
      ]);
      y = drawZebraTable(doc, y,
        ["Test", "Valeur cible", "Mesuré", "Résultat"],
        testRows,
        [70, 40, 40, 30],
      );
    }

    const outcomeColor = data.outcome === "success" ? GREEN : data.outcome === "partial" ? AMBER : RED;
    const outcomeText = data.outcome === "success"
      ? "Installation réussie - tous les tests ont passé."
      : data.outcome === "partial"
      ? "Installation partielle - un suivi est requis."
      : "Installation échouée - une nouvelle intervention est nécessaire.";
    y = drawInfoBox(doc, y, {
      title: "Résultat de l'intervention",
      body: outcomeText + (data.notes ? "\n\nNotes: " + data.notes : ""),
      bg: BLUE_LIGHT, border: outcomeColor, accent: outcomeColor,
    });

    if (data.client_signature_required !== false) {
      y = drawSignatureBlock(doc, y + 4, {
        leftLabel: "Signature du client",
        rightLabel: "Signature du technicien",
      });
    }

    drawFooterV2(doc, 1, 1);
    return { success: true, blob: doc.output("blob"), filename: `Rapport_Installation_${(data.client_name || "").replace(/\s+/g,"-")}_${data.report_number}.pdf` };
  } catch (e) {
    return { success: false, error: (e as Error)?.message || "Erreur de génération" };
  }
}

export default generateInstallationReportPDF;
