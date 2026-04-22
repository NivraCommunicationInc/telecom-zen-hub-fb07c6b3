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

type Maybe<T> = T | null | undefined;

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

      const { data, error } = await portalClient.rpc("get_client_history_snapshot", {
        _user_id: userId,
      });

      if (error) throw error;

      const snapshot = (data || {}) as any;
      const orderLifecycleMap: Record<string, any> = {};
      for (const row of snapshot.orderLifecycle || []) {
        if (row?.order_id) orderLifecycleMap[row.order_id] = row;
      }

      const customerIds = Array.isArray(snapshot?.identifiers?.customerIds)
        ? snapshot.identifiers.customerIds.filter(Boolean)
        : [];

      return {
        profile: snapshot.profile ?? null,
        account: snapshot.account ?? null,
        billingCustomer: snapshot.billingCustomer ?? null,
        orders: Array.isArray(snapshot.orders) ? snapshot.orders : [],
        orderLifecycle: orderLifecycleMap,
        invoices: Array.isArray(snapshot.invoices) ? snapshot.invoices : [],
        payments: Array.isArray(snapshot.payments) ? snapshot.payments : [],
        contracts: Array.isArray(snapshot.contracts) ? snapshot.contracts : [],
        subscriptions: Array.isArray(snapshot.subscriptions) ? snapshot.subscriptions : [],
        autoDocuments: Array.isArray(snapshot.autoDocuments) ? snapshot.autoDocuments : [],
        identifiers: {
          userId,
          accountId: snapshot?.identifiers?.accountId ?? snapshot?.account?.id ?? null,
          customerId:
            snapshot?.billingCustomer?.id ??
            customerIds[0] ??
            null,
          profileEmail: snapshot?.identifiers?.profileEmail ?? snapshot?.profile?.email ?? null,
          orderIds: Array.isArray(snapshot?.identifiers?.orderIds)
            ? snapshot.identifiers.orderIds.filter(Boolean)
            : [],
          usedFallbackLinks: Boolean(snapshot?.identifiers?.usedEmailFallback),
        },
      };
    },
  });
}
