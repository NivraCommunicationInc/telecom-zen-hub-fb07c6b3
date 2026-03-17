/**
 * Nivra PDF Templates - React Hooks V2.5
 * All hooks use unified invoiceEngine for invoice generation
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { safePDFDownload, safePDFOpen } from "@/lib/pdfUtils";
import {
  generateInvoicePDF,
  generateBlankInvoicePDF,
  generateOrderSummaryPDF,
  generateContractPDF,
  type OrderSummaryData,
  type ContractData,
  type PDFGenerationResult,
  type InvoiceDataV2,
} from "@/lib/pdf";

// ============================================================================
// LOCAL TYPES FOR DEPRECATED HOOKS (V2.5 - Internal use only)
// ============================================================================

interface InvoiceLine {
  service_type: string;
  service_description: string;
  service_period: string;
  service_price: number;
  service_promo?: string | null;
  service_total: number;
}

interface OneTimeItem {
  item_name: string;
  item_description?: string;
  qty: number;
  unit_price: number;
  line_total: number;
  serial_number?: string | null;
}

interface InvoiceMonthlyData {
  account_number: string;
  invoice_number: string;
  invoice_date: string;
  cycle_start: string;
  cycle_end: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  subtotal_after_discounts: number;
  tax_gst: number;
  tax_qst: number;
  total_due: number;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address: string;
  invoice_lines: InvoiceLine[];
}

interface InvoiceOneTimeData {
  account_number: string;
  invoice_number: string;
  invoice_date: string;
  cycle_start: string;
  cycle_end: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  subtotal_after_discounts: number;
  tax_gst: number;
  tax_qst: number;
  total_due: number;
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address: string;
  items: OneTimeItem[];
}

// ============================================================================
// HOOK: useInvoicePDF (Unified V2.5)
// Point d'entrée unique pour toutes les factures
// ============================================================================

export function useInvoicePDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (data: InvoiceDataV2): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const result = await generateInvoicePDF(data);
      if (!result.success) {
        toast.error(result.error || "Erreur lors de la génération");
      }
      return result;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const download = useCallback(async (data: InvoiceDataV2) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFDownload(result.blob, result.filename);
      toast.success("Facture téléchargée");
    }
    return result;
  }, [generate]);

  const open = useCallback(async (data: InvoiceDataV2) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFOpen(result.blob, result.filename);
    }
    return result;
  }, [generate]);

  const generateBlank = useCallback(async (invoiceType: "MONTHLY" | "ONETIME") => {
    setIsGenerating(true);
    try {
      const result = await generateBlankInvoicePDF(invoiceType);
      if (!result.success) {
        toast.error(result.error || "Erreur lors de la génération du template");
      }
      return result;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, download, open, generateBlank, isGenerating };
}

// ═══ PHASE 3: Legacy PDF hooks removed ═══
// useInvoiceMonthlyPDF, useInvoiceOneTimePDF, useInvoiceMonthlyV2PDF, useInvoiceOneTimeV2PDF
// All removed — zero consumers. Use useInvoicePDF() instead.
