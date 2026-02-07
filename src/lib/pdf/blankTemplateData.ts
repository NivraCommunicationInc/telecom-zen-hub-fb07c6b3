/**
 * Données « gabarit » (vierges) pour générer les PDFs sans informations réelles.
 * Objectif: permettre l’envoi des templates en pièces jointes sans données client/forfait/taxes.
 */

import type { InvoiceDataV2, OrderSummaryData } from "./types";
import type { ContractData } from "./contractTemplate";
import {
  generateAccountNumber,
  generateContractNumber,
  generateInvoiceNumber,
  generateOrderNumber,
} from "@/lib/secureIdGenerator";

const isoDate = (d: Date) => d.toISOString().split("T")[0];

export const createBlankInvoiceDataV2 = (
  invoiceType: "MONTHLY" | "ONETIME"
): InvoiceDataV2 => {
  const today = new Date();
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return {
    invoice_type: invoiceType,
    invoice_number: generateInvoiceNumber(),
    invoice_date: isoDate(today),
    due_date: isoDate(today),
    account_number: generateAccountNumber(),
    billing_period_start: invoiceType === "MONTHLY" ? isoDate(today) : undefined,
    billing_period_end: invoiceType === "MONTHLY" ? isoDate(in30) : undefined,
    currency: "CAD",
    status: "Issued",

    // Placeholders non-réels
    customer: {
      full_name: "GABARIT (VIERGE)",
      email: "template@example.invalid",
      phone: "",
      address_line1: "",
      city: "",
      province: "QC",
      postal_code: "",
    },

    // Une ligne vide pour afficher la structure du tableau
    items: [
      {
        category: invoiceType === "MONTHLY" ? "Internet" : "Equipment",
        description: "________________",
        period: invoiceType === "MONTHLY" ? "________________" : undefined,
        qty: 1,
        unit_price: 0,
        amount: 0,
        is_recurring: invoiceType === "MONTHLY",
      },
    ],

    discounts: [],

    // Totaux/taxes à zéro (aucune donnée réelle)
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
  const today = new Date();

  return {
    order_number: generateOrderNumber(),
    order_date: isoDate(today),
    account_number: generateAccountNumber(),

    // Placeholders non-réels
    client_name: "GABARIT (VIERGE)",
    client_email: "template@example.invalid",
    client_phone: "",
    service_address: "",
    billing_address: "",

    // Une ligne vide pour afficher la structure
    services: [
      {
        service_type: "Internet",
        service_description: "________________",
        service_period: "________________",
        service_price: 0,
        service_promo: null,
        service_total: 0,
      },
    ],
    items: [
      {
        item_name: "________________",
        item_description: "",
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
  const today = new Date();

  return {
    contract_number: generateContractNumber(),
    contract_date: isoDate(today),
    contract_version: "GABARIT",

    // Placeholders non-réels
    client_name: "GABARIT (VIERGE)",
    client_email: "template@example.invalid",
    client_phone: "",
    client_dob: "",
    service_address: "",
    billing_address: "",
    account_number: generateAccountNumber(),

    order_number: generateOrderNumber(),
    order_date: isoDate(today),

    // Lignes vides pour afficher la structure
    services: [
      {
        service_type: "Internet",
        service_description: "________________",
        service_period: "/mois",
        service_price: 0,
        service_promo: null,
        service_total: 0,
      },
    ],
    equipment: [
      {
        item_name: "________________",
        item_description: "",
        qty: 1,
        unit_price: 0,
        line_total: 0,
        serial_number: null,
      },
    ],
    one_time_fees: [{ label: "________________", amount: 0 }],

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
