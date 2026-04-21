/**
 * Server-side Auto Document Dispatcher (Deno).
 * Mirror of src/lib/pdf/autoDocumentDispatcher.ts but returns Uint8Array
 * (no Blob in Deno) and runs in the edge function process-document-jobs.
 */
import { generateWelcomeLetterPDF } from "./welcomeLetterTemplate.ts";
import { generateAddressChangePDF } from "./addressChangeTemplate.ts";
import { generatePaymentMethodChangePDF } from "./paymentMethodChangeTemplate.ts";
import { generateServiceCertificatePDF } from "./serviceCertificateTemplate.ts";
import { generateSuspensionNoticePDF } from "./suspensionNoticeTemplate.ts";
import { generateCancellationConfirmationPDF } from "./cancellationConfirmationTemplate.ts";
import { generateChargebackNoticePDF } from "./chargebackNoticeTemplate.ts";
import { generateFinalRefundReceiptPDF } from "./finalRefundReceiptTemplate.ts";
import { generateDeliverySlipPDF } from "./deliverySlipTemplate.ts";
import { generateReturnInstructionsPDF } from "./returnInstructionsTemplate.ts";
import { generateInstallationReportPDF } from "./installationReportTemplate.ts";
import { generateActivationConfirmationPDF } from "./activationConfirmationTemplate.ts";
import { generateContractAmendmentPDF } from "./contractAmendmentTemplate.ts";
import { generateFormalDemandPDF } from "./formalDemandTemplate.ts";
import { generateCollectionsTransferPDF } from "./collectionsTransferTemplate.ts";
import { generateComplaintAcknowledgmentPDF } from "./complaintAcknowledgmentTemplate.ts";
import { generatePreauthorizationConfirmationPDF } from "./preauthorizationConfirmationTemplate.ts";

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
  bytes: Uint8Array;
  filename: string;
  docNumber?: string;
  fileSizeBytes: number;
}

function toResult(
  result: { success: boolean; doc?: any; error?: string },
  filename: string,
  docNumber?: string,
): DispatchResult {
  if (!result.success || !result.doc) {
    throw new Error(result.error || "PDF generation failed");
  }
  // jsPDF in Deno: output("arraybuffer") returns ArrayBuffer
  const ab: ArrayBuffer = result.doc.output("arraybuffer");
  const bytes = new Uint8Array(ab);
  return { bytes, filename, docNumber, fileSizeBytes: bytes.byteLength };
}

export function dispatchAutoDocument(
  docType: AutoDocType,
  payload: Record<string, any>,
): DispatchResult {
  const p = payload || {};
  switch (docType) {
    case "welcome_letter":
      return toResult(generateWelcomeLetterPDF(p as any), `Lettre_Bienvenue_${p.letter_number || "DOC"}.pdf`, p.letter_number);
    case "address_change":
      return toResult(generateAddressChangePDF(p as any), `Changement_Adresse_${p.notice_number || "DOC"}.pdf`, p.notice_number);
    case "payment_method_change":
      return toResult(generatePaymentMethodChangePDF(p as any), `Changement_Paiement_${p.notice_number || "DOC"}.pdf`, p.notice_number);
    case "service_certificate":
      return toResult(generateServiceCertificatePDF(p as any), `Attestation_Service_${p.certificate_number || "DOC"}.pdf`, p.certificate_number);
    case "suspension_notice":
      return toResult(generateSuspensionNoticePDF(p as any), `Avis_Suspension_${p.notice_number || "DOC"}.pdf`, p.notice_number);
    case "cancellation_confirmation":
      return toResult(generateCancellationConfirmationPDF(p as any), `Confirmation_Annulation_${p.confirmation_number || "DOC"}.pdf`, p.confirmation_number);
    case "chargeback_notice":
      return toResult(generateChargebackNoticePDF(p as any), `Avis_Chargeback_${p.notice_number || "DOC"}.pdf`, p.notice_number);
    case "final_refund_receipt":
      return toResult(generateFinalRefundReceiptPDF(p as any), `Recu_Remboursement_Final_${p.receipt_number || "DOC"}.pdf`, p.receipt_number);
    case "delivery_slip":
      return toResult(generateDeliverySlipPDF(p as any), `Bon_Livraison_${p.slip_number || "DOC"}.pdf`, p.slip_number);
    case "return_instructions":
      return toResult(generateReturnInstructionsPDF(p as any), `Instructions_Retour_${p.instruction_number || "DOC"}.pdf`, p.instruction_number);
    case "installation_report":
      return toResult(generateInstallationReportPDF(p as any), `Rapport_Installation_${p.report_number || "DOC"}.pdf`, p.report_number);
    case "activation_confirmation":
      return toResult(generateActivationConfirmationPDF(p as any), `Confirmation_Activation_${p.confirmation_number || "DOC"}.pdf`, p.confirmation_number);
    case "contract_amendment":
      return toResult(generateContractAmendmentPDF(p as any), `Avenant_Contrat_${p.amendment_number || "DOC"}.pdf`, p.amendment_number);
    case "formal_demand":
      return toResult(generateFormalDemandPDF(p as any), `Mise_en_Demeure_${p.demand_number || "DOC"}.pdf`, p.demand_number);
    case "collections_transfer":
      return toResult(generateCollectionsTransferPDF(p as any), `Transfert_Recouvrement_${p.transfer_number || "DOC"}.pdf`, p.transfer_number);
    case "complaint_acknowledgment":
      return toResult(generateComplaintAcknowledgmentPDF(p as any), `Accuse_Plainte_${p.acknowledgment_number || "DOC"}.pdf`, p.acknowledgment_number);
    case "preauthorization_confirmation":
      return toResult(generatePreauthorizationConfirmationPDF(p as any), `Confirmation_Preautorisation_${p.confirmation_number || "DOC"}.pdf`, p.confirmation_number);
    default:
      throw new Error(`Unknown doc_type: ${docType}`);
  }
}
