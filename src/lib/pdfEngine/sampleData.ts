/**
 * Sample data for PDF Engine testing
 * Provides 3 test scenarios: Mobile only, Internet+Install, TV Bundle
 */

import type { UnifiedDocumentData } from "./types";
import { getCompanyInfo } from "./adapters";

const baseClient = {
  fullName: "Jean-Pierre Tremblay",
  email: "jean.tremblay@email.ca",
  phone: "514-555-1234",
  accountNumber: "CLT-2026-0001",
  serviceAddress: "1234 Rue Principale",
  serviceCity: "Montréal",
  serviceProvince: "QC",
  servicePostalCode: "H2X 1A1",
};

const baseAgent = {
  name: "Marie Lavoie",
  email: "marie@nivratelecom.ca",
  role: "Conseillère",
};

// ============= SAMPLE 1: MOBILE ONLY =============
export const sampleMobileOnly: UnifiedDocumentData = {
  docType: "contract",
  metadata: {
    documentNumber: "CTR-2026-MOB-001",
    orderNumber: "ORD-2026-0001",
    date: new Date().toISOString(),
    effectiveDate: new Date().toISOString(),
    version: "v2026.01.02-Prepaid-01",
  },
  client: baseClient,
  company: getCompanyInfo(),
  agent: baseAgent,
  services: [
    {
      type: "Mobile",
      name: "Mobile 50$/30 jours",
      description: "50-55 GB 4G, appels illimites Canada",
      monthlyPrice: 50,
      quantity: 1,
      priceLabel: "/30 jours",
    },
  ],
  // NO TV summary for mobile-only
  tvSummary: undefined,
  equipment: [
    {
      name: "Carte SIM physique",
      quantity: 1,
      unitPrice: 25,
      warranty: "N/A",
    },
  ],
  oneTimeFees: [
    { label: "Frais d'activation", amount: 25 },
    { label: "Livraison standard Quebec", amount: 30 },
  ],
  discounts: [],
  // Billing calculation: taxable = 50 (service) + 80 (one-time: 25 SIM + 25 activation + 30 delivery) - 0 = 130
  // TPS = 130 * 0.05 = 6.50, TVQ = 130 * 0.09975 = 12.97
  // Total = 130 + 6.50 + 12.97 = 149.47
  billing: {
    subtotal: 50,
    oneTimeTotal: 80, // 25 SIM + 25 activation + 30 delivery
    discountTotal: 0,
    tps: 6.50,
    tvq: 12.97,
    total: 149.47,
  },
  payment: {
    status: "pending",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  isSigned: false,
};

// ============= SAMPLE 2: INTERNET + INSTALLATION =============
export const sampleInternetInstall: UnifiedDocumentData = {
  docType: "contract",
  metadata: {
    documentNumber: "CTR-2026-INT-002",
    orderNumber: "ORD-2026-0002",
    date: new Date().toISOString(),
    effectiveDate: new Date().toISOString(),
    version: "v2026.01.02-Prepaid-01",
  },
  client: baseClient,
  company: getCompanyInfo(),
  agent: baseAgent,
  services: [
    {
      type: "Internet",
      name: "Internet 500 Mbps",
      description: "Fibre optique, telechargement illimite",
      monthlyPrice: 60,
      quantity: 1,
      priceLabel: "/mois",
    },
  ],
  // NO TV summary for internet-only
  tvSummary: undefined,
  equipment: [
    {
      name: "Routeur Nivra Born WiFi",
      quantity: 1,
      unitPrice: 60,
      serial: "RTR-2026-00123",
      warranty: "1 an",
    },
  ],
  oneTimeFees: [
    { label: "Frais d'activation", amount: 25 },
    { label: "Installation professionnelle", amount: 75, description: "Technicien certifie" },
  ],
  discounts: [
    { label: "Rabais installation nouvelle inscription", amount: 25, type: "promo" },
    { label: "Rabais paiement preautorise", amount: 5, type: "preauth" },
  ],
  // Billing calculation: 
  // Recurring = 60 (Internet)
  // One-time = 60 (router) + 25 (activation) + 75 (install) = 160
  // Discounts = 25 + 5 = 30
  // Taxable = 60 + 160 - 30 = 190
  // TPS = 190 * 0.05 = 9.50, TVQ = 190 * 0.09975 = 18.95
  // Total = 190 + 9.50 + 18.95 = 218.45
  billing: {
    subtotal: 60,
    oneTimeTotal: 160, // 60 router + 25 activation + 75 install
    discountTotal: 30,
    tps: 9.50,
    tvq: 18.95,
    total: 218.45,
  },
  payment: {
    status: "pending",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  isSigned: false,
};

// ============= SAMPLE 3: TV BUNDLE =============
export const sampleTVBundle: UnifiedDocumentData = {
  docType: "contract",
  metadata: {
    documentNumber: "CTR-2026-TVB-003",
    orderNumber: "ORD-2026-0003",
    date: new Date().toISOString(),
    effectiveDate: new Date().toISOString(),
    version: "v2026.01.02-Prepaid-01",
  },
  client: baseClient,
  company: getCompanyInfo(),
  agent: baseAgent,
  services: [
    {
      type: "Internet",
      name: "Internet 500 Mbps",
      description: "Fibre optique incluse dans le forfait",
      monthlyPrice: 0, // Included in bundle
      quantity: 1,
      priceLabel: "/mois",
    },
    {
      type: "TV",
      name: "TV 15 choix + Internet 500",
      description: "42 chaines totales, guide electronique",
      monthlyPrice: 95,
      quantity: 1,
      priceLabel: "/mois",
    },
  ],
  // TV summary - COUNTS ONLY, never individual channels
  tvSummary: {
    baseChannels: 27,
    optionalChannels: 15,
    premiumChannels: 0,
    premiumTotal: 0,
  },
  equipment: [
    {
      name: "Routeur Nivra Born WiFi",
      quantity: 1,
      unitPrice: 60,
      serial: "RTR-2026-00456",
      warranty: "1 an",
    },
    {
      name: "Terminal Nivra 4K Smart",
      quantity: 2,
      unitPrice: 50,
      warranty: "1 an",
    },
  ],
  oneTimeFees: [
    { label: "Frais d'activation", amount: 25 },
    { label: "Livraison standard Quebec", amount: 30 },
  ],
  discounts: [],
  // Billing calculation:
  // Recurring = 95 (TV bundle with internet)
  // One-time = 60 (router) + 100 (2 terminals) + 25 (activation) + 30 (delivery) = 215
  // Taxable = 95 + 215 - 0 = 310
  // TPS = 310 * 0.05 = 15.50, TVQ = 310 * 0.09975 = 30.92
  // Total = 310 + 15.50 + 30.92 = 356.42
  billing: {
    subtotal: 95,
    oneTimeTotal: 215, // 60 router + 100 terminals + 25 activation + 30 delivery
    discountTotal: 0,
    tps: 15.50,
    tvq: 30.92,
    total: 356.42,
  },
  payment: {
    status: "pending",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  isSigned: false,
};

// ============= SAMPLE 4: FULL COMBO (TV + Internet + Mobile) =============
export const sampleFullCombo: UnifiedDocumentData = {
  docType: "contract",
  metadata: {
    documentNumber: "CTR-2026-COMBO-004",
    orderNumber: "ORD-2026-0004",
    date: new Date().toISOString(),
    effectiveDate: new Date().toISOString(),
    version: "v2026.01.02-Prepaid-01",
  },
  client: baseClient,
  company: getCompanyInfo(),
  agent: baseAgent,
  services: [
    {
      type: "Internet",
      name: "Internet GIGA 1 Gbps",
      description: "Fibre optique, telechargement illimite",
      monthlyPrice: 80,
      quantity: 1,
      priceLabel: "/mois",
    },
    {
      type: "TV",
      name: "TV 25 choix",
      description: "52 chaines totales, guide electronique",
      monthlyPrice: 25,
      quantity: 1,
      priceLabel: "/mois",
    },
    {
      type: "Mobile",
      name: "Mobile 60$/30 jours",
      description: "60 GB 5G, appels illimites CA/US",
      monthlyPrice: 60,
      quantity: 1,
      priceLabel: "/30 jours",
    },
  ],
  tvSummary: {
    baseChannels: 27,
    optionalChannels: 25,
    premiumChannels: 2,
    premiumTotal: 12,
  },
  equipment: [
    {
      name: "Routeur Nivra Born WiFi",
      quantity: 1,
      unitPrice: 60,
      serial: "RTR-2026-00789",
      warranty: "1 an",
    },
    {
      name: "Terminal Nivra 4K Smart",
      quantity: 1,
      unitPrice: 50,
      warranty: "1 an",
    },
    {
      name: "Carte SIM physique",
      quantity: 1,
      unitPrice: 25,
      warranty: "N/A",
    },
  ],
  oneTimeFees: [
    { label: "Frais d'activation", amount: 25 },
    { label: "Livraison standard Quebec", amount: 30 },
  ],
  discounts: [
    { label: "Rabais paiement preautorise", amount: 5, type: "preauth" },
    { label: "Rabais multi-services", amount: 10, type: "multiLine" },
    { label: "Code promo BIENVENUE20", amount: 20, promoCode: "BIENVENUE20", type: "promo" },
  ],
  // Billing calculation:
  // Recurring = 80 + 25 + 60 = 165
  // One-time = 60 + 50 + 25 (SIM) + 25 (activation) + 30 (delivery) = 190
  // Discounts = 5 + 10 + 20 = 35
  // Taxable = 165 + 190 - 35 = 320
  // TPS = 320 * 0.05 = 16.00, TVQ = 320 * 0.09975 = 31.92
  // Total = 320 + 16.00 + 31.92 = 367.92
  billing: {
    subtotal: 165, // 80 + 25 + 60
    oneTimeTotal: 190, // 60 router + 50 terminal + 25 SIM + 25 activation + 30 delivery
    discountTotal: 35, // 5 + 10 + 20
    tps: 16.00,
    tvq: 31.92,
    total: 367.92,
  },
  payment: {
    status: "pending",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  isSigned: false,
};

// ============= INVOICE SAMPLES =============

export const sampleInvoiceMobile: UnifiedDocumentData = {
  ...sampleMobileOnly,
  docType: "invoice",
  metadata: {
    ...sampleMobileOnly.metadata,
    documentNumber: "INV-2026-0001",
  },
  payment: {
    status: "paid",
    paidAt: new Date().toISOString(),
    reference: "ETR-2026-001234",
    method: "etransfer",
  },
};

export const sampleInvoiceTVBundle: UnifiedDocumentData = {
  ...sampleTVBundle,
  docType: "invoice",
  metadata: {
    ...sampleTVBundle.metadata,
    documentNumber: "INV-2026-0003",
  },
  payment: {
    status: "pending",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
};

export const sampleInvoiceFullCombo: UnifiedDocumentData = {
  ...sampleFullCombo,
  docType: "invoice",
  metadata: {
    ...sampleFullCombo.metadata,
    documentNumber: "INV-2026-0004",
  },
  payment: {
    status: "pending",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
};
