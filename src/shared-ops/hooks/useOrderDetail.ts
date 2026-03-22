/**
 * useOrderDetail — Shared canonical order detail loader.
 * Single source of truth for order data across Core and Employee portals.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrderDetailData {
  order: any;
  resolvedOrderId: string;
  profile: { full_name: string | null; email: string | null; phone: string | null } | null;
  account: { account_number: string; status: string | null; billing_address: string | null; billing_city: string | null } | null;
  invoice: any | null;
  invoiceLines: any[];
  payment: any | null;
  subscription: any | null;
  equipment: any[];
  appointment: any | null;
  consent: any | null;
  logs: any[];
  pricingSnapshot: Record<string, any> | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_PARAM_RE = /^[\w-]+$/;

async function resolveOrderId(param: string): Promise<string> {
  const normalized = decodeURIComponent(param).trim();
  if (!normalized || !SAFE_PARAM_RE.test(normalized)) throw new Error("Identifiant de commande invalide");
  if (UUID_RE.test(normalized)) {
    const { data } = await supabase.from("orders").select("id").eq("id", normalized).maybeSingle();
    if (data) return data.id;
  }
  const { data } = await supabase.from("orders").select("id").eq("order_number", normalized).maybeSingle();
  if (data) return data.id;
  throw new Error("Commande introuvable");
}

export function useOrderDetail(orderRouteParam: string | undefined) {
  return useQuery<OrderDetailData>({
    queryKey: ["shared-order-detail", orderRouteParam],
    enabled: !!orderRouteParam,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      if (!orderRouteParam) throw new Error("Identifiant manquant");
      const resolvedOrderId = await resolveOrderId(orderRouteParam);
      const { data: order, error } = await supabase.from("orders").select("*").eq("id", resolvedOrderId).single();
      if (error) throw error;

      const [profileRes, invoiceRes, consentRes, logsRes, appointmentRes, accountRes, subscriptionRes, equipmentRes] = await Promise.all([
        order.user_id ? supabase.from("profiles").select("full_name, email, phone").eq("user_id", order.user_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("billing_invoices").select("id, invoice_number, total, subtotal, tps_amount, tvq_amount, status, due_date, paid_at, balance_due, amount_paid").eq("order_id", resolvedOrderId).order("created_at", { ascending: false }),
        supabase.from("consent_records").select("*").eq("order_id", resolvedOrderId).order("created_at", { ascending: false }).limit(1),
        supabase.from("activity_logs").select("action, created_at, actor_name, details, actor_role").eq("entity_id", resolvedOrderId).eq("entity_type", "order").order("created_at", { ascending: false }).limit(30),
        supabase.from("appointments").select("id, appointment_number, title, scheduled_at, status, service_address, service_city, technician_id").eq("order_id", resolvedOrderId).maybeSingle(),
        order.account_id ? supabase.from("accounts").select("account_number, status, billing_address, billing_city").eq("id", order.account_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("billing_subscriptions").select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date, next_renewal_at").eq("order_id", resolvedOrderId).maybeSingle(),
        supabase.from("equipment_inventory").select("id, catalog_name, serial_number, mac_address, status, category, sku, condition").eq("order_id", resolvedOrderId),
      ]);

      const invoices = invoiceRes.data ?? [];
      const invoice = invoices.find((inv: any) => !["paid", "paid_by_promo", "void", "cancelled"].includes(String(inv?.status || "").toLowerCase()) && Number(inv?.balance_due ?? 0) > 0) || invoices[0] || null;

      let invoiceLines: any[] = [];
      if (invoice?.id) {
        const { data: lines } = await supabase.from("billing_invoice_lines").select("*").eq("invoice_id", invoice.id).order("created_at", { ascending: true });
        invoiceLines = lines || [];
      }

      let paymentData = null;
      if (invoice?.id) {
        const { data: payment } = await supabase.from("billing_payments").select("id, payment_number, status, amount, method, provider, received_at, reference").eq("invoice_id", invoice.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        paymentData = payment;
      }

      return {
        resolvedOrderId, order, profile: profileRes.data, account: accountRes.data,
        invoice, invoiceLines, payment: paymentData, subscription: subscriptionRes.data,
        equipment: equipmentRes.data ?? [], appointment: appointmentRes.data,
        consent: consentRes.data?.[0] ?? null, logs: logsRes.data ?? [],
        pricingSnapshot: order.pricing_snapshot as Record<string, any> | null,
      };
    },
  });
}