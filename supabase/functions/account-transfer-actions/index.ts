// Module 48 — Account Ownership Transfer canonical Edge Function
// Single door for all writes to account_ownership_transfers + orchestration.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sha256(s: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then((buf) =>
    Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  );
}

const CreateSchema = z.object({
  action: z.literal('create_transfer'),
  account_id: z.string().uuid(),
  old_client_id: z.string().uuid(),
  new_client_id: z.string().uuid().nullable().optional(),
  new_client_payload: z
    .object({
      email: z.string().email(),
      first_name: z.string().min(1).max(80),
      last_name: z.string().min(1).max(80),
      phone: z.string().min(7).max(30),
      date_of_birth: z.string().optional(),
      address: z.string().max(300).optional(),
    })
    .nullable()
    .optional(),
  transfer_type: z.enum(['personal_transfer', 'business_transfer']).default('personal_transfer'),
  services_transferred: z.array(z.string()).default([]),
  billing_transfer_option: z.enum(['new_owner_all', 'old_keeps_debt', 'full_transfer']),
  equipment_transfer_option: z.string().default('transfer_all'),
  service_address_option: z.enum(['keep', 'new']).default('keep'),
  new_service_address: z.record(z.any()).nullable().optional(),
  reason: z.string().max(500).optional(),
  admin_override: z.boolean().default(false),
  admin_override_reason: z.string().max(500).optional(),
  idempotency_key: z.string().min(6).max(240),
});

const TokenSchema = z.object({
  action: z.enum(['approve_old_owner', 'approve_new_owner', 'reject_transfer']),
  token: z.string().min(10),
});

const IdSchema = z.object({
  action: z.enum(['cancel_transfer', 'execute_transfer', 'rollback_transfer']),
  transfer_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const auth = req.headers.get('Authorization') || '';
    const jwt = auth.replace('Bearer ', '');
    const { data: userData } = await svc.auth.getUser(jwt);
    const actor = userData?.user;
    const body = await req.json();

    // Token-based endpoints (email confirmation) — no auth needed
    if (['approve_old_owner', 'approve_new_owner', 'reject_transfer'].includes(body.action)) {
      const p = TokenSchema.safeParse(body);
      if (!p.success) return j({ error: p.error.flatten() }, 400);
      return await handleToken(svc, p.data);
    }

    // Admin/supervisor gated actions
    if (!actor) return j({ error: 'unauthorized' }, 401);
    const { data: isAdmin } = await svc.rpc('has_role', { _user_id: actor.id, _role: 'admin' });
    const { data: isSup } = await svc.rpc('has_role', { _user_id: actor.id, _role: 'supervisor' });
    if (!isAdmin && !isSup) return j({ error: 'forbidden' }, 403);

    if (body.action === 'create_transfer') {
      const p = CreateSchema.safeParse(body);
      if (!p.success) return j({ error: p.error.flatten() }, 400);
      return await handleCreate(svc, actor.id, p.data);
    }

    if (['cancel_transfer', 'execute_transfer', 'rollback_transfer'].includes(body.action)) {
      const p = IdSchema.safeParse(body);
      if (!p.success) return j({ error: p.error.flatten() }, 400);
      if (p.data.action === 'cancel_transfer') return await handleCancel(svc, actor.id, p.data);
      if (p.data.action === 'execute_transfer') return await handleExecute(svc, actor.id, p.data);
      if (p.data.action === 'rollback_transfer') return await handleRollback(svc, actor.id, p.data);
    }

    return j({ error: 'unknown_action' }, 400);
  } catch (e: any) {
    console.error('[account-transfer-actions] error', e);
    return j({ error: e.message ?? String(e) }, 500);
  }
});

async function handleCreate(svc: any, actorId: string, input: z.infer<typeof CreateSchema>) {
  const hash = await sha256(JSON.stringify({ ...input, idempotency_key: undefined }));

  // Idempotency
  const { data: existing } = await svc
    .from('account_transfer_idempotency')
    .select('*')
    .eq('idempotency_key', input.idempotency_key)
    .maybeSingle();
  if (existing) {
    if (existing.request_hash !== hash) return j({ error: 'idempotency_conflict' }, 409);
    return j({ ok: true, idempotent: true, result: existing.result });
  }

  // Resolve new_client_id (existing OR create-lite via profile match on email)
  let newClientId = input.new_client_id ?? null;
  let newClientEmail = input.new_client_payload?.email ?? null;
  if (!newClientId && input.new_client_payload) {
    const email = input.new_client_payload.email.trim().toLowerCase();
    const { data: existingProfile } = await svc
      .from('profiles')
      .select('user_id, email')
      .eq('email', email)
      .maybeSingle();
    if (existingProfile) newClientId = existingProfile.user_id;
    newClientEmail = email;
  }

  // Guard: outstanding balance
  const { data: acct } = await svc.from('accounts').select('id, client_id, status').eq('id', input.account_id).maybeSingle();
  if (!acct) return j({ error: 'account_not_found' }, 404);
  if (acct.client_id !== input.old_client_id) return j({ error: 'old_owner_mismatch' }, 400);

  // Balance check
  const { data: balances } = await svc
    .from('billing_invoices')
    .select('balance_due')
    .eq('customer_id', input.account_id)
    .neq('status', 'paid');
  const totalDue = (balances ?? []).reduce((s: number, r: any) => s + Number(r.balance_due ?? 0), 0);
  if (totalDue > 0 && !input.admin_override) {
    return j({ error: 'outstanding_balance', total_due: totalDue, require: 'admin_override' }, 409);
  }

  // Generate confirmation tokens
  const tokenOld = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const tokenNew = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  const { data: inserted, error: insErr } = await svc
    .from('account_ownership_transfers')
    .insert({
      account_id: input.account_id,
      old_client_id: input.old_client_id,
      new_client_id: newClientId,
      new_client_email: newClientEmail,
      new_client_payload: input.new_client_payload ?? null,
      requested_by: actorId,
      status: 'awaiting_old_owner_confirmation',
      transfer_type: input.transfer_type,
      services_transferred: input.services_transferred,
      billing_transfer_option: input.billing_transfer_option,
      equipment_transfer_option: input.equipment_transfer_option,
      service_address_option: input.service_address_option,
      new_service_address: input.new_service_address ?? null,
      reason: input.reason ?? null,
      admin_override: input.admin_override,
      admin_override_reason: input.admin_override_reason ?? null,
      confirmation_token_old: tokenOld,
      confirmation_token_new: tokenNew,
    })
    .select()
    .single();

  if (insErr) throw insErr;

  // Journal + audit + emails
  await writeJournal(svc, {
    targetTable: 'client_activity_logs',
    payload: {
      client_id: input.old_client_id,
      activity_type: 'account_transfer_created',
      description: 'Demande de transfert de propriété créée',
      metadata: { transfer_id: inserted.id, account_id: input.account_id, new_client_id: newClientId },
    },
    eventKey: `account_transfer:${input.account_id}:created`,
    correlationId: inserted.correlation_id,
  });

  await svc.from('admin_audit_log').insert({
    actor_id: actorId,
    action: 'account_transfer_created',
    target_type: 'account_ownership_transfers',
    target_id: inserted.id,
    metadata: { account_id: input.account_id, old_client_id: input.old_client_id, new_client_id: newClientId },
  });

  // Enqueue emails via canonical gateway
  const baseUrl = Deno.env.get('PUBLIC_APP_URL') ?? 'https://nivra-telecom.ca';
  await enqueueEmail(svc, {
    template: 'transfer-requested-old-owner',
    to_client_id: input.old_client_id,
    payload: {
      transfer_id: inserted.id,
      confirm_url: `${baseUrl}/account-transfer/confirm?token=${tokenOld}&party=old`,
    },
    idempotencyKey: `transfer_req_old:${inserted.id}`,
  });
  if (newClientEmail) {
    await enqueueEmail(svc, {
      template: 'transfer-requested-new-owner',
      to_email: newClientEmail,
      to_client_id: newClientId,
      payload: {
        transfer_id: inserted.id,
        confirm_url: `${baseUrl}/account-transfer/confirm?token=${tokenNew}&party=new`,
      },
      idempotencyKey: `transfer_req_new:${inserted.id}`,
    });
  }

  const result = { ok: true, transfer_id: inserted.id, status: inserted.status };
  await svc.from('account_transfer_idempotency').insert({
    idempotency_key: input.idempotency_key,
    request_hash: hash,
    result,
    status: 'completed',
    actor_id: actorId,
  });

  return j(result);
}

async function handleToken(svc: any, input: z.infer<typeof TokenSchema>) {
  const isOld = input.action === 'approve_old_owner';
  const col = isOld ? 'confirmation_token_old' : 'confirmation_token_new';
  const { data: t } = await svc.from('account_ownership_transfers').select('*').eq(col, input.token).maybeSingle();
  if (!t) return j({ error: 'invalid_token' }, 404);
  if (t.status === 'cancelled' || t.status === 'rejected' || t.status === 'expired') {
    return j({ error: 'transfer_closed', status: t.status }, 409);
  }

  if (input.action === 'reject_transfer') {
    await svc.rpc('rpc_account_transfer_transition', {
      p_transfer_id: t.id,
      p_next_status: 'rejected',
      p_actor: t.requested_by,
    });
    await writeJournal(svc, {
      targetTable: 'client_activity_logs',
      payload: {
        client_id: t.old_client_id,
        activity_type: 'account_transfer_rejected',
        description: 'Transfert de propriété refusé',
        metadata: { transfer_id: t.id, by: isOld ? 'old_owner' : 'new_owner' },
      },
      eventKey: `account_transfer:${t.account_id}:cancelled`,
      correlationId: t.correlation_id,
    });
    return j({ ok: true, status: 'rejected' });
  }

  if (isOld) {
    if (t.status !== 'awaiting_old_owner_confirmation') return j({ error: 'wrong_state', status: t.status }, 409);
    await svc.from('account_ownership_transfers').update({ old_owner_confirmed_at: new Date().toISOString() }).eq('id', t.id);
    await svc.rpc('rpc_account_transfer_transition', {
      p_transfer_id: t.id,
      p_next_status: 'awaiting_new_owner_confirmation',
      p_actor: t.requested_by,
    });
    await writeJournal(svc, {
      targetTable: 'client_activity_logs',
      payload: {
        client_id: t.old_client_id,
        activity_type: 'account_transfer_old_confirmed',
        description: 'Ancien propriétaire a confirmé le transfert',
        metadata: { transfer_id: t.id },
      },
      eventKey: `account_transfer:${t.account_id}:old_owner_confirmed`,
      correlationId: t.correlation_id,
    });
    return j({ ok: true, status: 'awaiting_new_owner_confirmation' });
  } else {
    if (t.status !== 'awaiting_new_owner_confirmation') return j({ error: 'wrong_state', status: t.status }, 409);
    await svc.from('account_ownership_transfers').update({ new_owner_confirmed_at: new Date().toISOString() }).eq('id', t.id);
    await svc.rpc('rpc_account_transfer_transition', {
      p_transfer_id: t.id,
      p_next_status: 'approved',
      p_actor: t.requested_by,
    });
    await writeJournal(svc, {
      targetTable: 'client_activity_logs',
      payload: {
        client_id: t.old_client_id,
        activity_type: 'account_transfer_new_confirmed',
        description: 'Nouveau propriétaire a accepté le transfert',
        metadata: { transfer_id: t.id },
      },
      eventKey: `account_transfer:${t.account_id}:new_owner_confirmed`,
      correlationId: t.correlation_id,
    });
    return j({ ok: true, status: 'approved' });
  }
}

async function handleCancel(svc: any, actorId: string, input: z.infer<typeof IdSchema>) {
  const { data: t } = await svc.from('account_ownership_transfers').select('*').eq('id', input.transfer_id).maybeSingle();
  if (!t) return j({ error: 'not_found' }, 404);
  await svc.rpc('rpc_account_transfer_transition', {
    p_transfer_id: t.id,
    p_next_status: 'cancelled',
    p_actor: actorId,
  });
  await svc.from('admin_audit_log').insert({
    actor_id: actorId,
    action: 'account_transfer_cancelled',
    target_type: 'account_ownership_transfers',
    target_id: t.id,
    metadata: { reason: input.reason ?? null },
  });
  await enqueueEmail(svc, {
    template: 'transfer-cancelled',
    to_client_id: t.old_client_id,
    payload: { transfer_id: t.id, reason: input.reason ?? null },
    idempotencyKey: `transfer_cancelled:${t.id}`,
  });
  return j({ ok: true, status: 'cancelled' });
}

async function handleExecute(svc: any, actorId: string, input: z.infer<typeof IdSchema>) {
  const { data: t } = await svc.from('account_ownership_transfers').select('*').eq('id', input.transfer_id).maybeSingle();
  if (!t) return j({ error: 'not_found' }, 404);
  if (t.status !== 'approved') return j({ error: 'not_approved', status: t.status }, 409);
  if (!t.new_client_id) return j({ error: 'new_client_missing' }, 400);

  await svc.rpc('rpc_account_transfer_transition', {
    p_transfer_id: t.id,
    p_next_status: 'processing',
    p_actor: actorId,
  });

  try {
    // 1. Reassign accounts.client_id
    await svc.from('accounts').update({ client_id: t.new_client_id, updated_at: new Date().toISOString() }).eq('id', t.account_id);

    // 2. Reassign orders (all or filtered by services list)
    const orderQuery = svc.from('orders').update({ user_id: t.new_client_id }).eq('user_id', t.old_client_id);
    if (Array.isArray(t.services_transferred) && t.services_transferred.length > 0) {
      await orderQuery.in('service_type', t.services_transferred);
    } else {
      await orderQuery;
    }

    // 3. Reassign equipment_inventory
    await svc.from('equipment_inventory').update({ client_id: t.new_client_id }).eq('client_id', t.old_client_id);

    // 4. Billing: subscriptions always transfer; invoices depend on option
    await svc.from('billing_subscriptions').update({ client_id: t.new_client_id }).eq('client_id', t.old_client_id);
    if (t.billing_transfer_option === 'full_transfer') {
      await svc.from('billing_invoices').update({ client_id: t.new_client_id }).eq('client_id', t.old_client_id);
      await svc.from('billing_payments').update({ client_id: t.new_client_id }).eq('client_id', t.old_client_id);
    }
    // 'new_owner_all' → future only (leave existing invoices as-is on account)
    // 'old_keeps_debt' → unpaid invoices remain with old client (leave)

    // 5. NEVER transfer payment methods; ensure new owner starts fresh (do nothing to old's cards)

    // 6. Complete transition
    await svc.rpc('rpc_account_transfer_transition', {
      p_transfer_id: t.id,
      p_next_status: 'completed',
      p_actor: actorId,
    });

    // 7. Journal + audit + emails
    await writeJournal(svc, {
      targetTable: 'client_activity_logs',
      payload: {
        client_id: t.old_client_id,
        activity_type: 'account_transfer_completed',
        description: 'Transfert de propriété complété',
        metadata: { transfer_id: t.id, new_client_id: t.new_client_id, account_id: t.account_id },
      },
      eventKey: `account_transfer:${t.account_id}:completed`,
      correlationId: t.correlation_id,
    });
    await writeJournal(svc, {
      targetTable: 'client_activity_logs',
      payload: {
        client_id: t.new_client_id,
        activity_type: 'account_transfer_received',
        description: 'Compte reçu par transfert de propriété',
        metadata: { transfer_id: t.id, from_client_id: t.old_client_id, account_id: t.account_id },
      },
      eventKey: `account_transfer:${t.account_id}:received`,
      correlationId: t.correlation_id,
    });
    await svc.from('admin_audit_log').insert({
      actor_id: actorId,
      action: 'account_transfer_completed',
      target_type: 'account_ownership_transfers',
      target_id: t.id,
      metadata: { old_client_id: t.old_client_id, new_client_id: t.new_client_id, account_id: t.account_id },
    });

    await enqueueEmail(svc, {
      template: 'transfer-completed-old-owner',
      to_client_id: t.old_client_id,
      payload: { transfer_id: t.id, account_id: t.account_id },
      idempotencyKey: `transfer_done_old:${t.id}`,
    });
    await enqueueEmail(svc, {
      template: 'transfer-completed-new-owner',
      to_client_id: t.new_client_id,
      payload: { transfer_id: t.id, account_id: t.account_id },
      idempotencyKey: `transfer_done_new:${t.id}`,
    });

    return j({ ok: true, status: 'completed' });
  } catch (err: any) {
    await svc.rpc('rpc_account_transfer_transition', {
      p_transfer_id: t.id,
      p_next_status: 'failed',
      p_actor: actorId,
    });
    return j({ error: 'execution_failed', message: err.message ?? String(err) }, 500);
  }
}

async function handleRollback(svc: any, actorId: string, input: z.infer<typeof IdSchema>) {
  const { data: t } = await svc.from('account_ownership_transfers').select('*').eq('id', input.transfer_id).maybeSingle();
  if (!t) return j({ error: 'not_found' }, 404);
  if (t.status !== 'completed') return j({ error: 'not_completed' }, 409);
  const completedAt = new Date(t.completed_at).getTime();
  if (Date.now() - completedAt > 24 * 3600 * 1000) return j({ error: 'rollback_window_expired' }, 409);

  // Reverse: swap owners back
  await svc.from('accounts').update({ client_id: t.old_client_id }).eq('id', t.account_id);
  await svc.from('orders').update({ user_id: t.old_client_id }).eq('user_id', t.new_client_id);
  await svc.from('equipment_inventory').update({ client_id: t.old_client_id }).eq('client_id', t.new_client_id);
  await svc.from('billing_subscriptions').update({ client_id: t.old_client_id }).eq('client_id', t.new_client_id);
  if (t.billing_transfer_option === 'full_transfer') {
    await svc.from('billing_invoices').update({ client_id: t.old_client_id }).eq('client_id', t.new_client_id);
    await svc.from('billing_payments').update({ client_id: t.old_client_id }).eq('client_id', t.new_client_id);
  }

  await svc.from('account_ownership_transfers').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), reason: input.reason ?? 'rollback' }).eq('id', t.id);

  await svc.from('admin_audit_log').insert({
    actor_id: actorId,
    action: 'account_transfer_rolled_back',
    target_type: 'account_ownership_transfers',
    target_id: t.id,
    metadata: { reason: input.reason ?? null },
  });

  return j({ ok: true, status: 'rolled_back' });
}

// ---- helpers ----

async function writeJournal(svc: any, args: {
  targetTable: string;
  payload: Record<string, unknown>;
  eventKey: string;
  correlationId?: string | null;
}) {
  try {
    await svc.rpc('rpc_account_journal_write', {
      p_target_table: args.targetTable,
      p_payload: { ...args.payload, visibility: 'staff' },
      p_event_key: args.eventKey,
      p_correlation_id: args.correlationId ?? null,
    });
  } catch (e) {
    console.warn('[account-transfer] journal write failed', e);
  }
}

async function enqueueEmail(svc: any, args: {
  template: string;
  to_client_id?: string | null;
  to_email?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}) {
  try {
    await svc.rpc('rpc_communication_enqueue', {
      p_channel: 'email',
      p_template: args.template,
      p_recipient_client_id: args.to_client_id ?? null,
      p_recipient_email: args.to_email ?? null,
      p_payload: args.payload,
      p_idempotency_key: args.idempotencyKey,
    });
  } catch (e) {
    console.warn('[account-transfer] email enqueue failed', e);
  }
}
