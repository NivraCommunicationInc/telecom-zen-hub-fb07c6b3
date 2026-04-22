/**
 * useCanonicalClientData — Shared canonical client data source.
 *
 * Single source of truth for the connected client's full history:
 *  - profile, account, orders, lifecycle
 *  - billing customer, invoices, payments, subscriptions
 *  - contracts, auto documents
 *
 * All client portal pages should read from this hook (via useQuery on the
 * same query keys) so that order status, totals, and document lists stay
 * synchronized across every tab/route without stale snapshots.
 *
 * Realtime invalidation is wired globally in ClientLayout.
 */
import { useQuery } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend/portalClient";

const OPERATIONAL_ENVS = ["live", "production"] as const;

type Maybe<T> = T | null | undefined;

const dedupeById = <T extends { id?: string | null }>(rows: T[]): T[] => {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (row?.id) map.set(row.id, row);
  }
  return Array.from(map.values());
};

const sortByCreatedDesc = <T extends { created_at?: string | null }>(rows: T[]): T[] =>
  [...rows].sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  );

export interface CanonicalClientData {
  profile: any | null;
  account: any | null;
  billingCustomer: any | null;
  orders: any[];
  orderLifecycle: Record<string, any>;
  invoices: any[];
  payments: any[];
  contracts: any[];
  subscriptions: any[];
  autoDocuments: any[];
  identifiers: {
    userId: string | null;
    accountId: string | null;
    customerId: string | null;
    profileEmail: string | null;
    orderIds: string[];
    /** True when invoices/payments were resolved through fallback link paths. */
    usedFallbackLinks: boolean;
  };
}

/**
 * Centralized canonical client data loader.
 * All reads go through portalClient (admin impersonation aware).
 */
export function useCanonicalClientData(userId: Maybe<string>) {
  return useQuery<CanonicalClientData>({
    queryKey: ["canonical-client-data", userId],
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!userId) {
        return {
          profile: null,
          account: null,
          billingCustomer: null,
          orders: [],
          orderLifecycle: {},
          invoices: [],
          payments: [],
          contracts: [],
          subscriptions: [],
          autoDocuments: [],
          identifiers: {
            userId: null,
            accountId: null,
            customerId: null,
            profileEmail: null,
            orderIds: [],
            usedFallbackLinks: false,
          },
        };
      }

      // 1) Profile + Account + BillingCustomer + Orders in parallel
      const [profileRes, accountRes, billingByUserRes, ordersRes] = await Promise.all([
        portalClient.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        portalClient
          .from("accounts")
          .select("*")
          .eq("client_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        portalClient.from("billing_customers").select("*").eq("user_id", userId).maybeSingle(),
        portalClient
          .from("orders")
          .select("*")
          .eq("user_id", userId)
          .in("environment", [...OPERATIONAL_ENVS])
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const profile = profileRes.data ?? null;
      const account = accountRes.data ?? null;
      let billingCustomer = billingByUserRes.data ?? null;
      const orders = ordersRes.data ?? [];
      const orderIds = orders.map((o: any) => o?.id).filter(Boolean) as string[];

      // 2) FALLBACK: if billing_customers has no row by user_id, try email
      let usedFallbackLinks = false;
      if (!billingCustomer && profile?.email) {
        const { data: bcByEmail } = await portalClient
          .from("billing_customers")
          .select("*")
          .ilike("email", profile.email.trim())
          .maybeSingle();
        if (bcByEmail) {
          billingCustomer = bcByEmail;
          usedFallbackLinks = true;
        }
      }

      const customerId: string | null = billingCustomer?.id ?? null;

      // 3) Invoices + Payments + Subscriptions + Contracts + Auto docs + Lifecycle
      const [invByCustRes, invByOrdersRes, payByCustRes, subsRes, contractsRes, autoDocsRes, lifecycleRes] =
        await Promise.all([
          customerId
            ? portalClient
                .from("billing_invoices")
                .select("*")
                .eq("customer_id", customerId)
                .order("created_at", { ascending: false })
                .limit(100)
            : Promise.resolve({ data: [], error: null } as any),
          orderIds.length > 0
            ? portalClient
                .from("billing_invoices")
                .select("*")
                .in("order_id", orderIds)
                .order("created_at", { ascending: false })
                .limit(100)
            : Promise.resolve({ data: [], error: null } as any),
          customerId
            ? portalClient
                .from("billing_payments")
                .select("*")
                .eq("customer_id", customerId)
                .order("created_at", { ascending: false })
                .limit(100)
            : Promise.resolve({ data: [], error: null } as any),
          customerId
            ? portalClient
                .from("billing_subscriptions")
                .select("*")
                .eq("customer_id", customerId)
                .order("created_at", { ascending: false })
                .limit(50)
            : Promise.resolve({ data: [], error: null } as any),
          portalClient
            .from("contracts")
            .select("*")
            .or(`owner_user_id.eq.${userId},user_id.eq.${userId}`)
            .order("created_at", { ascending: false })
            .limit(100),
          portalClient
            .from("client_auto_documents" as any)
            .select("*")
            .eq("client_id", userId)
            .order("created_at", { ascending: false })
            .limit(100),
          portalClient
            .from("order_lifecycle" as any)
            .select("*")
            .eq("user_id", userId),
        ]);

      // Merge invoices by customer_id and order_id
      const mergedInvoices = sortByCreatedDesc(
        dedupeById<any>([...(invByCustRes.data || []), ...(invByOrdersRes.data || [])]),
      );

      // Resolve invoice IDs for payment fallback
      const invoiceIds = mergedInvoices.map((i: any) => i.id).filter(Boolean);

      const [payByInvoicesRes] = await Promise.all([
        invoiceIds.length > 0
          ? portalClient
              .from("billing_payments")
              .select("*")
              .in("invoice_id", invoiceIds)
              .order("created_at", { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const mergedPayments = sortByCreatedDesc(
        dedupeById<any>([...(payByCustRes.data || []), ...(payByInvoicesRes.data || [])]),
      );

      if (
        (mergedInvoices.length > 0 && (invByOrdersRes.data?.length || 0) > 0 && !customerId) ||
        (mergedPayments.length > 0 && (payByInvoicesRes.data?.length || 0) > 0 && !customerId)
      ) {
        usedFallbackLinks = true;
      }

      const orderLifecycleMap: Record<string, any> = {};
      for (const row of (lifecycleRes.data as any[]) || []) {
        if (row?.order_id) orderLifecycleMap[row.order_id] = row;
      }

      return {
        profile,
        account,
        billingCustomer,
        orders,
        orderLifecycle: orderLifecycleMap,
        invoices: mergedInvoices,
        payments: mergedPayments,
        contracts: (contractsRes.data as any[]) || [],
        subscriptions: (subsRes.data as any[]) || [],
        autoDocuments: (autoDocsRes.data as any[]) || [],
        identifiers: {
          userId,
          accountId: account?.id ?? null,
          customerId,
          profileEmail: profile?.email ?? null,
          orderIds,
          usedFallbackLinks,
        },
      };
    },
  });
}
