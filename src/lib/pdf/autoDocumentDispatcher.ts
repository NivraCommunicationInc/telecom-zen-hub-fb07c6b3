/**
 * Auto Document Dispatcher
 * ------------------------
 * Maps `doc_type` (string from pending_document_jobs) to the correct
 * jsPDF template generator. Used exclusively by the browser-side worker
 * (useDocumentJobWorker) to materialize PDFs from queued events.
 *
 * Contract: every entry returns `{ blob, filename, docNumber }` or throws.
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
  | "preauthorization_confirmation";

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
  formal_demand: "Mise en demeure",
  collections_transfer: "Transfert au recouvrement",
  complaint_acknowledgment: "Accusé de réception de plainte",
  preauthorization_confirmation: "Confirmation de préautorisation",
};
