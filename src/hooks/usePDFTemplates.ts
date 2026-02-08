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
  type InvoiceMonthlyData,
  type InvoiceOneTimeData,
} from "@/lib/pdf";

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

// ============================================================================
// HOOK: useInvoiceMonthlyPDF (Legacy wrapper - uses V2.5 engine)
// ============================================================================

/** @deprecated Utiliser useInvoicePDF() à la place */
export function useInvoiceMonthlyPDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (data: InvoiceMonthlyData): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const v2Data: InvoiceDataV2 = {
        invoice_type: "MONTHLY",
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date,
        due_date: data.cycle_end,
        account_number: data.account_number,
        billing_period_start: data.cycle_start,
        billing_period_end: data.cycle_end,
        currency: "CAD",
        status: data.status === "paid" ? "Paid" : "Pending",
        customer: {
          full_name: data.client_name,
          email: data.client_email,
          phone: data.client_phone,
          address_line1: data.client_address,
          city: "",
          province: "QC",
          postal_code: "",
        },
        items: data.invoice_lines.map(line => ({
          category: line.service_type as any,
          description: line.service_description,
          period: line.service_period,
          qty: 1,
          unit_price: line.service_price,
          amount: line.service_total,
          is_recurring: true,
        })),
        subtotal: data.subtotal_after_discounts,
        taxes: {
          gst_rate: 0.05,
          gst_amount: data.tax_gst,
          qst_rate: 0.09975,
          qst_amount: data.tax_qst,
        },
        total: data.total_due,
        balance_due: data.total_due,
      };
      
      const result = await generateInvoicePDF(v2Data);
      if (!result.success) {
        toast.error(result.error || "Erreur lors de la génération");
      }
      return result;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const download = useCallback(async (data: InvoiceMonthlyData) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFDownload(result.blob, result.filename);
      toast.success("Facture mensuelle téléchargée");
    }
    return result;
  }, [generate]);

  const open = useCallback(async (data: InvoiceMonthlyData) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFOpen(result.blob, result.filename);
    }
    return result;
  }, [generate]);

  return { generate, download, open, isGenerating };
}

// ============================================================================
// HOOK: useInvoiceOneTimePDF (Legacy wrapper - uses V2.5 engine)
// ============================================================================

/** @deprecated Utiliser useInvoicePDF() à la place */
export function useInvoiceOneTimePDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (data: InvoiceOneTimeData): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const v2Data: InvoiceDataV2 = {
        invoice_type: "ONETIME",
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date,
        due_date: data.cycle_end,
        account_number: data.account_number,
        currency: "CAD",
        status: data.status === "paid" ? "Paid" : "Pending",
        customer: {
          full_name: data.client_name,
          email: data.client_email,
          phone: data.client_phone,
          address_line1: data.client_address,
          city: "",
          province: "QC",
          postal_code: "",
        },
        items: data.items.map(item => ({
          category: "Equipment" as const,
          description: item.item_name + (item.item_description ? ` - ${item.item_description}` : ""),
          qty: item.qty,
          unit_price: item.unit_price,
          amount: item.line_total,
          is_recurring: false,
          reference: item.serial_number || undefined,
        })),
        subtotal: data.subtotal_after_discounts,
        taxes: {
          gst_rate: 0.05,
          gst_amount: data.tax_gst,
          qst_rate: 0.09975,
          qst_amount: data.tax_qst,
        },
        total: data.total_due,
        balance_due: data.total_due,
      };
      
      const result = await generateInvoicePDF(v2Data);
      if (!result.success) {
        toast.error(result.error || "Erreur lors de la génération");
      }
      return result;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const download = useCallback(async (data: InvoiceOneTimeData) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFDownload(result.blob, result.filename);
      toast.success("Facture téléchargée");
    }
    return result;
  }, [generate]);

  const open = useCallback(async (data: InvoiceOneTimeData) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFOpen(result.blob, result.filename);
    }
    return result;
  }, [generate]);

  return { generate, download, open, isGenerating };
}

// ============================================================================
// HOOK: useOrderSummaryPDF
// ============================================================================

export function useOrderSummaryPDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (data: OrderSummaryData): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const result = generateOrderSummaryPDF(data);
      if (!result.success) {
        toast.error(result.error || "Erreur lors de la génération");
      }
      return result;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const download = useCallback(async (data: OrderSummaryData) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFDownload(result.blob, result.filename);
      toast.success("Résumé de commande téléchargé");
    }
    return result;
  }, [generate]);

  const open = useCallback(async (data: OrderSummaryData) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFOpen(result.blob, result.filename);
    }
    return result;
  }, [generate]);

  return { generate, download, open, isGenerating };
}

// ============================================================================
// HOOK: useContractPDF
// ============================================================================

export function useContractPDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (data: ContractData): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const result = generateContractPDF(data);
      if (!result.success) {
        toast.error(result.error || "Erreur lors de la génération du contrat");
      }
      return result;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const download = useCallback(async (data: ContractData) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFDownload(result.blob, result.filename);
      toast.success("Contrat téléchargé");
    }
    return result;
  }, [generate]);

  const open = useCallback(async (data: ContractData) => {
    const result = await generate(data);
    if (result.success && result.blob && result.filename) {
      safePDFOpen(result.blob, result.filename);
    }
    return result;
  }, [generate]);

  return { generate, download, open, isGenerating };
}

// ============================================================================
// HOOK: useInvoiceMonthlyV2PDF (Alias for useInvoicePDF - MONTHLY)
// ============================================================================

/** @deprecated Utiliser useInvoicePDF() à la place */
export function useInvoiceMonthlyV2PDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (data: InvoiceDataV2): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const result = await generateInvoicePDF({ ...data, invoice_type: "MONTHLY" });
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
      toast.success("Facture mensuelle V2 téléchargée");
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

  return { generate, download, open, isGenerating };
}

// ============================================================================
// HOOK: useInvoiceOneTimeV2PDF (Alias for useInvoicePDF - ONETIME)
// ============================================================================

/** @deprecated Utiliser useInvoicePDF() à la place */
export function useInvoiceOneTimeV2PDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (data: InvoiceDataV2): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const result = await generateInvoicePDF({ ...data, invoice_type: "ONETIME" });
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
      toast.success("Facture unique V2 téléchargée");
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

  return { generate, download, open, isGenerating };
}
