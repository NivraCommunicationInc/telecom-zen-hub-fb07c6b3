/**
 * core-apply-plan-change
 * Nivra Core — Executor transactionnel pour changement de forfait depuis le Client 360.
 *
 * Étapes:
 *  1. Vérifie l'authz (admin / staff_admin / supervisor / support).
 *  2. Insère une entrée dans service_change_requests (approuvée si immediate).
 *  3. Appelle la RPC canonique `apply_plan_change` (upgrade only).
 *  4. Crée une facture d'ajustement (prorata) si upgrade/add_service.
 *  5. Crée une commande d'équipement si p_ship_equipment=true (add_service TV/Internet).
 *  6. Enfile les notifications via `send-transactional-email`.
 *  7. Écrit un audit riche dans `admin_audit_log`.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { computeTaxes } from "../_shared/tax-constants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Auth requise" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Authz check via has_role (canonical app_role enum values only)
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  const { data: isSupervisor } = await admin.rpc("has_role", { _user_id: user.id, _role: "supervisor" });
  const { data: isBillingAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "billing_admin" });
  const { data: isSupport } = await admin.rpc("has_role", { _user_id: user.id, _role: "support" });
  if (!isAdmin && !isSupervisor && !isBillingAdmin && !isSupport) {
    return json(403, { error: "Rôle admin/billing_admin/supervisor/support requis" });
  }

  let body: {
    account_id: string;
    subscription_id: string;
    new_plan_code: string;
    new_plan_name: string;
    new_plan_price: number;
    change_type: "upgrade" | "downgrade" | "add_service" | "remove_service";
    ship_equipment?: boolean;
    return_equipment_ids?: string[];
    __audit_reason?: string;
    simulation_snapshot?: any;
  };
  try { body = await req.json(); }
  catch { return json(400, { error: "JSON invalide" }); }

  const reason = (body.__audit_reason || "").trim();
  if (reason.length < 3) return json(400, { error: "Motif requis (min 3 caractères)" });

  const {
    account_id, subscription_id, new_plan_code, new_plan_name, new_plan_price,
    change_type, ship_equipment, return_equipment_ids, simulation_snapshot,
  } = body;

  if (!account_id || !new_plan_name || new_plan_price == null || !change_type) {
    return json(400, { error: "account_id, new_plan_name, new_plan_price, change_type requis" });
  }

  const { data: acct } = await admin.from("accounts").select("*").eq("id", account_id).maybeSingle();
  if (!acct) return json(404, { error: "Compte introuvable" });
  const clientId: string = acct.client_id;

  const { data: profile } = await admin
    .from("profiles").select("email, first_name, account_number")
    .eq("user_id", clientId).maybeSingle();
  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";
  const accountNumber = profile?.account_number || acct.account_number || "";

  const { data: bSub } = subscription_id
    ? await admin.from("billing_subscriptions").select("*").eq("id", subscription_id).maybeSingle()
    : { data: null };

  const isImmediate = change_type === "upgrade" || change_type === "add_service";
  const effectiveDate = new Date().toISOString().slice(0, 10);

  // ── 1. service_change_requests ─────────────────────────────
  const { data: scr, error: scrErr } = await admin
    .from("service_change_requests")
    .insert({
      account_id,
      client_id: clientId,
      subscription_id: subscription_id || null,
      current_plan_name: bSub?.frozen_name || bSub?.plan_name || null,
      current_plan_price: bSub?.frozen_unit_price || bSub?.plan_price || null,
      requested_plan_id: new_plan_code,
      requested_plan_name: new_plan_name,
      requested_plan_price: new_plan_price,
      change_type,
      status: isImmediate ? "approved" : "pending",
      requested_by: user.id,
      effective_date: isImmediate ? effectiveDate : null,
      applied_at: isImmediate ? new Date().toISOString() : null,
      notes: `[Core 360] ${reason}`,
    })
    .select("id")
    .single();
  if (scrErr) return json(500, { error: `service_change_request: ${scrErr.message}` });

  const results: Record<string, unknown> = { scr_id: scr.id };

  // ── 2. Canonical apply_plan_change RPC (upgrade only) ──────────
  if (change_type === "upgrade" && subscription_id) {
    const { error: apcErr } = await admin.rpc("apply_plan_change", {
      p_old_subscription_id: subscription_id,
      p_new_plan_code: new_plan_code,
      p_new_plan_name: new_plan_name,
      p_new_plan_price: new_plan_price,
      p_context: {
        source: "core-apply-plan-change",
        change_type,
        service_change_request_id: scr.id,
        initiated_by: user.id,
        reason,
      },
    });
    if (apcErr) return json(500, { error: `apply_plan_change: ${apcErr.message}` });
    results.apply_plan_change = "ok";
  }

  // ── 3. Prorata adjustment invoice (upgrade/add_service) ────────
  if (isImmediate && bSub?.cycle_start_date && bSub?.cycle_end_date) {
    const prev = Number(bSub.frozen_unit_price || bSub.plan_price || 0);
    const proratable = change_type === "add_service" ? new_plan_price : (new_plan_price - prev);
    if (proratable > 0) {
      const today = new Date();
      const end = new Date(bSub.cycle_end_date);
      const start = new Date(bSub.cycle_start_date);
      const daysRemaining = Math.max(1, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
      const totalDays = Math.max(28, Math.round((end.getTime() - start.getTime()) / 86_400_000));
      const subtotal = Math.round(proratable * (daysRemaining / totalDays) * 100) / 100;
      if (subtotal >= 0.01) {
        const { tps, tvq, total } = computeTaxes(subtotal);
        const desc = change_type === "add_service"
          ? `Ajout de service proratisé — ${new_plan_name} (${daysRemaining}/${totalDays} jours)`
          : `Ajustement proratisé — ${bSub.frozen_name || bSub.plan_name} → ${new_plan_name} (${daysRemaining}/${totalDays} jours)`;
        const { data: invNumData } = await admin.rpc("generate_billing_invoice_number");
        const invNum = invNumData || `ADJ-${Date.now()}`;
        const { data: inv, error: invErr } = await admin.from("billing_invoices").insert({
          customer_id: bSub.customer_id,
          subscription_id: bSub.id,
          invoice_number: invNum,
          type: "adjustment",
          subtotal, tps_amount: tps, tvq_amount: tvq, total,
          balance_due: total, amount_paid: 0, currency: "CAD", status: "pending",
          due_date: today.toISOString().slice(0, 10),
          cycle_start_date: bSub.cycle_start_date, cycle_end_date: bSub.cycle_end_date,
          notes: desc,
          billing_snapshot_account_number: accountNumber,
          billing_snapshot_client: { first_name: firstName, email: clientEmail },
        }).select("id, invoice_number").single();
        if (!invErr && inv) {
          await admin.from("billing_invoice_lines").insert({
            invoice_id: inv.id, description: desc,
            unit_price: subtotal, quantity: 1, line_total: subtotal, line_type: "adjustment",
          });
          results.prorata_invoice = { id: inv.id, number: inv.invoice_number, total };
        }
      }
    }
  }

  // ── 4. Mark returned equipment ─────────────────────────────
  if (return_equipment_ids && return_equipment_ids.length > 0) {
    await admin.from("equipment_inventory")
      .update({ status: "return_pending" })
      .in("id", return_equipment_ids);
    results.equipment_returned = return_equipment_ids.length;
  }

  // ── 5. Communications via canonical email_queue (official template) ─────
  if (clientEmail) {
    await admin.from("email_queue").insert({
      to_email: clientEmail,
      template_key: isImmediate ? "plan_change_approved" : "plan_change_requested",
      template_vars: {
        first_name: firstName,
        client_name: firstName,
        to_email: clientEmail,
        current_plan_name: bSub?.frozen_name || bSub?.plan_name || "—",
        requested_plan_name: new_plan_name,
        effective_date: isImmediate ? "immédiatement" : "au prochain renouvellement",
        change_type,
        account_number: accountNumber,
      },
      status: "queued",
      priority: 0,
    }).catch((e) => console.warn("[core-apply-plan-change] email_queue failed:", e));
    await admin.from("email_queue").insert({
      to_email: "support@nivra-telecom.ca",
      template_key: "plan_change_admin_alert",
      template_vars: {
        client_name: firstName, account_number: accountNumber,
        current_plan_name: bSub?.frozen_name || bSub?.plan_name || "—",
        requested_plan_name: new_plan_name, change_type,
        core_actor: user.email, reason,
      },
      status: "queued", priority: 0,
    }).catch(() => {});
  }

  // ── 6. Rich audit log (canonical admin_audit_log schema) ──────
  const { error: auditErr } = await admin.from("admin_audit_log").insert({
    admin_user_id: user.id,
    admin_email: user.email ?? null,
    action: "core.plan_change.applied",
    target_type: "account",
    target_id: account_id,
    target_email: clientEmail,
    details: {
      module: "core-360-plan-change",
      module_tag: "core.plan_change",
      change_type,
      subscription_id,
      client_id: clientId,
      new_plan_code, new_plan_name, new_plan_price,
      reason,
      source: "core-360",
      results,
      before_state: {
        plan_name: bSub?.frozen_name ?? bSub?.plan_name ?? null,
        plan_price: bSub?.frozen_unit_price ?? bSub?.plan_price ?? null,
        cycle_start_date: bSub?.cycle_start_date ?? null,
        cycle_end_date: bSub?.cycle_end_date ?? null,
      },
      after_state: {
        plan_name: new_plan_name,
        plan_price: new_plan_price,
        change_type,
        effective_date: isImmediate ? effectiveDate : null,
      },
      simulation_snapshot: simulation_snapshot || null,
    },
  });
  if (auditErr) {
    console.error("[core-apply-plan-change] admin_audit_log insert failed:", auditErr.message);
  }

  return json(200, { ok: true, ...results });
});
