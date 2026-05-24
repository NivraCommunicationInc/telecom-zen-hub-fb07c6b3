// payroll-payments — A1 advanced payroll payment lifecycle engine
// Actions: create | update | transition | bulk_transition | send_notification | get_timeline | resend_notification | bulk_send_notification
// Generates PDF + email via existing process-payroll(mark_payment_sent_for_entry_id) flow.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_STATUS = new Set([
  "draft", "scheduled", "pending_approval", "approved", "processing",
  "sent", "confirmed", "failed", "bounced", "cancelled", "reversed", "disputed", "on_hold",
]);

const ALLOWED_METHODS = new Set([
  "interac", "direct_deposit", "cheque", "cash", "wire_transfer", "paypal", "other",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logEvent(
  supabase: any,
  paymentId: string,
  eventType: string,
  data: Record<string, unknown>,
  actor: { id?: string | null; name?: string | null; role?: string | null },
) {
  await supabase.from("payroll_payment_events").insert({
    payment_id: paymentId,
    event_type: eventType,
    event_data: data,
    actor_id: actor.id ?? null,
    actor_name: actor.name ?? null,
    actor_role: actor.role ?? null,
  });
}

async function getActor(supabase: any, authHeader: string | null) {
  if (!authHeader) return { id: null, name: "system", role: "system" };
  try {
    const token = authHeader.replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(token);
    if (!u?.user) return { id: null, name: "system", role: "system" };
    const { data: prof } = await supabase
      .from("profiles").select("full_name, email").eq("user_id", u.user.id).maybeSingle();
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", u.user.id).eq("status", "active").maybeSingle();
    return {
      id: u.user.id,
      name: prof?.full_name || prof?.email || u.user.email || "Utilisateur",
      role: role?.role || "user",
    };
  } catch { return { id: null, name: "system", role: "system" }; }
}

// Inline transition logic — used directly and by bulk_transition (no HTTP recursion,
// which previously failed because the Supabase gateway requires an `apikey` header
// that the recursive fetch did not pass, leaving statuses stuck on the original value).
async function doTransition(
  supabase: any,
  id: string,
  next: string,
  actor: { id: string | null; name: string; role: string },
  opts: {
    send_notification?: boolean;
    payment_method?: string;
    bank_reference?: string;
    transaction_id?: string;
    recipient_bank_name?: string;
    recipient_account_last4?: string;
    confirmation_number?: string;
    failure_reason?: string;
    failure_code?: string;
  } = {},
): Promise<{ payment?: any; error?: string }> {
  if (!id || !ALLOWED_STATUS.has(next)) return { error: "payment_id et next_status valides requis" };

  const { data: current, error: cErr } = await supabase
    .from("payroll_payments").select("*").eq("id", id).maybeSingle();
  if (cErr || !current) return { error: "Paiement introuvable" };

  const patch: Record<string, unknown> = { payment_status: next };
  const now = new Date().toISOString();

  if (next === "approved") {
    patch.approved_by = actor.id; patch.approved_by_name = actor.name; patch.approved_at = now;
  }
  if (next === "sent") {
    patch.sent_by = actor.id; patch.sent_by_name = actor.name; patch.sent_date = now;
    if (opts.payment_method && ALLOWED_METHODS.has(opts.payment_method)) patch.payment_method = opts.payment_method;
    if (opts.bank_reference) patch.bank_reference = opts.bank_reference;
    if (opts.transaction_id) patch.transaction_id = opts.transaction_id;
    if (opts.recipient_bank_name) patch.recipient_bank_name = opts.recipient_bank_name;
    if (opts.recipient_account_last4) patch.recipient_account_last4 = opts.recipient_account_last4;
  }
  if (next === "confirmed") {
    patch.confirmed_by = actor.id; patch.confirmed_by_name = actor.name; patch.confirmed_date = now;
    if (opts.confirmation_number) patch.confirmation_number = opts.confirmation_number;
  }
  if (next === "failed" || next === "bounced") {
    patch.failure_reason = opts.failure_reason || null;
    patch.failure_code = opts.failure_code || null;
    patch.retry_count = (Number(current.retry_count) || 0) + 1;
    if (next === "bounced") patch.bounced_date = now;
  }
  if (next === "cancelled" || next === "reversed") {
    patch.cancelled_by = actor.id; patch.cancelled_at = now;
  }

  const { data: updated, error: uErr } = await supabase
    .from("payroll_payments").update(patch).eq("id", id).select().single();
  if (uErr) return { error: uErr.message };

  await logEvent(supabase, id, `status:${next}`, { from: current.payment_status, to: next, ...patch }, actor);

  if (current.payroll_entry_id) {
    const legacyStatus = ["sent", "confirmed"].includes(next) ? "paid"
      : next === "failed" ? "failed"
      : next === "cancelled" ? "cancelled"
      : "pending";
    await supabase.from("payroll_entries").update({
      payment_status: legacyStatus,
      payment_method: patch.payment_method || current.payment_method,
      payment_reference: patch.bank_reference || patch.transaction_id || null,
      payment_date: ["sent", "confirmed"].includes(next) ? now.slice(0, 10) : null,
      paid_at: ["sent", "confirmed"].includes(next) ? now : null,
      status: ["sent", "confirmed"].includes(next) ? "paid" : undefined,
    } as any).eq("id", current.payroll_entry_id);
  }

  const autoNotify = opts.send_notification !== false && ["sent", "confirmed"].includes(next);
  if (autoNotify && current.payroll_entry_id) {
    try {
      await supabase.functions.invoke("process-payroll", {
        body: {
          mark_payment_sent_for_entry_id: current.payroll_entry_id,
          payment_method: patch.payment_method || current.payment_method,
          payment_status: "paid",
          payment_reference: patch.bank_reference || patch.transaction_id || current.bank_reference || "",
          payment_date: now.slice(0, 10),
          payment_notes: current.client_visible_notes || null,
          send_email: true,
          processed_by: actor.name,
        },
      });
      await supabase.from("payroll_payments").update({ email_sent_at: now }).eq("id", id);
      await logEvent(supabase, id, "notification:sent", { method: "email+pdf" }, actor);
    } catch (e) {
      console.error("[payroll-payments] notification failed:", e);
      await logEvent(supabase, id, "notification:failed", { error: String(e) }, actor);
    }
  }

  return { payment: updated };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = String(body.action || "").trim();
  const actor = await getActor(supabase, req.headers.get("Authorization"));

  try {
    // ====== CREATE ======
    if (action === "create") {
      const entryId = String(body.payroll_entry_id || "").trim();
      if (!entryId) return json({ error: "payroll_entry_id requis" }, 400);

      const { data: existing } = await supabase
        .from("payroll_payments").select("id").eq("payroll_entry_id", entryId).maybeSingle();
      if (existing) return json({ payment_id: existing.id, already_exists: true });

      const { data: entry, error: eErr } = await supabase
        .from("payroll_entries").select("*").eq("id", entryId).maybeSingle();
      if (eErr || !entry) return json({ error: "Entrée de paie introuvable" }, 404);

      const { data: profile } = await supabase
        .from("profiles").select("user_id, full_name, email, agent_number")
        .eq("user_id", entry.employee_id || entry.user_id).maybeSingle();

      const method = ALLOWED_METHODS.has(body.payment_method) ? body.payment_method : (entry.payment_method && ALLOWED_METHODS.has(entry.payment_method) ? entry.payment_method : "interac");
      const netAmount = Number(entry.net_pay || 0);
      const requiresApproval = body.requires_approval ?? (netAmount > 5000);

      const { data: inserted, error: iErr } = await supabase
        .from("payroll_payments").insert({
          payroll_entry_id: entryId,
          employee_user_id: entry.employee_id || entry.user_id,
          employee_name: profile?.full_name || profile?.email || "Employé",
          employee_number: profile?.agent_number || entry.agent_number || null,
          employee_email: profile?.email || null,
          gross_amount: Number(entry.total_gross || entry.gross_pay || 0),
          net_amount: netAmount,
          deductions_total: Number(entry.deductions_total || 0),
          payment_method: method,
          payment_status: requiresApproval ? "pending_approval" : "draft",
          scheduled_date: body.scheduled_date || null,
          internal_notes: body.internal_notes || null,
          requires_approval: requiresApproval,
          approval_threshold_amount: requiresApproval ? 5000 : null,
          created_by: actor.id,
          created_by_name: actor.name,
        }).select().single();
      if (iErr) return json({ error: iErr.message }, 500);

      await logEvent(supabase, inserted.id, "created", { from_entry: entryId, net_amount: netAmount }, actor);
      return json({ payment: inserted });
    }

    // ====== UPDATE (notes, scheduled_date, method, bank info) ======
    if (action === "update") {
      const id = String(body.payment_id || "").trim();
      if (!id) return json({ error: "payment_id requis" }, 400);
      const updates: Record<string, unknown> = {};
      const allowed = [
        "scheduled_date", "internal_notes", "client_visible_notes", "payment_method",
        "bank_reference", "recipient_bank_name", "recipient_account_last4",
        "transaction_id", "confirmation_number", "requires_approval", "approval_threshold_amount",
      ];
      for (const k of allowed) if (k in body) updates[k] = body[k];
      if (updates.payment_method && !ALLOWED_METHODS.has(updates.payment_method as string)) {
        return json({ error: "Méthode invalide" }, 400);
      }
      const { data, error } = await supabase.from("payroll_payments").update(updates).eq("id", id).select().single();
      if (error) return json({ error: error.message }, 500);
      await logEvent(supabase, id, "updated", updates, actor);
      return json({ payment: data });
    }

    // ====== TRANSITION (status change with side-effects) ======
    if (action === "transition") {
      const id = String(body.payment_id || "").trim();
      const next = String(body.next_status || "").trim();
      const result = await doTransition(supabase, id, next, actor, {
        send_notification: body.send_notification,
        payment_method: body.payment_method,
        bank_reference: body.bank_reference,
        transaction_id: body.transaction_id,
        recipient_bank_name: body.recipient_bank_name,
        recipient_account_last4: body.recipient_account_last4,
        confirmation_number: body.confirmation_number,
        failure_reason: body.failure_reason,
        failure_code: body.failure_code,
      });
      if (result.error) return json({ error: result.error }, 400);
      return json({ payment: result.payment });
    }

    // ====== BULK TRANSITION ======
    if (action === "bulk_transition") {
      const ids: string[] = Array.isArray(body.payment_ids) ? body.payment_ids : [];
      const next = String(body.next_status || "").trim();
      if (ids.length === 0 || !ALLOWED_STATUS.has(next)) return json({ error: "payment_ids et next_status requis" }, 400);
      const results: any[] = [];
      for (const id of ids) {
        const r = await doTransition(supabase, id, next, actor, { send_notification: body.send_notification });
        results.push({ id, ok: !r.error, error: r.error });
      }
      return json({ results, processed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
    }

    // ====== RESEND NOTIFICATION ======
    if (action === "resend_notification" || action === "send_notification") {
      const id = String(body.payment_id || "").trim();
      if (!id) return json({ error: "payment_id requis" }, 400);
      const { data: p } = await supabase.from("payroll_payments").select("*").eq("id", id).maybeSingle();
      if (!p) return json({ error: "Paiement introuvable" }, 404);
      if (!p.payroll_entry_id) return json({ error: "Aucune entrée de paie liée" }, 400);

      const { error: invErr } = await supabase.functions.invoke("process-payroll", {
        body: {
          mark_payment_sent_for_entry_id: p.payroll_entry_id,
          payment_method: p.payment_method,
          payment_status: "paid",
          payment_reference: p.bank_reference || p.transaction_id || "",
          payment_date: (p.sent_date || new Date().toISOString()).slice(0, 10),
          payment_notes: p.client_visible_notes || null,
          send_email: true,
          processed_by: actor.name,
        },
      });
      if (invErr) {
        await logEvent(supabase, id, "notification:failed", { error: invErr.message }, actor);
        return json({ error: invErr.message }, 500);
      }
      await supabase.from("payroll_payments").update({ email_sent_at: new Date().toISOString() }).eq("id", id);
      await logEvent(supabase, id, "notification:resent", {}, actor);
      return json({ ok: true });
    }

    // ====== BULK SEND NOTIFICATION ======
    if (action === "bulk_send_notification") {
      const ids: string[] = Array.isArray(body.payment_ids) ? body.payment_ids : [];
      if (!ids.length) return json({ error: "payment_ids requis" }, 400);
      const results: any[] = [];
      for (const id of ids) {
        try {
          const { data: p } = await supabase.from("payroll_payments").select("*").eq("id", id).maybeSingle();
          if (!p || !p.payroll_entry_id) {
            results.push({ id, ok: false, error: !p ? "Paiement introuvable" : "Aucune entrée de paie liée" });
            continue;
          }
          const { error: invErr } = await supabase.functions.invoke("process-payroll", {
            body: {
              mark_payment_sent_for_entry_id: p.payroll_entry_id,
              payment_method: p.payment_method,
              payment_status: "paid",
              payment_reference: p.bank_reference || p.transaction_id || "",
              payment_date: (p.sent_date || new Date().toISOString()).slice(0, 10),
              payment_notes: p.client_visible_notes || null,
              send_email: true,
              processed_by: actor.name,
            },
          });
          if (invErr) {
            await logEvent(supabase, id, "notification:failed", { error: invErr.message }, actor);
            results.push({ id, ok: false, error: invErr.message });
            continue;
          }
          await supabase.from("payroll_payments").update({ email_sent_at: new Date().toISOString() }).eq("id", id);
          await logEvent(supabase, id, "notification:resent", {}, actor);
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return json({ results });
    }

    // ====== GET TIMELINE ======
    if (action === "get_timeline") {
      const id = String(body.payment_id || "").trim();
      if (!id) return json({ error: "payment_id requis" }, 400);
      const { data, error } = await supabase
        .from("payroll_payment_events").select("*").eq("payment_id", id).order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ events: data || [] });
    }

    return json({ error: `Action inconnue: ${action}` }, 400);
  } catch (e) {
    console.error("[payroll-payments]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
