/**
 * Nivra External API Client
 * Source of truth for product pricing and order creation.
 */

const API_BASE = import.meta.env.VITE_NIVRA_CORE_URL
  ? `${import.meta.env.VITE_NIVRA_CORE_URL}/api`
  : "http://localhost:3001/api";

// ── Product types ──

export interface NivraProduct {
  id: string;
  sku: string;
  name: string;
  product_type: "internet_plan" | "mobile_plan" | "bundle" | "equipment" | "fee";
  base_price: number; // dollars (string from API, parsed to number)
}

export interface NivraOrderItem {
  sku: string;
  quantity: number;
}

export interface NivraCreateOrderPayload {
  customer_name: string;
  customer_email: string;
  items: NivraOrderItem[];
}

export interface NivraOrderResponse {
  order_id: number;
  order_number: string;
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
  /** Payment number returned by Nivra Core — used to notify mark-paid after PayPal capture */
  payment_number: string;
  /** Invoice number returned by Nivra Core */
  invoice_number: string;
}

// ── Full Checkout Submission (Nivra Core = source of truth) ──

export interface NivraCheckoutCustomer {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth?: string | null;
}

export interface NivraCheckoutAddress {
  street: string;
  apartment?: string | null;
  city: string;
  province: string;
  postal_code: string;
}

export interface NivraCheckoutService {
  sku: string;
  name: string;
  plan_code: string;
  plan_price: number;
  category: string;
  quantity: number;
}

export interface NivraCheckoutEquipment {
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface NivraCheckoutFee {
  sku: string;
  name: string;
  amount: number;
}

export interface NivraCheckoutPromo {
  code: string;
  name: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  is_referral_code?: boolean;
  referral_code_id?: string;
  influencer_id?: string;
}

export interface NivraCheckoutPayment {
  method: 'paypal' | 'etransfer' | 'credit_card' | 'promo_free';
  status: 'captured' | 'pending' | 'pre_authorized';
  reference?: string | null;
  paypal_capture_id?: string | null;
  preauth_opt_in?: boolean;
  preauth_discount?: number;
}

export interface NivraCheckoutIdentity {
  verification_session_id: string;
  id_type?: string | null;
  id_number?: string | null;
  id_expiration?: string | null;
  id_province?: string | null;
}

export interface NivraCheckoutChannels {
  base_channels: Array<{ id: string; name: string; }>;
  free_channels: Array<{ id: string; name: string; }>;
  paid_channels: Array<{ id: string; name: string; price: number; }>;
}

export interface NivraCheckoutInstallation {
  type: string; // 'auto' | 'technician' | 'delivery_standard' | 'uber_express' | 'ship_to_home'
  delivery_fee: number;
  installation_fee: number;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
}

export interface NivraCheckoutPortRequest {
  port_in: boolean;
  phone_number: string;
  carrier?: string | null;
  account_number?: string | null;
  service_account?: string | null;
  imei?: string | null;
}

export interface NivraCheckoutStreamingAddon {
  id: string;
  name: string;
  monthly_price: number;
}

/**
 * Full checkout payload sent to Nivra Core.
 * Nivra Core creates: order, invoice, payment, subscription(s).
 */
export interface NivraFullCheckoutPayload {
  /** Idempotency key — prevents duplicate orders on retry */
  client_request_id: string;
  customer: NivraCheckoutCustomer;
  service_address: NivraCheckoutAddress;
  services: NivraCheckoutService[];
  equipment: NivraCheckoutEquipment[];
  fees: NivraCheckoutFee[];
  promo?: NivraCheckoutPromo | null;
  payment: NivraCheckoutPayment;
  identity?: NivraCheckoutIdentity | null;
  installation: NivraCheckoutInstallation;
  channels?: NivraCheckoutChannels | null;
  streaming_addons?: NivraCheckoutStreamingAddon[];
  port_request?: NivraCheckoutPortRequest | null;
  /** Server-side pricing snapshot from compute_checkout_pricing RPC */
  pricing_snapshot: Record<string, any>;
  /** Line items for contract/PDF generation */
  line_items: any[];
  notes?: string;
  account_id?: string | null;
  /** Referral code tracking (independent of promo) */
  referral?: {
    code: string;
    type: "client" | "influencer";
    referrer_user_id?: string;
    referral_code_id?: string;
    influencer_id?: string;
  } | null;
}

/**
 * Full checkout response from Nivra Core.
 * Contains all canonical references for downstream use.
 */
export interface NivraFullCheckoutResponse {
  success: boolean;
  /** Nivra Core order UUID */
  order_id: string;
  /** Human-readable order number (e.g. "23456") */
  order_number: string;
  /** Nivra Core invoice UUID */
  invoice_id: string;
  /** Invoice number (e.g. "INV-3511600") */
  invoice_number: string;
  /** Nivra Core payment UUID */
  payment_id: string;
  /** Payment number (e.g. "PAY-001234") */
  payment_number: string;
  /** Subscription UUID (if recurring services) */
  subscription_id?: string | null;
  /** Account number (6-digit canonical) */
  account_number: string;
  /** Canonical pricing totals */
  pricing: {
    subtotal: number;
    recurring_subtotal: number;
    one_time_subtotal: number;
    discount_total: number;
    welcome_discount: number;
    promo_discount: number;
    preauth_discount: number;
    taxable_base: number;
    tps_amount: number;
    tvq_amount: number;
    grand_total: number;
  };
  /** Billing cycle day anchored by Nivra Core */
  billing_cycle_day: number;
  /** ISO timestamp of order creation */
  created_at: string;
}

// ── Category mapping (API product_type → internal category) ──

const PRODUCT_TYPE_TO_CATEGORY: Record<string, string> = {
  internet_plan: "Internet",
  mobile_plan: "Mobile",
  bundle: "TV",
  equipment: "Équipement",
  fee: "Frais",
};

export function mapProductTypeToCategory(productType: string): string {
  return PRODUCT_TYPE_TO_CATEGORY[productType] || productType;
}

// ── API calls ──

export async function fetchNivraProducts(): Promise<NivraProduct[]> {
  const response = await fetch(`${API_BASE}/products`);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[NivraAPI] GET /products failed:", response.status, body);
    throw new Error(`Failed to fetch products (${response.status})`);
  }

  const raw: Array<{
    id: string;
    sku: string;
    name: string;
    product_type: string;
    base_price: string;
  }> = await response.json();

  return raw.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    product_type: p.product_type as NivraProduct["product_type"],
    base_price: parseFloat(p.base_price),
  }));
}

export async function createNivraOrder(
  payload: NivraCreateOrderPayload
): Promise<NivraOrderResponse> {
  console.log("[NivraAPI] POST /create-order payload:", payload);

  const response = await fetch(`${API_BASE}/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[NivraAPI] POST /create-order failed:", response.status, body);
    throw new Error(`Order creation failed (${response.status}): ${body}`);
  }

  const data: NivraOrderResponse = await response.json();
  console.log("[NivraAPI] Order created:", data);
  return data;
}

/**
 * Submit the full checkout to Nivra Core.
 * Nivra Core atomically creates: order, invoice, payment, subscription(s).
 * This replaces both the local orders.upsert() and billing-create-order edge function.
 */
export async function submitNivraCheckout(
  payload: NivraFullCheckoutPayload
): Promise<NivraFullCheckoutResponse> {
  console.log("[NivraAPI] POST /checkout payload:", {
    client_request_id: payload.client_request_id,
    services: payload.services.length,
    equipment: payload.equipment.length,
    payment_method: payload.payment.method,
  });

  const response = await fetch(`${API_BASE}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[NivraAPI] POST /checkout failed:", response.status, body);
    
    // Try to parse error JSON for user-friendly message
    let errorMessage = `Erreur lors de la création de la commande (${response.status})`;
    try {
      const errorData = JSON.parse(body);
      if (errorData.error) errorMessage = errorData.error;
      if (errorData.message) errorMessage = errorData.message;
    } catch { /* use default */ }
    
    throw new Error(errorMessage);
  }

  const data = await response.json() as Partial<NivraFullCheckoutResponse> & { error?: string; message?: string };

  // Defensive guard: some upstream errors can return HTTP 200 with success=false or incomplete chain.
  // Force fallback path by throwing in those cases.
  if (!data?.success || !data?.order_id || !data?.invoice_id || !data?.payment_id) {
    throw new Error(data?.error || data?.message || "CHECKOUT_FINALIZING");
  }

  const typedData = data as NivraFullCheckoutResponse;
  console.log("[NivraAPI] Checkout complete:", {
    order_number: typedData.order_number,
    invoice_number: typedData.invoice_number,
    payment_number: typedData.payment_number,
    grand_total: typedData.pricing.grand_total,
  });
  return typedData;
}

// ── SKU helpers ──

/** Build a SKU→Product lookup map */
export function buildSkuMap(products: NivraProduct[]): Map<string, NivraProduct> {
  const map = new Map<string, NivraProduct>();
  for (const p of products) {
    map.set(p.sku, p);
  }
  return map;
}

/** Find product by SKU */
export function findProductBySku(
  products: NivraProduct[],
  sku: string
): NivraProduct | undefined {
  return products.find((p) => p.sku === sku);
}

/** Map a product name to a SKU using fuzzy matching against loaded products */
export function findSkuByName(
  products: NivraProduct[],
  name: string
): string | null {
  const lower = name.toLowerCase().trim();

  // Direct name match
  const exact = products.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact.sku;

  // Partial match
  const partial = products.find(
    (p) =>
      lower.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(lower)
  );
  if (partial) return partial.sku;

  return null;
}

// ── Equipment SKU constants (for checkout item building) ──

export const SKU = {
  // Internet plans
  INT_100: "INT-100",
  INT_500: "INT-500",
  INT_GIGA: "INT-GIGA",
  // Mobile plans
  MOB_50GB: "MOB-50GB",
  MOB_75GB: "MOB-75GB",
  // Equipment
  ROUTER: "EQ-ROUTER",
  TVBOX: "EQ-TVBOX",
  // Fees
  ACTIVATION_1: "FEE-ACT-1",
  ACTIVATION_2PLUS: "FEE-ACT-2PLUS",
  SIM: "FEE-SIM",
  ESIM: "FEE-ESIM",
  DELIVERY: "FEE-DELIVERY",
} as const;
