/**
 * QA Lots 2-5 — Generate 17 PDFs with Table Lakay test data.
 * Outputs to /mnt/documents/qa-lots-2-5/
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { Buffer } from "node:buffer";

// Reuse jsPDF via dynamic imports of project modules through tsx
import { generateWelcomeLetterPDF } from "../src/lib/pdf/welcomeLetterTemplate";
import { generateAddressChangePDF } from "../src/lib/pdf/addressChangeTemplate";
import { generatePaymentMethodChangePDF } from "../src/lib/pdf/paymentMethodChangeTemplate";
import { generateServiceCertificatePDF } from "../src/lib/pdf/serviceCertificateTemplate";
import { generateSuspensionNoticePDF } from "../src/lib/pdf/suspensionNoticeTemplate";
import { generateCancellationConfirmationPDF } from "../src/lib/pdf/cancellationConfirmationTemplate";
import { generateChargebackNoticePDF } from "../src/lib/pdf/chargebackNoticeTemplate";
import { generateFinalRefundReceiptPDF } from "../src/lib/pdf/finalRefundReceiptTemplate";
import { generateDeliverySlipPDF } from "../src/lib/pdf/deliverySlipTemplate";
import { generateReturnInstructionsPDF } from "../src/lib/pdf/returnInstructionsTemplate";
import { generateInstallationReportPDF } from "../src/lib/pdf/installationReportTemplate";
import { generateActivationConfirmationPDF } from "../src/lib/pdf/activationConfirmationTemplate";
import { generateContractAmendmentPDF } from "../src/lib/pdf/contractAmendmentTemplate";
import { generateFormalDemandPDF } from "../src/lib/pdf/formalDemandTemplate";
import { generateCollectionsTransferPDF } from "../src/lib/pdf/collectionsTransferTemplate";
import { generateComplaintAcknowledgmentPDF } from "../src/lib/pdf/complaintAcknowledgmentTemplate";
import { generatePreauthorizationConfirmationPDF } from "../src/lib/pdf/preauthorizationConfirmationTemplate";

const OUT = "/mnt/documents/qa-lots-2-5";
mkdirSync(OUT, { recursive: true });

// Table Lakay test client
const CLIENT = {
  client_name: "Table Lakay",
  client_email: "tablelakay@gmail.com",
  client_phone: "(514) 555-0142",
  client_address: "1234 Rue Saint-Laurent",
  client_city: "Montréal",
  client_province: "QC",
  client_postal: "H2X 2T5",
  account_number: "NIV-2026-0042",
};

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}

async function save(name: string, res: { success: boolean; blob?: Blob; filename?: string; error?: string }) {
  if (!res.success || !res.blob) { console.error(`✗ ${name}:`, res.error); return; }
  const buf = await blobToBuffer(res.blob);
  writeFileSync(`${OUT}/${name}`, buf);
  console.log(`✓ ${name} (${Math.round(buf.length / 1024)} KB)`);
}

async function main() {
  // LOT 2
  await save("21_Lettre_Bienvenue.pdf", generateWelcomeLetterPDF({
    letter_number: "BVN-2026-0001", issue_date: "2026-04-21",
    ...CLIENT,
    service_name: "Internet Fibre 1 Gbps", activation_date: "2026-04-15",
    monthly_amount: 89.99, next_billing_date: "2026-05-15",
    portal_url: "https://nivra-telecom.ca/portal",
  }));

  await save("22_Changement_Adresse.pdf", generateAddressChangePDF({
    notice_number: "ADR-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    old_address: "1234 Rue Saint-Laurent", old_city: "Montréal", old_province: "QC", old_postal: "H2X 2T5",
    new_address: "5678 Boulevard René-Lévesque", new_city: "Montréal", new_province: "QC", new_postal: "H3B 1A4",
    effective_date: "2026-05-01", service_continuity: "scheduled_interruption",
    notes: "Interruption prévue de 4h le matin du 1er mai pour bascule du service.",
  }));

  await save("23_Changement_Mode_Paiement.pdf", generatePaymentMethodChangePDF({
    notice_number: "PAY-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email, account_number: CLIENT.account_number,
    old_method: "Carte de crédit Visa ****4521",
    new_method: "PayPal — tablelakay@gmail.com",
    effective_date: "2026-04-21", autopay_enabled: true, next_billing_date: "2026-05-15",
  }));

  await save("24_Attestation_Service_Actif.pdf", generateServiceCertificatePDF({
    certificate_number: "ATT-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email, client_phone: CLIENT.client_phone,
    account_number: CLIENT.account_number,
    service_address: CLIENT.client_address, service_city: CLIENT.client_city,
    service_province: CLIENT.client_province, service_postal: CLIENT.client_postal,
    service_name: "Internet Fibre 1 Gbps", activation_date: "2026-04-15",
    status: "Actif", monthly_amount: 89.99, purpose: "Preuve d'adresse",
  }));

  // LOT 3
  await save("25_Avis_Suspension.pdf", generateSuspensionNoticePDF({
    notice_number: "SUS-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    service_name: "Internet Fibre 1 Gbps",
    reason: "Solde impayé depuis plus de 30 jours malgré 3 rappels.",
    suspension_date: "2026-04-21", amount_due: 195.43,
    invoice_numbers: ["INV-2026-0145", "INV-2026-0167"], reactivation_fee: 25.00,
  }));

  await save("26_Confirmation_Annulation.pdf", generateCancellationConfirmationPDF({
    confirmation_number: "ANN-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    service_name: "Internet Fibre 1 Gbps",
    cancellation_date: "2026-04-21", effective_date: "2026-05-15",
    reason: "Déménagement hors zone de service.", final_balance: -45.30,
    equipment_to_return: ["Borne WiFi Nivra (S/N: NV-WF-8821)", "1x Câble Ethernet Cat 6"],
    refund_pending: 45.30,
  }));

  await save("27_Avis_Chargeback.pdf", generateChargebackNoticePDF({
    notice_number: "CHB-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    invoice_number: "INV-2026-0145", invoice_date: "2026-03-15",
    invoice_amount: 103.46, chargeback_amount: 103.46, chargeback_date: "2026-04-18",
    bank_reference: "VISA-CB-2026041899", reason_code: "10.4 — Other Fraud",
    reactivation_fee: 25.00, total_due: 128.46, response_deadline: "2026-05-01",
  }));

  await save("28_Remboursement_Final.pdf", generateFinalRefundReceiptPDF({
    receipt_number: "REF-FIN-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email, account_number: CLIENT.account_number,
    refund_amount: 45.30, refund_method: "Virement Interac",
    reference_number: "INTERAC-78421-2026", processed_date: "2026-04-21",
    related_invoice: "INV-2026-0167",
    reason: "Crédit résiduel à la fermeture du compte suite à annulation.",
    account_closed: true,
  }));

  // LOT 4
  await save("29_Bon_Livraison.pdf", generateDeliverySlipPDF({
    slip_number: "BL-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    delivery_address: CLIENT.client_address, delivery_city: CLIENT.client_city,
    delivery_province: CLIENT.client_province, delivery_postal: CLIENT.client_postal,
    order_number: "ORD-2026-0089", carrier: "Postes Canada Xpresspost",
    tracking_number: "PC123456789CA", estimated_delivery: "2026-04-24",
    items: [
      { description: "Borne WiFi Nivra Pro 6E", serial_number: "NV-WF-8821", quantity: 1 },
      { description: "Terminal TV Nivra 4K", serial_number: "NV-TV-3344", quantity: 1 },
      { description: "Câble Ethernet Cat 6 — 3m", quantity: 2 },
    ],
  }));

  await save("30_Instructions_Retour.pdf", generateReturnInstructionsPDF({
    instruction_number: "RMA-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    return_deadline: "2026-05-15",
    return_address: "1799 Av. Pierre-Péladeau", return_city: "Laval", return_province: "QC", return_postal: "H7T 2Y5",
    items: [
      { description: "Borne WiFi Nivra Pro 6E", serial_number: "NV-WF-8821" },
      { description: "Terminal TV Nivra 4K", serial_number: "NV-TV-3344" },
    ],
    non_return_fee: 60.00, return_method: "Postes Canada — étiquette prépayée incluse dans le courriel",
    rma_number: "RMA-2026-0001",
  }));

  await save("31_Rapport_Installation.pdf", generateInstallationReportPDF({
    report_number: "RAP-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    service_address: CLIENT.client_address, service_city: CLIENT.client_city,
    service_province: CLIENT.client_province, service_postal: CLIENT.client_postal,
    technician_name: "Marc Lefebvre", technician_id: "TECH-042",
    appointment_date: "2026-04-15", start_time: "09:30", end_time: "11:15",
    service_installed: "Internet Fibre 1 Gbps + WiFi 6E mesh",
    equipment_installed: [
      { description: "Borne WiFi Nivra Pro 6E", serial_number: "NV-WF-8821" },
      { description: "ONT Fibre", serial_number: "ONT-7765" },
    ],
    outcome: "success",
    notes: "Installation complétée. Test de vitesse: 945 Mbps download / 920 Mbps upload. Client formé sur l'utilisation.",
    client_signature_required: true,
  }));

  await save("32_Confirmation_Activation.pdf", generateActivationConfirmationPDF({
    confirmation_number: "ACT-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    service_name: "Internet Fibre 1 Gbps", service_type: "internet",
    activation_date: "2026-04-15", internet_speed: "1 Gbps symétrique",
    monthly_amount: 89.99,
    first_billing_cycle: "15 avril 2026 — 14 mai 2026",
  }));

  // LOT 5
  await save("33_Avenant_Contrat.pdf", generateContractAmendmentPDF({
    amendment_number: "AVE-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email, account_number: CLIENT.account_number,
    original_contract_number: "CTR-2026-0042", original_contract_date: "2026-04-15",
    effective_date: "2026-05-01",
    changes: [
      { field: "Vitesse Internet", old_value: "1 Gbps", new_value: "1.5 Gbps" },
      { field: "Frais mensuels", old_value: "89,99 $", new_value: "104,99 $" },
      { field: "Forfait TV", old_value: "Non inclus", new_value: "Bouquet Découverte (40 chaînes)" },
    ],
    reason: "Mise à niveau demandée par le client.",
    new_monthly_amount: 104.99,
  }));

  await save("34_Mise_En_Demeure.pdf", generateFormalDemandPDF({
    demand_number: "MED-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, client_address: CLIENT.client_address,
    client_city: CLIENT.client_city, client_province: CLIENT.client_province, client_postal: CLIENT.client_postal,
    account_number: CLIENT.account_number, total_due: 412.78,
    invoices: [
      { invoice_number: "INV-2026-0145", invoice_date: "2026-01-15", amount: 103.46, days_overdue: 96 },
      { invoice_number: "INV-2026-0167", invoice_date: "2026-02-15", amount: 103.46, days_overdue: 65 },
      { invoice_number: "INV-2026-0189", invoice_date: "2026-03-15", amount: 103.46, days_overdue: 37 },
      { invoice_number: "INV-2026-0211", invoice_date: "2026-04-15", amount: 102.40, days_overdue: 6 },
    ],
    response_deadline: "2026-05-01", legal_basis: "Code civil du Québec, art. 1594",
  }));

  await save("35_Transfert_Recouvrement.pdf", generateCollectionsTransferPDF({
    notice_number: "REC-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    total_transferred: 437.78,
    collection_agency_name: "Agence de Recouvrement MRC Inc.",
    collection_agency_phone: "1-888-555-0199",
    collection_agency_email: "dossiers@mrc-recouvrement.ca",
    collection_agency_reference: "MRC-2026-NIV-0042",
    transfer_effective_date: "2026-04-21", credit_bureau_reported: true,
  }));

  await save("36_Accuse_Plainte.pdf", generateComplaintAcknowledgmentPDF({
    acknowledgment_number: "PLA-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email,
    client_phone: CLIENT.client_phone, account_number: CLIENT.account_number,
    complaint_received_date: "2026-04-20",
    complaint_summary: "Le client signale des coupures Internet répétées (4 incidents en 7 jours) malgré une installation récente. Demande compensation.",
    case_number: "CASE-2026-0089", assigned_agent: "Sophie Tremblay",
    expected_resolution_date: "2026-05-04",
    next_step: "Un technicien procédera à un diagnostic à distance dans les 48h. Si nécessaire, une visite sur place sera planifiée sans frais.",
  }));

  await save("37_Preautorisation.pdf", generatePreauthorizationConfirmationPDF({
    confirmation_number: "PRE-2026-0001", issue_date: "2026-04-21",
    client_name: CLIENT.client_name, client_email: CLIENT.client_email, account_number: CLIENT.account_number,
    authorized_amount: 150.00, payment_method: "Carte de crédit Visa ****4521",
    capture_deadline: "2026-04-28", related_order: "ORD-2026-0089",
    purpose: "Garantie d'équipement (Borne WiFi + Terminal TV)",
    notes: "Le montant sera capturé à la confirmation de la livraison ou libéré si la commande est annulée.",
  }));

  console.log("\n✓ All 17 PDFs generated.");
}

main().catch(e => { console.error(e); process.exit(1); });
