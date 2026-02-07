/**
 * Données « gabarit » (vierges) pour générer les PDFs sans informations réelles.
 * Objectif: permettre l'envoi des templates en pièces jointes sans données client/forfait/taxes.
 * 
 * PLACEHOLDERS NEUTRES:
 * - CLIENT_NOM, CLIENT_EMAIL, CLIENT_TEL, CLIENT_ADRESSE
 * - FORFAIT_NOM, SERVICE_TYPE
 * - #COMMANDE, #FACTURE, #CONTRAT, #COMPTE
 * - DATE_EMISSION, DATE_ECHEANCE, PERIODE
 */

import type { InvoiceDataV2, OrderSummaryData } from "./types";
import type { ContractData } from "./contractTemplate";

export const TEMPLATE_WATERMARK = "DOCUMENT MODÈLE — TEMPLATE VIERGE";

export const createBlankInvoiceDataV2 = (
  invoiceType: "MONTHLY" | "ONETIME"
): InvoiceDataV2 => {
  return {
    invoice_type: invoiceType,
    invoice_number: "#FACTURE",
    invoice_date: "DATE_EMISSION",
    due_date: "DATE_ECHEANCE",
    account_number: "#COMPTE",
    billing_period_start: invoiceType === "MONTHLY" ? "DEBUT_PERIODE" : undefined,
    billing_period_end: invoiceType === "MONTHLY" ? "FIN_PERIODE" : undefined,
    currency: "CAD",
    status: "Issued",

    customer: {
      full_name: "CLIENT_NOM",
      email: "CLIENT_EMAIL",
      phone: "CLIENT_TEL",
      address_line1: "CLIENT_ADRESSE",
      city: "VILLE",
      province: "QC",
      postal_code: "CODE_POSTAL",
    },

    items: [
      {
        category: invoiceType === "MONTHLY" ? "Internet" : "Equipment",
        description: "FORFAIT_NOM",
        period: invoiceType === "MONTHLY" ? "PERIODE" : undefined,
        qty: 1,
        unit_price: 0,
        amount: 0,
        is_recurring: invoiceType === "MONTHLY",
      },
    ],

    discounts: [],

    subtotal: 0,
    taxes: {
      gst_rate: 0,
      gst_amount: 0,
      qst_rate: 0,
      qst_amount: 0,
    },
    total: 0,
    balance_due: 0,

    payments: [],
    payments_total: 0,
  };
};

export const createBlankOrderSummaryData = (): OrderSummaryData => {
  return {
    order_number: "#COMMANDE",
    order_date: "DATE_EMISSION",
    account_number: "#COMPTE",

    client_name: "CLIENT_NOM",
    client_email: "CLIENT_EMAIL",
    client_phone: "CLIENT_TEL",
    service_address: "CLIENT_ADRESSE",
    billing_address: "ADRESSE_FACTURATION",

    services: [
      {
        service_type: "SERVICE_TYPE",
        service_description: "FORFAIT_NOM",
        service_period: "PERIODE",
        service_price: 0,
        service_promo: null,
        service_total: 0,
      },
    ],
    items: [
      {
        item_name: "EQUIPEMENT_NOM",
        item_description: "EQUIPEMENT_DESC",
        qty: 1,
        unit_price: 0,
        line_total: 0,
        serial_number: null,
      },
    ],

    subtotal_services: 0,
    subtotal_equipment: 0,
    total_discounts: 0,
    subtotal_before_tax: 0,
    tax_gst: 0,
    tax_qst: 0,
    total_due: 0,

    payment_status: "pending",
    payment_method: null,
    payment_reference: null,
    paid_at: null,

    promo_code: null,
    promo_description: null,
    estimated_activation: null,
    first_billing_date: null,
  };
};

export const createBlankContractData = (): ContractData => {
  return {
    contract_number: "#CONTRAT",
    contract_date: "DATE_EMISSION",
    contract_version: "V2.5",

    client_name: "CLIENT_NOM",
    client_email: "CLIENT_EMAIL",
    client_phone: "CLIENT_TEL",
    client_dob: "DATE_NAISSANCE",
    service_address: "CLIENT_ADRESSE",
    billing_address: "ADRESSE_FACTURATION",
    account_number: "#COMPTE",

    order_number: "#COMMANDE",
    order_date: "DATE_COMMANDE",

    services: [
      {
        service_type: "SERVICE_TYPE",
        service_description: "FORFAIT_NOM",
        service_period: "/mois",
        service_price: 0,
        service_promo: null,
        service_total: 0,
      },
    ],
    equipment: [
      {
        item_name: "EQUIPEMENT_NOM",
        item_description: "EQUIPEMENT_DESC",
        qty: 1,
        unit_price: 0,
        line_total: 0,
        serial_number: null,
      },
    ],
    one_time_fees: [{ label: "FRAIS_UNIQUES", amount: 0 }],

    subtotal_monthly: 0,
    subtotal_equipment: 0,
    subtotal_one_time_fees: 0,
    total_discounts: 0,
    subtotal_before_tax: 0,
    tax_gst: 0,
    tax_qst: 0,
    total_due_today: 0,
    monthly_recurring: 0,

    installation_type: "standard",

    signature_name: "",
    signature_ip: "",
    is_signed: false,
  };
};
