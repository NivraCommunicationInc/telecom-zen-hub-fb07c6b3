/**
 * useAdminOrders — Core-local copy for deployment decoupling.
 * CANONICAL: Uses billing_invoices.total + accounts.account_number as authoritative values.
 * PHASE C: Includes sla_deadline + sla_status for SLA tracking UI.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  assertCanonicalAccountInvariant,
  buildCanonicalAccountMaps,
  resolveCanonicalAccountNumber,
} from "@/lib/canonicalAccountResolver";
import type { EnvironmentFilter } from "./useEnvironmentFilter";

export interface AdminOrder {
  id: string;
  order_number: string | null;
  user_id: string;
  service_type: string | null;
  order_type: string | null;
  status: string;
  payment_status: string | null;
  total_amount: number | null;
  risk_flags: string[] | null;
  created_at: string;
  environment?: string;
  client_full_name: string | null;
  client_email: string | null;
  account_number: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  kyc_status: string | null;
  sla_deadline: string | null;
  sla_status: string | null;
  payment_method: string | null;
  source: string | null;
  created_by_agent_id: string | null;
  agent_full_name: string | null;
}

export function useAdminOrders(environment: EnvironmentFilter = "all") {
  return useQuery<AdminOrder[]>({
    queryKey: ["admin-orders-v2", environment],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, order_number, user_id, account_id, service_type, order_type, status, payment_status, payment_method, total_amount, risk_flags, created_at, environment, kyc_status, sla_deadline, sla_status, source, created_by_agent_id")
        .order("created_at", { ascending: false })
        .limit(500);
      if (environment !== "all") query = query.eq("environment", environment);
      const { data: orders, error } = await query;
      if (error) throw error;
      const orderRows = orders || [];

      const { data: fieldIntents } = environment === "test"
        ? { data: [] as any[] }
        : await supabase
            .from("field_payment_intents" as any)
            .select("id, agent_id, payment_method, status, amount, customer_email, customer_name, created_at, converted_order_id")
            .is("converted_order_id", null)
            .order("created_at", { ascending: false })
            .limit(100);

      const userIds = [...new Set(orderRows.map((o) => o.user_id))];
      const agentIds = [...new Set([
        ...orderRows.map((o: any) => o.created_by_agent_id).filter(Boolean),
        ...((fieldIntents || []) as any[]).map((i: any) => i.agent_id).filter(Boolean),
      ] as string[])];
      const allProfileIds = [...new Set([...userIds, ...agentIds])];
      const { data: profiles } = allProfileIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", allProfileIds)
        : { data: [] as any[] };

      const orderIds = orderRows.map((o) => o.id);
      const { data: invoices } = orderIds.length
        ? await supabase
            .from("billing_invoices")
            .select("order_id, invoice_number, status, total")
            .in("order_id", orderIds)
        : { data: [] as any[] };

      const maps = await buildCanonicalAccountMaps(supabase, {
        orderIds,
        userIds,
        accountIds: orders.map((o: any) => o.account_id),
      });

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
      const invoiceMap = new Map<string, { invoice_number: string; status: string | null; total: number }>();
      for (const inv of invoices || []) {
        if (!inv.order_id) continue;
        const existing = invoiceMap.get(inv.order_id);
        if (!existing || (existing.status === "void" && inv.status !== "void")) {
          invoiceMap.set(inv.order_id, inv as any);
        }
      }

      const canonicalOrders = orderRows.map((o: any): AdminOrder => {
        const profile = profileMap.get(o.user_id);
        const invoice = invoiceMap.get(o.id);
        const accountNumber = resolveCanonicalAccountNumber(maps, {
          orderId: o.id,
          accountId: o.account_id,
          userId: o.user_id,
        });

        assertCanonicalAccountInvariant(
          "order",
          o.id,
          { orderId: o.id, accountId: o.account_id, userId: o.user_id },
          accountNumber,
        );

        return {
          id: o.id,
          order_number: o.order_number,
          user_id: o.user_id,
          service_type: o.service_type,
          order_type: o.order_type,
          status: o.status,
          payment_status: o.payment_status,
          total_amount: invoice?.total ?? o.total_amount,
          risk_flags: o.risk_flags as string[] | null,
          created_at: o.created_at,
          environment: o.environment,
          client_full_name: profile?.full_name ?? null,
          client_email: profile?.email ?? null,
          account_number: accountNumber,
          invoice_number: invoice?.invoice_number ?? null,
          invoice_status: invoice?.status ?? null,
          kyc_status: o.kyc_status ?? null,
          sla_deadline: o.sla_deadline ?? null,
          sla_status: o.sla_status ?? null,
          payment_method: o.payment_method ?? null,
          source: o.source ?? null,
          created_by_agent_id: o.created_by_agent_id ?? null,
          agent_full_name: o.created_by_agent_id ? (profileMap.get(o.created_by_agent_id)?.full_name ?? null) : null,
        };
      });

      const pendingFieldOrders = (fieldIntents || []).map((intent: any): AdminOrder => ({
        id: intent.id,
        order_number: `FIELD-${String(intent.id).slice(0, 8).toUpperCase()}`,
        user_id: intent.agent_id,
        service_type: "Vente terrain en attente",
        order_type: "field_payment_intent",
        status: intent.status === "paid" || intent.status === "completed" ? "paid" : "pending_payment",
        payment_status: intent.status,
        total_amount: Number(intent.amount || 0),
        risk_flags: null,
        created_at: intent.created_at,
        environment: "live",
        client_full_name: intent.customer_name ?? null,
        client_email: intent.customer_email ?? null,
        account_number: null,
        invoice_number: null,
        invoice_status: null,
        kyc_status: null,
        sla_deadline: null,
        sla_status: null,
        payment_method: intent.payment_method ?? null,
        source: "field_payment_intent",
        created_by_agent_id: intent.agent_id ?? null,
        agent_full_name: intent.agent_id ? (profileMap.get(intent.agent_id)?.full_name ?? null) : null,
      }));

      return [...pendingFieldOrders, ...canonicalOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });
}
