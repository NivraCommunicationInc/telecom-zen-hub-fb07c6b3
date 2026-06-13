import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = Pick<SupabaseClient<any>, "from">;

type MaybeId = string | null | undefined;

type CanonicalLookupInput = {
  orderIds?: MaybeId[];
  customerIds?: MaybeId[];
  userIds?: MaybeId[];
  accountIds?: MaybeId[];
};

export type CanonicalAccountMaps = {
  byAccountId: Map<string, string>;
  byUserId: Map<string, string>;
  byOrderId: Map<string, string>;
  byCustomerId: Map<string, string>;
};

const uniqIds = (values: MaybeId[] = []) =>
  [...new Set(values.filter((value): value is string => !!value && value.trim().length > 0))];

function pickNewestAccountNumber(
  current: { account_number: string; created_at: string | null } | undefined,
  incoming: { account_number: string; created_at: string | null },
) {
  if (!current) return incoming;
  const currentTs = current.created_at ? new Date(current.created_at).getTime() : 0;
  const incomingTs = incoming.created_at ? new Date(incoming.created_at).getTime() : 0;
  return incomingTs >= currentTs ? incoming : current;
}

export async function buildCanonicalAccountMaps(
  db: DbClient,
  input: CanonicalLookupInput,
): Promise<CanonicalAccountMaps> {
  const orderIds = uniqIds(input.orderIds);
  const customerIds = uniqIds(input.customerIds);
  const directUserIds = uniqIds(input.userIds);
  const directAccountIds = uniqIds(input.accountIds);

  const [ordersRes, customersRes] = await Promise.all([
    orderIds.length > 0
      ? db
          .from("orders")
          .select("id, account_id, user_id")
          .in("id", orderIds)
      : Promise.resolve({ data: [], error: null } as any),
    customerIds.length > 0
      ? db
          .from("billing_customers")
          .select("id, user_id")
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (ordersRes.error) throw ordersRes.error;
  if (customersRes.error) throw customersRes.error;

  const orderRows = ordersRes.data || [];
  const customerRows = customersRes.data || [];

  const derivedAccountIds = uniqIds([
    ...directAccountIds,
    ...orderRows.map((row: any) => row.account_id),
  ]);

  const derivedUserIds = uniqIds([
    ...directUserIds,
    ...orderRows.map((row: any) => row.user_id),
    ...customerRows.map((row: any) => row.user_id),
  ]);

  const [accountsByIdRes, accountsByUserRes] = await Promise.all([
    derivedAccountIds.length > 0
      ? db
          .from("accounts")
          .select("id, client_id, account_number, created_at")
          .in("id", derivedAccountIds)
      : Promise.resolve({ data: [], error: null } as any),
    derivedUserIds.length > 0
      ? db
          .from("accounts")
          .select("id, client_id, account_number, created_at")
          .in("client_id", derivedUserIds)
          .eq("status", "active")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (accountsByIdRes.error) throw accountsByIdRes.error;
  if (accountsByUserRes.error) throw accountsByUserRes.error;

  const byAccountId = new Map<string, string>();
  const latestByUser = new Map<string, { account_number: string; created_at: string | null }>();

  for (const row of [...(accountsByIdRes.data || []), ...(accountsByUserRes.data || [])] as any[]) {
    if (row?.id && row?.account_number) {
      byAccountId.set(row.id, row.account_number);
    }
    if (row?.client_id && row?.account_number) {
      latestByUser.set(
        row.client_id,
        pickNewestAccountNumber(latestByUser.get(row.client_id), {
          account_number: row.account_number,
          created_at: row.created_at ?? null,
        }),
      );
    }
  }

  const byUserId = new Map<string, string>();
  for (const [userId, account] of latestByUser.entries()) {
    byUserId.set(userId, account.account_number);
  }

  const byOrderId = new Map<string, string>();
  for (const row of orderRows as any[]) {
    const accountNumber =
      (row.account_id ? byAccountId.get(row.account_id) : null) ||
      (row.user_id ? byUserId.get(row.user_id) : null) ||
      null;

    if (row.id && accountNumber) {
      byOrderId.set(row.id, accountNumber);
    }
  }

  const byCustomerId = new Map<string, string>();
  for (const row of customerRows as any[]) {
    const accountNumber = row.user_id ? byUserId.get(row.user_id) : null;
    if (row.id && accountNumber) {
      byCustomerId.set(row.id, accountNumber);
    }
  }

  return {
    byAccountId,
    byUserId,
    byOrderId,
    byCustomerId,
  };
}

export function resolveCanonicalAccountNumber(
  maps: CanonicalAccountMaps,
  refs: {
    orderId?: string | null;
    customerId?: string | null;
    userId?: string | null;
    accountId?: string | null;
  },
): string | null {
  return (
    (refs.orderId ? maps.byOrderId.get(refs.orderId) : null) ||
    (refs.accountId ? maps.byAccountId.get(refs.accountId) : null) ||
    (refs.customerId ? maps.byCustomerId.get(refs.customerId) : null) ||
    (refs.userId ? maps.byUserId.get(refs.userId) : null) ||
    null
  );
}

export function assertCanonicalAccountInvariant(
  entity: string,
  entityId: string,
  refs: {
    orderId?: string | null;
    customerId?: string | null;
    userId?: string | null;
    accountId?: string | null;
  },
  accountNumber: string | null,
) {
  const hasCanonicalRef = !!(refs.orderId || refs.customerId || refs.userId || refs.accountId);
  if (hasCanonicalRef && !accountNumber) {
    console.warn(
      `[Nivra] No account_number for ${entity}(${entityId}) — entity may lack an active accounts row.`,
    );
  }
}
