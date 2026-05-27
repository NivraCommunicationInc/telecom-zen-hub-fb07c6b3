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
  monthlyInvoices: any[];
  payments: any[];
  legacyPayments: any[];
  contracts: any[];
  subscriptions: any[];
  serviceInstances: any[];
  serviceAddresses: any[];
  equipment: any[];
  autoDocuments: any[];
  clientDocuments: any[];
  orderDocuments: any[];
  paymentProofs: any[];
  phoneOrders: any[];
  appointments: any[];
  supportTickets: any[];
  replacementTickets: any[];
  replacementOrders: any[];
  cancellationRequests: any[];
  paymentMethods: any[];
  authorizedContacts: any[];
  webFormThreads: any[];
  loyaltyPoints: any[];
  loyaltyTransactions: any[];
  identityVerifications: any[];
  documentRequests: any[];
  notifications: any[];
  activity: any[];
  projection: {
    source: string;
    version: number;
    lastRefreshedAt: string | null;
    sectionCounts: Record<string, number>;
    validationStatus: string;
    validationErrors: any[];
    coreHasData: boolean;
    portalEmpty: boolean;
    stale: boolean;
  };
  identifiers: {
    userId: string | null;
    relatedUserIds: string[];
    accountId: string | null;
    accountIds: string[];
    customerId: string | null;
    customerIds: string[];
    profileEmail: string | null;
    authEmail: string | null;
    emails: string[];
    orderIds: string[];
    subscriptionIds: string[];
    /** True when invoices/payments were resolved through fallback link paths. */
    usedFallbackLinks: boolean;
  };
}

const emptyCanonicalClientData = (userId: string | null = null): CanonicalClientData => ({
  profile: null,
  account: null,
  billingCustomer: null,
  orders: [],
  orderLifecycle: {},
  invoices: [],
  monthlyInvoices: [],
  payments: [],
  legacyPayments: [],
  contracts: [],
  subscriptions: [],
  serviceInstances: [],
  serviceAddresses: [],
  equipment: [],
  autoDocuments: [],
  clientDocuments: [],
  orderDocuments: [],
  paymentProofs: [],
  phoneOrders: [],
  appointments: [],
  supportTickets: [],
  replacementTickets: [],
  replacementOrders: [],
  cancellationRequests: [],
  paymentMethods: [],
  authorizedContacts: [],
  webFormThreads: [],
  loyaltyPoints: [],
  loyaltyTransactions: [],
  identityVerifications: [],
  documentRequests: [],
  notifications: [],
  activity: [],
  projection: {
    source: "customer_portal_snapshot",
    version: 0,
    lastRefreshedAt: null,
    sectionCounts: {},
    validationStatus: "pending",
    validationErrors: [],
    coreHasData: false,
    portalEmpty: true,
    stale: true,
  },
  identifiers: {
    userId,
    relatedUserIds: userId ? [userId] : [],
    accountId: null,
    accountIds: [],
    customerId: null,
    customerIds: [],
    profileEmail: null,
    authEmail: null,
    emails: [],
    orderIds: [],
    subscriptionIds: [],
    usedFallbackLinks: false,
  },
});

/**
 * Centralized canonical client data loader.
 * All reads go through portalClient (admin impersonation aware).
 */
export function useCanonicalClientData(userId: Maybe<string>) {
  return useQuery<CanonicalClientData>({
    queryKey: ["canonical-client-data", userId],
    enabled: !!userId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      if (!userId) {
        return emptyCanonicalClientData();
      }

      const { data, error } = await portalClient.rpc("get_customer_portal_snapshot", {
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
         monthlyInvoices: Array.isArray(snapshot.monthlyInvoices) ? snapshot.monthlyInvoices : [],
        payments: Array.isArray(snapshot.payments) ? snapshot.payments : [],
         legacyPayments: Array.isArray(snapshot.legacyPayments) ? snapshot.legacyPayments : [],
        contracts: Array.isArray(snapshot.contracts) ? snapshot.contracts : [],
        subscriptions: Array.isArray(snapshot.subscriptions) ? snapshot.subscriptions : [],
        serviceInstances: Array.isArray(snapshot.serviceInstances) ? snapshot.serviceInstances : [],
         serviceAddresses: Array.isArray(snapshot.serviceAddresses) ? snapshot.serviceAddresses : [],
        equipment: Array.isArray(snapshot.equipment) ? snapshot.equipment : [],
        autoDocuments: Array.isArray(snapshot.autoDocuments) ? snapshot.autoDocuments : [],
         clientDocuments: Array.isArray(snapshot.clientDocuments) ? snapshot.clientDocuments : [],
         orderDocuments: Array.isArray(snapshot.orderDocuments) ? snapshot.orderDocuments : [],
         paymentProofs: Array.isArray(snapshot.paymentProofs) ? snapshot.paymentProofs : [],
         phoneOrders: Array.isArray(snapshot.phoneOrders) ? snapshot.phoneOrders : [],
          appointments: Array.isArray(snapshot.appointments) ? snapshot.appointments : [],
          supportTickets: Array.isArray(snapshot.supportTickets) ? snapshot.supportTickets : [],
          replacementTickets: Array.isArray(snapshot.replacementTickets) ? snapshot.replacementTickets : [],
          replacementOrders: Array.isArray(snapshot.replacementOrders) ? snapshot.replacementOrders : [],
          cancellationRequests: Array.isArray(snapshot.cancellationRequests) ? snapshot.cancellationRequests : [],
          paymentMethods: Array.isArray(snapshot.paymentMethods) ? snapshot.paymentMethods : [],
          authorizedContacts: Array.isArray(snapshot.authorizedContacts) ? snapshot.authorizedContacts : [],
          webFormThreads: Array.isArray(snapshot.webFormThreads) ? snapshot.webFormThreads : [],
          loyaltyPoints: Array.isArray(snapshot.loyaltyPoints) ? snapshot.loyaltyPoints : [],
          loyaltyTransactions: Array.isArray(snapshot.loyaltyTransactions) ? snapshot.loyaltyTransactions : [],
          identityVerifications: Array.isArray(snapshot.identityVerifications) ? snapshot.identityVerifications : [],
          documentRequests: Array.isArray(snapshot.documentRequests) ? snapshot.documentRequests : [],
        notifications: Array.isArray(snapshot.notifications) ? snapshot.notifications : [],
        activity: Array.isArray(snapshot.activity) ? snapshot.activity : [],
        projection: {
          source: snapshot?.projection?.source ?? "customer_portal_snapshot",
          version: Number(snapshot?.projection?.version ?? 0),
          lastRefreshedAt: snapshot?.projection?.lastRefreshedAt ?? null,
          sectionCounts: snapshot?.projection?.sectionCounts ?? {},
          validationStatus: snapshot?.projection?.validationStatus ?? "unknown",
          validationErrors: Array.isArray(snapshot?.projection?.validationErrors) ? snapshot.projection.validationErrors : [],
          coreHasData: Boolean(snapshot?.projection?.coreHasData),
          portalEmpty: Boolean(snapshot?.projection?.portalEmpty),
          stale: Boolean(snapshot?.projection?.stale),
        },
        identifiers: {
          userId,
           relatedUserIds: Array.isArray(snapshot?.identifiers?.relatedUserIds)
             ? snapshot.identifiers.relatedUserIds.filter(Boolean)
             : [userId].filter(Boolean),
          accountId: snapshot?.identifiers?.accountId ?? snapshot?.account?.id ?? null,
          accountIds: Array.isArray(snapshot?.identifiers?.accountIds)
            ? snapshot.identifiers.accountIds.filter(Boolean)
            : [],
          customerId:
            snapshot?.billingCustomer?.id ??
            customerIds[0] ??
            null,
          customerIds,
          profileEmail: snapshot?.identifiers?.profileEmail ?? snapshot?.profile?.email ?? null,
           authEmail: snapshot?.identifiers?.authEmail ?? null,
           emails: Array.isArray(snapshot?.identifiers?.emails)
             ? snapshot.identifiers.emails.filter(Boolean)
             : [],
          orderIds: Array.isArray(snapshot?.identifiers?.orderIds)
            ? snapshot.identifiers.orderIds.filter(Boolean)
            : [],
          subscriptionIds: Array.isArray(snapshot?.identifiers?.subscriptionIds)
            ? snapshot.identifiers.subscriptionIds.filter(Boolean)
            : [],
          usedFallbackLinks: Boolean(snapshot?.identifiers?.usedEmailFallback),
        },
      };
    },
  });
}
