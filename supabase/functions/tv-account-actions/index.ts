// TV account actions — Nivra Core & Nivra OneView CS
// Single entry for all client TV management operations:
//   - change_plan         : change TV plan (upgrade/downgrade/lateral)
//   - add_themed_pack     : activate themed bouquet (Sports/Cinema/International/Kids/Adult/Premium)
//   - remove_themed_pack  : cancel a themed bouquet
//   - purchase_vod        : record a PPV/VOD purchase (on-invoice by default)
//   - terminal_action     : reboot / identify / factory_reset / firmware_push / deactivate / reactivate
//   - set_parental        : enable / update parental controls (rating + blocked channels + PIN)
//
// Every action:
//   - validates staff role via user_roles (admin/employee/supervisor/support/billing_admin/sales)
//   - writes the domain row (tv_plan_changes | tv_addon_subscriptions | tv_vod_purchases |
//     tv_terminal_actions | tv_parental_controls)
//   - records admin_audit_log entry (best-effort, never blocks)
//   - queues a branded corporate-shell client email through email_queue (Violet Bold)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "change_plan"
  | "add_themed_pack"
  | "remove_themed_pack"
  | "purchase_vod"
  | "terminal_action"
  | "set_parental"
  | "set_channels";

interface Body {
  action: Action;
  client_user_id: string;
  account_id?: string | null;
  subscription_id?: string | null;
  reason?: string | null;
  idempotency_key?: string | null;

  // change_plan
  previous_plan_name?: string;
  previous_monthly_price?: number;
  new_plan_name?: string;
  new_monthly_price?: number;
  change_type?: "upgrade" | "downgrade" | "lateral" | "reactivation" | "cancellation";
  effective_date?: string;

  // add/remove themed pack
  addon_id?: string;
  addon_code?: string;
  addon_name?: string;
  addon_type?:
    | "themed_pack" | "sports" | "cinema" | "international"
    | "adult" | "kids" | "premium_channel" | "other";
  monthly_price?: number;

  // VOD
  title?: string;
  content_type?: "movie" | "event" | "ppv" | "series" | "rental";
  amount?: number;
  currency?: string;
  payment_method?: string;
  payment_reference?: string;

  // terminal
  terminal_serial?: string;
  action_type?: "reboot" | "identify" | "factory_reset" | "firmware_push" | "deactivate" | "reactivate";

  // parental
  enabled?: boolean;
  max_rating?: "G" | "PG" | "PG-13" | "R" | "NC-17" | "adult_blocked";
  pin?: string;
  blocked_channels?: string[];
  time_restrictions?: Record<string, unknown>;

  // set_channels
  channel_ids?: string[];        // tv_channels.id list
  notes?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_ROLES = new Set([
  "admin", "employee", "supervisor", "support", "billing_admin", "sales",
]);

const TERMINAL_LABELS: Record<string, { label: string; critical: boolean }> = {
  reboot:         { label: "Redémarrage du terminal TV", critical: false },
  identify:       { label: "Identification du terminal TV", critical: false },
  factory_reset:  { label: "Réinitialisation usine du terminal TV", critical: true },
  firmware_push:  { label: "Mise à jour micrologiciel du terminal TV", critical: false },
  deactivate:     { label: "Désactivation du terminal TV", critical: true },
  reactivate:     { label: "Réactivation du terminal TV", critical: false },
};

const fmtMoney = (n: number, currency = "CAD") => {
  try {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(n);
  } catch (_e) {
    return `${n.toFixed(2)} $`;
  }
};

// Hash PIN with sha-256 (parental control)
const sha256Hex = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
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

  // Authorize: staff roles only
    const { isStaff } = await checkStaffAuth(admin, user.id);
  if (!isStaff) return json(403, { error: "Action réservée au personnel autorisé" });

  let body: Body;
  try {
    body = await req.json();
  } catch (_e) {
    return json(400, { error: "Corps JSON invalide" });
  }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return json(400, { error: "Champs requis: action, client_user_id" });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_id, email, first_name, last_name, account_number")
    .eq("user_id", client_user_id)
    .maybeSingle();

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const callerName =
    [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(" ") ||
    callerProfile?.email || "Personnel Nivra";

  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const audit = async (label: string, payload: Record<string, unknown>) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `tv.${label}`,
        admin_user_id: user.id,
        admin_email: callerProfile?.email ?? null,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        details: payload,
      });
    } catch (_e) { /* swallow */ }
  };

  const activity = async (
    action_type: string,
    entity_id: string | null,
    entity_type: string,
    summary: string,
    after_data: Record<string, unknown> | null = null,
  ) => {
    try {
      await admin.from("client_activity_logs").insert({
        client_id: client_user_id,
        actor_user_id: user.id,
        actor_name: callerName,
        actor_role: "staff",
        action_type,
        entity_type,
        entity_id,
        summary,
        before_data: null,
        after_data,
      });
    } catch (_e) { /* swallow */ }
  };

  const sysNote = async (body_text: string) => {
    try {
      await admin.from("client_internal_notes").insert({
        client_id: client_user_id,
        note_type: "system",
        body: body_text,
        created_by_user_id: user.id,
        created_by_role: "staff",
        created_by_name: callerName,
      });
    } catch (_e) { /* swallow */ }
  };

  const enqueueEmail = async (template: string, vars: Record<string, unknown>) => {
    if (!clientEmail) return;
    try {
      await admin.from("email_queue").insert({
        to_email: clientEmail,
        template_key: template,
        template_vars: { ...vars, first_name: firstName, to_email: clientEmail },
        status: "queued",
        priority: 0,
      });
    } catch (_e) { /* swallow */ }
  };

  try {
    switch (action) {
      // ============================================================
      case "change_plan": {
        const new_plan_name = (body.new_plan_name || "").trim();
        const new_monthly_price = Number(body.new_monthly_price ?? 0);
        if (!new_plan_name) return json(400, { error: "new_plan_name requis" });
        if (!Number.isFinite(new_monthly_price) || new_monthly_price < 0) {
          return json(400, { error: "new_monthly_price invalide" });
        }
        const change_type = body.change_type || "upgrade";
        const effective_date = body.effective_date || new Date().toISOString().slice(0, 10);

        const { data, error } = await admin
          .from("tv_plan_changes")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            previous_plan_name: body.previous_plan_name ?? null,
            previous_monthly_price: body.previous_monthly_price ?? null,
            new_plan_name,
            new_monthly_price,
            change_type,
            effective_date,
            status: "completed",
            reason: body.reason ?? null,
            performed_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        // Best-effort: update subscription price/name
        if (body.subscription_id) {
          await admin
            .from("subscriptions")
            .update({
              plan_name: new_plan_name,
              monthly_price: new_monthly_price,
              amount: new_monthly_price,
            })
            .eq("id", body.subscription_id);
        }

        await audit("change_plan", {
          plan_change_id: data.id, new_plan_name, new_monthly_price, change_type,
        });
        await activity("plan_change", data.id, "subscription",
          `Forfait TV: ${body.previous_plan_name || "—"} → ${new_plan_name} (${fmtMoney(new_monthly_price)})`,
          { new_plan_name, new_monthly_price, change_type, effective_date });
        await sysNote(`Changement de forfait TV — ${body.previous_plan_name || "—"} → ${new_plan_name} (${fmtMoney(new_monthly_price)}). Motif: ${body.reason || "—"}`);
        await enqueueEmail("client_tv_plan_change", {
          previous_plan_name: body.previous_plan_name || "—",
          new_plan_name,
          new_monthly_price: fmtMoney(new_monthly_price),
          effective_date,
          change_type,
        });

        return json(200, { ok: true, plan_change_id: data.id });
      }

      // ============================================================
      case "add_themed_pack": {
        const addon_code = body.addon_code;
        const addon_name = body.addon_name;
        const addon_type = body.addon_type || "themed_pack";
        if (!addon_code || !addon_name) {
          return json(400, { error: "Champs requis: addon_code, addon_name" });
        }
        const monthly_price = Number(body.monthly_price ?? 0);

        const { data, error } = await admin
          .from("tv_addon_subscriptions")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            addon_code,
            addon_name,
            addon_type,
            monthly_price,
            status: "active",
            activated_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("add_themed_pack", { addon_id: data.id, addon_code, monthly_price });
        await activity("service_add", data.id, "service",
          `Bouquet TV activé: ${addon_name} (${fmtMoney(monthly_price)}/mois)`,
          { addon_code, addon_name, addon_type, monthly_price });
        await sysNote(`Activation bouquet TV — ${addon_name} (${addon_code}) à ${fmtMoney(monthly_price)}/mois. Motif: ${body.reason || "—"}`);
        await enqueueEmail("client_tv_pack_change", {
          addon_name,
          monthly_price: fmtMoney(monthly_price),
          change_type: "activated",
        });

        return json(200, { ok: true, addon_id: data.id });
      }

      // ============================================================
      case "remove_themed_pack": {
        const addon_id = body.addon_id;
        if (!addon_id) return json(400, { error: "addon_id requis" });

        const { data: existing, error: fetchErr } = await admin
          .from("tv_addon_subscriptions")
          .select("id, addon_name, monthly_price, status, user_id")
          .eq("id", addon_id)
          .maybeSingle();
        if (fetchErr) return json(500, { error: fetchErr.message });
        if (!existing) return json(404, { error: "Bouquet introuvable" });
        if (existing.user_id !== client_user_id) return json(403, { error: "Cible invalide" });
        if (existing.status !== "active") return json(409, { error: "Bouquet déjà annulé" });

        const { error: updErr } = await admin
          .from("tv_addon_subscriptions")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancelled_reason: body.reason ?? null,
          })
          .eq("id", addon_id);
        if (updErr) return json(500, { error: updErr.message });

        await audit("remove_themed_pack", { addon_id, addon_name: existing.addon_name });
        await activity("service_remove", addon_id, "service",
          `Bouquet TV annulé: ${existing.addon_name}`,
          { addon_id, addon_name: existing.addon_name });
        await sysNote(`Annulation bouquet TV — ${existing.addon_name}. Motif: ${body.reason || "—"}`);
        await enqueueEmail("client_tv_pack_change", {
          addon_name: existing.addon_name,
          monthly_price: fmtMoney(Number(existing.monthly_price ?? 0)),
          change_type: "cancelled",
        });

        return json(200, { ok: true });
      }

      // ============================================================
      case "purchase_vod": {
        const title = (body.title || "").trim();
        const amount = Number(body.amount ?? 0);
        if (!title) return json(400, { error: "title requis" });
        if (!Number.isFinite(amount) || amount <= 0) return json(400, { error: "amount invalide" });

        const content_type = body.content_type || "movie";
        const currency = body.currency || "CAD";
        const payment_method = body.payment_method || "on_invoice";
        const payment_reference = body.payment_reference ||
          `VOD-${Date.now().toString(36).toUpperCase()}`;

        const { data, error } = await admin
          .from("tv_vod_purchases")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            title,
            content_type,
            amount,
            currency,
            payment_method,
            payment_reference,
            status: "completed",
            performed_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("purchase_vod", { vod_id: data.id, title, amount, currency });
        await activity("service_add", data.id, "service",
          `Achat VOD/PPV: ${title} (${fmtMoney(amount, currency)})`,
          { title, content_type, amount, currency, payment_method, payment_reference });
        await sysNote(`Achat VOD/PPV — ${title} (${content_type}) à ${fmtMoney(amount, currency)}. Réf: ${payment_reference}. Motif: ${body.reason || "—"}`);
        await enqueueEmail("client_tv_vod_purchase", {
          title,
          content_type,
          amount: fmtMoney(amount, currency),
          payment_method,
          payment_reference,
        });

        return json(200, { ok: true, vod_id: data.id });
      }

      // ============================================================
      case "terminal_action": {
        const action_type = body.action_type;
        if (!action_type || !TERMINAL_LABELS[action_type]) {
          return json(400, { error: "action_type invalide" });
        }
        const meta = TERMINAL_LABELS[action_type];

        const { data, error } = await admin
          .from("tv_terminal_actions")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            terminal_serial: body.terminal_serial ?? null,
            action_type,
            reason: body.reason ?? null,
            status: "completed",
            performed_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("terminal_action", {
          terminal_action_id: data.id, action_type, terminal_serial: body.terminal_serial,
        });
        await activity("equipment_change", data.id, "equipment",
          `${meta.label}${body.terminal_serial ? ` (SN ${body.terminal_serial})` : ""}`,
          { action_type, terminal_serial: body.terminal_serial, critical: meta.critical });
        await sysNote(`${meta.label} — SN ${body.terminal_serial || "—"}. Motif: ${body.reason || "—"}${meta.critical ? " [CRITIQUE]" : ""}`);
        await enqueueEmail("client_tv_terminal_action", {
          action_label: meta.label,
          terminal_serial: body.terminal_serial || "—",
          reason: body.reason || "—",
          is_critical: meta.critical ? "true" : "false",
        });

        return json(200, { ok: true, terminal_action_id: data.id });
      }

      // ============================================================
      case "set_parental": {
        const enabled = !!body.enabled;
        const max_rating = body.max_rating || "PG-13";
        const blocked_channels = Array.isArray(body.blocked_channels) ? body.blocked_channels : [];
        const time_restrictions = body.time_restrictions ?? {};

        let pin_hash: string | null | undefined = undefined;
        if (body.pin) {
          if (!/^\d{4,8}$/.test(body.pin)) {
            return json(400, { error: "NIP parental doit être 4 à 8 chiffres" });
          }
          pin_hash = await sha256Hex(body.pin);
        }

        const upsertPayload: Record<string, unknown> = {
          user_id: client_user_id,
          account_id: body.account_id ?? null,
          enabled,
          max_rating,
          blocked_channels,
          time_restrictions,
          updated_by: user.id,
        };
        if (pin_hash !== undefined) upsertPayload.pin_hash = pin_hash;

        // Scope upsert by (user_id, account_id) so a multi-account user
        // doesn't overwrite parental controls across their other accounts.
        // Falls back to user_id-only upsert when account_id is null (legacy
        // single-account customers).
        const conflictKey = body.account_id ? "user_id,account_id" : "user_id";
        const { error } = await admin
          .from("tv_parental_controls")
          .upsert(upsertPayload, { onConflict: conflictKey });
        if (error) return json(500, { error: error.message });

        await audit("set_parental", {
          enabled, max_rating, blocked_count: blocked_channels.length, pin_changed: !!body.pin,
        });
        await enqueueEmail("client_tv_parental_controls", {
          enabled: enabled ? "true" : "false",
          max_rating,
          blocked_count: String(blocked_channels.length),
          pin_changed: body.pin ? "true" : "false",
        });

        return json(200, { ok: true });
      }

      // ============================================================
      case "set_channels": {
        const ids = Array.isArray(body.channel_ids) ? body.channel_ids.filter(Boolean) : [];
        if (ids.length === 0) return json(400, { error: "Aucune chaîne sélectionnée" });

        const { data: chans, error: chErr } = await admin
          .from("tv_channels")
          .select("id,name,category,price")
          .in("id", ids)
          .eq("is_active", true);
        if (chErr) return json(500, { error: chErr.message });
        if (!chans || chans.length === 0) return json(400, { error: "Chaînes introuvables" });

        const channelsJson = chans.map((c) => ({
          id: c.id, name: c.name, category: c.category, price: Number(c.price ?? 0),
        }));
        const total_price = channelsJson.reduce((s, c) => s + c.price, 0);

        const { data, error } = await admin
          .from("channel_selections")
          .insert({
            user_id: client_user_id,
            channels: channelsJson,
            total_price,
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
            confirmed_by: user.id,
            notes: body.notes ?? null,
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("set_channels", {
          selection_id: data.id, count: channelsJson.length, total_price,
        });
        await enqueueEmail("client_tv_channels_updated", {
          channel_count: String(channelsJson.length),
          total_price: fmtMoney(total_price),
          channel_names: channelsJson.map((c) => c.name).slice(0, 20).join(", "),
        });

        return json(200, { ok: true, selection_id: data.id, total_price });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
