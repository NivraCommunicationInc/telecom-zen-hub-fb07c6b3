// Referrals account actions — Nivra Core & Nivra OneView CS
// Staff-only operations on `client_referrals` (the qualifying referral table).
//
// Actions:
//   - list_for_client    : returns all referrals where the client is referrer
//   - qualify            : force-qualify a referral (sets status=qualified, reward_status=reward_pending)
//   - issue_reward       : mark reward as issued (records provider/reference)
//   - mark_delivered     : mark reward delivered to client
//   - mark_fraud         : flag fraud (sets fraud_flag, optional notes)
//   - clear_fraud        : remove fraud flag
//   - disqualify         : disqualify a referral with a reason
//
// All writes are gated by staff role, audited, and (except list) queue a
// branded Violet Bold client email.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set([
  "admin", "employee", "supervisor", "support", "billing_admin", "sales",
]);

type Action =
  | "list_for_client"
  | "qualify"
  | "issue_reward"
  | "mark_delivered"
  | "mark_fraud"
  | "clear_fraud"
  | "disqualify";

interface Body {
  action: Action;
  client_user_id: string;            // the REFERRER user_id (account being inspected)
  referral_id?: string;
  // issue_reward
  reward_reference?: string;
  reward_card_provider?: string;
  reward_amount?: number;
  reward_type?: string;
  // mark_fraud / disqualify
  reason?: string;
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

  const { data: roles } = await admin
    .from("user_roles").select("role").eq("user_id", user.id);
  const { isStaff, callerRole: _callerRole } = await checkStaffAuth(admin, user.id);
  if (!isStaff) return json(403, { error: "Action réservée au personnel autorisé" });

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return json(400, { error: "Champs requis: action, client_user_id" });
  }

  // Fetch referrer profile (for first_name, email on audit)
  const { data: refProfile } = await admin
    .from("profiles")
    .select("user_id, email, first_name")
    .eq("user_id", client_user_id)
    .maybeSingle();
  const refEmail = refProfile?.email || null;
  const refFirst = refProfile?.first_name || "Client";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
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

  const enqueueEmail = async (template: string, vars: Record<string, unknown>) => {
    if (!refEmail) return;
    try {
      await admin.from("email_queue").insert({
        to_email: refEmail,
        template_key: template,
        template_vars: { ...vars, first_name: refFirst, to_email: refEmail },
        status: "queued",
        priority: 0,
      });
    } catch (_e) { /* swallow */ }
  };

  // Helper: fetch a referral that belongs to this referrer
  const loadReferral = async (id: string) => {
    const { data, error } = await admin
      .from("client_referrals")
      .select("*")
      .eq("id", id)
      .eq("referrer_user_id", client_user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Parrainage introuvable pour ce client");
    return data;
  };

  // Helper: pretty referred name
  const referredName = async (referred_user_id: string): Promise<string> => {
    const { data } = await admin
      .from("profiles")
      .select("first_name,last_name")
      .eq("user_id", referred_user_id)
      .maybeSingle();
    return [data?.first_name, data?.last_name].filter(Boolean).join(" ") || "votre filleul";
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
            notes, created_at, updated_at
          `)
          .eq("referrer_user_id", client_user_id)
          .order("created_at", { ascending: false });
        if (error) return json(500, { error: error.message });

        // Hydrate referred names
        const ids = Array.from(new Set((data || []).map((r) => r.referred_user_id).filter(Boolean)));
        let nameMap: Record<string, string> = {};
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
        const ref = await loadReferral(body.referral_id);
        if (ref.status === "qualified" || ref.reward_status === "reward_issued") {
          return json(400, { error: "Parrainage déjà qualifié ou récompensé" });
        }
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

        await audit("qualify", { referral_id: ref.id });
        const rname = await referredName(ref.referred_user_id);
        await enqueueEmail("client_referral_qualified", {
          referred_name: rname,
          reward_amount: fmtMoney(Number(ref.reward_amount ?? 25)),
        });
        return json(200, { ok: true });
      }

      // ============================================================
      case "issue_reward": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        const ref = await loadReferral(body.referral_id);
        if (ref.reward_status === "reward_issued") {
          return json(400, { error: "Récompense déjà émise" });
        }
        const reward_reference = (body.reward_reference || "").trim();
        if (!reward_reference) return json(400, { error: "Référence requise" });
        const reward_card_provider = (body.reward_card_provider || "").trim() || null;
        const reward_amount = Number.isFinite(body.reward_amount)
          ? Number(body.reward_amount)
          : Number(ref.reward_amount ?? 25);
        const reward_type = (body.reward_type || ref.reward_type || "visa_mastercard_gift_card");

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
            reward_type,
            // ensure qualified
            status: ref.status === "qualified" ? "qualified" : "qualified",
            qualified_at: ref.qualified_at ?? now,
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });

        await audit("issue_reward", {
          referral_id: ref.id, reward_amount, reward_reference, reward_card_provider,
        });
        const rname = await referredName(ref.referred_user_id);
        await enqueueEmail("client_referral_reward_issued", {
          referred_name: rname,
          reward_amount: fmtMoney(reward_amount),
          reward_type: reward_type === "visa_mastercard_gift_card"
            ? "Carte cadeau Visa/Mastercard"
            : reward_type,
          reward_reference,
        });
        return json(200, { ok: true });
      }

      // ============================================================
      case "mark_delivered": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        const ref = await loadReferral(body.referral_id);
        if (ref.reward_status !== "reward_issued") {
          return json(400, { error: "Émettre la récompense avant de la livrer" });
        }
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
        const ref = await loadReferral(body.referral_id);
        const reason = (body.reason || "").trim();
        if (!reason) return json(400, { error: "Raison requise" });
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
        const ref = await loadReferral(body.referral_id);
        const { error } = await admin
          .from("client_referrals")
          .update({
            fraud_flag: false,
            fraud_review_notes: null,
            fraud_checked_at: new Date().toISOString(),
            fraud_checked_by: user.id,
            status: ref.qualifying_cycles_paid >= ref.required_cycles
              ? "qualified"
              : "code_used",
          })
          .eq("id", ref.id);
        if (error) return json(500, { error: error.message });
        await audit("clear_fraud", { referral_id: ref.id });
        return json(200, { ok: true });
      }

      // ============================================================
      case "disqualify": {
        if (!body.referral_id) return json(400, { error: "referral_id requis" });
        const ref = await loadReferral(body.referral_id);
        const reason = (body.reason || "").trim() || "Non admissible";
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
          referred_name: rname,
          reason,
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
