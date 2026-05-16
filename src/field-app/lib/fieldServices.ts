/**
 * Field Portal — Backend Service Layer (Complete)
 * ALL business logic calls go through edge functions.
 * Frontend only: fetches data, displays data, submits intent, shows status.
 */
import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

async function callFieldFunction<T = any>(
  functionName: string,
  params?: Record<string, string>,
  options?: { method?: string; body?: any }
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Non authentifié");

  const url = new URL(`https://${PROJECT_ID}.supabase.co/functions/v1/${functionName}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method: options?.method || "GET",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
    throw new Error(err.error || `Erreur ${res.status}`);
  }

  return res.json();
}

// ═══════════════════════════════════════
// DASHBOARD SERVICE
// ═══════════════════════════════════════

export async function fetchDashboardSummary() {
  return callFieldFunction("field-order-engine", { action: "dashboard-summary" });
}

export async function fetchDashboardActivity() {
  return callFieldFunction("field-order-engine", { action: "dashboard-activity" });
}

// ═══════════════════════════════════════
// CATALOG SERVICE
// ═══════════════════════════════════════

export interface CatalogData {
  products: any[];
  prices: any[];
  attributes: any[];
  equipment_rules: any[];
  promotions: any[];
  field_promotions: any[];
}

export async function fetchCatalog(category?: string): Promise<CatalogData> {
  const params: Record<string, string> = { action: "full" };
  if (category) params.category = category;
  return callFieldFunction("field-catalog", params);
}

export async function fetchEquipmentCatalog(): Promise<{ equipment: any[]; prices: any[] }> {
  return callFieldFunction("field-catalog", { action: "equipment" });
}

export async function fetchFieldConfig(): Promise<Record<string, any>> {
  const res = await callFieldFunction<{ config: Record<string, any> }>("field-catalog", { action: "config" });
  return res.config;
}

// ═══════════════════════════════════════
// SERVICEABILITY SERVICE
// ═══════════════════════════════════════

export interface ServiceabilityResult {
  status: "available" | "limited" | "unavailable" | "unknown";
  coverage_type: string | null;
  serviceable_products: string[];
  notes: string | null;
  existing_orders_count: number;
  has_active_subscription: boolean;
  normalized_address: string;
}

export async function checkServiceability(
  postalCode: string,
  address: string,
  city: string
): Promise<ServiceabilityResult> {
  return callFieldFunction("field-serviceability", { action: "check" }, {
    method: "POST",
    body: { postal_code: postalCode, address, city },
  });
}

export interface DuplicateCheckResult {
  has_duplicates: boolean;
  matches: Array<{ type: string; id: string; name: string; score: number }>;
}

export async function checkDuplicates(
  phone: string,
  email: string,
  address: string
): Promise<DuplicateCheckResult> {
  return callFieldFunction("field-serviceability", { action: "duplicate-check" }, {
    method: "POST",
    body: { phone, email, address },
  });
}

// ═══════════════════════════════════════
// CUSTOMER SERVICE
// ═══════════════════════════════════════

export async function searchCustomers(query: string) {
  return callFieldFunction("field-serviceability", { action: "customer-search", q: query });
}

export async function fetchCustomerDetail(customerId: string) {
  return callFieldFunction("field-serviceability", { action: "customer-detail", customer_id: customerId });
}

// ═══════════════════════════════════════
// PRICING SERVICE
// ═══════════════════════════════════════

export interface PricingQuoteResult {
  lines: any[];
  recurring_subtotal: number;
  one_time_subtotal: number;
  discount_total: number;
  applied_promos: any[];
  activation_fee: number;
  taxable_base: number;
  tps_rate: number;
  tvq_rate: number;
  tps_amount: number;
  tvq_amount: number;
  grand_total: number;
  recurring_monthly_estimate: number;
  due_today_estimate: number;
  computed_at: string;
}

export async function computePricingQuote(
  items: Array<{ product_id: string; quantity: number }>,
  promos?: Array<{ promo_code?: string; field_promo_id?: string }>,
  installationType?: string,
  paymentMethod?: string
): Promise<PricingQuoteResult> {
  return callFieldFunction("field-pricing-quote", {}, {
    method: "POST",
    body: { items, promos, installation_type: installationType, payment_method: paymentMethod },
  });
}

// ═══════════════════════════════════════
// ORDER SERVICE
// ═══════════════════════════════════════

export interface OrderValidation {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

export async function createOrderDraft(orderData: any) {
  return callFieldFunction("field-order-engine", { action: "create-draft" }, {
    method: "POST",
    body: orderData,
  });
}

export async function validateOrderDraft(orderData: any): Promise<OrderValidation> {
  return callFieldFunction("field-order-engine", { action: "validate" }, {
    method: "POST",
    body: orderData,
  });
}

export async function submitOrder(orderId: string): Promise<{ success: boolean; order_id: string; sync_status: string; message: string }> {
  return callFieldFunction("field-order-engine", { action: "submit" }, {
    method: "POST",
    body: { order_id: orderId },
  });
}

export async function updatePaymentStatus(orderId: string, paymentStatus: string, reference?: string) {
  return callFieldFunction("field-order-engine", { action: "update-payment" }, {
    method: "POST",
    body: { order_id: orderId, payment_status: paymentStatus, payment_reference: reference },
  });
}

export async function retrySyncOrder(orderId: string): Promise<{ success: boolean; message: string; attempt_count: number }> {
  return callFieldFunction("field-order-engine", { action: "retry-sync" }, {
    method: "POST",
    body: { order_id: orderId },
  });
}

export async function addOrderNote(orderId: string, content: string, noteType = "internal") {
  return callFieldFunction("field-order-engine", { action: "add-note" }, {
    method: "POST",
    body: { order_id: orderId, content, note_type: noteType },
  });
}

export async function fetchOrderDetail(orderId: string) {
  return callFieldFunction("field-order-engine", { action: "detail", order_id: orderId });
}

export async function fetchOrderHistory(orderId: string) {
  return callFieldFunction("field-order-engine", { action: "history", order_id: orderId });
}

export async function fetchOrderList(filters?: { status?: string; payment_status?: string; sync_status?: string; mine?: boolean }) {
  const params: Record<string, string> = { action: "list" };
  if (filters?.status) params.status = filters.status;
  if (filters?.payment_status) params.payment_status = filters.payment_status;
  if (filters?.sync_status) params.sync_status = filters.sync_status;
  if (filters?.mine) params.mine = "true";
  return callFieldFunction("field-order-engine", params);
}

// ═══════════════════════════════════════
// COMMISSION SERVICE
// ═══════════════════════════════════════

export async function fetchCommissionSummary() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.functions.invoke("field-commission-engine", {
    method: "GET",
  });

  console.log('[commission] userId:', user?.id);
  console.log('[commission] response:', data);

  if (error) throw error;
  return data;
}

export async function fetchCommissionList(status?: string) {
  const params: Record<string, string> = { action: "list" };
  if (status) params.status = status;
  return callFieldFunction("field-commission-engine", params);
}

export async function fetchCommissionDetail(commissionId: string) {
  return callFieldFunction("field-commission-engine", { action: "detail", commission_id: commissionId });
}

export async function createCommissionDispute(commissionId: string, reason: string) {
  return callFieldFunction("field-commission-engine", { action: "dispute" }, {
    method: "POST",
    body: { commission_id: commissionId, reason },
  });
}

export async function requestWithdrawal(amount: number, method: string, destination: string, notes?: string) {
  return callFieldFunction("field-commission-engine", { action: "withdraw" }, {
    method: "POST",
    body: { amount, method, destination, notes },
  });
}

export async function fetchWithdrawals() {
  return callFieldFunction("field-commission-engine", { action: "withdrawals" });
}

// ═══════════════════════════════════════
// OBJECTIVES SERVICE
// ═══════════════════════════════════════

export async function fetchObjectives() {
  return callFieldFunction("field-objectives", { action: "current" });
}

export async function fetchObjectiveProgress() {
  return callFieldFunction("field-objectives", { action: "progress" });
}

// ═══════════════════════════════════════
// LEADS SERVICE
// ═══════════════════════════════════════

export async function fetchLeads(filters?: { status?: string; search?: string }) {
  const params: Record<string, string> = { action: "list" };
  if (filters?.status) params.status = filters.status;
  if (filters?.search) params.search = filters.search;
  return callFieldFunction("field-order-engine", { ...params, domain: "leads" });
}

export async function fetchLeadDetail(leadId: string) {
  return callFieldFunction("field-order-engine", { action: "lead-detail", lead_id: leadId, domain: "leads" });
}

export async function updateLeadStatus(leadId: string, newStatus: string) {
  return callFieldFunction("field-order-engine", { action: "update-lead", domain: "leads" }, {
    method: "POST",
    body: { lead_id: leadId, status: newStatus },
  });
}

export async function createLeadActivity(leadId: string, activityType: string, notes: string) {
  return callFieldFunction("field-order-engine", { action: "lead-activity", domain: "leads" }, {
    method: "POST",
    body: { lead_id: leadId, activity_type: activityType, notes },
  });
}

export async function convertLeadToDraft(leadId: string) {
  return callFieldFunction("field-order-engine", { action: "convert-lead", domain: "leads" }, {
    method: "POST",
    body: { lead_id: leadId },
  });
}

// ═══════════════════════════════════════
// TERRITORY SERVICE
// ═══════════════════════════════════════

export async function fetchTerritories() {
  return callFieldFunction("field-objectives", { action: "territories" });
}

export async function fetchTerritoryStreets(filters?: { status?: string }) {
  const params: Record<string, string> = { action: "streets" };
  if (filters?.status) params.status = filters.status;
  return callFieldFunction("field-objectives", params);
}

export async function createTerritoryStreet(data: { street_name: string; city: string; postal_code?: string; total_doors?: number; notes?: string }) {
  return callFieldFunction("field-objectives", { action: "create-street" }, {
    method: "POST",
    body: data,
  });
}

export async function updateTerritoryStreet(streetId: string, updates: Record<string, any>) {
  return callFieldFunction("field-objectives", { action: "update-street" }, {
    method: "POST",
    body: { street_id: streetId, ...updates },
  });
}

export async function deleteTerritoryStreet(streetId: string) {
  return callFieldFunction("field-objectives", { action: "delete-street" }, {
    method: "POST",
    body: { street_id: streetId },
  });
}

export async function createTerritoryVisit(streetId: string, data: { doors_knocked: number; doors_answered: number; doors_interested: number; doors_sold: number; notes?: string }) {
  return callFieldFunction("field-objectives", { action: "log-visit" }, {
    method: "POST",
    body: { street_id: streetId, ...data },
  });
}

// ═══════════════════════════════════════
// NOTIFICATIONS SERVICE
// ═══════════════════════════════════════

export async function fetchNotifications() {
  return callFieldFunction("field-order-engine", { action: "notifications", domain: "notifications" });
}

export async function markNotificationsRead() {
  return callFieldFunction("field-order-engine", { action: "mark-read", domain: "notifications" }, {
    method: "POST",
  });
}

// ═══════════════════════════════════════
// RESOURCES SERVICE
// ═══════════════════════════════════════

export async function fetchResources() {
  return callFieldFunction("field-catalog", { action: "resources" });
}

// ═══════════════════════════════════════
// TRACKING / PIPELINE SERVICE
// ═══════════════════════════════════════

export async function fetchTrackingSummary() {
  return callFieldFunction("field-order-engine", { action: "tracking-summary" });
}

// ═══════════════════════════════════════
// DAILY REPORT SERVICE
// ═══════════════════════════════════════

export async function fetchDailyReport() {
  return callFieldFunction("field-order-engine", { action: "daily-report" });
}

// ═══════════════════════════════════════
// PAY / PAYROLL SERVICE
// ═══════════════════════════════════════

export async function fetchPaySummary() {
  return callFieldFunction("field-commission-engine", { action: "pay-summary" });
}

// ═══════════════════════════════════════
// PERFORMANCE / ANALYTICS SERVICE
// ═══════════════════════════════════════

export async function fetchPerformanceData(period: string) {
  return callFieldFunction("field-order-engine", { action: "performance", period });
}

// ═══════════════════════════════════════
// PROFILE SERVICE
// ═══════════════════════════════════════

export async function fetchAgentProfile() {
  return callFieldFunction("field-order-engine", { action: "agent-profile" });
}

export async function updateAgentProfile(data: { full_name: string; phone: string }) {
  return callFieldFunction("field-order-engine", { action: "update-profile" }, {
    method: "POST",
    body: data,
  });
}

// ═══════════════════════════════════════
// NEW SALE — ORDER CREATION (full submit)
// ═══════════════════════════════════════

export async function submitNewSale(draftData: any) {
  return callFieldFunction("field-order-engine", { action: "submit-sale" }, {
    method: "POST",
    body: draftData,
  });
}

// ═══════════════════════════════════════
// NEW LEAD — CREATE LEAD
// ═══════════════════════════════════════

export async function createNewLead(leadData: any) {
  return callFieldFunction("field-order-engine", { action: "create-lead", domain: "leads" }, {
    method: "POST",
    body: leadData,
  });
}

// ═══════════════════════════════════════
// SIDEBAR BADGES
// ═══════════════════════════════════════

export async function fetchSidebarBadges() {
  return callFieldFunction("field-order-engine", { action: "sidebar-badges" });
}

// ═══════════════════════════════════════
// SALE SUCCESS — ORDER STATUS POLL
// ═══════════════════════════════════════

export async function fetchSaleStatus(orderId: string) {
  return callFieldFunction("field-order-engine", { action: "sale-status", order_id: orderId });
}
