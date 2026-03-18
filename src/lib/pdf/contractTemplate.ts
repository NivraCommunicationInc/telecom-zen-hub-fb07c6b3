/**
 * Nivra Contract Template — LEGACY ADAPTER (delegates to V3.0)
 * 
 * This file preserves the ContractData interface for backward compatibility.
 * All generation now delegates to contractTemplateV3.ts (approved 2026-03-18).
 * 
 * DO NOT add new callers to this file. Use contractTemplateV3 directly.
 */

import type { PDFGenerationResult } from "./types";
import { generateContractV3PDF, type ContractDataV3 } from "./contractTemplateV3";
import { CURRENT_TERMS_VERSION } from "./serviceTermsTemplate";

// ============================================================================
// CONTRACT DATA INTERFACE (backward compatible — legacy callers)
// ============================================================================

export interface ContractData {
  contract_number?: string;
  contractNumber?: string;
  contractId?: string;
  templateId?: string;
  templateVersion?: string;
  contract_date?: string;
  contract_version?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_dob?: string;
  service_address?: string;
  billing_address?: string;
  account_number?: string;
  order_number?: string;
  order_date?: string;
  services?: Array<{
    service_type: string;
    service_description?: string;
    service_price: number;
    service_total: number;
    service_period?: string;
    [key: string]: any;
  }>;
  equipment?: Array<{
    item_name: string;
    item_description?: string;
    qty: number;
    unit_price: number;
    line_total: number;
    serial_number?: string;
    [key: string]: any;
  }>;
  one_time_fees?: { label: string; amount: number }[];
  subtotal_monthly?: number;
  subtotal_equipment?: number;
  subtotal_one_time_fees?: number;
  total_discounts?: number;
  subtotal_before_tax?: number;
  tax_gst?: number;
  tax_qst?: number;
  total_due_today?: number;
  monthly_recurring?: number;
  promo_code?: string;
  promo_description?: string;
  installation_date?: string;
  installation_time_slot?: string;
  installation_type?: "standard" | "complex";
  activation_date?: string;
  first_billing_date?: string;
  bill_cycle_day?: number;
  payment_method?: string;
  payment_reference?: string;
  signature_name?: string;
  signature_date?: string;
  signature_ip?: string;
  is_signed?: boolean;
  [key: string]: any;
}

// ============================================================================
// ACTIVE CONTRACT TEMPLATE IDENTIFIER (for field sales etc.)
// ============================================================================

export const ACTIVE_CONTRACT_TEMPLATE = "contract-v3-locked-2026-03-18";

export function getContractEngineFooterLine(): string {
  return "Template V3.0 — Approuve 2026-03-18";
}

// ============================================================================
// ADAPTER: ContractData → ContractDataV3 → V3 PDF
// ============================================================================

function adaptToV3(data: ContractData): ContractDataV3 {
  return {
    contract_number: data.contract_number || data.contractNumber || "CTR-XXXX",
    contract_date: data.contract_date || new Date().toISOString(),
    terms_version: data.contract_version || CURRENT_TERMS_VERSION,
    client_name: data.client_name || "",
    client_email: data.client_email || "",
    client_phone: data.client_phone || "",
    client_dob: data.client_dob,
    billing_address: data.billing_address || data.service_address || "",
    service_address: data.service_address || data.billing_address || "",
    account_number: data.account_number || "",
    order_number: data.order_number || "",
    services: (data.services || []).map(s => ({
      type: s.service_type || "Telecom",
      name: s.service_description || s.service_type || "",
      monthly_price: s.service_price || s.service_total || 0,
    })),
    equipment: (data.equipment || []).map(e => ({
      name: e.item_name || "",
      quantity: e.qty || 1,
      unit_price: e.unit_price || 0,
      serial: e.serial_number,
    })),
    one_time_fees: data.one_time_fees || [],
    subtotal_monthly: data.subtotal_monthly || 0,
    subtotal_one_time: (data.subtotal_equipment || 0) + (data.subtotal_one_time_fees || 0),
    discount_amount: data.total_discounts || 0,
    tax_gst: data.tax_gst || 0,
    tax_qst: data.tax_qst || 0,
    total_due_today: data.total_due_today || 0,
    payment_method: data.payment_method || "",
    is_signed: data.is_signed,
    signature_name: data.signature_name,
    signature_date: data.signature_date,
    signature_ip: data.signature_ip,
  };
}

// ============================================================================
// MAIN GENERATOR — delegates to V3
// ============================================================================

export function generateContractPDF(data: ContractData): PDFGenerationResult {
  const v3Data = adaptToV3(data);
  return generateContractV3PDF(v3Data);
}

export default generateContractPDF;
