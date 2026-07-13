/**
 * Types for the Field Sales 5-step guided workflow (rebuild v2).
 * Flow: Client → Forfaits → Rabais → Récap → Paiement
 */

export interface FieldSaleCustomer {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  address: string;
  apartment?: string;
  city: string;
  postal_code: string;
  province: string;
  notes: string;
  serviceability_status: "unknown" | "checking" | "available" | "unavailable";
  install_date?: string | null;
  install_mode?: "technician" | "self";
  delivery_mode?: "standard" | "express" | "technician";
  delivery_fee?: number;
  installation_fee?: number;
  /** Chosen installation slot from the shared InstallSlotPicker */
  install_slot?: { date: string; time_slot: string } | null;
  /** Answers from the shared CoaxialSurvey component; mirrored onto orders.coaxial_survey */
  coaxial_survey?: {
    has_outlet: "yes" | "no" | null;
    outlet_works: "yes" | "unknown" | "no" | null;
    outlet_count: number | null;
  } | null;
}

export interface FieldSaleCustomAdjustment {
  id: string;
  kind: "fee" | "credit" | "promotion";
  label: string;
  amount: number;
}

/** Concatenates address + apartment for downstream consumers (orders, invoices). */
export function composeFullAddress(c: Pick<FieldSaleCustomer, "address" | "apartment">): string {
  const base = (c.address || "").trim();
  const apt = (c.apartment || "").trim();
  if (!base) return "";
  if (!apt) return base;
  return `${base}, App. ${apt}`;
}

export interface FieldSaleService {
  id: string;
  name: string;
  category: string;
  monthlyPrice: number;
  description: string | null;
  speed?: string;
}

export interface FieldSaleEquipment {
  id: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
}

/**
 * Agent discount applied to a sale.
 * Sourced from the agent_discounts catalogue.
 */
export type FieldDiscountType =
  | "fixed"
  | "percentage"
  | "fixed_monthly"
  | "remove_fee"
  | "first_month_free";

export type FieldDiscountAppliesTo =
  | "internet"
  | "tv"
  | "mobile"
  | "bundle"
  | "all"
  | "installation"
  | "plans_80_plus"
  | "plans_90_plus"
  | "plan_only";

export interface FieldSaleDiscount {
  id: string;
  name: string;
  type: FieldDiscountType;
  value: number;
  applies_to: FieldDiscountAppliesTo;
  description?: string | null;
  duration_months?: number | null;
  min_plan_price?: number | null;
  source?: "catalog" | "custom_core";
}

/**
 * Payment options for field sales.
 *  - paypal_onsite : Generate a PayPal link/QR — client pays on agent's device.
 *  - paypal_email  : Send a PayPal payment link to the client by email.
 *  - card_manual   : Agent collects card data manually for admin processing within 48h.
 */
export type FieldPaymentMethod = "paypal_onsite" | "paypal_email" | "card_manual" | "paypal_inline" | "square_inline" | "square_onsite" | "square_email";

export interface FieldSalePayment {
  method: FieldPaymentMethod;
  status: "pending" | "sent" | "completed";
  linkSentTo: string | null;
  quoteId?: string | null;
  paypalApprovalUrl?: string | null;
  paypalOrderId?: string | null;
  fieldOrderId?: string | null;
  invoiceId?: string | null;
  coreOrderId?: string | null;
}

/**
 * 5 canonical steps in the rebuilt flow.
 */
export type FieldSaleStep =
  | "customer"
  | "services"
  | "equipment"
  | "discounts"
  | "recap"
  | "payment"
  | "submitted";

export interface FieldSaleDraft {
  id?: string;
  step: FieldSaleStep;
  customer: FieldSaleCustomer;
  services: FieldSaleService[];
  equipment: FieldSaleEquipment[];
  discount: FieldSaleDiscount | null;
  custom_adjustments?: FieldSaleCustomAdjustment[];
  payment: FieldSalePayment;
  agentId: string;
  createdAt: string;
  /**
   * When set (staff-initiated order for an existing account), the tunnel
   * pre-fills + locks the client identity step and, at submission time,
   * skips new-account creation — the resulting order is attached to this
   * account_id / service_address_id.
   */
  existing_account_id?: string | null;
  existing_service_address_id?: string | null;
}

export const EMPTY_DRAFT: Omit<FieldSaleDraft, "agentId" | "createdAt"> = {
  step: "customer",
  customer: {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    address: "",
    apartment: "",
    city: "",
    postal_code: "",
    province: "QC",
    notes: "",
    serviceability_status: "unknown",
    install_date: null,
    install_mode: "technician",
    delivery_mode: "technician",
    delivery_fee: 0,
    installation_fee: 50,
    install_slot: null,
    coaxial_survey: null,
  },
  services: [],
  equipment: [],
  discount: null,
  custom_adjustments: [],
  payment: {
    method: "square_onsite",
    status: "pending",
    linkSentTo: null,
    quoteId: null,
    paypalApprovalUrl: null,
    paypalOrderId: null,
    fieldOrderId: null,
    invoiceId: null,
    coreOrderId: null,
  },
};

export const STEP_ORDER: FieldSaleStep[] = [
  "customer",
  "services",
  "equipment",
  "discounts",
  "recap",
  "payment",
];

export const STEP_LABELS: Record<FieldSaleStep, string> = {
  customer: "Client",
  services: "Forfaits",
  equipment: "Équipement",
  discounts: "Rabais",
  recap: "Récap",
  payment: "Paiement",
  submitted: "Soumis",
};
