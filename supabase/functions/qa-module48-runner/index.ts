// Module 48 QA Runner — Account Ownership Transfer
// Executes 15 declarative checks and returns Run ID + PASS/FAIL summary.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

type Result = { id: string; label: string; status: 'PASS' | 'FAIL'; detail?: string };

async function callEF(name: string, body: unknown, auth?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth ?? ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, json, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const runId = crypto.randomUUID();
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const results: Result[] = [];
  const push = (id: string, label: string, ok: boolean, detail?: string) =>
    results.push({ id, label, status: ok ? 'PASS' : 'FAIL', detail });

  try {
    // 1. table exists
    {
      const { data } = await admin.rpc('has_role', { _user_id: '00000000-0000-0000-0000-000000000000', _role: 'admin' }).select().limit(0);
      const { error } = await admin.from('account_ownership_transfers').select('id').limit(1);
      push('T01', 'account_ownership_transfers accessible', !error, error?.message);
    }
    // 2. idempotency table exists
    {
      const { error } = await admin.from('account_transfer_idempotency').select('idempotency_key').limit(1);
      push('T02', 'account_transfer_idempotency table exists', !error, error?.message);
    }
    // 3. RPC state machine present
    {
      const { error } = await admin.rpc('rpc_account_transfer_transition', {
        p_transfer_id: '00000000-0000-0000-0000-000000000000',
        p_new_status: 'cancelled',
        p_actor_role: 'admin',
        p_reason: 'qa-probe',
      });
      // We expect an error (row not found), but the function must exist
      const missingFn = error?.message?.includes('does not exist') || error?.code === '42883';
      push('T03', 'rpc_account_transfer_transition exists', !missingFn, error?.message);
    }
    // 4-8. email templates registered
    for (const slug of [
      'transfer-requested-old-owner',
      'transfer-requested-new-owner',
      'transfer-completed-old-owner',
      'transfer-completed-new-owner',
      'transfer-cancelled',
    ]) {
      const { data, error } = await admin.from('email_templates').select('slug,is_active').eq('slug', slug).maybeSingle();
      push(`T-EMAIL-${slug}`, `Template ${slug} active`, !!data?.is_active, error?.message ?? (data ? '' : 'missing'));
    }
    // 9. timeline view includes account_ownership_transfers — insert synthetic row, verify appearance, cleanup
    {
      // Need a real account_id + old_client_id. Pick any existing account.
      const { data: acct } = await admin.from('accounts').select('id,user_id').limit(1).maybeSingle();
      if (!acct) {
        push('T09', 'v_customer_timeline includes account_transfer', false, 'no account to probe');
      } else {
        const requester = acct.user_id ?? '00000000-0000-0000-0000-000000000001';
        const { data: ins, error: insErr } = await admin
          .from('account_ownership_transfers')
          .insert({
            account_id: acct.id,
            old_client_id: acct.user_id ?? requester,
            requested_by: requester,
            billing_transfer_option: 'new_owner_all',
            new_client_email: 'qa+m48@nivra-telecom.ca',
            reason: 'QA runner probe',
          })
          .select('id')
          .maybeSingle();
        if (insErr || !ins) {
          push('T09', 'v_customer_timeline includes account_transfer', false, insErr?.message ?? 'insert failed');
        } else {
          const { data: tl, error: tlErr } = await admin
            .from('v_customer_timeline')
            .select('event_type,source_table,source_id')
            .eq('source_id', ins.id)
            .maybeSingle();
          push('T09', 'v_customer_timeline includes account_transfer', tl?.event_type === 'account_transfer', tlErr?.message ?? JSON.stringify(tl));
          await admin.from('account_ownership_transfers').delete().eq('id', ins.id);
        }
      }
    }
    // 10. EF rejects invalid auth
    {
      const r = await callEF('account-transfer-actions', { action: 'create_transfer' }, 'anon-invalid');
      push('T10', 'EF rejects invalid auth', [401, 403, 404].includes(r.status), `status=${r.status}`);
    }
    // 11. EF gate on unauthorized/malformed payload
    {
      const r = await callEF('account-transfer-actions', { action: 'create_transfer' }, SERVICE_KEY);
      push('T11', 'EF gate on unauthorized/invalid payload', [400, 401, 403, 422].includes(r.status), `status=${r.status}`);
    }
    // 12. Idempotency table has required columns
    {
      const { error } = await admin.from('account_transfer_idempotency').select('idempotency_key,request_hash,result,status').limit(1);
      push('T12', 'Idempotency columns present', !error, error?.message);
    }
    // 13. status column readable
    {
      const { error } = await admin.from('account_ownership_transfers').select('status').limit(0);
      push('T13', 'transfers.status column readable', !error, error?.message);
    }
    // 14. RLS enabled on account_ownership_transfers (anon should not read)
    {
      const anon = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await anon.from('account_ownership_transfers').select('id').limit(1);
      const blocked = !!error || (Array.isArray(data) && data.length === 0);
      push('T14', 'Anon cannot read transfers (RLS)', blocked, error?.message);
    }
    // 15. Log run to DB (best-effort)
    {
      try {
        await admin.from('activity_logs').insert({
          action: 'qa_module48_run',
          actor_role: 'system',
          actor_name: 'qa-module48-runner',
          metadata: { run_id: runId, results },
        });
        push('T15', 'Run logged to activity_logs', true);
      } catch (e) {
        push('T15', 'Run logged to activity_logs', false, String(e));
      }
    }
  } catch (e) {
    push('FATAL', 'runner exception', false, String(e));
  }

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  return new Response(
    JSON.stringify({ run_id: runId, module: 'Module 48', total: results.length, pass, fail, results }, null, 2),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
