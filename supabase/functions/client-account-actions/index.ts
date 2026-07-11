// Module 49 + 50 — Canonical gateway for client account writes
// Single door for profile / service_addresses / billing address / email / phone identity writes.
// Module 50 adds: email.request_change, email.confirm_change, phone.request_change, phone.verify_otp.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import { writeAccountJournal } from '../_shared/writeAccountJournal.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

// B1.1 FIX: removed `communication_preference` — column does not exist on profiles.
// Module 50: `reason` is REQUIRED for identity mutations.
const ProfileUpdate = z.object({
  action: z.literal('profile.update'),
  ...Base,
  reason: z.string().trim().min(3).max(500),
  payload: z.object({
    first_name: z.string().trim().min(1).max(80).optional(),
    last_name: z.string().trim().min(1).max(80).optional(),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    preferred_language: z.enum(['fr', 'en']).optional(),
  }).refine((o) => Object.keys(o).length > 0, { message: 'payload must contain at least one field' }),
});

// Module 50 — Email double opt-in
const EmailRequestChange = z.object({
  action: z.literal('email.request_change'),
  ...Base,
  reason: z.string().trim().min(3).max(500),
  payload: z.object({
    new_email: z.string().trim().email().max(254),
  }),
});

const EmailConfirmChange = z.object({
  action: z.literal('email.confirm_change'),
  ...Base,
  payload: z.object({
    verification_token: z.string().min(16).max(128),
  }),
});

// Module 50 — Phone OTP
const PhoneRequestChange = z.object({
  action: z.literal('phone.request_change'),
  ...Base,
  reason: z.string().trim().min(3).max(500),
  payload: z.object({
    new_phone: z.string().trim().regex(/^\+?[\d\s\-()]{7,20}$/),
  }),
});

const PhoneVerifyOtp = z.object({
  action: z.literal('phone.verify_otp'),
  ...Base,
  payload: z.object({
    request_id: z.string().uuid(),
    otp: z.string().trim().regex(/^\d{6}$/),
  }),
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
  EmailRequestChange,
  EmailConfirmChange,
  PhoneRequestChange,
  PhoneVerifyOtp,
]);

// ---------- Helpers ----------

async function loadActor(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.replace('Bearer ', '');
  const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data } = await svc.auth.getUser(jwt);
  return data?.user ?? null;
}

// B1.1 FIX: `support_agent` does not exist in app_role — replaced with `support`.
async function canWriteAccount(svc: any, userId: string, accountId: string): Promise<{ ok: boolean; role: string }> {
  const { data: acct } = await svc.from('accounts').select('client_id').eq('id', accountId).maybeSingle();
  if (acct?.client_id === userId) return { ok: true, role: 'client' };
  for (const role of ['admin', 'supervisor', 'support'] as const) {
    const { data: has } = await svc.rpc('has_role', { _user_id: userId, _role: role });
    if (has) return { ok: true, role };
  }
  return { ok: false, role: 'none' };
}

// B1.1 FIX: replay only when result IS NOT NULL. Poisoned rows (result null)
// are treated as unclaimed and re-executed. Failed attempts also clean up.
async function reserveIdempotency(
  svc: any,
  accountId: string,
  action: string,
  idempotencyKey: string,
  requestHash: string,
  actorId: string,
): Promise<{ replay: boolean; result: any | null }> {
  const { data: existing } = await svc
    .from('client_account_action_idempotency')
    .select('id, request_hash, result')
    .eq('account_id', accountId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing && existing.result !== null) {
    return { replay: true, result: existing.result };
  }

  if (existing && existing.result === null) {
    // Stale/poisoned reservation — clear it and re-reserve.
    await svc
      .from('client_account_action_idempotency')
      .delete()
      .eq('account_id', accountId)
      .eq('idempotency_key', idempotencyKey);
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

async function releaseIdempotency(svc: any, accountId: string, idempotencyKey: string) {
  await svc
    .from('client_account_action_idempotency')
    .delete()
    .eq('account_id', accountId)
    .eq('idempotency_key', idempotencyKey);
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

// B1.1 FIX: admin_audit_log columns are target_type/target_id/admin_email — not resource_*.
// Journal + audit run best-effort AFTER the business write already succeeded.
async function auditAndJournal(
  svc: any,
  {
    accountId,
    action,
    before,
    after,
    reason,
    correlationId,
    actorId,
    actorRole,
    actorEmail,
    moduleTag = 'module_49',
  }: {
    accountId: string;
    action: string;
    before: any;
    after: any;
    reason?: string | null;
    correlationId: string;
    actorId: string;
    actorRole: string;
    actorEmail: string | null;
    moduleTag?: string;
  },
) {
  try {
    await svc.from('admin_audit_log').insert({
      admin_user_id: actorId,
      admin_email: actorEmail,
      action: `client_account.${action}`,
      target_type: 'account',
      target_id: accountId,
      details: { before, after, reason: reason ?? null, correlation_id: correlationId, actor_role: actorRole, module_tag: moduleTag },
    });
  } catch (e) {
    console.warn('admin_audit_log insert failed (non-fatal):', (e as Error).message);
  }

  try {
    const { data: acct } = await svc.from('accounts').select('client_id').eq('id', accountId).maybeSingle();
    await writeAccountJournal(svc, {
      targetTable: 'client_activity_logs',
      payload: {
        client_id: acct?.client_id ?? null,
        account_id: accountId,
        action_type: `account.${action}`,
        entity_type: 'account',
        entity_id: accountId,
        summary: reason ? `${action} — ${reason}` : `Client account ${action}`,
        before_data: before,
        after_data: after,
        metadata: { before, after, reason: reason ?? null },
      },
      eventKey: `account:${accountId}:${action}:${correlationId}`,
      correlationId,
      actor: { userId: actorId, role: actorRole, email: actorEmail },
      visibility: 'staff',
    });
  } catch (e) {
    console.warn('journal write failed (non-fatal):', (e as Error).message);
  }
}

// B1.1 FIX: demote any other primary address on the same account.
async function demoteOtherPrimaries(svc: any, accountId: string, keepId: string | null) {
  const q = svc
    .from('service_addresses')
    .update({ is_primary: false })
    .eq('account_id', accountId)
    .eq('is_primary', true);
  const { error } = keepId ? await q.neq('id', keepId) : await q;
  if (error) throw error;
}

// ---------- Action handlers ----------

// B1.1 FIX: profiles is keyed by user_id (= accounts.client_id), not id.
async function handleProfileUpdate(svc: any, actor: any, actorRole: string, input: z.infer<typeof ProfileUpdate>, correlationId: string) {
  const { data: acct } = await svc.from('accounts').select('client_id').eq('id', input.account_id).maybeSingle();
// B1.1 FIX: profiles is keyed by user_id (= accounts.client_id), not id.
// Module 50: identity update no longer accepts `phone` here — use phone.request_change/verify_otp.
async function handleProfileUpdate(svc: any, actor: any, actorRole: string, input: z.infer<typeof ProfileUpdate>, correlationId: string) {
  const { data: acct } = await svc.from('accounts').select('client_id').eq('id', input.account_id).maybeSingle();
  if (!acct?.client_id) throw new Error('account not found');

  const { data: before } = await svc
    .from('profiles')
    .select('first_name,last_name,date_of_birth,preferred_language')
    .eq('user_id', acct.client_id)
    .maybeSingle();
  if (!before) throw new Error('profile not found for account.client_id');

  const patch: Record<string, unknown> = { ...input.payload };
  // Derive full_name when name parts change.
  if (patch.first_name !== undefined || patch.last_name !== undefined) {
    const fn = (patch.first_name ?? before.first_name ?? '').toString().trim();
    const ln = (patch.last_name ?? before.last_name ?? '').toString().trim();
    (patch as any).full_name = `${fn} ${ln}`.trim();
  }

  const { data: after, error } = await svc
    .from('profiles')
    .update(patch)
    .eq('user_id', acct.client_id)
    .select('first_name,last_name,date_of_birth,preferred_language,full_name')
    .maybeSingle();
  if (error) throw error;
  if (!after) throw new Error('profile update matched no row');

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'profile.update',
    before, after,
    reason: input.reason,
    moduleTag: 'module_50',
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });
  return { ok: true, before, after };
}

async function handleAddressCreate(svc: any, actor: any, actorRole: string, input: z.infer<typeof AddressCreate>, correlationId: string) {
  const p = input.payload;
  const willBePrimary = p.is_primary === true;

  if (willBePrimary) {
    await demoteOtherPrimaries(svc, input.account_id, null);
  }

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
    is_primary: willBePrimary,
    is_active: true,
    created_by_user_id: actor.id,
    created_via: 'core',
  }).select('*').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'service_address.create',
    before: null, after,
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });
  return { ok: true, service_address: after };
}

async function handleAddressUpdate(svc: any, actor: any, actorRole: string, input: z.infer<typeof AddressUpdate>, correlationId: string) {
  const { service_address_id, ...patch } = input.payload;
  const { data: before } = await svc.from('service_addresses').select('*').eq('id', service_address_id).eq('account_id', input.account_id).maybeSingle();
  if (!before) throw new Error('service_address not found for account');

  if (patch.is_primary === true) {
    await demoteOtherPrimaries(svc, input.account_id, service_address_id);
  }

  const { data: after, error } = await svc.from('service_addresses').update(patch).eq('id', service_address_id).select('*').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'service_address.update',
    before, after,
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });
  return { ok: true, service_address: after };
}

// B1.1 FIX: refuse if an active billing_subscription references this address.
// Do NOT overwrite notes — append reason into deletion_reason / metadata via notes suffix only when notes is empty.
async function handleAddressSoftDelete(svc: any, actor: any, actorRole: string, input: z.infer<typeof AddressSoftDelete>, correlationId: string) {
  const { service_address_id, reason } = input.payload;
  const { data: before } = await svc.from('service_addresses').select('*').eq('id', service_address_id).eq('account_id', input.account_id).maybeSingle();
  if (!before) throw new Error('service_address not found');
  if (before.is_primary) throw new Error('cannot delete primary service address');

  // Reject if an active subscription is bound to this address.
  const { count: activeSubs, error: subErr } = await svc
    .from('billing_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('service_address_id', service_address_id)
    .in('status', ['active', 'pending', 'suspended']);
  if (subErr) throw subErr;
  if ((activeSubs ?? 0) > 0) {
    throw new Error(`cannot delete: ${activeSubs} active subscription(s) still bound to this address`);
  }

  // Also block if a billing_service_address_id link exists on the account.
  const { data: acctLink } = await svc
    .from('accounts')
    .select('billing_service_address_id')
    .eq('id', input.account_id)
    .maybeSingle();
  if (acctLink?.billing_service_address_id === service_address_id) {
    throw new Error('cannot delete: this address is the billing address');
  }

  const patch: Record<string, unknown> = {
    is_active: false,
    deleted_at: new Date().toISOString(),
  };
  // Preserve existing notes; append reason only if room and non-destructive.
  if (reason) {
    const existing = (before.notes ?? '').toString();
    const suffix = `[deleted: ${reason}]`;
    patch.notes = existing ? `${existing}\n${suffix}` : suffix;
  }

  const { data: after, error } = await svc
    .from('service_addresses')
    .update(patch)
    .eq('id', service_address_id)
    .select('*').maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'service_address.soft_delete',
    before, after,
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });
  return { ok: true, service_address: after };
}

async function handleAddressRestore(svc: any, actor: any, actorRole: string, input: z.infer<typeof AddressRestore>, correlationId: string) {
  const { service_address_id } = input.payload;
  const { data: before } = await svc.from('service_addresses').select('*').eq('id', service_address_id).eq('account_id', input.account_id).maybeSingle();
  if (!before) throw new Error('service_address not found');
  if (before.is_active === true && before.deleted_at === null) {
    const err: any = new Error('service_address already active');
    err.status = 409;
    err.code = 'ALREADY_ACTIVE';
    throw err;
  }
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
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });
  return { ok: true, service_address: after };
}

// B1.1 FIX: null out the 4 legacy billing_* columns when same-as-service.
async function handleBillingSameAsService(svc: any, actor: any, actorRole: string, input: z.infer<typeof BillingSameAsService>, correlationId: string) {
  const cols = 'billing_same_as_service,billing_service_address_id,billing_address,billing_city,billing_province,billing_postal_code';
  const { data: before } = await svc.from('accounts').select(cols).eq('id', input.account_id).maybeSingle();
  const { data: after, error } = await svc.from('accounts').update({
    billing_same_as_service: true,
    billing_service_address_id: null,
    billing_address: null,
    billing_city: null,
    billing_province: null,
    billing_postal_code: null,
  }).eq('id', input.account_id).select(cols).maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'billing_address.set_same_as_service',
    before, after,
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });
  return { ok: true, accounts: after };
}

async function handleBillingSetCustom(svc: any, actor: any, actorRole: string, input: z.infer<typeof BillingSetCustom>, correlationId: string) {
  const p = input.payload;
  const cols = 'billing_same_as_service,billing_service_address_id,billing_address,billing_city,billing_province,billing_postal_code';
  const { data: before } = await svc.from('accounts').select(cols).eq('id', input.account_id).maybeSingle();
  const { data: after, error } = await svc.from('accounts').update({
    billing_same_as_service: false,
    billing_service_address_id: null,
    billing_address: p.billing_address,
    billing_city: p.billing_city,
    billing_province: p.billing_province,
    billing_postal_code: p.billing_postal_code,
  }).eq('id', input.account_id).select(cols).maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'billing_address.set_custom',
    before, after,
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });
  return { ok: true, accounts: after };
}

// B1.1 FIX: also null out the 4 legacy billing_* columns when linking.
async function handleBillingLinkToServiceAddress(svc: any, actor: any, actorRole: string, input: z.infer<typeof BillingLinkToServiceAddress>, correlationId: string) {
  const { service_address_id } = input.payload;
  const { data: sa } = await svc.from('service_addresses').select('id,account_id,is_active').eq('id', service_address_id).maybeSingle();
  if (!sa || sa.account_id !== input.account_id) throw new Error('service_address not found for account');
  if (sa.is_active === false) throw new Error('service_address is inactive');

  const cols = 'billing_same_as_service,billing_service_address_id,billing_address,billing_city,billing_province,billing_postal_code';
  const { data: before } = await svc.from('accounts').select(cols).eq('id', input.account_id).maybeSingle();
  const { data: after, error } = await svc.from('accounts').update({
    billing_same_as_service: false,
    billing_service_address_id: service_address_id,
    billing_address: null,
    billing_city: null,
    billing_province: null,
    billing_postal_code: null,
  }).eq('id', input.account_id).select(cols).maybeSingle();
  if (error) throw error;

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'billing_address.link_to_service_address',
    before, after,
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });
  return { ok: true, accounts: after };
}

// ---------- Module 50 — Email double opt-in ----------
function randToken(len = 48): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}

function randOtp(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, '0');
}

async function handleEmailRequestChange(svc: any, actor: any, actorRole: string, input: z.infer<typeof EmailRequestChange>, correlationId: string) {
  const { data: acct } = await svc.from('accounts').select('client_id').eq('id', input.account_id).maybeSingle();
  if (!acct?.client_id) throw new Error('account not found');

  const { data: profile } = await svc.from('profiles').select('email,first_name').eq('user_id', acct.client_id).maybeSingle();
  const currentEmail = profile?.email ?? null;
  const newEmail = input.payload.new_email.toLowerCase();
  if (currentEmail && currentEmail.toLowerCase() === newEmail) {
    const err: any = new Error('new_email equals current email'); err.status = 409; err.code = 'SAME_EMAIL'; throw err;
  }

  // Invalidate previous pending requests for this client.
  await svc.from('email_change_requests').update({ status: 'cancelled' })
    .eq('client_id', acct.client_id).eq('status', 'pending');

  const token = randToken(48);
  const { data: req, error } = await svc.from('email_change_requests').insert({
    client_id: acct.client_id,
    current_email: currentEmail ?? '',
    new_email: newEmail,
    verification_token: token,
    status: 'pending',
  }).select('id, expires_at').maybeSingle();
  if (error) throw error;

  // Send verification email via canonical gateway (best-effort).
  try {
    await svc.rpc('rpc_communication_enqueue', {
      p_channel: 'email',
      p_template_key: 'email_change_verify',
      p_recipient: newEmail,
      p_template_vars: {
        first_name: profile?.first_name ?? '',
        verification_token: token,
        expires_at: req?.expires_at,
      },
      p_idempotency_key: `email_change_verify:${req?.id}`,
      p_client_id: acct.client_id,
      p_category: 'transactional',
      p_actor_user_id: actor.id,
      p_actor_role: actorRole,
      p_entity_type: 'email_change_request',
      p_entity_id: req?.id,
      p_correlation_id: correlationId,
      p_reason: input.reason,
    });
  } catch (e) { console.warn('email enqueue failed (non-fatal):', (e as Error).message); }

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'email.request_change',
    before: { email: currentEmail },
    after: { email_pending: newEmail, request_id: req?.id },
    reason: input.reason,
    moduleTag: 'module_50',
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });

  return { ok: true, request_id: req?.id, expires_at: req?.expires_at, new_email: newEmail };
}

async function handleEmailConfirmChange(svc: any, actor: any, actorRole: string, input: z.infer<typeof EmailConfirmChange>, correlationId: string) {
  const { data: acct } = await svc.from('accounts').select('client_id').eq('id', input.account_id).maybeSingle();
  if (!acct?.client_id) throw new Error('account not found');

  const { data: req } = await svc.from('email_change_requests')
    .select('*').eq('verification_token', input.payload.verification_token).maybeSingle();
  if (!req) { const e: any = new Error('token not found'); e.status = 404; e.code = 'TOKEN_NOT_FOUND'; throw e; }
  if (req.client_id !== acct.client_id) { const e: any = new Error('token/account mismatch'); e.status = 403; e.code = 'TOKEN_MISMATCH'; throw e; }
  if (req.status !== 'pending' && req.status !== 'old_verified') { const e: any = new Error(`request status is ${req.status}`); e.status = 409; e.code = 'INVALID_STATUS'; throw e; }
  if (new Date(req.expires_at).getTime() < Date.now()) {
    await svc.from('email_change_requests').update({ status: 'expired' }).eq('id', req.id);
    const e: any = new Error('token expired'); e.status = 410; e.code = 'EXPIRED'; throw e;
  }

  const { data: before } = await svc.from('profiles').select('email').eq('user_id', acct.client_id).maybeSingle();
  const { data: after, error } = await svc.from('profiles')
    .update({ email: req.new_email }).eq('user_id', acct.client_id).select('email').maybeSingle();
  if (error) throw error;

  await svc.from('email_change_requests').update({
    status: 'completed', new_email_verified: true, completed_at: new Date().toISOString(),
  }).eq('id', req.id);

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'email.confirm_change',
    before, after,
    reason: 'confirm via verification token',
    moduleTag: 'module_50',
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });

  return { ok: true, email: after?.email };
}

// ---------- Module 50 — Phone OTP ----------
async function handlePhoneRequestChange(svc: any, actor: any, actorRole: string, input: z.infer<typeof PhoneRequestChange>, correlationId: string) {
  const { data: acct } = await svc.from('accounts').select('client_id').eq('id', input.account_id).maybeSingle();
  if (!acct?.client_id) throw new Error('account not found');

  // Normalize to a permissive digit form (E.164-lite): strip spaces/dashes/parens.
  const raw = input.payload.new_phone;
  const digits = raw.replace(/[^\d+]/g, '');
  const newPhone = digits.startsWith('+') ? digits : (digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : digits);

  const { data: profile } = await svc.from('profiles').select('phone,first_name').eq('user_id', acct.client_id).maybeSingle();
  if (profile?.phone === newPhone) {
    const err: any = new Error('new_phone equals current phone'); err.status = 409; err.code = 'SAME_PHONE'; throw err;
  }

  // Rate limit: cancel any pending request older than 30s, allow only 1 pending at a time.
  await svc.from('phone_change_requests').update({ status: 'cancelled' })
    .eq('client_id', acct.client_id).eq('status', 'pending');

  const otp = randOtp();
  const otpHash = await sha256(otp);
  const { data: req, error } = await svc.from('phone_change_requests').insert({
    client_id: acct.client_id,
    current_phone: profile?.phone ?? null,
    new_phone: newPhone,
    otp_hash: otpHash,
    status: 'pending',
    requested_by: actor.id,
    requested_by_role: actorRole,
    reason: input.reason,
    correlation_id: correlationId,
  }).select('id, expires_at').maybeSingle();
  if (error) throw error;

  // Send OTP via SMS gateway (best-effort).
  try {
    await svc.rpc('rpc_communication_enqueue', {
      p_channel: 'sms',
      p_template_key: 'phone_change_otp',
      p_recipient: newPhone,
      p_template_vars: { first_name: profile?.first_name ?? '', otp },
      p_idempotency_key: `phone_change_otp:${req?.id}`,
      p_client_id: acct.client_id,
      p_category: 'transactional',
      p_actor_user_id: actor.id,
      p_actor_role: actorRole,
      p_entity_type: 'phone_change_request',
      p_entity_id: req?.id,
      p_correlation_id: correlationId,
      p_reason: input.reason,
    });
  } catch (e) { console.warn('sms enqueue failed (non-fatal):', (e as Error).message); }

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'phone.request_change',
    before: { phone: profile?.phone ?? null },
    after: { phone_pending: newPhone, request_id: req?.id },
    reason: input.reason,
    moduleTag: 'module_50',
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });

  return { ok: true, request_id: req?.id, expires_at: req?.expires_at, new_phone: newPhone };
}

async function handlePhoneVerifyOtp(svc: any, actor: any, actorRole: string, input: z.infer<typeof PhoneVerifyOtp>, correlationId: string) {
  const { data: acct } = await svc.from('accounts').select('client_id').eq('id', input.account_id).maybeSingle();
  if (!acct?.client_id) throw new Error('account not found');

  const { data: req } = await svc.from('phone_change_requests')
    .select('*').eq('id', input.payload.request_id).maybeSingle();
  if (!req) { const e: any = new Error('request not found'); e.status = 404; e.code = 'REQUEST_NOT_FOUND'; throw e; }
  if (req.client_id !== acct.client_id) { const e: any = new Error('request/account mismatch'); e.status = 403; e.code = 'REQUEST_MISMATCH'; throw e; }
  if (req.status !== 'pending') { const e: any = new Error(`request status is ${req.status}`); e.status = 409; e.code = 'INVALID_STATUS'; throw e; }
  if (new Date(req.expires_at).getTime() < Date.now()) {
    await svc.from('phone_change_requests').update({ status: 'expired' }).eq('id', req.id);
    const e: any = new Error('otp expired'); e.status = 410; e.code = 'EXPIRED'; throw e;
  }
  if ((req.attempts ?? 0) >= (req.max_attempts ?? 5)) {
    await svc.from('phone_change_requests').update({ status: 'failed' }).eq('id', req.id);
    const e: any = new Error('max attempts reached'); e.status = 429; e.code = 'MAX_ATTEMPTS'; throw e;
  }

  const submittedHash = await sha256(input.payload.otp);
  if (submittedHash !== req.otp_hash) {
    await svc.from('phone_change_requests').update({ attempts: (req.attempts ?? 0) + 1 }).eq('id', req.id);
    const e: any = new Error('invalid otp'); e.status = 401; e.code = 'INVALID_OTP'; throw e;
  }

  const { data: before } = await svc.from('profiles').select('phone').eq('user_id', acct.client_id).maybeSingle();
  const { data: after, error } = await svc.from('profiles')
    .update({ phone: req.new_phone }).eq('user_id', acct.client_id).select('phone').maybeSingle();
  if (error) throw error;

  await svc.from('phone_change_requests').update({
    status: 'verified', verified_at: new Date().toISOString(),
  }).eq('id', req.id);

  await auditAndJournal(svc, {
    accountId: input.account_id,
    action: 'phone.verify_otp',
    before, after,
    reason: req.reason ?? 'phone verified via OTP',
    moduleTag: 'module_50',
    correlationId, actorId: actor.id, actorRole, actorEmail: actor.email ?? null,
  });

  return { ok: true, phone: after?.phone };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let reservedForCleanup: { accountId: string; key: string } | null = null;
  try {
    const actor = await loadActor(req.headers.get('Authorization'));
    if (!actor) return j({ error: 'unauthorized' }, 401);

    const raw = await req.json();
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) return j({ error: 'validation_failed', details: parsed.error.flatten() }, 400);
    const input = parsed.data;

    const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const rbac = await canWriteAccount(svc, actor.id, input.account_id);
    if (!rbac.ok) return j({ error: 'forbidden' }, 403);

    const correlationId = input.correlation_id ?? crypto.randomUUID();
    const requestHash = await sha256(JSON.stringify({ action: input.action, account_id: input.account_id, payload: (input as any).payload ?? {} }));
    const reserved = await reserveIdempotency(svc, input.account_id, input.action, input.idempotency_key, requestHash, actor.id);
    if (reserved.replay) return j({ ok: true, replay: true, result: reserved.result });
    reservedForCleanup = { accountId: input.account_id, key: input.idempotency_key };

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
    reservedForCleanup = null;
    return j(response);
  } catch (e) {
    console.error('client-account-actions error:', e);
    // B1.1 FIX: delete the poisoned reservation on failure so retries are not blocked.
    if (reservedForCleanup) {
      try {
        const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
        await releaseIdempotency(svc, reservedForCleanup.accountId, reservedForCleanup.key);
      } catch (_) { /* ignore */ }
    }
    const status = (e as any)?.status && Number.isInteger((e as any).status) ? (e as any).status : 500;
    const code = (e as any)?.code;
    return j({ error: (e as Error).message || 'internal_error', ...(code ? { code } : {}) }, status);
  }
});
