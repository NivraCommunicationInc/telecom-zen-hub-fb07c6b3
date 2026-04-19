/**
 * useCoreGlobalSearch — Global search across orders, clients (profiles),
 * accounts, equipment_inventory, identity_verification_sessions,
 * billing_invoices, billing_payments, billing_subscriptions.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import type { EnvironmentFilter } from "./useEnvironmentFilter";

export interface SearchResult {
  id: string;
  type: "account" | "customer" | "order" | "invoice" | "payment" | "subscription" | "equipment" | "verification";
  title: string;
  subtitle: string | null;
  badge: string | null;
  href: string;
  environment?: string;
}

async function searchAll(query: string, env: EnvironmentFilter): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const pattern = `%${q}%`;
  const results: SearchResult[] = [];

  const [accounts, profiles, billingCustomers, orders, invoices, payments, subscriptions, equipment, verifications] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, account_number, account_name, status")
      .or(`account_number.ilike.${pattern},account_name.ilike.${pattern}`)
      .limit(8),
    // Clients (profiles) — primary client lookup
    supabase
      .from("profiles")
      .select("user_id, first_name, last_name, full_name, email, phone, account_number")
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .limit(8),
    // Billing customers — fallback for guest/checkout flows
    supabase
      .from("billing_customers")
      .select("id, first_name, last_name, email, phone, user_id")
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .limit(6),
    (() => {
      let qb = supabase
        .from("orders")
        .select("id, order_number, status, service_type, environment")
        .or(`order_number.ilike.${pattern},status.ilike.${pattern},service_type.ilike.${pattern}`)
        .limit(8);
      if (env !== "all") qb = qb.eq("environment", env);
      return qb;
    })(),
    (() => {
      let qb = supabase
        .from("billing_invoices")
        .select("id, invoice_number, status, total, environment")
        .or(`invoice_number.ilike.${pattern}`)
        .limit(6);
      if (env !== "all") qb = qb.eq("environment", env);
      return qb;
    })(),
    (() => {
      let qb = supabase
        .from("billing_payments")
        .select("id, payment_number, amount, method, status, environment")
        .or(`payment_number.ilike.${pattern},reference.ilike.${pattern}`)
        .limit(6);
      if (env !== "all") qb = qb.eq("environment", env);
      return qb;
    })(),
    (() => {
      let qb = supabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_code, status, environment")
        .or(`plan_name.ilike.${pattern},plan_code.ilike.${pattern}`)
        .limit(6);
      if (env !== "all") qb = qb.eq("environment", env);
      return qb;
    })(),
    // Equipment — by serial, MAC, IMEI, SKU, catalog name
    supabase
      .from("equipment_inventory")
      .select("id, serial_number, mac_address, imei, sku, status, category, catalog_name, order_id")
      .or(`serial_number.ilike.${pattern},mac_address.ilike.${pattern},imei.ilike.${pattern},sku.ilike.${pattern},catalog_name.ilike.${pattern}`)
      .limit(8),
    // Identity verification sessions — by case_number / reference_code / order_number
    supabase
      .from("identity_verification_sessions")
      .select("id, case_number, reference_code, status, order_id, order_number")
      .or(`case_number.ilike.${pattern},reference_code.ilike.${pattern},order_number.ilike.${pattern}`)
      .limit(6),
  ]);

  if (accounts.data) {
    for (const a of accounts.data) {
      results.push({
        id: a.id, type: "account",
        title: a.account_number,
        subtitle: a.account_name || null,
        badge: a.status || null,
        href: corePath(`/accounts/${a.id}`),
      });
    }
  }

  if (profiles.data) {
    for (const p of profiles.data) {
      const name = p.full_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || "Client";
      const subtitleParts = [p.email, p.phone, p.account_number ? `Compte ${p.account_number}` : null].filter(Boolean);
      results.push({
        id: p.user_id, type: "customer",
        title: name,
        subtitle: subtitleParts.length ? subtitleParts.join(" · ") : null,
        badge: null,
        href: corePath(`/customers/${p.user_id}`),
      });
    }
  }

  if (billingCustomers.data) {
    const seen = new Set(results.filter(r => r.type === "customer").map(r => r.id));
    for (const c of billingCustomers.data) {
      const key = c.user_id || c.id;
      if (seen.has(key)) continue;
      results.push({
        id: key, type: "customer",
        title: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "Client",
        subtitle: [c.email, c.phone].filter(Boolean).join(" · ") || null,
        badge: null,
        href: c.user_id ? corePath(`/customers/${c.user_id}`) : corePath("/accounts"),
      });
    }
  }

  if (orders.data) {
    for (const o of orders.data) {
      results.push({
        id: o.id, type: "order",
        title: o.order_number || o.id.slice(0, 8),
        subtitle: o.service_type || null,
        badge: o.status || null,
        href: corePath(`/orders/${o.id}`),
        environment: (o as any).environment,
      });
    }
  }

  if (invoices.data) {
    for (const inv of invoices.data) {
      results.push({
        id: inv.id, type: "invoice",
        title: inv.invoice_number,
        subtitle: inv.total != null ? `${Number(inv.total).toFixed(2)} $` : null,
        badge: inv.status || null,
        href: corePath(`/invoices/${inv.id}`),
        environment: (inv as any).environment,
      });
    }
  }

  if (payments.data) {
    for (const p of payments.data) {
      results.push({
        id: p.id, type: "payment",
        title: p.payment_number,
        subtitle: `${Number(p.amount).toFixed(2)} $ · ${p.method}`,
        badge: p.status || null,
        href: corePath("/payments"),
        environment: (p as any).environment,
      });
    }
  }

  if (subscriptions.data) {
    for (const s of subscriptions.data) {
      results.push({
        id: s.id, type: "subscription",
        title: s.plan_name,
        subtitle: s.plan_code,
        badge: s.status || null,
        href: corePath(`/subscriptions/${s.id}`),
        environment: (s as any).environment,
      });
    }
  }

  if (equipment.data) {
    for (const e of equipment.data) {
      const idLabel = e.serial_number || e.mac_address || e.imei || e.id.slice(0, 8);
      const subtitleParts = [e.sku, e.category, e.catalog_name].filter(Boolean);
      results.push({
        id: e.id, type: "equipment",
        title: idLabel,
        subtitle: subtitleParts.join(" · ") || null,
        badge: e.status || null,
        href: e.order_id ? corePath(`/orders/${e.order_id}`) : corePath("/equipment"),
      });
    }
  }

  if (verifications.data) {
    for (const v of verifications.data) {
      results.push({
        id: v.id, type: "verification",
        title: v.case_number || v.reference_code || v.id.slice(0, 8),
        subtitle: v.order_number ? `Commande ${v.order_number}` : v.reference_code || null,
        badge: v.status || null,
        href: v.order_id ? corePath(`/orders/${v.order_id}`) : corePath("/work-queue"),
      });
    }
  }

  return results;
}

export function useCoreGlobalSearch(query: string, environment: EnvironmentFilter = "live") {
  return useQuery<SearchResult[]>({
    queryKey: ["core-global-search", query, environment],
    queryFn: () => searchAll(query, environment),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}
