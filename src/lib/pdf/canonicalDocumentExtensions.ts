import type { SupabaseClient } from "@supabase/supabase-js";
import type { PDFGenerationResult } from "./types";
import { fetchCanonicalDocumentData } from "./canonicalDocumentService";
import { buildOrderSummaryData, buildReceiptData } from "./documentBuilder";
import { generateOrderSummaryPDF } from "./orderSummaryTemplate";
import { generateReceiptPDF } from "./receiptTemplate";

function toOrderDocumentData(data: any, orderId: string) {
  return {
    orderId,
    order: data.order,
    profile: data.profile,
    account: data.account,
    billingInvoice: data.billingInvoice,
    billingInvoiceLines: data.billingInvoiceLines || [],
    billingPayments: data.billingPayments || [],
    contract: data.contract,
    breakdown: data.breakdown || null,
  };
}

/**
 * Generate canonical order summary PDF from any authenticated backend client.
 * Output is identical across admin, client portal, and staff portal.
 */
export async function generateCanonicalOrderSummaryPDF(
  client: SupabaseClient,
  orderId: string
): Promise<PDFGenerationResult> {
  try {
    const data = await fetchCanonicalDocumentData(client, { orderId });
    if (!data) {
      return { success: false, error: "Données de commande introuvables" };
    }

    const payload = toOrderDocumentData(data, orderId);
    if (!payload.breakdown) {
      return { success: false, error: "Données de facturation indisponibles pour le sommaire" };
    }

    const summaryData = buildOrderSummaryData(payload as any);
    return generateOrderSummaryPDF(summaryData);
  } catch (e: any) {
    console.error("[CanonicalDocExtensions] Order summary generation failed:", e);
    return { success: false, error: e?.message || "Erreur de génération" };
  }
}

/**
 * Generate canonical receipt PDF from any authenticated backend client.
 * Output is identical across admin, client portal, and staff portal.
 */
export async function generateCanonicalReceiptPDF(
  client: SupabaseClient,
  invoiceId: string
): Promise<PDFGenerationResult> {
  try {
    const data = await fetchCanonicalDocumentData(client, { invoiceId });
    if (!data) {
      return { success: false, error: "Données de facture introuvables" };
    }

    const orderId = data.order?.id || data.billingInvoice?.order_id || invoiceId;
    const payload = toOrderDocumentData(data, orderId);
    if (!payload.breakdown) {
      return { success: false, error: "Données de facturation indisponibles pour le reçu" };
    }

    const receiptData = buildReceiptData(payload as any);
    if (!receiptData) {
      return { success: false, error: "Aucun paiement confirmé — reçu non disponible" };
    }

    return generateReceiptPDF(receiptData);
  } catch (e: any) {
    console.error("[CanonicalDocExtensions] Receipt generation failed:", e);
    return { success: false, error: e?.message || "Erreur de génération" };
  }
}
