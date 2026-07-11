// Module 49 — Phase B1 — Canonical gateway for client account writes
// Single door for profile / service_addresses / billing address writes.
// NOTE: email change is intentionally NOT handled here (see email_change_requests).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import { writeAccountJournal } from '../_shared/writeAccountJournal.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Zod schemas ----------
const Base = {
  account_id: z.string().uuid(),
  idempotency_key: z.string().min(6).max(240),
  correlation_id: z.string().min(6).max(240).optional(),
};

const ProfileUpdate = z.object({
  action: z.literal('profile.update'),
  ...Base,
  payload: z.object({
    first_name: z.string().trim().min(1).max(80).optional(),
    last_name: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().min(7).max(30).optional(),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    preferred_language: z.enum(['fr', 'en']).optional(),
    communication_preference: z.enum(['email', 'sms', 'both', 'none']).optional(),
  }).refine((o) => Object.keys(o).length > 0, { message: 'payload must contain at least one field' }),
});

const AddressFields = {
  label: z.string().trim().min(1).max(80).optional(),
  address_line: z.string().trim().min(3).max(300),
  city: z.string().trim().min(1).max(120).optional(),
  province: z.string().trim().min(2).max(4).optional(),
  postal_code: z.string().trim().min(5).max(12).optional(),
  contact_name: z.string().trim().max(160).optional(),
  contact_phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
};

const AddressCreate = z.object({
  action: z.literal('service_address.create'),
  ...Base,
  payload: z.object({
    ...AddressFields,
    is_primary: z.boolean().optional(),
  }),
});

const AddressUpdate = z.object({
  action: z.literal('service_address.update'),
  ...Base,
  payload: z.object({
    service_address_id: z.string().uuid(),
    label: z.string().trim().min(1).max(80).optional(),
    address_line: z.string().trim().min(3).max(300).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    province: z.string().trim().min(2).max(4).optional(),
    postal_code: z.string().trim().min(5).max(12).optional(),
    contact_name: z.string().trim().max(160).optional(),
    contact_phone: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(500).optional(),
    is_primary: z.boolean().optional(),
  }).refine((o) => Object.keys(o).length > 1, { message: 'nothing to update' }),
});

const AddressSoftDelete = z.object({
  action: z.literal('service_address.soft_delete'),
  ...Base,
  payload: z.object({
    service_address_id: z.string().uuid(),
    reason: z.string().max(500).optional(),
  }),
});

const AddressRestore = z.object({
  action: z.literal('service_address.restore'),
  ...Base,
  payload: z.object({ service_address_id: z.string().uuid() }),
});

const BillingSameAsService = z.object({
  action: z.literal('billing_address.set_same_as_service'),
  ...Base,
  payload: z.object({}).default({}),
});

const BillingSetCustom = z.object({
  action: z.literal('billing_address.set_custom'),
  ...Base,
  payload: z.object({
    billing_address: z.string().trim().min(3).max(300),
    billing_city: z.string().trim().min(1).max(120),
    billing_province: z.string().trim().min(2).max(4),
    billing_postal_code: z.string().trim().min(5).max(12),
  }),
});

const BillingLinkToServiceAddress = z.object({
  action: z.literal('billing_address.link_to_service_address'),
  ...Base,
  payload: z.object({ service_address_id: z.string().uuid() }),
});

const InputSchema = z.discriminatedUnion('action', [
  ProfileUpdate,
  AddressCreate,
  AddressUpdate,
  AddressSoftDelete,
  AddressRestore,
  BillingSameAsService,
  BillingSetCustom,
  BillingLinkToServiceAddress,
]);

// ---------- Helpers ----------

async function loadActor(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.replace('Bearer ', '');
  const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data } = await svc.auth.getUser(jwt);
  return data?.user ?? null;
}

async function canWriteAccount(svc: any, userId: string, accountId: string): Promise<{ ok: boolean; role: string }> {
  // Owner check
  const { data: acct } = await svc.from('accounts').select('client_id').eq('id', accountId).maybeSingle();
  if (acct?.client_id === userId) return { ok: true, role: 'client' };
  // Staff roles
  for (const role of ['admin', 'supervisor', 'support_agent'] as const) {
    const { data: has } = await svc.rpc('has_role', { _user_id: userId, _role: role });
    if (has) return { ok: true, role };
  }
  return { ok: false, role: 'none' };
}

async function reserveIdempotency(
  svc: any,
  accountId: string,
  action: string,
  idempotencyKey: string,
  requestHash: string,
  actorId: string,
): Promise<{ replay: boolean; result: any | null }> {
  // Check existing
  const { data: existing } = await svc
    .from('client_account_action_idempotency')
    .select('id, request_hash, result')
    .eq('account_id', accountId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) {
    return { replay: true, result: existing.result ?? { replay: true } };
  }
  const { error } = await svc.from('client_account_action_idempotency').insert({
    account_id: accountId,
    action,
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    actor_id: actorId,
    result: null,
  });
  if (error && !`${error.message}`.includes('duplicate')) {
    throw error;
  }
  return { replay: false, result: null };
}

async function finalizeIdempotency(
  svc: any,
  accountId: string,
  idempotencyKey: string,
  result: any,
) {
  await svc
    .from('client_account_action_idempotency')
    .update({ result })
    .eq('account_id', accountId)
    .eq('idempotency_key', idempotencyKey);
}

async function auditAndJournal(
  svc: any,
  {
    accountId,
    action,
    before,
    after,
    correlationId,
    actorId,
    actorRole,
  }: {
    accountId: string;
    action: string;
    before: any;
    after: any;
    correlationId: string;
    actorId: string;
    actorRole: string;
  },
) {
  // admin_audit_log
  await svc.from('admin_audit_log').insert({
    admin_user_id: actorId,
    action: `client_account.${action}`,
    resource_type: 'account',
    resource_id: accountId,
    details: { before, after, correlation_id: correlationId, actor_role: actorRole },
  });

  // Timeline
  try {
    await writeAccountJournal(svc, {
      targetTable: 'client_activity_logs',
      payload: {
        client_id: null, // resolved via account_id in RPC
        account_id: accountId,
        activity_type: `account.${action}`,
        description: `Client account ${action}`,
        metadata: { before, after },
      },
      eventKey: `account:${accountId}:${action}:${correlationId}`,
      correlationId,
      actor: { userId: actorId, role: actorRole },
      visibility: 'staff',
    });
  } catch (e) {
    console.warn('journal write failed (non-fatal):', (e as Error).message);
  }
}

// ---------- Action handlers ----------

async function handleProfileUpdate(svc: any, actor: any, actorRole: string, input: z.infer<typeof ProfileUpdate>, correlationId: string) {
  const { data: acct } = await svc.from('accounts').select('client_id').eq('id', input.account_id).maybeSingle();
  if (!acct?.client_id) throw new Error('account not found');

  const { data: before } = await svc
    .from('profiles')
    .select('first_name,last_name,phone,date_of_birth,preferred_language,communication_preference')
    .eq('id', acct.client_id)
    .maybeSingle();

  const patch: Record<string, unknown> = { ...input.payload };
  const { data: after, error } = await svc
    .from('profiles')
    .update(patch)
    .eq('id', acct.client_id)
    .select('first_name,last_name,phone,date_of_birth,preferred_language,communication_preference')
    .maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'profile.update',
    before, after,
    correlationId, actorId: actor.id, actorRole,
  });
  return { ok: true, before, after };
}

async function handleAddressCreate(svc: any, actor: any, actorRole: string, input: z.infer<typeof AddressCreate>, correlationId: string) {
  const p = input.payload;
  const { data: after, error } = await svc.from('service_addresses').insert({
    account_id: input.account_id,
    label: p.label ?? 'Service',
    address_line: p.address_line,
    city: p.city,
    province: p.province,
    postal_code: p.postal_code,
    contact_name: p.contact_name,
    contact_phone: p.contact_phone,
    notes: p.notes,
    is_primary: p.is_primary ?? false,
    is_active: true,
    created_by_user_id: actor.id,
    created_via: 'client-account-actions',
  }).select('*').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'service_address.create',
    before: null, after,
    correlationId, actorId: actor.id, actorRole,
  });
  return { ok: true, service_address: after };
}

async function handleAddressUpdate(svc: any, actor: any, actorRole: string, input: z.infer<typeof AddressUpdate>, correlationId: string) {
  const { service_address_id, ...patch } = input.payload;
  const { data: before } = await svc.from('service_addresses').select('*').eq('id', service_address_id).eq('account_id', input.account_id).maybeSingle();
  if (!before) throw new Error('service_address not found for account');
  const { data: after, error } = await svc.from('service_addresses').update(patch).eq('id', service_address_id).select('*').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'service_address.update',
    before, after,
    correlationId, actorId: actor.id, actorRole,
  });
  return { ok: true, service_address: after };
}

async function handleAddressSoftDelete(svc: any, actor: any, actorRole: string, input: z.infer<typeof AddressSoftDelete>, correlationId: string) {
  const { service_address_id, reason } = input.payload;
  const { data: before } = await svc.from('service_addresses').select('*').eq('id', service_address_id).eq('account_id', input.account_id).maybeSingle();
  if (!before) throw new Error('service_address not found');
  if (before.is_primary) throw new Error('cannot delete primary service address');
  const { data: after, error } = await svc
    .from('service_addresses')
    .update({ is_active: false, deleted_at: new Date().toISOString(), notes: reason ? `[deleted] ${reason}` : before.notes })
    .eq('id', service_address_id)
    .select('*').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'service_address.soft_delete',
    before, after,
    correlationId, actorId: actor.id, actorRole,
  });
  return { ok: true, service_address: after };
}

async function handleAddressRestore(svc: any, actor: any, actorRole: string, input: z.infer<typeof AddressRestore>, correlationId: string) {
  const { service_address_id } = input.payload;
  const { data: before } = await svc.from('service_addresses').select('*').eq('id', service_address_id).eq('account_id', input.account_id).maybeSingle();
  if (!before) throw new Error('service_address not found');
  const { data: after, error } = await svc
    .from('service_addresses')
    .update({ is_active: true, deleted_at: null })
    .eq('id', service_address_id)
    .select('*').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'service_address.restore',
    before, after,
    correlationId, actorId: actor.id, actorRole,
  });
  return { ok: true, service_address: after };
}

async function handleBillingSameAsService(svc: any, actor: any, actorRole: string, input: z.infer<typeof BillingSameAsService>, correlationId: string) {
  const { data: before } = await svc.from('accounts').select('billing_same_as_service,billing_service_address_id,billing_address,billing_city,billing_province,billing_postal_code').eq('id', input.account_id).maybeSingle();
  const { data: after, error } = await svc.from('accounts').update({
    billing_same_as_service: true,
    billing_service_address_id: null,
  }).eq('id', input.account_id).select('billing_same_as_service,billing_service_address_id,billing_address,billing_city,billing_province,billing_postal_code').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'billing_address.set_same_as_service',
    before, after,
    correlationId, actorId: actor.id, actorRole,
  });
  return { ok: true, accounts: after };
}

async function handleBillingSetCustom(svc: any, actor: any, actorRole: string, input: z.infer<typeof BillingSetCustom>, correlationId: string) {
  const p = input.payload;
  const { data: before } = await svc.from('accounts').select('billing_same_as_service,billing_service_address_id,billing_address,billing_city,billing_province,billing_postal_code').eq('id', input.account_id).maybeSingle();
  const { data: after, error } = await svc.from('accounts').update({
    billing_same_as_service: false,
    billing_service_address_id: null,
    billing_address: p.billing_address,
    billing_city: p.billing_city,
    billing_province: p.billing_province,
    billing_postal_code: p.billing_postal_code,
  }).eq('id', input.account_id).select('billing_same_as_service,billing_service_address_id,billing_address,billing_city,billing_province,billing_postal_code').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'billing_address.set_custom',
    before, after,
    correlationId, actorId: actor.id, actorRole,
  });
  return { ok: true, accounts: after };
}

async function handleBillingLinkToServiceAddress(svc: any, actor: any, actorRole: string, input: z.infer<typeof BillingLinkToServiceAddress>, correlationId: string) {
  const { service_address_id } = input.payload;
  const { data: sa } = await svc.from('service_addresses').select('id,account_id,is_active').eq('id', service_address_id).maybeSingle();
  if (!sa || sa.account_id !== input.account_id) throw new Error('service_address not found for account');
  if (sa.is_active === false) throw new Error('service_address is inactive');

  const { data: before } = await svc.from('accounts').select('billing_same_as_service,billing_service_address_id').eq('id', input.account_id).maybeSingle();
  const { data: after, error } = await svc.from('accounts').update({
    billing_same_as_service: false,
    billing_service_address_id: service_address_id,
  }).eq('id', input.account_id).select('billing_same_as_service,billing_service_address_id').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'billing_address.link_to_service_address',
    before, after,
    correlationId, actorId: actor.id, actorRole,
  });
  return { ok: true, accounts: after };
}

// ---------- Server ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const actor = await loadActor(req.headers.get('Authorization'));
    if (!actor) return j({ error: 'unauthorized' }, 401);

    const raw = await req.json();
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) return j({ error: 'validation_failed', details: parsed.error.flatten() }, 400);
    const input = parsed.data;

    const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // RBAC
    const rbac = await canWriteAccount(svc, actor.id, input.account_id);
    if (!rbac.ok) return j({ error: 'forbidden' }, 403);

    // Idempotency
    const correlationId = input.correlation_id ?? crypto.randomUUID();
    const requestHash = await sha256(JSON.stringify({ action: input.action, account_id: input.account_id, payload: (input as any).payload ?? {} }));
    const reserved = await reserveIdempotency(svc, input.account_id, input.action, input.idempotency_key, requestHash, actor.id);
    if (reserved.replay) return j({ ok: true, replay: true, result: reserved.result });

    let result: any;
    switch (input.action) {
      case 'profile.update': result = await handleProfileUpdate(svc, actor, rbac.role, input, correlationId); break;
      case 'service_address.create': result = await handleAddressCreate(svc, actor, rbac.role, input, correlationId); break;
      case 'service_address.update': result = await handleAddressUpdate(svc, actor, rbac.role, input, correlationId); break;
      case 'service_address.soft_delete': result = await handleAddressSoftDelete(svc, actor, rbac.role, input, correlationId); break;
      case 'service_address.restore': result = await handleAddressRestore(svc, actor, rbac.role, input, correlationId); break;
      case 'billing_address.set_same_as_service': result = await handleBillingSameAsService(svc, actor, rbac.role, input, correlationId); break;
      case 'billing_address.set_custom': result = await handleBillingSetCustom(svc, actor, rbac.role, input, correlationId); break;
      case 'billing_address.link_to_service_address': result = await handleBillingLinkToServiceAddress(svc, actor, rbac.role, input, correlationId); break;
    }

    const response = { ...result, correlation_id: correlationId };
    await finalizeIdempotency(svc, input.account_id, input.idempotency_key, response);
    return j(response);
  } catch (e) {
    console.error('client-account-actions error:', e);
    return j({ error: (e as Error).message || 'internal_error' }, 500);
  }
});
