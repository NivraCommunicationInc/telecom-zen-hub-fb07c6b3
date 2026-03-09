/**
 * useCoreGlobalSearch — Core-local copy for deployment decoupling.
 * Identical logic to @/hooks/admin/useCoreGlobalSearch.
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { corePath } from "@/core-app/lib/corePaths";
import type { EnvironmentFilter } from "./useEnvironmentFilter";

export interface SearchResult {
  id: string;
  type: "account" | "customer" | "order" | "invoice" | "payment" | "subscription";
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

  const [accounts, customers, orders, invoices, payments, subscriptions] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, account_number, account_name, status")
      .or(`account_number.ilike.${pattern},account_name.ilike.${pattern}`)
      .limit(8),
    supabase
      .from("billing_customers")
      .select("id, first_name, last_name, email, phone")
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
      .limit(8),
    (() => {
      let qb = supabase.from("orders").select("id, order_number, status, service_type, environment").or(`order_number.ilike.${pattern}`).limit(8);
      if (env !== "all") qb = qb.eq("environment", env);
      return qb;
    })(),
    (() => {
      let qb = supabase.from("billing_invoices").select("id, invoice_number, status, total, environment").or(`invoice_number.ilike.${pattern}`).limit(8);
      if (env !== "all") qb = qb.eq("environment", env);
      return qb;
    })(),
    (() => {
      let qb = supabase.from("billing_payments").select("id, payment_number, amount, method, status, environment").or(`payment_number.ilike.${pattern},reference.ilike.${pattern}`).limit(8);
      if (env !== "all") qb = qb.eq("environment", env);
      return qb;
    })(),
    (() => {
      let qb = supabase.from("billing_subscriptions").select("id, plan_name, plan_code, status, environment").or(`plan_name.ilike.${pattern},plan_code.ilike.${pattern}`).limit(8);
      if (env !== "all") qb = qb.eq("environment", env);
      return qb;
    })(),
  ]);

  if (accounts.data) for (const a of accounts.data) results.push({ id: a.id, type: "account", title: a.account_number, subtitle: a.account_name || null, badge: a.status || null, href: corePath(`/accounts/${a.id}`) });
  if (customers.data) for (const c of customers.data) results.push({ id: c.id, type: "customer", title: `${c.first_name} ${c.last_name}`, subtitle: c.email, badge: null, href: corePath("/accounts") });
  if (orders.data) for (const o of orders.data) results.push({ id: o.id, type: "order", title: o.order_number || o.id.slice(0, 8), subtitle: o.service_type || null, badge: o.status || null, href: corePath(`/orders/${o.id}`), environment: (o as any).environment });
  if (invoices.data) for (const inv of invoices.data) results.push({ id: inv.id, type: "invoice", title: inv.invoice_number, subtitle: inv.total != null ? `${inv.total.toFixed(2)} $` : null, badge: inv.status || null, href: corePath(`/invoices/${inv.id}`), environment: (inv as any).environment });
  if (payments.data) for (const p of payments.data) results.push({ id: p.id, type: "payment", title: p.payment_number, subtitle: `${p.amount.toFixed(2)} $ · ${p.method}`, badge: p.status || null, href: corePath("/payments"), environment: (p as any).environment });
  if (subscriptions.data) for (const s of subscriptions.data) results.push({ id: s.id, type: "subscription", title: s.plan_name, subtitle: s.plan_code, badge: s.status || null, href: corePath(`/subscriptions/${s.id}`), environment: (s as any).environment });

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
