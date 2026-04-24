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
}

export function useAdminOrders(environment: EnvironmentFilter = "all") {
  return useQuery<AdminOrder[]>({
    queryKey: ["admin-orders-v2", environment],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, order_number, user_id, account_id, service_type, order_type, status, payment_status, payment_method, total_amount, risk_flags, created_at, environment, kyc_status, sla_deadline, sla_status")
        .order("created_at", { ascending: false })
        .limit(500);
      if (environment !== "all") query = query.eq("environment", environment);
      const { data: orders, error } = await query;
      if (error) throw error;
      if (!orders || orders.length === 0) return [];

      const userIds = [...new Set(orders.map((o) => o.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const orderIds = orders.map((o) => o.id);
      const { data: invoices } = await supabase
        .from("billing_invoices")
        .select("order_id, invoice_number, status, total")
        .in("order_id", orderIds);

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

      return orders.map((o: any): AdminOrder => {
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
        };
      });
    },
  });
}
