/**
 * Server-side Auto Document Dispatcher (Deno).
 * Mirror of src/lib/pdf/autoDocumentDispatcher.ts.
 * Returns Uint8Array bytes from the PDF blob produced by jsPDF.
 *
 * Also normalizes/enriches the raw event payload coming from DB triggers
 * so each template receives the exact shape it expects (defensive defaults).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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

// --------------------------------------------------------------------------
// Payload helpers
// --------------------------------------------------------------------------

const nowIso = () => new Date().toISOString();

function pickClientName(p: Record<string, any>): string {
  const candidates = [
    p.client_name,
    p.full_name,
    [p.first_name, p.last_name].filter(Boolean).join(" "),
    p.name,
    p.email,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "Client Nivra";
}

function pickAddress(p: Record<string, any>) {
  const a = p.service_address || p.billing_address || p.address || {};
  return {
    street: a.street || p.address_line1 || "",
    city: a.city || p.city || "",
    province: a.province || p.province || "QC",
    postal_code: a.postal_code || p.postal_code || "",
  };
}

/** Normalize payload and inject the fields each template expects. */
function normalizePayload(
  docType: AutoDocType,
  raw: Record<string, any>,
): Record<string, any> {
  const p = { ...(raw || {}) };
  const clientName = pickClientName(p);
  const addr = pickAddress(p);

  // Common fields that nearly every template uses
  const base = {
    ...p,
    client_name: clientName,
    client_email: p.client_email || p.email || "",
    client_phone: p.client_phone || p.phone || "",
    client_address: p.client_address || addr.street,
    client_city: p.client_city || addr.city,
    client_province: p.client_province || addr.province,
    client_postal: p.client_postal || addr.postal_code,
    account_number: p.account_number || "—",
    issue_date: p.issue_date || nowIso(),
  };

  switch (docType) {
    case "welcome_letter":
      return {
        ...base,
        letter_number: p.letter_number || `BVN-${Date.now()}`,
        service_name: p.service_name || p.plan_name || "Service Nivra",
        activation_date: p.activation_date || p.created_at || nowIso(),
        monthly_amount: Number(p.monthly_amount ?? p.unit_price ?? 0),
        next_billing_date: p.next_billing_date || null,
        portal_url: p.portal_url || "https://nivra-telecom.ca/portal",
      };

    case "contract_amendment": {
      // Build a sensible "changes" array if trigger didn't provide one
      let changes: Array<{ field: string; old_value: string; new_value: string }> =
        Array.isArray(p.changes) ? p.changes : [];
      if (!changes.length) {
        if (p.change_type === "service_added" || p.service_name) {
          changes = [{
            field: "Service ajouté",
            old_value: "—",
            new_value: String(p.service_name || p.service_code || "Nouveau service"),
          }];
          if (p.unit_price !== undefined && p.unit_price !== null) {
            changes.push({
              field: "Tarif mensuel",
              old_value: "—",
              new_value: `${Number(p.unit_price).toFixed(2)} $`,
            });
          }
        } else if (p.change_type === "service_removed") {
          changes = [{
            field: "Service retiré",
            old_value: String(p.service_name || p.service_code || "Service"),
            new_value: "—",
          }];
        } else {
          changes = [{
            field: "Modification",
            old_value: "—",
            new_value: String(p.change_type || "Mise à jour du contrat"),
          }];
        }
      }
      // Sanitize each row
      changes = changes.map((c) => ({
        field: String(c?.field ?? "—"),
        old_value: String(c?.old_value ?? "—"),
        new_value: String(c?.new_value ?? "—"),
      }));
      return {
        ...base,
        amendment_number: p.amendment_number || `AMD-${Date.now()}`,
        original_contract_number: p.original_contract_number || base.account_number,
        original_contract_date: p.original_contract_date || p.account_created_at || nowIso(),
        effective_date: p.effective_date || nowIso(),
        changes,
        reason: p.reason || (p.change_type ? `Modification : ${p.change_type}` : undefined),
        new_monthly_amount: p.new_monthly_amount,
        notes: p.notes,
      };
    }

    case "address_change":
      return {
        ...base,
        notice_number: p.notice_number || `ADR-${Date.now()}`,
        old_address: p.old_address || "—",
        new_address: p.new_address || `${addr.street}, ${addr.city} ${addr.province} ${addr.postal_code}`,
        effective_date: p.effective_date || nowIso(),
      };

    case "payment_method_change":
      return {
        ...base,
        notice_number: p.notice_number || `PAY-${Date.now()}`,
        old_method: p.old_method || "—",
        new_method: p.new_method || "Nouveau moyen de paiement",
        effective_date: p.effective_date || nowIso(),
      };

    case "service_certificate":
      return {
        ...base,
        certificate_number: p.certificate_number || `CRT-${Date.now()}`,
        service_name: p.service_name || "Service Nivra",
        active_since: p.active_since || p.activation_date || nowIso(),
      };

    case "suspension_notice":
      return {
        ...base,
        notice_number: p.notice_number || `SUS-${Date.now()}`,
        suspension_date: p.suspension_date || nowIso(),
        reason: p.reason || "Solde impayé",
        amount_due: Number(p.amount_due ?? 0),
      };

    case "cancellation_confirmation":
      return {
        ...base,
        confirmation_number: p.confirmation_number || `CAN-${Date.now()}`,
        cancellation_date: p.cancellation_date || nowIso(),
        reason: p.reason || "—",
      };

    case "chargeback_notice":
      return {
        ...base,
        notice_number: p.notice_number || `CHB-${Date.now()}`,
        chargeback_opened_at: p.chargeback_opened_at || nowIso(),
        amount: Number(p.amount ?? 0),
      };

    case "final_refund_receipt":
      return {
        ...base,
        receipt_number: p.receipt_number || `REF-${Date.now()}`,
        refund_amount: Number(p.refund_amount ?? 0),
        refund_date: p.refund_date || nowIso(),
        method: p.method || "manual",
        reference: p.reference || "—",
      };

    case "delivery_slip":
      return {
        ...base,
        slip_number: p.slip_number || `BL-${Date.now()}`,
        order_number: p.order_number || "—",
        carrier: p.carrier || "—",
        tracking_number: p.tracking_number || "—",
        shipped_at: p.shipped_at || nowIso(),
        equipment_details: p.equipment_details || [],
      };

    case "return_instructions":
      return {
        ...base,
        instruction_number: p.instruction_number || `RET-${Date.now()}`,
        order_number: p.order_number || "—",
        items: Array.isArray(p.items) ? p.items : [],
      };

    case "installation_report":
      return {
        ...base,
        report_number: p.report_number || `INS-${Date.now()}`,
        installation_date: p.installation_date || nowIso(),
        technician_name: p.technician_name || "—",
        equipment_installed: p.equipment_installed || [],
      };

    case "activation_confirmation":
      return {
        ...base,
        confirmation_number: p.confirmation_number || `ACT-${Date.now()}`,
        activation_date: p.activation_date || nowIso(),
        service_name: p.service_name || "Service Nivra",
      };

    case "formal_demand":
      return {
        ...base,
        demand_number: p.demand_number || `MED-${Date.now()}`,
        demand_date: p.demand_date || nowIso(),
        amount_due: Number(p.amount_due ?? 0),
      };

    case "collections_transfer":
      return {
        ...base,
        transfer_number: p.transfer_number || `COL-${Date.now()}`,
        transfer_date: p.transfer_date || nowIso(),
        amount: Number(p.amount ?? 0),
      };

    case "complaint_acknowledgment":
      return {
        ...base,
        acknowledgment_number: p.acknowledgment_number || `PLT-${Date.now()}`,
        complaint_date: p.complaint_date || nowIso(),
        complaint_subject: p.complaint_subject || "—",
      };

    case "preauthorization_confirmation":
      return {
        ...base,
        confirmation_number: p.confirmation_number || `PRE-${Date.now()}`,
        authorized_amount: Number(p.authorized_amount ?? 0),
        authorized_at: p.authorized_at || nowIso(),
        method: p.method || "card",
      };

    default:
      return base;
  }
}

// --------------------------------------------------------------------------
// Result extraction (templates return { blob, filename })
// --------------------------------------------------------------------------

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

async function toResult(
  result: { success: boolean; blob?: Blob; filename?: string; error?: string },
  fallbackFilename: string,
  docNumber?: string,
): Promise<DispatchResult> {
  if (!result.success || !result.blob) {
    throw new Error(result.error || "PDF generation failed");
  }
  const bytes = await blobToBytes(result.blob);
  return {
    bytes,
    filename: result.filename || fallbackFilename,
    docNumber,
    fileSizeBytes: bytes.byteLength,
  };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export async function dispatchAutoDocument(
  docType: AutoDocType,
  payload: Record<string, any>,
): Promise<DispatchResult> {
  const p = normalizePayload(docType, payload || {});
  switch (docType) {
    case "welcome_letter":
      return toResult(generateWelcomeLetterPDF(p as any), `Lettre_Bienvenue_${p.letter_number}.pdf`, p.letter_number);
    case "address_change":
      return toResult(generateAddressChangePDF(p as any), `Changement_Adresse_${p.notice_number}.pdf`, p.notice_number);
    case "payment_method_change":
      return toResult(generatePaymentMethodChangePDF(p as any), `Changement_Paiement_${p.notice_number}.pdf`, p.notice_number);
    case "service_certificate":
      return toResult(generateServiceCertificatePDF(p as any), `Attestation_Service_${p.certificate_number}.pdf`, p.certificate_number);
    case "suspension_notice":
      return toResult(generateSuspensionNoticePDF(p as any), `Avis_Suspension_${p.notice_number}.pdf`, p.notice_number);
    case "cancellation_confirmation":
      return toResult(generateCancellationConfirmationPDF(p as any), `Confirmation_Annulation_${p.confirmation_number}.pdf`, p.confirmation_number);
    case "chargeback_notice":
      return toResult(generateChargebackNoticePDF(p as any), `Avis_Chargeback_${p.notice_number}.pdf`, p.notice_number);
    case "final_refund_receipt":
      return toResult(generateFinalRefundReceiptPDF(p as any), `Recu_Remboursement_Final_${p.receipt_number}.pdf`, p.receipt_number);
    case "delivery_slip":
      return toResult(generateDeliverySlipPDF(p as any), `Bon_Livraison_${p.slip_number}.pdf`, p.slip_number);
    case "return_instructions":
      return toResult(generateReturnInstructionsPDF(p as any), `Instructions_Retour_${p.instruction_number}.pdf`, p.instruction_number);
    case "installation_report":
      return toResult(generateInstallationReportPDF(p as any), `Rapport_Installation_${p.report_number}.pdf`, p.report_number);
    case "activation_confirmation":
      return toResult(generateActivationConfirmationPDF(p as any), `Confirmation_Activation_${p.confirmation_number}.pdf`, p.confirmation_number);
    case "contract_amendment":
      return toResult(generateContractAmendmentPDF(p as any), `Avenant_Contrat_${p.amendment_number}.pdf`, p.amendment_number);
    case "formal_demand":
      return toResult(generateFormalDemandPDF(p as any), `Mise_en_Demeure_${p.demand_number}.pdf`, p.demand_number);
    case "collections_transfer":
      return toResult(generateCollectionsTransferPDF(p as any), `Transfert_Recouvrement_${p.transfer_number}.pdf`, p.transfer_number);
    case "complaint_acknowledgment":
      return toResult(generateComplaintAcknowledgmentPDF(p as any), `Accuse_Plainte_${p.acknowledgment_number}.pdf`, p.acknowledgment_number);
    case "preauthorization_confirmation":
      return toResult(generatePreauthorizationConfirmationPDF(p as any), `Confirmation_Preautorisation_${p.confirmation_number}.pdf`, p.confirmation_number);
    default:
      throw new Error(`Unknown doc_type: ${docType}`);
  }
}
