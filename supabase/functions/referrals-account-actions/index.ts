// ============================================================
// Referrals account actions — Nivra Core / Nivra OneView CS
// Module 33 — Phase A part 2
//
// Strict RBAC:  admin | supervisor | billing_admin
// FORBIDDEN:    sales, employee, support (F33-11)
//
// All mutations flow through rpc_referral_apply_action (row lock + audit +
// reason + event_key idempotency, F33-1). Direct writes on
// client_referrals are gated to service_role by DB grants (Phase A part 1).
// ============================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set(["admin", "supervisor", "billing_admin"]);

type Action =
  | "list_for_client"
  | "qualify"
  | "issue_reward"
  | "mark_delivered"
  | "mark_fraud"
  | "clear_fraud"
  | "disqualify"
  | "clawback"
  | "reassign";

interface Body {
  action: Action;
  client_user_id: string;
  referral_id?: string;
  idempotency_key?: string;
  // issue_reward
  reward_reference?: string;
  reward_card_provider?: string;
  reward_amount?: number;
  reward_type?: string; // points | credit | visa_mastercard_gift_card
  // mark_fraud / disqualify / clawback / reassign
  reason?: string;
  // reassign
  new_referrer_user_id?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fmtMoney = (n: number) => {
  try { return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n); }
  catch { return `${n.toFixed(2)} $`; }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Non autorisé" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Strict RBAC (F33-11): only admin / supervisor / billing_admin
  const { data: roles } = await admin
    .from("user_roles").select("role").eq("user_id", user.id);
  const roleList = (roles || []).map((r: { role: string }) => r.role);
  const authorized = roleList.some((r) => ALLOWED_ROLES.has(r));
  if (!authorized) {
    return json(403, {
      error: "Action réservée à admin/supervisor/billing_admin. Rôle sales exclu.",
    });
  }

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return json(400, { error: "Champs requis: action, client_user_id" });
  }

  // Fetch referrer profile (audit/email)
  const { data: refProfile } = await admin
    .from("profiles")
    .select("user_id, email, first_name")
    .eq("user_id", client_user_id)
    .maybeSingle();
  const refEmail = refProfile?.email || null;
  const refFirst = refProfile?.first_name || "Client";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
             req.headers.get("cf-connecting-ip") || "unknown";

  const audit = async (label: string, payload: Record<string, unknown>) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `referrals.${label}`,
        admin_user_id: user.id,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        details: payload,
      });
    } catch (_e) { /* swallow */ }
  };

  const enqueueEmail = async (
    template: string,
    vars: Record<string, unknown>,
    eventKey?: string,
  ) => {
    if (!refEmail) return;
    try {
      // F33-17 idempotence — event_key prevents duplicate emails on retries
      if (eventKey) {
        const { data: exists } = await admin
          .from("email_queue")
          .select("id")
          .eq("to_email", refEmail)
          .eq("template_key", template)
          .contains("template_vars", { event_key: eventKey })
          .limit(1);
        if (exists && exists.length > 0) return;
      }
      await admin.from("email_queue").insert({
        to_email: refEmail,
        template_key: template,
        template_vars: {
          ...vars,
          first_name: refFirst,
          to_email: refEmail,
          event_key: eventKey,
        },
        status: "queued",
        priority: 0,
      });
    } catch (_e) { /* swallow */ }
  };

  const loadReferral = async (id: string) => {
    const { data, error } = await admin
      .from("client_referrals").select("*")
      .eq("id", id)
      .eq("referrer_user_id", client_user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Parrainage introuvable pour ce client");
    return data;
  };

  const referredName = async (referred_user_id: string): Promise<string> => {
    const { data } = await admin
      .from("profiles")
      .select("first_name,last_name")
      .eq("user_id", referred_user_id).maybeSingle();
    return [data?.first_name, data?.last_name].filter(Boolean).join(" ") || "votre filleul";
  };

  // Helper — canonical write via rpc_referral_apply_action (F33-1)
  const applyAction = async (
    referralId: string,
    rpcAction: string,
    reason: string | null,
    payload: Record<string, unknown>,
    eventKey: string,
  ) => {
    const { data, error } = await admin.rpc("rpc_referral_apply_action", {
      p_referral_id: referralId,
      p_action: rpcAction,
      p_actor_id: user.id,
      p_reason: reason,
      p_payload: payload,
      p_event_key: eventKey,
    });
    if (error) throw new Error(error.message);
    return data as { ok: boolean; idempotent?: boolean };
  };

  try {
    switch (action) {
      // ============================================================
      case "list_for_client": {
        const { data, error } = await admin
          .from("client_referrals")
          .select(`
            id, referral_code_used, referred_user_id, referred_order_id,
            status, qualifying_cycles_paid, required_cycles,
            reward_status, reward_type, reward_amount, reward_reference,
            reward_card_provider, reward_issued_at, reward_sent_at, reward_delivered_at,
            qualified_at, disqualified_at, disqualification_reason,
            fraud_flag, fraud_review_notes, fraud_checked_at,
            notes, created_at, updated_at,
            reassigned_from, reassigned_at, clawback_at, clawback_reason
          `)
          .eq("referrer_user_id", client_user_id)
          .order("created_at", { ascending: false });
        if (error) return json(500, { error: error.message });

        const ids = Array.from(new Set((data || []).map((r) => r.referred_user_id).filter(Boolean)));
        const nameMap: Record<string, string> = {};
        if (ids.length > 0) {
          const { data: profs } = await admin
            .from("profiles")
            .select("user_id,first_name,last_name,email")
            .in("user_id", ids);
          (profs || []).forEach((p: { user_id: string; first_name?: string; last_name?: string; email?: string }) => {
            nameMap[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—";
          });
        }
        const rows = (data || []).map((r) => ({
          ...r,
          referred_name: nameMap[r.referred_user_id] || "—",
        }));
        return json(200, { ok: true, referrals: rows });
      }

      // ============================================================
      case "qualify": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        if (!body.idempotency_key) return json(400, { error: "idempotency_key requis" });
        const ref = await loadReferral(body.referral_id);
        if (ref.status === "qualified" || ref.reward_status === "reward_issued") {
          return json(400, { error: "Parrainage déjà qualifié ou récompensé" });
        }
        const eventKey = `qualify:${body.referral_id}:${body.idempotency_key}`;
        const rpcRes = await applyAction(ref.id, "qualify", null, { by: user.id }, eventKey);
        if (rpcRes.idempotent) return json(200, { ok: true, idempotent: true });

        // Row already locked & event logged by RPC — now apply state
        const now = new Date().toISOString();
        const { error } = await admin
          .from("client_referrals")
          .update({
            status: "qualified",
            reward_status: "reward_pending",
            qualified_at: now,
            qualifying_cycles_paid: Math.max(ref.qualifying_cycles_paid, ref.required_cycles),
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });

        await audit("qualify", { referral_id: ref.id, idempotency_key: body.idempotency_key });
        const rname = await referredName(ref.referred_user_id);
        await enqueueEmail("client_referral_qualified", {
          referred_name: rname,
          reward_amount: fmtMoney(Number(ref.reward_amount ?? 25)),
        }, eventKey);
        return json(200, { ok: true });
      }

      // ============================================================
      case "issue_reward": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        if (!body.idempotency_key) return json(400, { error: "idempotency_key requis" });
        const ref = await loadReferral(body.referral_id);
        if (ref.reward_status === "reward_issued") {
          return json(400, { error: "Récompense déjà émise" });
        }
        const reward_reference = (body.reward_reference || "").trim();
        if (!reward_reference) return json(400, { error: "Référence requise" });

        // F33-8 — RPC accepte uniquement points | credit
        const inputType = (body.reward_type || "credit").toLowerCase();
        const allowedTypes = new Set(["points", "credit"]);
        if (!allowedTypes.has(inputType)) {
          return json(400, { error: `reward_type invalide: ${inputType}. Autorisé: points | credit` });
        }
        const reward_card_provider = (body.reward_card_provider || "").trim() || null;
        const reward_amount = Number.isFinite(body.reward_amount)
          ? Number(body.reward_amount)
          : Number(ref.reward_amount ?? 25);

        const eventKey = `issue_reward:${body.referral_id}:${body.idempotency_key}`;
        const rpcRes = await applyAction(ref.id, "issue_reward", null, {
          reward_amount, reward_reference, reward_card_provider, reward_type: inputType,
        }, eventKey);
        if (rpcRes.idempotent) return json(200, { ok: true, idempotent: true });

        const now = new Date().toISOString();
        const { error } = await admin
          .from("client_referrals")
          .update({
            reward_status: "reward_issued",
            reward_issued_at: now,
            reward_issued_by: user.id,
            reward_reference,
            reward_card_provider,
            reward_amount,
            reward_type: inputType,
            status: "qualified",
            qualified_at: ref.qualified_at ?? now,
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });

        await audit("issue_reward", {
          referral_id: ref.id, reward_amount, reward_reference,
          reward_card_provider, idempotency_key: body.idempotency_key,
        });
        const rname = await referredName(ref.referred_user_id);
        await enqueueEmail("client_referral_reward_issued", {
          referred_name: rname,
          reward_amount: fmtMoney(reward_amount),
          reward_type: inputType === "credit" ? "Crédit compte" : "Points fidélité",
          reward_reference,
        }, eventKey);
        return json(200, { ok: true });
      }

      // ============================================================
      case "mark_delivered": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        if (!body.idempotency_key) return json(400, { error: "idempotency_key requis" });
        const ref = await loadReferral(body.referral_id);
        if (ref.reward_status !== "reward_issued") {
          return json(400, { error: "Émettre la récompense avant de la livrer" });
        }
        const eventKey = `mark_delivered:${body.referral_id}:${body.idempotency_key}`;
        const rpcRes = await applyAction(ref.id, "mark_delivered", null, {}, eventKey);
        if (rpcRes.idempotent) return json(200, { ok: true, idempotent: true });
        const now = new Date().toISOString();
        const { error } = await admin
          .from("client_referrals")
          .update({
            reward_sent_at: ref.reward_sent_at ?? now,
            reward_delivered_at: now,
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });
        await audit("mark_delivered", { referral_id: ref.id });
        return json(200, { ok: true });
      }

      // ============================================================
      case "mark_fraud": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        if (!body.idempotency_key) return json(400, { error: "idempotency_key requis" });
        const reason = (body.reason || "").trim();
        if (!reason) return json(400, { error: "Raison requise" });
        const ref = await loadReferral(body.referral_id);
        const eventKey = `mark_fraud:${body.referral_id}:${body.idempotency_key}`;
        const rpcRes = await applyAction(ref.id, "mark_fraud", reason, {}, eventKey);
        if (rpcRes.idempotent) return json(200, { ok: true, idempotent: true });
        const now = new Date().toISOString();
        const { error } = await admin
          .from("client_referrals")
          .update({
            fraud_flag: true,
            fraud_review_notes: reason,
            fraud_checked_at: now,
            fraud_checked_by: user.id,
            status: "fraud_review",
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });
        await audit("mark_fraud", { referral_id: ref.id, reason });
        return json(200, { ok: true });
      }

      // ============================================================
      case "clear_fraud": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        if (!body.idempotency_key) return json(400, { error: "idempotency_key requis" });
        const ref = await loadReferral(body.referral_id);
        const eventKey = `clear_fraud:${body.referral_id}:${body.idempotency_key}`;
        const rpcRes = await applyAction(ref.id, "clear_fraud", null, {}, eventKey);
        if (rpcRes.idempotent) return json(200, { ok: true, idempotent: true });
        const { error } = await admin
          .from("client_referrals")
          .update({
            fraud_flag: false,
            fraud_review_notes: null,
            fraud_checked_at: new Date().toISOString(),
            fraud_checked_by: user.id,
            status: ref.qualifying_cycles_paid >= ref.required_cycles ? "qualified" : "code_used",
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });
        await audit("clear_fraud", { referral_id: ref.id });
        return json(200, { ok: true });
      }

      // ============================================================
      case "disqualify": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        if (!body.idempotency_key) return json(400, { error: "idempotency_key requis" });
        const reason = (body.reason || "").trim();
        if (!reason) return json(400, { error: "Raison requise" });
        const ref = await loadReferral(body.referral_id);
        const eventKey = `disqualify:${body.referral_id}:${body.idempotency_key}`;
        const rpcRes = await applyAction(ref.id, "disqualify", reason, {}, eventKey);
        if (rpcRes.idempotent) return json(200, { ok: true, idempotent: true });
        const now = new Date().toISOString();
        const { error } = await admin
          .from("client_referrals")
          .update({
            status: "disqualified",
            reward_status: "cancelled",
            disqualified_at: now,
            disqualification_reason: reason,
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });
        await audit("disqualify", { referral_id: ref.id, reason });
        const rname = await referredName(ref.referred_user_id);
        await enqueueEmail("client_referral_disqualified", {
          referred_name: rname, reason,
        }, eventKey);
        return json(200, { ok: true });
      }

      // ============================================================
      case "clawback": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        if (!body.idempotency_key) return json(400, { error: "idempotency_key requis" });
        const reason = (body.reason || "").trim();
        if (!reason) return json(400, { error: "Raison requise" });
        const ref = await loadReferral(body.referral_id);
        const eventKey = `clawback:${body.referral_id}:${body.idempotency_key}`;
        const rpcRes = await applyAction(ref.id, "clawback", reason, {}, eventKey);
        if (rpcRes.idempotent) return json(200, { ok: true, idempotent: true });
        const now = new Date().toISOString();
        const { error } = await admin
          .from("client_referrals")
          .update({
            clawback_at: now,
            clawback_by: user.id,
            clawback_reason: reason,
            reward_status: "cancelled",
            status: "disqualified",
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });
        await audit("clawback", { referral_id: ref.id, reason });
        return json(200, { ok: true });
      }

      // ============================================================
      case "reassign": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        if (!body.idempotency_key) return json(400, { error: "idempotency_key requis" });
        if (!body.new_referrer_user_id) return json(400, { error: "new_referrer_user_id requis" });
        const reason = (body.reason || "").trim();
        if (!reason) return json(400, { error: "Raison requise" });
        const ref = await loadReferral(body.referral_id);
        if (body.new_referrer_user_id === ref.referred_user_id) {
          return json(400, { error: "Auto-parrainage interdit (F33-B)" });
        }
        const eventKey = `reassign:${body.referral_id}:${body.idempotency_key}`;
        const rpcRes = await applyAction(ref.id, "reassign", reason, {
          from: client_user_id, to: body.new_referrer_user_id,
        }, eventKey);
        if (rpcRes.idempotent) return json(200, { ok: true, idempotent: true });
        // Resolve new referrer account
        const { data: newAcct } = await admin
          .from("accounts").select("id").eq("client_id", body.new_referrer_user_id).limit(1).maybeSingle();
        const now = new Date().toISOString();
        const { error } = await admin
          .from("client_referrals")
          .update({
            reassigned_from: client_user_id,
            reassigned_at: now,
            reassigned_by: user.id,
            referrer_user_id: body.new_referrer_user_id,
            referrer_account_id: newAcct?.id ?? null,
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });
        await audit("reassign", {
          referral_id: ref.id, from: client_user_id, to: body.new_referrer_user_id, reason,
        });
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
