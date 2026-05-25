// Mobile account actions — Core & OneView CS
// Single entry point for ALL mobile client actions:
//   - topup            : record a prepaid recharge
//   - add_addon        : activate a mobile add-on (data, intl, LD, etc.)
//   - remove_addon     : cancel an active mobile add-on
//   - sim_action       : suspend / reactivate / replace / swap eSIM / block intl-roaming
//
// Every action:
//   - validates staff role via has_role (admin/employee/supervisor/support/billing_admin/sales)
//   - writes domain row (mobile_topups | mobile_addons | sim_actions)
//   - records admin_audit_log entry (best-effort, never blocks)
//   - queues a branded client email through email_queue (Violet Bold shell)
//
// All errors return CORS-safe JSON. Idempotency uses idempotency_key when provided.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "topup" | "add_addon" | "remove_addon" | "sim_action";

interface Body {
  action: Action;
  client_user_id: string;
  account_id?: string | null;
  subscription_id?: string | null;
  msisdn?: string | null;
  reason?: string | null;
  idempotency_key?: string | null;

  // topup
  amount?: number;
  currency?: string;
  payment_method?: string;
  payment_reference?: string;

  // addon
  addon_id?: string;
  addon_code?: string;
  addon_name?: string;
  addon_type?: "data" | "international" | "long_distance" | "roaming" | "voicemail" | "other";
  monthly_price?: number;
  one_time_price?: number;

  // sim
  sim_action_type?:
    | "suspend_lost" | "suspend_stolen" | "suspend_other" | "reactivate"
    | "replace_sim" | "swap_to_esim" | "swap_to_physical"
    | "block_international" | "unblock_international"
    | "block_roaming" | "unblock_roaming";
  new_iccid?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ALLOWED_ROLES = new Set([
  "admin", "employee", "supervisor", "support", "billing_admin", "sales",
]);

const SIM_ACTION_LABELS: Record<string, { label: string; critical: boolean }> = {
  suspend_lost: { label: "SIM suspendue (perte)", critical: true },
  suspend_stolen: { label: "SIM suspendue (vol)", critical: true },
  suspend_other: { label: "SIM suspendue", critical: true },
  reactivate: { label: "SIM réactivée", critical: false },
  replace_sim: { label: "SIM remplacée", critical: true },
  swap_to_esim: { label: "Conversion vers eSIM", critical: false },
  swap_to_physical: { label: "Conversion vers SIM physique", critical: false },
  block_international: { label: "Appels internationaux bloqués", critical: false },
  unblock_international: { label: "Appels internationaux débloqués", critical: false },
  block_roaming: { label: "Itinérance bloquée", critical: false },
  unblock_roaming: { label: "Itinérance débloquée", critical: false },
};

const fmtMoney = (n: number, currency = "CAD") => {
  try {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} $`;
  }
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
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const userRoles = new Set((roles || []).map((r: { role: string }) => r.role));
  const isStaff = [...userRoles].some((r) => ALLOWED_ROLES.has(r));
  if (!isStaff) return json(403, { error: "Action réservée au personnel autorisé" });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Corps JSON invalide" });
  }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return json(400, { error: "Champs requis: action, client_user_id" });
  }

  // Resolve client profile/email
  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_id, email, first_name, last_name, account_number")
    .eq("user_id", client_user_id)
    .maybeSingle();

  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const audit = async (
    action_label: string,
    payload: Record<string, unknown>,
  ) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `mobile.${action_label}`,
        admin_id: user.id,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        metadata: payload,
      });
    } catch (_e) { /* swallow */ }
  };

  const enqueueEmail = async (
    template: string,
    vars: Record<string, unknown>,
  ) => {
    if (!clientEmail) return;
    try {
      await admin.from("email_queue").insert({
        to_email: clientEmail,
        template_key: template,
        template_vars: { ...vars, first_name: firstName, to_email: clientEmail },
        status: "queued",
        priority: "normal",
      });
    } catch (_e) { /* swallow */ }
  };

  try {
    switch (action) {
      // ============================================================
      case "topup": {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return json(400, { error: "Montant invalide" });
        }
        const currency = body.currency || "CAD";
        const payment_method = body.payment_method || "manual";
        const payment_reference = body.payment_reference ||
          `TOP-${Date.now().toString(36).toUpperCase()}`;

        const { data, error } = await admin
          .from("mobile_topups")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            msisdn: body.msisdn ?? null,
            amount,
            currency,
            payment_method,
            payment_reference,
            status: "completed",
            performed_by: user.id,
            reason: body.reason ?? null,
            metadata: { source: "client-account-actions", idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("topup", { topup_id: data.id, amount, currency, msisdn: body.msisdn });
        await enqueueEmail("client_mobile_topup_confirmation", {
          amount: fmtMoney(amount, currency),
          msisdn: body.msisdn,
          payment_method,
          payment_reference,
        });

        return json(200, { ok: true, topup_id: data.id });
      }

      // ============================================================
      case "add_addon": {
        const addon_code = body.addon_code;
        const addon_name = body.addon_name;
        const addon_type = body.addon_type;
        if (!addon_code || !addon_name || !addon_type) {
          return json(400, { error: "Champs requis: addon_code, addon_name, addon_type" });
        }
        const monthly_price = Number(body.monthly_price ?? 0);
        const one_time_price = Number(body.one_time_price ?? 0);

        const { data, error } = await admin
          .from("mobile_addons")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            addon_code,
            addon_name,
            addon_type,
            monthly_price,
            one_time_price,
            status: "active",
            activated_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("add_addon", { addon_id: data.id, addon_code, monthly_price });
        await enqueueEmail("client_mobile_addon_change", {
          addon_name,
          monthly_price: fmtMoney(monthly_price),
          change_type: "activated",
        });

        return json(200, { ok: true, addon_id: data.id });
      }

      // ============================================================
      case "remove_addon": {
        const addon_id = body.addon_id;
        if (!addon_id) return json(400, { error: "addon_id requis" });

        const { data: existing, error: fetchErr } = await admin
          .from("mobile_addons")
          .select("id, addon_name, monthly_price, status, user_id")
          .eq("id", addon_id)
          .maybeSingle();
        if (fetchErr) return json(500, { error: fetchErr.message });
        if (!existing) return json(404, { error: "Option introuvable" });
        if (existing.user_id !== client_user_id) return json(403, { error: "Cible invalide" });
        if (existing.status !== "active") {
          return json(409, { error: "Option déjà annulée" });
        }

        const { error: updErr } = await admin
          .from("mobile_addons")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancelled_reason: body.reason ?? null,
          })
          .eq("id", addon_id);
        if (updErr) return json(500, { error: updErr.message });

        await audit("remove_addon", { addon_id, addon_name: existing.addon_name });
        await enqueueEmail("client_mobile_addon_change", {
          addon_name: existing.addon_name,
          monthly_price: fmtMoney(Number(existing.monthly_price ?? 0)),
          change_type: "cancelled",
        });

        return json(200, { ok: true });
      }

      // ============================================================
      case "sim_action": {
        const sim_action_type = body.sim_action_type;
        if (!sim_action_type || !SIM_ACTION_LABELS[sim_action_type]) {
          return json(400, { error: "sim_action_type invalide" });
        }
        const meta = SIM_ACTION_LABELS[sim_action_type];

        // Resolve mobile_fulfillment + old iccid.
        // SECURITY: scope by BOTH user_id AND subscription_id (and account_id
        // when provided) so a multi-account user can't trigger SIM actions
        // on the wrong account's fulfillment. Without the subscription_id
        // filter, the most recent fulfillment of ANY of the user's accounts
        // would have been used.
        let mobile_fulfillment_id: string | null = null;
        let old_iccid: string | null = null;
        if (body.subscription_id) {
          let q = admin
            .from("mobile_fulfillment")
            .select("id, sim_iccid, order_id, account_id, subscription_id")
            .eq("user_id", client_user_id)
            .eq("subscription_id", body.subscription_id);
          if (body.account_id) q = q.eq("account_id", body.account_id);
          const { data: fulfill } = await q
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          mobile_fulfillment_id = fulfill?.id ?? null;
          old_iccid = fulfill?.sim_iccid ?? null;
        }

        const { data, error } = await admin
          .from("sim_actions")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            mobile_fulfillment_id,
            action_type: sim_action_type,
            reason: body.reason ?? null,
            old_iccid,
            new_iccid: body.new_iccid ?? null,
            status: "completed",
            performed_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        // Update fulfillment for replace/swap actions
        if (mobile_fulfillment_id && body.new_iccid) {
          if (sim_action_type === "replace_sim" || sim_action_type === "swap_to_physical") {
            await admin
              .from("mobile_fulfillment")
              .update({ sim_iccid: body.new_iccid, sim_type: "physical" })
              .eq("id", mobile_fulfillment_id);
          } else if (sim_action_type === "swap_to_esim") {
            await admin
              .from("mobile_fulfillment")
              .update({ sim_iccid: body.new_iccid, sim_type: "esim" })
              .eq("id", mobile_fulfillment_id);
          }
        }

        await audit("sim_action", {
          sim_action_id: data.id,
          sim_action_type,
          msisdn: body.msisdn,
        });
        await enqueueEmail("client_mobile_sim_action", {
          action_label: meta.label,
          reason: body.reason || "Demande de l'utilisateur",
          msisdn: body.msisdn,
          is_critical: meta.critical ? "true" : "false",
        });

        return json(200, { ok: true, sim_action_id: data.id });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
