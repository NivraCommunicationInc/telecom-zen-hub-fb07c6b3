// account-tags-actions — Module 27 (VIP / Churn risk / Tags)
// Canonical Edge Function for all account_tags mutations.
// Enforces: ownership, role-based sensitivity, canonical catalogue, motif >= 5,
// idempotency, expires_at hygiene, anti-flood, normalized errors, full audit.

import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  action: "list" | "add" | "remove" | "apply_lock";
  client_user_id: string;
  account_id?: string | null;
  tag_id?: string;
  tag_key?: string;
  severity?: "info" | "warning" | "critical";
  note?: string;
  expires_at?: string | null;
  reason?: string;
  idempotency_key?: string | null;
  // apply_lock only
  lock_mode?: "full_lock" | "payment_lock" | "portal_lock";
  notify_client?: boolean;
}

// Canonical catalogue — no free-form tag keys allowed.
// allowedRoles = roles authorized to add/remove this tag.
const STAFF_ANY = [
  "admin", "super_admin", "employee", "supervisor", "support",
  "billing_admin", "sales", "manager", "hr", "field_agent", "field_sales",
];
const ADMIN_ONLY = ["admin", "super_admin"];
const ADMIN_MANAGER = ["admin", "super_admin", "manager"];

type Preset = {
  key: string;
  label: string;
  severity: "info" | "warning" | "critical";
  allowedRoles: string[];
  system?: boolean; // set by system flows, still gated
};

const CATALOG: Preset[] = [
  { key: "vip", label: "VIP", severity: "info", allowedRoles: ADMIN_MANAGER },
  { key: "loyal", label: "Client fidèle", severity: "info", allowedRoles: STAFF_ANY },
  { key: "churn_risk", label: "Risque de churn", severity: "warning", allowedRoles: STAFF_ANY },
  { key: "watchlist", label: "Surveillance", severity: "warning", allowedRoles: STAFF_ANY },
  { key: "at_risk", label: "À risque", severity: "warning", allowedRoles: STAFF_ANY },
  { key: "collections", label: "Recouvrement actif", severity: "warning", allowedRoles: ["admin", "super_admin", "billing_admin", "manager"] },
  { key: "escalation_required", label: "Escalade requise", severity: "warning", allowedRoles: STAFF_ANY },
  { key: "satisfaction_risk", label: "Satisfaction à risque", severity: "warning", allowedRoles: STAFF_ANY, system: true },
  { key: "chargeback_history", label: "Historique chargeback", severity: "warning", allowedRoles: ADMIN_ONLY },
  { key: "do_not_contact", label: "Ne pas contacter", severity: "critical", allowedRoles: ADMIN_ONLY },
  { key: "fraud_suspected", label: "Fraude suspectée", severity: "critical", allowedRoles: ADMIN_ONLY },
  { key: "litigation", label: "Litige juridique", severity: "critical", allowedRoles: ADMIN_ONLY },
  { key: "full_lock", label: "Compte verrouillé", severity: "critical", allowedRoles: ADMIN_ONLY, system: true },
  { key: "payment_lock", label: "Paiements verrouillés", severity: "critical", allowedRoles: ADMIN_ONLY, system: true },
  { key: "portal_lock", label: "Portail verrouillé", severity: "critical", allowedRoles: ADMIN_ONLY, system: true },
];

const PRESET_MAP = new Map(CATALOG.map((p) => [p.key, p]));

const ACTION_LABELS: Record<string, string> = {
  tag_add: "Étiquette compte ajoutée",
  tag_remove: "Étiquette compte retirée",
  fraud_lock_applied: "Verrouillage sécurité appliqué",
};

const ERR = {
  UNAUTHORIZED: { status: 401, code: "UNAUTHORIZED", message: "Authentification requise" },
  FORBIDDEN_STAFF: { status: 403, code: "FORBIDDEN_STAFF", message: "Action réservée au personnel autorisé" },
  FORBIDDEN_ROLE: { status: 403, code: "FORBIDDEN_ROLE", message: "Rôle insuffisant pour ce tag" },
  CROSS_CLIENT: { status: 403, code: "CROSS_CLIENT_TARGET", message: "Compte non associé à ce client" },
  INVALID_INPUT: { status: 400, code: "INVALID_INPUT", message: "Paramètres invalides" },
  REASON_REQUIRED: { status: 400, code: "REASON_REQUIRED", message: "Motif requis (min 5 caractères)" },
  UNKNOWN_TAG: { status: 400, code: "UNKNOWN_TAG", message: "Tag hors catalogue" },
  DUPLICATE: { status: 409, code: "DUPLICATE_ACTIVE", message: "Cette étiquette existe déjà sur ce compte" },
  NOT_FOUND: { status: 404, code: "NOT_FOUND", message: "Étiquette introuvable" },
  RATE_LIMIT: { status: 429, code: "RATE_LIMIT", message: "Trop de mutations récentes — réessayez dans un instant" },
  IDEMPOTENT_REPLAY: { status: 200, code: "IDEMPOTENT_REPLAY", message: "Replay détecté" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return jerr(ERR.UNAUTHORIZED);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return jerr(ERR.UNAUTHORIZED);
    const actor = userData.user;

    const admin = createClient(supabaseUrl, serviceKey);
    const { isStaff, callerRole, roles } = await checkStaffAuth(admin, actor.id);
    if (!isStaff) return jerr(ERR.FORBIDDEN_STAFF);

    const body = (await req.json()) as Body;
    if (!body?.client_user_id || !body?.action) return jerr(ERR.INVALID_INPUT);

    // ---------- helpers ----------
    const assertOwnership = async (accountId: string | null | undefined): Promise<Response | null> => {
      if (!accountId) return null;
      const { data: acct } = await admin
        .from("accounts")
        .select("id, client_id, status")
        .eq("id", accountId)
        .maybeSingle();
      if (!acct) {
        await audit("tag_denied", { reason_code: "ACCOUNT_NOT_FOUND", account_id: accountId });
        return jerr({ ...ERR.CROSS_CLIENT, message: "Compte introuvable" });
      }
      if ((acct as any).client_id !== body.client_user_id) {
        await audit("tag_denied", {
          reason_code: "CROSS_CLIENT_TARGET",
          account_id: accountId,
          claimed_client_user_id: body.client_user_id,
        });
        return jerr(ERR.CROSS_CLIENT);
      }
      return null;
    };

    const audit = async (action: string, details: Record<string, unknown>) => {
      try {
        await admin.from("admin_audit_log").insert({
          admin_user_id: actor.id,
          admin_email: actor.email,
          action: `account_ops.${action}`,
          target_type: "user",
          target_id: body.client_user_id,
          details: { actor_role: callerRole, roles, ...details },
        });
      } catch (_e) { /* best-effort */ }
    };

    const writeParityLogs = async (
      op: "tag_add" | "tag_remove" | "fraud_lock_applied",
      accountId: string | null,
      details: Record<string, unknown>,
      reason: string,
    ) => {
      try {
        await admin.from("client_activity_logs").insert({
          client_id: body.client_user_id,
          actor_user_id: actor.id,
          actor_role: callerRole,
          actor_name: actor.email || callerRole,
          action_type: "account_tag",
          summary: ACTION_LABELS[op],
          entity_type: "account_tag",
          entity_id: accountId ?? body.client_user_id,
          after_data: { ...details, reason },
        });
      } catch (_e) { /* best-effort */ }
      try {
        await admin.from("activity_logs").insert({
          user_id: body.client_user_id,
          entity_type: "account_tag",
          entity_id: accountId ?? body.client_user_id,
          action: op,
          reason,
          actor_email: actor.email ?? null,
          actor_name: actor.email ?? callerRole,
          actor_role: callerRole,
          details: { source: "account-tags-actions", ...details },
        } as any);
      } catch (_e) { /* best-effort */ }
      try {
        if (accountId) {
          await admin.from("client_internal_notes").insert({
            account_id: accountId,
            client_id: body.client_user_id,
            note_type: "system",
            body: `${ACTION_LABELS[op]} — par ${actor.email || actor.id} (${callerRole}) — motif: ${reason}`,
            created_by_user_id: actor.id,
            created_by_name: actor.email || callerRole,
            created_by_role: callerRole,
          });
        }
      } catch (_e) { /* best-effort */ }
    };

    // Anti-flood: max 20 mutating calls / 60s per actor
    const checkFlood = async (): Promise<Response | null> => {
      try {
        const since = new Date(Date.now() - 60_000).toISOString();
        const { count } = await admin
          .from("admin_audit_log")
          .select("id", { count: "exact", head: true })
          .eq("admin_user_id", actor.id)
          .in("action", ["account_ops.tag_add", "account_ops.tag_remove", "account_ops.fraud_lock_applied"])
          .gte("created_at", since);
        if ((count ?? 0) >= 20) return jerr(ERR.RATE_LIMIT);
      } catch (_e) { /* best-effort */ }
      return null;
    };

    // Idempotency probe: return prior success if the same idempotency_key exists.
    const idempotentReplay = async (op: string): Promise<Response | null> => {
      if (!body.idempotency_key) return null;
      const { data } = await admin
        .from("admin_audit_log")
        .select("id, details")
        .eq("admin_user_id", actor.id)
        .eq("action", `account_ops.${op}`)
        .contains("details", { idempotency_key: body.idempotency_key })
        .limit(1)
        .maybeSingle();
      if (data) return json({ ok: true, replay: true, previous_id: data.id });
      return null;
    };

    switch (body.action) {
      // -------------------------- LIST --------------------------
      case "list": {
        // Auto-expire: hide rows past expires_at
        const nowIso = new Date().toISOString();
        const { data, error } = await admin
          .from("account_tags")
          .select("*")
          .eq("client_user_id", body.client_user_id)
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
          .order("severity", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({
          ok: true,
          tags: data ?? [],
          presets: CATALOG.map((p) => ({
            key: p.key,
            label: p.label,
            severity: p.severity,
            requires_admin: p.allowedRoles === ADMIN_ONLY,
            system: !!p.system,
          })),
        });
      }

      // -------------------------- ADD --------------------------
      case "add": {
        if (!body.tag_key) return jerr(ERR.INVALID_INPUT);
        const preset = PRESET_MAP.get(body.tag_key.trim().toLowerCase());
        if (!preset) return jerr(ERR.UNKNOWN_TAG);
        if (!preset.allowedRoles.some((r) => roles.includes(r))) return jerr(ERR.FORBIDDEN_ROLE);
        if (!body.reason || body.reason.trim().length < 5) return jerr(ERR.REASON_REQUIRED);

        const own = await assertOwnership(body.account_id);
        if (own) return own;
        const flood = await checkFlood();
        if (flood) return flood;
        const replay = await idempotentReplay("tag_add");
        if (replay) return replay;

        // expires_at hygiene
        let expiresAt: string | null = null;
        if (body.expires_at) {
          const d = new Date(body.expires_at);
          if (Number.isNaN(d.getTime())) return jerr({ ...ERR.INVALID_INPUT, message: "expires_at invalide" });
          if (d.getTime() <= Date.now()) return jerr({ ...ERR.INVALID_INPUT, message: "expires_at doit être futur" });
          expiresAt = d.toISOString();
        }

        const reason = body.reason.trim();
        const row = {
          client_user_id: body.client_user_id,
          account_id: body.account_id ?? null,
          tag_key: preset.key,
          tag_label: preset.label,
          severity: preset.severity,
          note: body.note?.trim() || null,
          expires_at: expiresAt,
          created_by: actor.id,
          created_by_email: actor.email ?? null,
        };

        const { data, error } = await admin.from("account_tags").insert(row).select("*").single();
        if (error) {
          if (String(error.message).toLowerCase().includes("unique") ||
              String(error.message).includes("account_tags_unique_active")) {
            return jerr(ERR.DUPLICATE);
          }
          throw error;
        }

        await audit("tag_add", {
          tag: row,
          reason,
          idempotency_key: body.idempotency_key ?? null,
        });
        await writeParityLogs("tag_add", body.account_id ?? null, { tag: row }, reason);

        return json({ ok: true, tag: data });
      }

      // -------------------------- REMOVE --------------------------
      case "remove": {
        if (!body.tag_id) return jerr({ ...ERR.INVALID_INPUT, message: "tag_id requis" });
        if (!body.reason || body.reason.trim().length < 5) return jerr(ERR.REASON_REQUIRED);

        const { data: existing } = await admin
          .from("account_tags")
          .select("*")
          .eq("id", body.tag_id)
          .eq("client_user_id", body.client_user_id)
          .maybeSingle();
        if (!existing) return jerr(ERR.NOT_FOUND);

        // Role check on the existing tag's sensitivity
        const preset = PRESET_MAP.get(existing.tag_key);
        if (preset && !preset.allowedRoles.some((r) => roles.includes(r))) return jerr(ERR.FORBIDDEN_ROLE);

        const own = await assertOwnership(existing.account_id ?? body.account_id ?? null);
        if (own) return own;
        const flood = await checkFlood();
        if (flood) return flood;
        const replay = await idempotentReplay("tag_remove");
        if (replay) return replay;

        const reason = body.reason.trim();
        const { error } = await admin
          .from("account_tags")
          .delete()
          .eq("id", body.tag_id)
          .eq("client_user_id", body.client_user_id);
        if (error) throw error;

        await audit("tag_remove", {
          removed_tag: existing,
          reason,
          idempotency_key: body.idempotency_key ?? null,
        });
        await writeParityLogs("tag_remove", existing.account_id ?? null, { removed_tag: existing }, reason);

        return json({ ok: true });
      }

      // -------------------------- APPLY LOCK (fraud) --------------------------
      // Server-only path to update accounts.status + write the *_lock tag.
      case "apply_lock": {
        if (!body.lock_mode || !["full_lock", "payment_lock", "portal_lock"].includes(body.lock_mode)) {
          return jerr({ ...ERR.INVALID_INPUT, message: "lock_mode invalide" });
        }
        if (!body.reason || body.reason.trim().length < 10) {
          return jerr({ ...ERR.REASON_REQUIRED, message: "Motif requis (min 10 caractères)" });
        }
        const preset = PRESET_MAP.get(body.lock_mode)!;
        if (!preset.allowedRoles.some((r) => roles.includes(r))) return jerr(ERR.FORBIDDEN_ROLE);
        if (!body.account_id) return jerr({ ...ERR.INVALID_INPUT, message: "account_id requis" });

        const own = await assertOwnership(body.account_id);
        if (own) return own;
        const flood = await checkFlood();
        if (flood) return flood;
        const replay = await idempotentReplay("fraud_lock_applied");
        if (replay) return replay;

        const reason = body.reason.trim();

        if (body.lock_mode === "full_lock") {
          const { error: upErr } = await admin
            .from("accounts")
            .update({ status: "blocked", updated_at: new Date().toISOString() } as any)
            .eq("id", body.account_id);
          if (upErr) throw upErr;
        }

        // Upsert lock tag (soft: delete existing same key first for clean write)
        await admin
          .from("account_tags")
          .delete()
          .eq("client_user_id", body.client_user_id)
          .eq("tag_key", preset.key);

        const { data: tag, error: tagErr } = await admin
          .from("account_tags")
          .insert({
            client_user_id: body.client_user_id,
            account_id: body.account_id,
            tag_key: preset.key,
            tag_label: preset.label,
            severity: preset.severity,
            note: reason,
            created_by: actor.id,
            created_by_email: actor.email ?? null,
          })
          .select("*")
          .single();
        if (tagErr) throw tagErr;

        await audit("fraud_lock_applied", {
          lock_mode: body.lock_mode,
          account_id: body.account_id,
          reason,
          idempotency_key: body.idempotency_key ?? null,
        });
        await writeParityLogs("fraud_lock_applied", body.account_id, { lock_mode: body.lock_mode, tag }, reason);

        return json({ ok: true, tag, lock_mode: body.lock_mode });
      }

      default:
        return jerr({ ...ERR.INVALID_INPUT, message: `unknown action: ${body.action}` });
    }
  } catch (e) {
    console.error("account-tags-actions error", e);
    return json({ ok: false, code: "INTERNAL", error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jerr(e: { status: number; code: string; message: string }) {
  return json({ ok: false, code: e.code, error: e.message }, e.status);
}
