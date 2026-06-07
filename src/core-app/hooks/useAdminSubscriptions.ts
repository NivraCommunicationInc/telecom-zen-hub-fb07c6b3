/**
 * useAdminSubscriptions — Core-local copy for deployment decoupling.
 * Identical logic to @/hooks/admin/useAdminSubscriptions.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  assertCanonicalAccountInvariant,
  buildCanonicalAccountMaps,
  resolveCanonicalAccountNumber,
} from "@/lib/canonicalAccountResolver";
import type { EnvironmentFilter } from "./useEnvironmentFilter";

export interface ServiceAddress {
  address_line: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
}

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
  address_id: string | null;
  created_at: string | null;
  environment?: string;
  client_name: string | null;
  client_email: string | null;
  account_number: string | null;
  // Billing cycle from accounts table
  billing_cycle_day: number | null;
  next_invoice_date: string | null;
  // Service address from service_addresses table
  service_address: ServiceAddress | null;
}

export function useAdminSubscriptions(environment: EnvironmentFilter = "all") {
  return useQuery<AdminSubscription[]>({
    queryKey: ["admin-subscriptions", environment],
    queryFn: async () => {
      let query = supabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_code, plan_price, status, service_category, cycle_start_date, cycle_end_date, auto_billing_enabled, order_id, customer_id, address_id, created_at, environment")
        .order("created_at", { ascending: false })
        .limit(500);
      if (environment !== "all") query = query.eq("environment", environment);
      const { data: subs, error } = await query;
      if (error) throw error;
      if (!subs?.length) return [];

      const customerIds = [...new Set(subs.map((s) => s.customer_id))];
      const addressIds = [...new Set(subs.map((s) => (s as any).address_id).filter(Boolean))];

      const [customersRes, addressesRes] = await Promise.all([
        supabase
          .from("billing_customers")
          .select("id, first_name, last_name, email, user_id")
          .in("id", customerIds),
        addressIds.length > 0
          ? supabase
              .from("service_addresses")
              .select("id, address_line, city, province, postal_code")
              .in("id", addressIds)
          : Promise.resolve({ data: [] }),
      ]);

      const customerMap = new Map((customersRes.data || []).map((c) => [c.id, c]));
      const addressMap = new Map((addressesRes.data || []).map((a: any) => [a.id, a]));

      // Fetch profile names (source of truth) to override stale billing_customer names
      const userIds = [...new Set((customersRes.data || []).map((c) => c.user_id).filter(Boolean))];

      const [profilesRes, accountsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase
              .from("accounts")
              .select("client_id, billing_cycle_day, next_invoice_date")
              .in("client_id", userIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      // accounts.client_id === auth.users.id === billing_customers.user_id
      const accountMap = new Map((accountsRes.data || []).map((a: any) => [a.client_id, a]));

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

        const account = cust?.user_id ? accountMap.get(cust.user_id) : null;
        const addr = (s as any).address_id ? addressMap.get((s as any).address_id) : null;

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
          address_id: (s as any).address_id ?? null,
          created_at: s.created_at,
          environment: (s as any).environment,
          client_name: (() => {
            const prof = cust?.user_id ? profileMap.get(cust.user_id) : null;
            if (prof?.first_name || prof?.last_name) return `${prof.first_name || ""} ${prof.last_name || ""}`.trim();
            return cust ? `${cust.first_name} ${cust.last_name}` : null;
          })(),
          client_email: cust?.email ?? null,
          account_number: accountNumber,
          billing_cycle_day: account?.billing_cycle_day ?? null,
          next_invoice_date: account?.next_invoice_date ?? null,
          service_address: addr
            ? {
                address_line: addr.address_line ?? null,
                city: addr.city ?? null,
                province: addr.province ?? null,
                postal_code: addr.postal_code ?? null,
              }
            : null,
        };
      });
    },
  });
}
