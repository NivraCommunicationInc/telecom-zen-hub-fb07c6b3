import type { QueryClient } from "@tanstack/react-query";

export const CLIENT_REALTIME_QUERY_KEYS = [
  "canonical-client-data",
  "client-orders",
  "client-orders-all",
  "client-order-lifecycle",
  "client-orders-count",
  "client-orders-for-docs",
  "client-orders-in-progress",
  "client-profile",
  "client-profile-dashboard",
  "client-account",
  "client-account-billing",
  "client-account-identity",
  "client-accounts",
  "client-service-locations",
  "client-invoice-breakdowns",
  "client-invoices",
  "client-payments",
  "client-billing-subscriptions",
  "client-billing-subscriptions-canonical",
  "client-subscriptions",
  "client-subscriptions-billing",
  "client-monthly-invoices",
  "client-billing-invoices-canonical",
  "client-billing-payments-canonical",
  "client-contracts",
  "client-contracts-for-docs",
  "client-auto-documents",
  "client-subscriptions-count",
  "ledger-history-v2",
  "ledger-balance",
  "portal-section-badges",
  "overdue-count-unified",
] as const;

export const OPERATIONAL_REALTIME_QUERY_KEYS = [
  "admin-orders",
  "admin-order-detail",
  "admin-order-overview",
  "core-order-detail",
  "shared-client-profile",
  "shared-orders-list",
  "shared-order-detail",
  "shared-payments-list",
  "shared-invoices-list",
  "account-profile",
  "account-profile-orders",
  "account-profile-invoices",
  "account-profile-payments",
  "account-profile-subscriptions",
  "billing-invoices",
  "billing-payments",
  "admin-activity-logs",
] as const;

export function invalidateQueryKeyList(queryClient: QueryClient, keys: readonly string[]) {
  keys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
}

export function invalidateClientRealtimeQueries(queryClient: QueryClient) {
  invalidateQueryKeyList(queryClient, CLIENT_REALTIME_QUERY_KEYS);
}

export function invalidateOperationalRealtimeQueries(queryClient: QueryClient) {
  invalidateQueryKeyList(queryClient, OPERATIONAL_REALTIME_QUERY_KEYS);
}