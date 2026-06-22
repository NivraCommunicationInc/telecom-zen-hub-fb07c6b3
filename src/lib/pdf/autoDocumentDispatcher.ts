/**
 * Auto Document Dispatcher
 * ------------------------
 * Maps `doc_type` (string from pending_document_jobs) to the correct
 * jsPDF template generator. Used exclusively by the browser-side worker
 * (useDocumentJobWorker) to materialize PDFs from queued events.
 *
 * Contract: every entry returns `{ blob, filename, docNumber }` or throws.
 *
 * Hardening (2026-05):
 *   - validatePayload() checks the required fields BEFORE rendering. If any
 *     are missing/blank, we log a system alert so operators see the bad job
 *     instead of receiving a PDF with "null" or "—" placeholders.
 *   - The render still proceeds with the safer fallback text — the customer
 *     receives a slightly incomplete document but never garbage.
 */
import {
  generateWelcomeLetterPDF,
  generateAddressChangePDF,
  generatePaymentMethodChangePDF,
  generateServiceCertificatePDF,
  generateSuspensionNoticePDF,
  generateCancellationConfirmationPDF,
  generateChargebackNoticePDF,
  generateFinalRefundReceiptPDF,
  generateDeliverySlipPDF,
  generateReturnInstructionsPDF,
  generateInstallationReportPDF,
  generateActivationConfirmationPDF,
  generateContractAmendmentPDF,
  generateFormalDemandPDF,
  generateCollectionsTransferPDF,
  generateComplaintAcknowledgmentPDF,
  generatePreauthorizationConfirmationPDF,
} from "./index";
import { generateReactivationNoticePDF } from "./reactivationNoticeTemplate";
import { generateCreditNotePDF } from "./creditNoteTemplate";
import { checkRequiredFields } from "./_pdfSanitize";
import { supabase } from "@/integrations/supabase/client";

/**
 * Required fields per document type. If any of these are missing in the
 * payload, the PDF is still generated (with `safeText` fallbacks) but a
 * billing_system_alerts row is created so ops can fix the source data.
 */
const REQUIRED_FIELDS_BY_TYPE: Record<string, string[]> = {
  welcome_letter:              ["client_name", "account_number"],
  address_change:              ["client_name", "account_number", "old_address", "new_address", "effective_date"],
  payment_method_change:       ["client_name", "account_number", "new_method"],
  service_certificate:         ["client_name", "account_number", "service_name"],
  suspension_notice:           ["client_name", "account_number", "suspension_date", "reason"],
  cancellation_confirmation:   ["client_name", "account_number", "service_name", "effective_date"],
  credit_note:                 ["client_name", "account_number", "description", "amount"],
  reactivation_notice:         ["client_name", "account_number", "service_name", "reactivation_date"],
  chargeback_notice:           ["client_name", "account_number", "amount", "chargeback_date"],
  final_refund_receipt:        ["client_name", "account_number", "amount", "refund_date"],
  delivery_slip:               ["client_name", "tracking_number"],
  return_instructions:         ["client_name", "rma_number"],
  installation_report:         ["client_name", "account_number", "service_address", "completion_date"],
  activation_confirmation:     ["client_name", "account_number", "service_name", "activation_date"],
  contract_amendment:          ["client_name", "account_number", "amendment_summary", "effective_date"],
  formal_demand:               ["client_name", "account_number", "amount", "due_by"],
  collections_transfer:        ["client_name", "account_number", "amount"],
  complaint_acknowledgment:    ["client_name", "complaint_number"],
  preauthorization_confirmation: ["client_name", "account_number", "amount", "expiry_date"],
};

/**
 * Validate a payload against its document type's required fields. When
 * fields are missing, raise a billing_system_alerts row (fire-and-forget)
 * so operations can see and fix bad enqueues — but don't block rendering.
 */
function validatePayload(docType: string, payload: Record<string, unknown>): {
  ok: boolean;
  missing: string[];
} {
  const required = REQUIRED_FIELDS_BY_TYPE[docType];
  if (!required || required.length === 0) return { ok: true, missing: [] };

  const missing = checkRequiredFields(payload as Record<string, unknown>, required);
  if (missing.length === 0) return { ok: true, missing: [] };

  // Fire-and-forget alert. We use supabase.from() directly to keep this
  // file dependency-light; no top-level await needed.
  void supabase.from("billing_system_alerts").insert({
    alert_type: "pdf_payload_incomplete",
    entity_type: "pending_document_jobs",
    entity_reference: docType,
    details: {
      doc_type: docType,
      missing_fields: missing,
      payload_keys: Object.keys(payload),
      note: "PDF rendered with fallback placeholders. Fix source data and regenerate.",
    },
  }).then(() => undefined, () => undefined);

  return { ok: false, missing: missing as string[] };
}

export type AutoDocType =
  | "welcome_letter"
  | "address_change"
  | "payment_method_change"
  | "service_certificate"
  | "suspension_notice"
  | "cancellation_confirmation"
  | "chargeback_notice"
  | "final_refund_receipt"
  | "delivery_slip"
  | "return_instructions"
  | "installation_report"
  | "activation_confirmation"
  | "contract_amendment"
  | "formal_demand"
  | "collections_transfer"
  | "complaint_acknowledgment"
  | "preauthorization_confirmation"
  | "credit_note"
  | "reactivation_notice";

export interface DispatchResult {
  blob: Blob;
  filename: string;
  docNumber?: string;
  fileSizeBytes: number;
}

function pdfResultToBlob(
  result: { success: boolean; doc?: any; error?: string; pdfData?: string },
  filename: string,
  docNumber?: string,
): DispatchResult {
  if (!result.success || !result.doc) {
    throw new Error(result.error || "PDF generation failed");
  }
  const blob: Blob = result.doc.output("blob");
  return {
    blob,
    filename,
    docNumber,
    fileSizeBytes: blob.size,
  };
}

/**
 * Generate a PDF from a queued job's payload. The payload SHAPE must match
 * the corresponding template's `*Data` interface (validated at enqueue time).
 */
export function dispatchAutoDocument(
  docType: AutoDocType,
  payload: Record<string, any>,
): DispatchResult {
  const safePayload = payload || {};

  // Validate required fields. If anything is missing, we log a system alert
  // but still render the PDF — the customer receives the document with
  // "—" / "Non fourni" placeholders rather than crashing.
  const validation = validatePayload(docType, safePayload);
  if (!validation.ok) {
    console.warn(
      `[PDF] ${docType} rendered with missing fields:`,
      validation.missing,
    );
  }

  switch (docType) {
    case "welcome_letter": {
      const result = generateWelcomeLetterPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Lettre_Bienvenue_${safePayload.letter_number || "DOC"}.pdf`,
        safePayload.letter_number,
      );
    }
    case "address_change": {
      const result = generateAddressChangePDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Changement_Adresse_${safePayload.notice_number || "DOC"}.pdf`,
        safePayload.notice_number,
      );
    }
    case "payment_method_change": {
      const result = generatePaymentMethodChangePDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Changement_Paiement_${safePayload.notice_number || "DOC"}.pdf`,
        safePayload.notice_number,
      );
    }
    case "service_certificate": {
      const result = generateServiceCertificatePDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Attestation_Service_${safePayload.certificate_number || "DOC"}.pdf`,
        safePayload.certificate_number,
      );
    }
    case "suspension_notice": {
      const result = generateSuspensionNoticePDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Avis_Suspension_${safePayload.notice_number || "DOC"}.pdf`,
        safePayload.notice_number,
      );
    }
    case "cancellation_confirmation": {
      const result = generateCancellationConfirmationPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Confirmation_Annulation_${safePayload.confirmation_number || "DOC"}.pdf`,
        safePayload.confirmation_number,
      );
    }
    case "chargeback_notice": {
      const result = generateChargebackNoticePDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Avis_Chargeback_${safePayload.notice_number || "DOC"}.pdf`,
        safePayload.notice_number,
      );
    }
    case "final_refund_receipt": {
      const result = generateFinalRefundReceiptPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Recu_Remboursement_Final_${safePayload.receipt_number || "DOC"}.pdf`,
        safePayload.receipt_number,
      );
    }
    case "delivery_slip": {
      const result = generateDeliverySlipPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Bon_Livraison_${safePayload.slip_number || "DOC"}.pdf`,
        safePayload.slip_number,
      );
    }
    case "return_instructions": {
      const result = generateReturnInstructionsPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Instructions_Retour_${safePayload.instruction_number || "DOC"}.pdf`,
        safePayload.instruction_number,
      );
    }
    case "installation_report": {
      const result = generateInstallationReportPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Rapport_Installation_${safePayload.report_number || "DOC"}.pdf`,
        safePayload.report_number,
      );
    }
    case "activation_confirmation": {
      const result = generateActivationConfirmationPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Confirmation_Activation_${safePayload.confirmation_number || "DOC"}.pdf`,
        safePayload.confirmation_number,
      );
    }
    case "contract_amendment": {
      const result = generateContractAmendmentPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Avenant_Contrat_${safePayload.amendment_number || "DOC"}.pdf`,
        safePayload.amendment_number,
      );
    }
    case "formal_demand": {
      const result = generateFormalDemandPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Mise_en_Demeure_${safePayload.demand_number || "DOC"}.pdf`,
        safePayload.demand_number,
      );
    }
    case "collections_transfer": {
      const result = generateCollectionsTransferPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Transfert_Recouvrement_${safePayload.transfer_number || "DOC"}.pdf`,
        safePayload.transfer_number,
      );
    }
    case "complaint_acknowledgment": {
      const result = generateComplaintAcknowledgmentPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Accuse_Plainte_${safePayload.acknowledgment_number || "DOC"}.pdf`,
        safePayload.acknowledgment_number,
      );
    }
    case "preauthorization_confirmation": {
      const result = generatePreauthorizationConfirmationPDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Confirmation_Preautorisation_${safePayload.confirmation_number || "DOC"}.pdf`,
        safePayload.confirmation_number,
      );
    }
    case "credit_note": {
      const result = generateCreditNotePDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Note_Credit_${safePayload.credit_note_number || safePayload.credit_number || "DOC"}.pdf`,
        safePayload.credit_note_number || safePayload.credit_number,
      );
    }
    case "reactivation_notice": {
      const result = generateReactivationNoticePDF(safePayload as any);
      return pdfResultToBlob(
        result,
        `Avis_Reactivation_${safePayload.notice_number || "DOC"}.pdf`,
        safePayload.notice_number,
      );
    }
    default: {
      throw new Error(`Unknown doc_type: ${docType}`);
    }
  }
}

/** French label for UI display in /portal/documents. */
export const DOC_TYPE_LABELS: Record<AutoDocType, string> = {
  welcome_letter: "Lettre de bienvenue",
  address_change: "Changement d'adresse",
  payment_method_change: "Changement de mode de paiement",
  service_certificate: "Attestation de service",
  suspension_notice: "Avis de suspension",
  cancellation_confirmation: "Confirmation d'annulation",
  chargeback_notice: "Avis de chargeback",
  final_refund_receipt: "Reçu de remboursement final",
  delivery_slip: "Bon de livraison",
  return_instructions: "Instructions de retour",
  installation_report: "Rapport d'installation",
  activation_confirmation: "Confirmation d'activation",
  contract_amendment: "Avenant au contrat",
  formal_demand: "Avis final de régularisation",
  collections_transfer: "Transfert au recouvrement",
  complaint_acknowledgment: "Accusé de réception de plainte",
  preauthorization_confirmation: "Confirmation de préautorisation",
  credit_note: "Note de crédit",
  reactivation_notice: "Avis de réactivation",
};
