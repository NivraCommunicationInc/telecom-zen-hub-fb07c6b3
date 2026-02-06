/**
 * Nivra PDF Templates - React Hooks
 * Easy-to-use hooks for generating and downloading billing documents
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { safePDFDownload, safePDFOpen } from "@/lib/pdfUtils";
import {
  generateInvoiceMonthlyPDF,
  generateInvoiceOneTimePDF,
  generateOrderSummaryPDF,
  generateContractPDF,
  generateDocument,
  detectDocumentType,
  type DocumentType,
  type InvoiceMonthlyData,
  type InvoiceOneTimeData,
  type OrderSummaryData,
  type ContractData,
  type PDFGenerationResult,
} from "@/lib/pdf";

// ============================================================================
// HOOK: useInvoiceMonthlyPDF
// ============================================================================

export function useInvoiceMonthlyPDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (data: InvoiceMonthlyData): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const result = generateInvoiceMonthlyPDF(data);
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
// HOOK: useInvoiceOneTimePDF
// ============================================================================

export function useInvoiceOneTimePDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (data: InvoiceOneTimeData): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const result = generateInvoiceOneTimePDF(data);
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
// HOOK: useDocumentPDF (Unified)
// ============================================================================

type AnyDocumentData = InvoiceMonthlyData | InvoiceOneTimeData | OrderSummaryData | ContractData;

export function useDocumentPDF() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (
    type: DocumentType,
    data: AnyDocumentData
  ): Promise<PDFGenerationResult> => {
    setIsGenerating(true);
    try {
      const result = generateDocument(type, data);
      if (!result.success) {
        toast.error(result.error || "Erreur lors de la génération");
      }
      return result;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const download = useCallback(async (type: DocumentType, data: AnyDocumentData) => {
    const result = await generate(type, data);
    if (result.success && result.blob && result.filename) {
      safePDFDownload(result.blob, result.filename);
      toast.success("Document téléchargé");
    }
    return result;
  }, [generate]);

  const open = useCallback(async (type: DocumentType, data: AnyDocumentData) => {
    const result = await generate(type, data);
    if (result.success && result.blob && result.filename) {
      safePDFOpen(result.blob, result.filename);
    }
    return result;
  }, [generate]);

  const autoGenerate = useCallback(async (
    data: AnyDocumentData,
    hints?: { hasRecurringServices?: boolean; hasEquipment?: boolean; isOrderConfirmation?: boolean; isContract?: boolean }
  ) => {
    const type = detectDocumentType(hints || {});
    return generate(type, data);
  }, [generate]);

  return { generate, download, open, autoGenerate, isGenerating, detectDocumentType };
}
