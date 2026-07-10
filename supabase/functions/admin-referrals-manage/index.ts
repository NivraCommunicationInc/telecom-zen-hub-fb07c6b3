// ============================================================
// admin-referrals-manage (F33-1, F33-4, F33-11, F33-14, F33-19)
// Consolidated admin mutations on: referral_codes, referral_program_settings,
// referral_attributions (decide), influencers (status).
//
// Strict RBAC:  admin | supervisor | billing_admin
// FORBIDDEN:    sales, employee, support
//
// All writes go through service_role after auth check (DB grants block
// authenticated writes on these tables since Phase A part 1).
// ============================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set(["admin", "supervisor", "billing_admin"]);

type Action =
  | "settings.update"
  | "code.create"
  | "code.update"
  | "code.toggle"
  | "influencer.set_status"
  | "attribution.decide";

interface Body {
  action: Action;
  idempotency_key?: string;
  // settings.update
  settings?: Record<string, unknown>;
  // code.*
  code_id?: string;
  influencer_id?: string;
  code?: string;
  status?: string;
  usage_limit_total?: number | null;
  usage_limit_monthly?: number | null;
  // influencer.set_status
  new_status?: "active" | "suspended" | "pending";
  reason?: string;
  cascade_codes?: boolean;
  // attribution.decide
  attribution_id?: string;
  decision?: "approved" | "rejected" | "hold" | "disputed" | "pending";
  note?: string;
  commission?: number;
}

const json = (s: number, p: unknown) =>
  new Response(JSON.stringify(p), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: roles } = await admin
    .from("user_roles").select("role").eq("user_id", user.id);
  const roleList = (roles || []).map((r: { role: string }) => r.role);
  if (!roleList.some((r) => ALLOWED_ROLES.has(r))) {
    return json(403, { error: "Réservé admin/supervisor/billing_admin. Rôle sales exclu." });
  }

  let body: Body;
  try { body = await req.json(); } catch { return json(400, { error: "JSON invalide" }); }
  if (!body.action) return json(400, { error: "action requise" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const audit = async (label: string, details: Record<string, unknown>) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `referrals_admin.${label}`,
        admin_user_id: user.id,
        target_id: (details.target as string) ?? null,
        target_type: "referral",
        ip_address: ip,
        details,
      });
    } catch (_e) { /* swallow */ }
  };

  try {
    switch (body.action) {

      // ---------- settings.update (audit auto via trigger F33-19) ----------
      case "settings.update": {
        if (!body.settings) return json(400, { error: "settings requis" });
        const allowed = new Set([
          "discount_percent_first_invoice_monthly",
          "discount_stacks",
          "commission_model_default",
          "commission_value_default",
          "cooldown_days",
          "min_cashout_amount",
          "allow_self_referrals",
          "required_cycles",
          "payout_delay_min_days",
          "payout_delay_max_days",
        ]);
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(body.settings)) {
          if (allowed.has(k)) patch[k] = v;
        }
        if (Object.keys(patch).length === 0) return json(400, { error: "Aucun champ valide" });
        const { data: current } = await admin
          .from("referral_program_settings").select("id").limit(1).maybeSingle();
        if (!current) return json(404, { error: "Paramètres introuvables" });
        const { error } = await admin
          .from("referral_program_settings").update(patch).eq("id", current.id);
        if (error) return json(500, { error: error.message });
        await audit("settings_update", { target: current.id, patch });
        return json(200, { ok: true });
      }

      // ---------- code.create ----------
      case "code.create": {
        if (!body.code) return json(400, { error: "code requis" });
        if (!body.influencer_id) return json(400, { error: "influencer_id requis" });
        const codeUpper = body.code.trim().toUpperCase();
        // Duplicate guard (F33-B invariant)
        const { data: dup } = await admin
          .from("referral_codes").select("id").eq("code", codeUpper).maybeSingle();
        if (dup) return json(409, { error: "Code déjà utilisé" });
        const { data, error } = await admin
          .from("referral_codes").insert({
            influencer_id: body.influencer_id,
            code: codeUpper,
            code_type: "influencer",
            status: "active",
            usage_limit_total: body.usage_limit_total ?? null,
            usage_limit_monthly: body.usage_limit_monthly ?? null,
          }).select("id").maybeSingle();
        if (error) return json(500, { error: error.message });
        await audit("code_create", { target: data?.id, code: codeUpper, influencer_id: body.influencer_id });
        return json(200, { ok: true, id: data?.id });
      }

      // ---------- code.update ----------
      case "code.update": {
        if (!body.code_id) return json(400, { error: "code_id requis" });
        const patch: Record<string, unknown> = {};
        if (body.usage_limit_total !== undefined) patch.usage_limit_total = body.usage_limit_total;
        if (body.usage_limit_monthly !== undefined) patch.usage_limit_monthly = body.usage_limit_monthly;
        if (Object.keys(patch).length === 0) return json(400, { error: "Aucun champ à mettre à jour" });
        const { error } = await admin
          .from("referral_codes").update(patch).eq("id", body.code_id);
        if (error) return json(500, { error: error.message });
        await audit("code_update", { target: body.code_id, patch });
        return json(200, { ok: true });
      }

      // ---------- code.toggle (active/disabled) ----------
      case "code.toggle": {
        if (!body.code_id) return json(400, { error: "code_id requis" });
        if (!body.status || !["active", "disabled"].includes(body.status)) {
          return json(400, { error: "status doit être 'active' ou 'disabled'" });
        }
        const { error } = await admin
          .from("referral_codes").update({ status: body.status }).eq("id", body.code_id);
        if (error) return json(500, { error: error.message });
        await audit("code_toggle", { target: body.code_id, status: body.status });
        return json(200, { ok: true });
      }

      // ---------- influencer.set_status (cascade codes) ----------
      case "influencer.set_status": {
        if (!body.influencer_id) return json(400, { error: "influencer_id requis" });
        if (!body.new_status) return json(400, { error: "new_status requis" });
        if (body.new_status === "suspended" && !(body.reason || "").trim()) {
          return json(400, { error: "reason requise pour suspension" });
        }
        // Fetch existing notes to append
        const { data: inf } = await admin
          .from("influencers").select("notes").eq("id", body.influencer_id).maybeSingle();
        const patch: Record<string, unknown> = { status: body.new_status };
        if (body.reason) {
          patch.notes = `${inf?.notes ? inf.notes + "\n" : ""}[${new Date().toISOString()}] ${body.new_status}: ${body.reason}`;
        }
        const { error } = await admin
          .from("influencers").update(patch).eq("id", body.influencer_id);
        if (error) return json(500, { error: error.message });
        // Cascade
        if (body.cascade_codes !== false) {
          const nextCodeStatus = body.new_status === "suspended" ? "disabled" : "active";
          await admin.from("referral_codes")
            .update({ status: nextCodeStatus })
            .eq("influencer_id", body.influencer_id);
        }
        await audit("influencer_status", {
          target: body.influencer_id, new_status: body.new_status, reason: body.reason,
        });
        return json(200, { ok: true });
      }

      // ---------- attribution.decide (F33-14 anti double commission) ----------
      case "attribution.decide": {
        if (!body.attribution_id) return json(400, { error: "attribution_id requis" });
        if (!body.decision) return json(400, { error: "decision requise" });
        if (!["approved", "rejected", "hold", "disputed", "pending"].includes(body.decision)) {
          return json(400, { error: "decision invalide" });
        }
        const { data: attr, error: aErr } = await admin
          .from("referral_attributions")
          .select("id, influencer_id, status")
          .eq("id", body.attribution_id).maybeSingle();
        if (aErr) return json(500, { error: aErr.message });
        if (!attr) return json(404, { error: "Attribution introuvable" });

        // Update attribution
        const { error: upErr } = await admin
          .from("referral_attributions")
          .update({
            status: body.decision,
            fraud_notes: body.note || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.attribution_id);
        if (upErr) return json(500, { error: upErr.message });

        // F33-14: UPSERT on (attribution_id, type) — no duplicate commission
        // even after approve → reject → approve cycles.
        if (body.decision === "approved" && (body.commission || 0) > 0) {
          const { error: cErr } = await admin
            .from("commission_ledger_entries")
            .upsert({
              influencer_id: attr.influencer_id,
              attribution_id: attr.id,
              type: "approved_credit",
              amount: body.commission,
              currency: "CAD",
              status: "approved",
              notes: body.note || "Commission approuvée",
              approved_at: new Date().toISOString(),
              created_by: user.id,
            }, { onConflict: "attribution_id,type" });
          if (cErr) return json(500, { error: cErr.message });
        }

        if (body.decision === "rejected" || body.decision === "disputed") {
          // Reverse existing approved_credit if any (idempotent via unique on reversal)
          const { data: creds } = await admin
            .from("commission_ledger_entries")
            .select("id, amount")
            .eq("attribution_id", attr.id)
            .eq("type", "approved_credit")
            .eq("status", "approved");
          for (const c of creds || []) {
            await admin.from("commission_ledger_entries").upsert({
              influencer_id: attr.influencer_id,
              attribution_id: attr.id,
              type: "reversal",
              amount: -Number(c.amount),
              currency: "CAD",
              status: "approved",
              notes: body.note || `Annulation (${body.decision})`,
              approved_at: new Date().toISOString(),
              created_by: user.id,
            }, { onConflict: "attribution_id,type" });
          }
        }

        await audit("attribution_decide", {
          target: attr.id, decision: body.decision, commission: body.commission,
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
