/**
 * useAdminSubscriptions — Fetches all subscriptions with joined customer data.
 * Zero local financial math.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  assertCanonicalAccountInvariant,
  buildCanonicalAccountMaps,
  resolveCanonicalAccountNumber,
} from "@/lib/canonicalAccountResolver";
import type { EnvironmentFilter } from "./useEnvironmentFilter";

export interface AdminSubscription {
  id: string;
  plan_name: string;
  plan_code: string;
  plan_price: number;
  status: string | null;
  service_category: string | null;
  cycle_start_date: string;
  cycle_end_date: string;
  auto_billing_enabled: boolean | null;
  order_id: string | null;
  customer_id: string;
  created_at: string | null;
  environment?: string;
  client_name: string | null;
  client_email: string | null;
  account_number: string | null;
}

export function useAdminSubscriptions(environment: EnvironmentFilter = "all") {
  return useQuery<AdminSubscription[]>({
    queryKey: ["admin-subscriptions", environment],
    queryFn: async () => {
      let query = supabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_code, plan_price, status, service_category, cycle_start_date, cycle_end_date, auto_billing_enabled, order_id, customer_id, created_at, environment")
        .order("created_at", { ascending: false })
        .limit(500);
      if (environment !== "all") query = query.eq("environment", environment);
      const { data: subs, error } = await query;
      if (error) throw error;
      if (!subs?.length) return [];

      const customerIds = [...new Set(subs.map((s) => s.customer_id))];
      const { data: customers } = await supabase
        .from("billing_customers")
        .select("id, first_name, last_name, email, user_id")
        .in("id", customerIds);

      const customerMap = new Map((customers || []).map((c) => [c.id, c]));

      // Fetch profile names (source of truth) to override stale billing_customer names
      const userIds = [...new Set((customers || []).map((c) => c.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const maps = await buildCanonicalAccountMaps(supabase, {
        customerIds,
        userIds,
      });

      return subs.map((s) => {
        const cust = customerMap.get(s.customer_id);
        const accountNumber = resolveCanonicalAccountNumber(maps, {
          customerId: s.customer_id,
          userId: cust?.user_id,
        });

        assertCanonicalAccountInvariant(
          "subscription",
          s.id,
          { customerId: s.customer_id, userId: cust?.user_id },
          accountNumber,
        );

        return {
          id: s.id,
          plan_name: s.plan_name,
          plan_code: s.plan_code,
          plan_price: s.plan_price,
          status: s.status,
          service_category: s.service_category,
          cycle_start_date: s.cycle_start_date,
          cycle_end_date: s.cycle_end_date,
          auto_billing_enabled: s.auto_billing_enabled,
          order_id: s.order_id,
          customer_id: s.customer_id,
          created_at: s.created_at,
          environment: (s as any).environment,
          client_name: cust ? `${cust.first_name} ${cust.last_name}` : null,
          client_email: cust?.email ?? null,
          account_number: accountNumber,
        };
      });
    },
  });
}
