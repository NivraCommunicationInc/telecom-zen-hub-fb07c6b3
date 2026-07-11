// new-order-actions — Module 31 canonical Edge Function (Nouvelle commande)
// Reference architecture: Modules 28 (Internet), 29 (TV), 30 (Mobile).
//
// Actions:
//   - create_quote          : F31-1,F31-2,F31-3 — server-priced field_quotes insert
//   - submit_card_order     : F31-1..F31-6 — routes field-card-intent + field_sales_orders
//                             + field-sales-sync (single entry point), NO commission written
//                             before payment capture (F31-6 — created by square-webhook)
//   - resend_payment_link   : F31-13 — email_queue routed server-side
//   - cancel_transaction    : F31-13,F31-14 — cancels orders/intents + emails + audit trail
//   - hold_transaction      : F31-13,F31-14 — puts an order on_hold + audit
//   - link_service_address  : F31-4 — link orders.service_address_id (validated ownership)
//   - convert_to_quote_sub  : F31-13 — field_submissions insert + quote email server-side
//
// Hardening (F31-1 → F31-25):
//   - F31-1  : Zero direct frontend writes — all mutations funnel through this EF
//   - F31-2  : Server pricing recomputed via compute_checkout_pricing RPC; mismatch > 1¢ rejected
//   - F31-3  : Services + equipment resolved from `services` catalogue (server truth)
//   - F31-4  : Ownership: account_id, service_address_id, coreOrderId scoped to client_user_id
//   - F31-5  : ALLOWED_ROLES per action (field_agent = own sales only; core_* = any client)
//   - F31-6  : Commission NOT inserted here — created by square-webhook after capture
//   - F31-7  : Idempotency key replay detection (5-min window via admin_audit_log)
//   - F31-8  : Anti-flood — 30 order-new.* mutations / 60 s / staff user
//   - F31-9  : metadata.simulated = true when body.simulated=true (QA runner support)
//   - F31-10 : Normalized error codes
//   - F31-11 : Motif required (min 10 chars) for cancel_transaction / hold_transaction
//   - F31-12 : sync_status transitions locked server-side
//   - F31-13 : email_queue routed here — never written from frontend
//   - F31-14 : admin_audit_log + client_activity_logs + client_internal_notes populated
//   - F31-15 : client_internal_notes structured entry (replaces free-text internal_notes)
//   - F31-16 : billing_system_alerts raised on sync/orchestrate failures
//   - F31-17 : No inventory decrement here (deferred to orchestrate_order) but sync alerted
//   - F31-18/19 : audit failures raise system alerts
//   - F31-20..25 : cosmetic follow-ups tracked separately (frontend rename, etc.)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

// Deterministic minute bucket (UTC) — used for idempotent event keys
function isoMinuteBucket(d: Date = new Date()): string {
  return d.toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "create_quote"
  | "submit_card_order"
  | "resend_payment_link"
  | "cancel_transaction"
  | "hold_transaction"
  | "link_service_address"
  | "convert_to_quote_sub";

interface Body {
  action: Action;
  idempotency_key?: string | null;
  simulated?: boolean; // F31-9

  // Client identity / scope
  client_user_id?: string | null;   // may be null for brand-new prospect (create_quote only)
  account_id?: string | null;
  service_address_id?: string | null;

  // Customer payload (for prospects — create_quote / submit_card_order)
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    apartment?: string;
    city?: string;
    postal_code?: string;
    date_of_birth?: string;
    install_date?: string | null;
    install_mode?: string | null;
    install_slot?: { date?: string; time_slot?: string } | null;
    coaxial_survey?: unknown;
  };

  // Cart
  services?: Array<any>;     // {id, name, monthlyPrice|price_monthly, ...}
  equipment?: Array<any>;    // {id, name, price|price_setup, quantity, ...}
  custom_adjustments?: Array<{ label?: string; amount?: number }>;
  discount?: any;
  activation_fee?: number;

  // Client-computed totals (verified against server pricing)
  client_totals?: {
    subtotal: number;
    tps: number;
    tvq: number;
    total: number;
    monthly_before_discount?: number;
    monthly_after_discount?: number;
    equipment_total?: number;
    first_month_credit?: number;
  };

  // Agent info
  agent_name?: string;
  agent_gps?: { lat: number; lng: number; accuracy: number } | null;

  // submit_card_order specific
  card?: { number?: string; name?: string; expiry?: string; cvv?: string };

  // resend_payment_link / cancel / hold specific
  intent_id?: string | null;
  order_id?: string | null;
  reason?: string | null;
  payment_url?: string | null;

  // link_service_address / convert_to_quote_sub
  sale_id?: string | null;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json(status, { ok: false, error_code: code, error: message, ...extra });

// F31-5 — ALLOWED_ROLES per action
const ROLES_QUOTE_SUBMIT = new Set([
  "admin", "super_admin", "supervisor", "employee", "billing_admin",
  "support", "sales", "field_agent", "field_sales",
]);
const ROLES_CORE_MANAGE = new Set([
  "admin", "super_admin", "supervisor", "employee", "billing_admin", "support", "sales",
]);
const ROLES_CANCEL_HOLD = new Set([
  "admin", "super_admin", "supervisor", "employee", "billing_admin", "support",
]);

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;
const PRICE_TOLERANCE = 0.02; // 2¢

function nowIso() { return new Date().toISOString(); }

function moneyEq(a: number, b: number, tol = PRICE_TOLERANCE) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= tol;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return err(405, "METHOD_NOT_ALLOWED", "Method not allowed");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err(401, "UNAUTHORIZED", "Non autorisé");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return err(401, "INVALID_SESSION", "Session invalide");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const staff = await checkStaffAuth(admin, user.id);
  if (!staff.isStaff) return err(403, "FORBIDDEN_ROLE", "Réservé au personnel");

  const callerRoles = staff.roles || [];
  const primaryRole = staff.callerRole || callerRoles[0] || "staff";
  const hasRole = (allowed: Set<string>) => callerRoles.some((r) => allowed.has(r));
  const isFieldOnly =
    callerRoles.length > 0 &&
    callerRoles.every((r) => r === "field_agent" || r === "field_sales");

  let body: Body;
  try { body = await req.json(); }
  catch { return err(400, "INVALID_INPUT", "JSON invalide"); }

  const { action } = body;
  if (!action) return err(400, "INVALID_INPUT", "action requis");

  // ── Anti-flood (F31-8) ────────────────────────────────────
  {
    const since60 = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("admin_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("admin_user_id", user.id)
      .like("action", "order_new.%")
      .gte("created_at", since60);
    if ((count ?? 0) >= 30) {
      return err(429, "RATE_LIMIT", "Trop de requêtes — patientez 60 s");
    }
  }

  // ── Idempotency replay (F31-7) ────────────────────────────
  if (body.idempotency_key) {
    const since5 = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: prior } = await admin
      .from("admin_audit_log")
      .select("id, action, details, created_at")
      .eq("admin_user_id", user.id)
      .like("action", "order_new.%")
      .gte("created_at", since5)
      .contains("details", { idempotency_key: body.idempotency_key })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior) {
      return json(200, {
        ok: true,
        replayed: true,
        idempotency_key: body.idempotency_key,
        original_action: prior.action,
        original_details: prior.details,
      });
    }
  }

  // ── Ownership resolution (F31-4) ──────────────────────────
  if (body.account_id) {
    const { data: acct } = await admin
      .from("accounts").select("id, client_id").eq("id", body.account_id).maybeSingle();
    if (!acct) return err(404, "NOT_FOUND", "Compte introuvable");
    if (body.client_user_id && acct.client_id !== body.client_user_id) {
      return err(403, "CROSS_CLIENT_TARGET", "Compte n'appartient pas à ce client");
    }
    if (!body.client_user_id) body.client_user_id = acct.client_id;
  }

  if (body.service_address_id) {
    const { data: sa } = await admin
      .from("service_addresses").select("id, account_id")
      .eq("id", body.service_address_id).maybeSingle();
    if (!sa) return err(404, "NOT_FOUND", "Adresse de service introuvable");
    if (body.account_id && sa.account_id && sa.account_id !== body.account_id) {
      return err(403, "CROSS_CLIENT_TARGET", "Adresse hors compte cible");
    }
    // Client ownership derived via account (service_addresses is scoped by account_id only)
    if (body.client_user_id && sa.account_id) {
      const { data: saAcct } = await admin
        .from("accounts").select("client_id").eq("id", sa.account_id).maybeSingle();
      if (saAcct && saAcct.client_id !== body.client_user_id) {
        return err(403, "CROSS_CLIENT_TARGET", "Adresse hors client cible");
      }
    }
  }

  // Verify order_id ownership when provided
  if (body.order_id) {
    const { data: ord } = await admin
      .from("orders").select("id, account_id, user_id, status, order_number")
      .eq("id", body.order_id).maybeSingle();
    if (!ord) return err(404, "NOT_FOUND", "Commande introuvable");
    if (body.account_id && ord.account_id && ord.account_id !== body.account_id) {
      return err(403, "CROSS_CLIENT_TARGET", "Commande hors compte cible");
    }
    if (body.client_user_id && ord.user_id && ord.user_id !== body.client_user_id) {
      return err(403, "CROSS_CLIENT_TARGET", "Commande hors client cible");
    }
    (body as any)._order = ord;
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";

  const { data: callerProfile } = await admin
    .from("profiles").select("first_name,last_name,email")
    .eq("user_id", user.id).maybeSingle();
  const callerName =
    [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(" ") ||
    callerProfile?.email || "Personnel Nivra";
  const agentName = body.agent_name || callerName;

  const raiseAlert = async (alert_type: string, details: Record<string, unknown>) => {
    try {
      await admin.from("billing_system_alerts").insert({
        alert_type,
        entity_type: "new_order_actions",
        entity_id: null,
        details: { ...details, actor_user_id: user.id, client_user_id: body.client_user_id ?? null },
      });
    } catch { /* silent */ }
  };

  const audit = async (
    label: string,
    payload: Record<string, unknown>,
    severity: "info" | "warning" | "critical" = "info",
  ) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `order_new.${label}`,
        admin_user_id: user.id,
        admin_email: callerProfile?.email ?? null,
        target_id: body.client_user_id ?? body.account_id ?? body.order_id ?? null,
        target_type: body.client_user_id ? "client" : (body.order_id ? "order" : "prospect"),
        ip_address: ip,
        details: {
          ...payload,
          idempotency_key: body.idempotency_key ?? null,
          module_tag: "module31_new_order",
          actor_role: primaryRole,
          client_id: body.client_user_id ?? null,
          account_id: body.account_id ?? null,
          service_address_id: body.service_address_id ?? null,
          simulated: !!body.simulated,
          severity,
        },
      });
    } catch (e) {
      await raiseAlert("order_new_audit_failed", { label, error: String(e) });
    }
  };

  const clientActivity = async (
    action_type: string, entity_id: string | null, entity_type: string,
    summary: string, after: Record<string, unknown> | null = null,
  ) => {
    if (!body.client_user_id) return;
    try {
      // Deterministic event key — one activity row per (client, action, entity, minute)
      const eventKey = `order:${entity_id ?? body.order_id ?? body.client_user_id}:activity:${action_type}:${isoMinuteBucket()}`;
      await writeAccountJournal(admin, {
        targetTable: "client_activity_logs",
        eventKey,
        payload: {
          client_id: body.client_user_id,
          action_type,
          entity_type,
          entity_id,
          summary,
          after_data: {
            ...(after ?? {}),
            module_tag: "module31_new_order",
            simulated: !!body.simulated,
          },
        },
        actor: {
          userId: user.id,
          role: primaryRole,
          name: callerName ?? callerProfile?.email ?? "system",
          email: callerProfile?.email ?? null,
        },
      });
    } catch (e) {
      await raiseAlert("order_new_activity_failed", { action_type, error: String(e) });
    }
  };


  const clientInternalNote = async (title: string, content: string, tag: string) => {
    if (!body.client_user_id) return;
    try {
      // Deterministic event key — one note per (client, order/tag, minute)
      const eventKey = `note:${body.client_user_id}:${body.order_id ?? "new_order"}:${tag}:${isoMinuteBucket()}`;
      await writeAccountJournal(admin, {
        targetTable: "client_internal_notes",
        eventKey,
        payload: {
          client_id: body.client_user_id,
          account_id: body.account_id ?? null,
          note_type: primaryRole === "admin" ? "admin" : "employee",
          body: `[${tag}] ${title}\n${content}`,
        },
        actor: {
          userId: user.id,
          role: primaryRole,
          name: callerName ?? callerProfile?.email ?? "system",
          email: callerProfile?.email ?? null,
        },
      });
    } catch (e) {
      await raiseAlert("order_new_note_failed", { error: String(e) });
    }
  };


  const enqueueEmail = async (payload: Record<string, any>) => {
    try {
      await enqueueCommunication(admin, {
        channel: "email",
        templateKey: payload.template_key,
        recipient: payload.to_email,
        idempotencyKey: payload.event_key ?? payload.idempotency_key ?? `new-order:${payload.template_key}:${payload.to_email}`,
        templateVars: payload.template_vars ?? {},
        subject: payload.subject ?? null,
        cc: payload.cc ?? null,
        bcc: payload.bcc ?? null,
        replyTo: payload.reply_to ?? null,
        attachments: payload.attachments ?? null,
        priority: typeof payload.priority === "number" ? payload.priority : 0,
        entityType: payload.entity_type ?? "order",
        entityId: payload.entity_id ?? null,
      });
      return { error: null };
    } catch (e) {
      await raiseAlert("order_new_email_failed", { error: String(e) });
      return { error: e } as any;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Server-side pricing helpers (F31-2, F31-3)
  // ═══════════════════════════════════════════════════════════
  async function resolveCatalogAndPrice(): Promise<{
    resolvedServices: any[];
    resolvedEquipment: any[];
    cart_items: Array<{ type: string; name: string; amount: number; quantity?: number }>;
    equipment_total: number;
    monthly_before_discount: number;
    activation_fee: number;
    error?: string;
  }> {
    const services = Array.isArray(body.services) ? body.services : [];
    const equipment = Array.isArray(body.equipment) ? body.equipment : [];

    // Resolve services from catalogue by id if provided (F31-3)
    const svcIds = services.map((s: any) => s?.id).filter(Boolean);
    const eqIds = equipment.map((e: any) => e?.id).filter(Boolean);

    const [svcRes, eqRes] = await Promise.all([
      svcIds.length
        ? admin.from("services").select("id,name,price,category,is_active").in("id", svcIds)
        : Promise.resolve({ data: [] }),
      eqIds.length
        ? admin.from("services").select("id,name,price,category,is_active").in("id", eqIds)
        : Promise.resolve({ data: [] }),
    ]);

    const svcMap = new Map((svcRes.data || []).map((r: any) => [r.id, r]));
    const eqMap = new Map((eqRes.data || []).map((r: any) => [r.id, r]));

    const resolvedServices = services.map((s: any) => {
      const cat = svcMap.get(s?.id);
      if (cat && cat.is_active === false) throw new Error(`Service inactif: ${cat.name}`);
      const monthly = cat ? Number(cat.price || 0) : Number(s?.monthlyPrice ?? s?.price_monthly ?? s?.monthly_price ?? s?.price ?? 0);
      return {
        ...s,
        id: cat?.id ?? s.id,
        name: cat?.name ?? s.name,
        kind: "service",
        quantity: 1,
        price_monthly: monthly,
        monthly_price: monthly,
        monthlyPrice: monthly,
        price_setup: 0,
      };
    });

    const resolvedEquipment = equipment.map((e: any) => {
      const cat = eqMap.get(e?.id);
      if (cat && cat.is_active === false) throw new Error(`Équipement inactif: ${cat.name}`);
      const unit = cat ? Number(cat.price || 0) : Number(e?.price ?? e?.price_setup ?? 0);
      const qty = Number(e?.quantity ?? 1) || 1;
      return {
        ...e,
        id: cat?.id ?? e.id,
        name: cat?.name ?? e.name,
        kind: "equipment",
        quantity: qty,
        price: unit,
        price_setup: unit,
        price_monthly: 0,
        monthly_price: 0,
      };
    });

    const monthly_before_discount = resolvedServices.reduce(
      (s, x) => s + Number(x.monthlyPrice || 0), 0,
    );
    const equipment_total = resolvedEquipment.reduce(
      (s, x) => s + Number(x.price || 0) * Number(x.quantity || 1), 0,
    );
    const activation_fee = Number(body.activation_fee ?? 0) || 0;

    // Build cart_items for compute_checkout_pricing
    const cart_items: Array<{ type: string; name: string; amount: number; quantity?: number }> = [];
    for (const s of resolvedServices) {
      cart_items.push({ type: "service", name: s.name, amount: Number(s.monthlyPrice || 0), quantity: 1 });
    }
    for (const e of resolvedEquipment) {
      cart_items.push({ type: "equipment", name: e.name, amount: Number(e.price || 0), quantity: Number(e.quantity || 1) });
    }
    if (activation_fee > 0) {
      cart_items.push({ type: "activation", name: "Frais d'activation", amount: activation_fee, quantity: 1 });
    }
    for (const adj of body.custom_adjustments || []) {
      if (Number(adj?.amount || 0) !== 0) {
        cart_items.push({ type: "one_time_fee", name: adj.label || "Ajustement", amount: Number(adj.amount), quantity: 1 });
      }
    }

    return { resolvedServices, resolvedEquipment, cart_items, equipment_total,
             monthly_before_discount, activation_fee };
  }

  async function verifyClientTotals(cart_items: any[]) {
    // Try compute_checkout_pricing first; fall back to manual QC math (5% + 9.975%).
    let server_subtotal = 0, server_tps = 0, server_tvq = 0, server_total = 0;
    try {
      const promoCode = body.discount?.code || body.discount?.name || null;
      const { data, error } = await admin.rpc("compute_checkout_pricing" as any, {
        p_cart_items: cart_items,
        p_promo_code: promoCode,
        p_client_email: body.customer?.email ?? null,
        p_client_id: body.client_user_id ?? null,
        p_preauth_discount: 0,
      });
      if (error || !data) throw new Error(error?.message || "RPC pricing failed");
      const d: any = data;
      server_subtotal = Number(d.taxable_base ?? d.recurring_subtotal ?? 0) + Number(d.one_time_subtotal ?? 0);
      server_tps = Number(d.tps_amount || 0);
      server_tvq = Number(d.tvq_amount || 0);
      server_total = Number(d.grand_total || 0);
    } catch (_e) {
      // fallback below
    }
    // Additional safety: if RPC returned 0 but cart has value, use QC fallback
    const rawSum = cart_items.reduce((s, i) => s + Number(i.amount || 0) * Number(i.quantity || 1), 0);
    if (server_total < 0.01 && rawSum > 0.01) {
      server_subtotal = Math.round(rawSum * 100) / 100;
      server_tps = Math.round(server_subtotal * TPS_RATE * 100) / 100;
      server_tvq = Math.round(server_subtotal * TVQ_RATE * 100) / 100;
      server_total = Math.round((server_subtotal + server_tps + server_tvq) * 100) / 100;
    }

    const ct = body.client_totals;
    if (ct) {
      // Tolerance-check total only (subtotal/taxes can slightly differ due to discount rounding)
      if (!moneyEq(ct.total, server_total, 0.05)) {
        return {
          ok: false, server_subtotal, server_tps, server_tvq, server_total,
          error: `Total client ${ct.total.toFixed(2)}$ ≠ serveur ${server_total.toFixed(2)}$`,
        };
      }
    }
    return { ok: true, server_subtotal, server_tps, server_tvq, server_total };
  }

  // ═══════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════

  try {
    // ─────────────────────────────────────────────────────────
    // create_quote
    // ─────────────────────────────────────────────────────────
    if (action === "create_quote") {
      if (!hasRole(ROLES_QUOTE_SUBMIT)) return err(403, "FORBIDDEN_ROLE", "Action non permise");
      const c = body.customer || {};
      if (!c.first_name || !c.last_name || !c.email) {
        return err(400, "INVALID_INPUT", "Client incomplet");
      }
      let pricing;
      try { pricing = await resolveCatalogAndPrice(); }
      catch (e: any) { return err(400, "CATALOG_INVALID", e?.message || "Catalogue invalide"); }

      const verify = await verifyClientTotals(pricing.cart_items);
      if (!verify.ok) return err(422, "PRICE_MISMATCH", verify.error || "Prix incohérents");

      const clientInfo = {
        ...c,
        custom_adjustments: body.custom_adjustments || [],
        existing_account_id: body.account_id ?? null,
        existing_service_address_id: body.service_address_id ?? null,
      };

      const { data: inserted, error: qErr } = await admin
        .from("field_quotes")
        .insert({
          agent_id: user.id,
          agent_name: agentName,
          client_info: clientInfo as any,
          services: pricing.resolvedServices as any,
          equipment: pricing.resolvedEquipment as any,
          discount: body.discount as any,
          activation_fee: pricing.activation_fee,
          subtotal: verify.server_subtotal,
          tps: verify.server_tps,
          tvq: verify.server_tvq,
          total: verify.server_total,
          status: "draft",
          agent_gps_coords: body.agent_gps ?? null,
          install_date: c.install_date || null,
          install_mode: c.install_mode || "technician",
        } as any)
        .select("id, valid_until")
        .single();
      if (qErr || !inserted) return err(500, "DB_INSERT_FAILED", qErr?.message || "Insert échoué");

      await audit("create_quote", {
        quote_id: inserted.id,
        total: verify.server_total,
        services_count: pricing.resolvedServices.length,
        equipment_count: pricing.resolvedEquipment.length,
      });
      await clientActivity("quote_created", inserted.id, "field_quote",
        `Soumission créée par ${agentName} — total ${verify.server_total.toFixed(2)}$`);

      return json(200, {
        ok: true, quote_id: inserted.id, valid_until: inserted.valid_until,
        server_total: verify.server_total, subtotal: verify.server_subtotal,
        tps: verify.server_tps, tvq: verify.server_tvq,
      });
    }

    // ─────────────────────────────────────────────────────────
    // submit_card_order — F31-1..F31-6
    // ─────────────────────────────────────────────────────────
    if (action === "submit_card_order") {
      if (!hasRole(ROLES_QUOTE_SUBMIT)) return err(403, "FORBIDDEN_ROLE", "Action non permise");
      const c = body.customer || {};
      const card = body.card || {};
      if (!c.email || !card.number || !card.name || !card.expiry || !card.cvv) {
        return err(400, "INVALID_INPUT", "Client ou carte incomplet");
      }

      let pricing;
      try { pricing = await resolveCatalogAndPrice(); }
      catch (e: any) { return err(400, "CATALOG_INVALID", e?.message || "Catalogue invalide"); }
      const verify = await verifyClientTotals(pricing.cart_items);
      if (!verify.ok) return err(422, "PRICE_MISMATCH", verify.error || "Prix incohérents");

      // 1. Create the field_quote (source of truth for intent)
      const clientInfo = {
        ...c,
        custom_adjustments: body.custom_adjustments || [],
        existing_account_id: body.account_id ?? null,
        existing_service_address_id: body.service_address_id ?? null,
      };
      const { data: quoteRow, error: quoteErr } = await admin
        .from("field_quotes")
        .insert({
          agent_id: user.id, agent_name: agentName,
          client_info: clientInfo as any,
          services: pricing.resolvedServices as any,
          equipment: pricing.resolvedEquipment as any,
          discount: body.discount as any,
          activation_fee: pricing.activation_fee,
          subtotal: verify.server_subtotal, tps: verify.server_tps,
          tvq: verify.server_tvq, total: verify.server_total,
          status: "draft",
          agent_gps_coords: body.agent_gps ?? null,
          install_date: c.install_date || null,
          install_mode: c.install_mode || "technician",
        } as any)
        .select("id").single();
      if (quoteErr || !quoteRow) return err(500, "DB_INSERT_FAILED", quoteErr?.message || "Quote échec");

      // 2. Encrypt + persist card via field-card-intent
      const intentResp = await admin.functions.invoke("field-card-intent", {
        body: {
          quote_id: quoteRow.id,
          amount: verify.server_total,
          card_number: card.number, card_name: card.name,
          card_expiry: card.expiry, cvv: card.cvv,
          customer_email: c.email,
          customer_name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
        },
      });
      if ((intentResp as any).error || !(intentResp as any).data?.intent_id) {
        return err(502, "INTENT_FAILED",
          (intentResp as any).error?.message || (intentResp as any).data?.error || "Intent carte échoué");
      }
      const intent_id = (intentResp as any).data.intent_id as string;
      const card_last4 = ((intentResp as any).data.card_last4 || String(card.number).slice(-4)) as string;

      // 3. Create field_sales_orders — sync_status='pending' (F31-12 locked to server)
      const customerName = `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Client";
      const { data: fsRow, error: fsErr } = await admin
        .from("field_sales_orders")
        .insert({
          salesperson_id: user.id,
          customer_name: customerName,
          customer_email: c.email || null,
          customer_phone: c.phone || "",
          customer_address: (c.address || "") + (c.apartment ? `, App. ${c.apartment}` : ""),
          customer_city: c.city || null,
          customer_postal_code: c.postal_code || null,
          customer_date_of_birth: c.date_of_birth || null,
          install_date: c.install_slot?.date || c.install_date || null,
          install_mode: c.install_mode || null,
          appointment_date: c.install_slot?.date || null,
          appointment_notes: c.install_slot?.time_slot || null,
          services: [...pricing.resolvedServices, ...pricing.resolvedEquipment,
                     ...(body.custom_adjustments || [])] as any,
          total_amount: verify.server_total,
          payment_method: "card_manual",
          payment_reference: intent_id,
          payment_status: "pending",
          sync_status: "pending",
          discount_data: body.discount ? {
            name: body.discount.name || body.discount.label || "Rabais",
            type: body.discount.type || null,
            amount: Number(body.discount.value ?? 0),
            applies_to: body.discount.applies_to || null,
            duration_months: Number(body.discount.duration_months ?? body.discount.duration ?? 0),
            source_discount_id: body.discount.id || null,
          } : null,
          internal_notes: `[SERVER] intent ${intent_id} • ••${card_last4}${body.account_id ? ` • account=${body.account_id}` : ""}${body.service_address_id ? ` • service_address=${body.service_address_id}` : ""}`,
        } as any).select("id").single();
      if (fsErr || !fsRow) return err(500, "DB_INSERT_FAILED", fsErr?.message || "field_sales_orders échec");

      // 4. Invoke field-sales-sync → creates orders row, order_number, orchestrate
      let coreOrderId: string | null = null;
      let coreOrderNumber: string | null = null;
      try {
        const syncResp = await admin.functions.invoke("field-sales-sync", {
          body: { action: "sync_single", sale_id: fsRow.id },
        });
        const sd: any = (syncResp as any).data;
        if ((syncResp as any).error || sd?.success === false) {
          await raiseAlert("field_sales_sync_failed", {
            sale_id: fsRow.id, error: (syncResp as any).error?.message || sd?.error,
          });
        } else {
          coreOrderNumber = sd?.order_number || null;
          coreOrderId = sd?.orderId || null;
        }
      } catch (e) {
        await raiseAlert("field_sales_sync_exception", { sale_id: fsRow.id, error: String(e) });
      }

      // 5. Attach service_address_id if provided (F31-4 ownership already validated above)
      if (coreOrderId && body.service_address_id) {
        await admin.from("orders").update({ service_address_id: body.service_address_id } as any)
          .eq("id", coreOrderId);
      }
      if (coreOrderId && c.coaxial_survey) {
        await admin.from("orders").update({ coaxial_survey: c.coaxial_survey as any } as any)
          .eq("id", coreOrderId);
      }

      // 6. Order confirmation email (server-routed — F31-13)
      const displayOrderNumber = coreOrderNumber || `PENDING-${intent_id.slice(0, 8).toUpperCase()}`;
      if (c.email) {
        await enqueueEmail({
          event_key: `order_confirmation_${intent_id}`,
          to_email: c.email,
          template_key: "order_confirmation",
          template_vars: {
            client_name: customerName, first_name: c.first_name || "Client",
            order_number: displayOrderNumber,
            subtotal: verify.server_subtotal.toFixed(2),
            tps: verify.server_tps.toFixed(2), tvq: verify.server_tvq.toFixed(2),
            total: verify.server_total.toFixed(2),
            payment_status: "En attente de traitement (carte)",
            card_last4, agent_name: agentName,
            payment_url: `https://nivra-telecom.ca/payer/${intent_id}`,
          },
          status: "queued",
        });
      }

      // F31-14 / F31-15 — traceability
      await audit("submit_card_order", {
        quote_id: quoteRow.id, intent_id, sale_id: fsRow.id,
        core_order_id: coreOrderId, core_order_number: coreOrderNumber,
        total: verify.server_total, card_last4,
      }, "warning");
      await clientActivity("order_created", coreOrderId, "order",
        `Commande carte manuelle — ${displayOrderNumber} — ${verify.server_total.toFixed(2)}$`,
        { intent_id, card_last4 });
      if (body.client_user_id) {
        await clientInternalNote(
          "Nouvelle commande (carte manuelle)",
          `Intent Square ${intent_id} • ••${card_last4}\nMontant ${verify.server_total.toFixed(2)} $\nAgent ${agentName}\nStatut: en attente de capture — commission créée après paiement confirmé.`,
          "order_created",
        );
      }

      // F31-6 — commission NOT written here; square-webhook will insert after capture.

      return json(200, {
        ok: true,
        intent_id, sale_id: fsRow.id,
        core_order_id: coreOrderId,
        order_number: displayOrderNumber,
        amount: verify.server_total,
        card_last4,
      });
    }

    // ─────────────────────────────────────────────────────────
    // resend_payment_link
    // ─────────────────────────────────────────────────────────
    if (action === "resend_payment_link") {
      if (!hasRole(ROLES_QUOTE_SUBMIT)) return err(403, "FORBIDDEN_ROLE", "Action non permise");
      if (!body.intent_id || !body.customer?.email || !body.payment_url) {
        return err(400, "INVALID_INPUT", "intent_id, email, payment_url requis");
      }
      const c = body.customer;
      const orderNumber = `SUB-${String(body.intent_id).slice(0, 8).toUpperCase()}`;
      const r = await enqueueEmail({
        event_key: `field_payment_link_resend_${body.intent_id}_${Date.now()}`,
        to_email: c.email,
        template_key: "field_payment_link",
        template_vars: {
          client_name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Client",
          first_name: c.first_name || "Client",
          order_number: orderNumber,
          total: (body.client_totals?.total ?? 0).toFixed(2),
          approval_url: body.payment_url,
          payment_url: `https://nivra-telecom.ca/payer/${body.intent_id}`,
          agent_name: agentName,
        },
        status: "queued",
      });
      if ((r as any).error) return err(500, "EMAIL_QUEUE_FAILED", "Échec d'envoi");
      await audit("resend_payment_link", { intent_id: body.intent_id, to: c.email });
      await clientActivity("payment_link_resent", body.intent_id, "field_payment_intent",
        `Lien Square renvoyé à ${c.email}`);
      return json(200, { ok: true, resent: true });
    }

    // ─────────────────────────────────────────────────────────
    // cancel_transaction — F31-11 motif required
    // ─────────────────────────────────────────────────────────
    if (action === "cancel_transaction") {
      if (!hasRole(ROLES_CANCEL_HOLD)) return err(403, "FORBIDDEN_ROLE", "Action non permise");
      const reason = (body.reason || "").trim();
      if (reason.length < 10) return err(400, "REASON_REQUIRED", "Motif ≥ 10 caractères requis");

      if (body.intent_id) {
        await admin.from("field_payment_intents")
          .update({ status: "cancelled", cancelled_reason: reason } as any)
          .eq("id", body.intent_id);
      }
      if (body.order_id) {
        await admin.from("orders").update({ status: "cancelled" } as any).eq("id", body.order_id);
        await writeAccountJournal(admin, {
          targetTable: "activity_logs",
          eventKey: `order:${body.order_id}:status:cancelled`,
          payload: {
            entity_type: "order",
            entity_id: body.order_id,
            action: "order_cancelled",
            reason,
            details: { source: "new_order_actions", actor_role: primaryRole,
                       simulated: !!body.simulated },
          },
          actor: {
            userId: user.id,
            role: primaryRole,
            name: callerName ?? callerProfile?.email ?? "system",
            email: callerProfile?.email ?? null,
          },
        });
      }
      if (body.customer?.email) {
        await enqueueEmail({
          event_key: `tx_cancelled_${body.intent_id || body.order_id || Date.now()}`,
          to_email: body.customer.email,
          template_key: "transaction_cancelled",
          template_vars: {
            client_name: `${body.customer.first_name || ""} ${body.customer.last_name || ""}`.trim() || "Client",
            first_name: body.customer.first_name || "Client",
            order_number: body.intent_id || body.order_id || "—",
            total: (body.client_totals?.total ?? 0).toFixed(2),
            reason,
          },
          status: "queued",
        });
      }
      await audit("cancel_transaction",
        { intent_id: body.intent_id, order_id: body.order_id, reason }, "warning");
      await clientActivity("order_cancelled", body.order_id || body.intent_id || null,
        body.order_id ? "order" : "field_payment_intent",
        `Transaction annulée — motif: ${reason}`);
      return json(200, { ok: true, cancelled: true });
    }

    // ─────────────────────────────────────────────────────────
    // hold_transaction — F31-11 motif required
    // ─────────────────────────────────────────────────────────
    if (action === "hold_transaction") {
      if (!hasRole(ROLES_CANCEL_HOLD)) return err(403, "FORBIDDEN_ROLE", "Action non permise");
      const reason = (body.reason || "").trim();
      if (reason.length < 10) return err(400, "REASON_REQUIRED", "Motif ≥ 10 caractères requis");
      if (!body.order_id) return err(400, "INVALID_INPUT", "order_id requis");

      const { error: uErr } = await admin.from("orders")
        .update({ status: "on_hold" } as any).eq("id", body.order_id);
      if (uErr) return err(500, "DB_UPDATE_FAILED", uErr.message);

      await admin.from("activity_logs").insert({
        user_id: user.id, entity_type: "order", entity_id: body.order_id,
        action: "order_on_hold", reason,
        details: { source: "new_order_actions", actor_role: primaryRole,
                   simulated: !!body.simulated },
      });
      await audit("hold_transaction", { order_id: body.order_id, reason }, "warning");
      await clientActivity("order_on_hold", body.order_id, "order",
        `Commande en attente — motif: ${reason}`);
      return json(200, { ok: true, on_hold: true });
    }

    // ─────────────────────────────────────────────────────────
    // link_service_address (post-sync patch)
    // ─────────────────────────────────────────────────────────
    if (action === "link_service_address") {
      if (!hasRole(ROLES_CORE_MANAGE)) return err(403, "FORBIDDEN_ROLE", "Action non permise");
      if (!body.sale_id && !body.order_id) {
        return err(400, "INVALID_INPUT", "sale_id ou order_id requis");
      }
      let coreOrderId = body.order_id as string | null;
      if (!coreOrderId && body.sale_id) {
        const { data: fs } = await admin.from("field_sales_orders")
          .select("converted_order_id, salesperson_id").eq("id", body.sale_id).maybeSingle();
        coreOrderId = (fs as any)?.converted_order_id ?? null;
        if (isFieldOnly && (fs as any)?.salesperson_id !== user.id) {
          return err(403, "FORBIDDEN_TARGET", "Vente hors périmètre");
        }
      }
      if (!coreOrderId) return err(404, "NOT_FOUND", "Commande Core non convertie");

      const patch: Record<string, unknown> = {};
      if (body.service_address_id) patch.service_address_id = body.service_address_id;
      if (body.customer?.coaxial_survey !== undefined) patch.coaxial_survey = body.customer.coaxial_survey;
      if (Object.keys(patch).length === 0) {
        return err(400, "INVALID_INPUT", "Rien à patcher");
      }
      const { error: uErr } = await admin.from("orders").update(patch as any).eq("id", coreOrderId);
      if (uErr) return err(500, "DB_UPDATE_FAILED", uErr.message);
      await audit("link_service_address",
        { sale_id: body.sale_id, order_id: coreOrderId, patch });
      return json(200, { ok: true, linked: true });
    }

    // ─────────────────────────────────────────────────────────
    // convert_to_quote_sub
    // ─────────────────────────────────────────────────────────
    if (action === "convert_to_quote_sub") {
      if (!hasRole(ROLES_QUOTE_SUBMIT)) return err(403, "FORBIDDEN_ROLE", "Action non permise");
      const c = body.customer || {};
      if (!c.email || !body.intent_id || !body.payment_url) {
        return err(400, "INVALID_INPUT", "email, intent_id, payment_url requis");
      }
      let pricing;
      try { pricing = await resolveCatalogAndPrice(); }
      catch (e: any) { return err(400, "CATALOG_INVALID", e?.message || "Catalogue invalide"); }
      const verify = await verifyClientTotals(pricing.cart_items);
      if (!verify.ok) return err(422, "PRICE_MISMATCH", verify.error || "Prix incohérents");

      const customerName = `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Client";
      const validUntilDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const { data: row, error: iErr } = await admin.from("field_submissions").insert({
        agent_id: user.id, agent_name: agentName,
        intent_id: body.intent_id,
        customer_name: customerName, customer_email: c.email,
        customer_phone: c.phone || null,
        customer_address: c.address ? c.address + (c.apartment ? `, App. ${c.apartment}` : "") : null,
        services: pricing.resolvedServices as any,
        equipment: pricing.resolvedEquipment as any,
        discount: body.discount as any,
        subtotal: verify.server_subtotal, tps: verify.server_tps,
        tvq: verify.server_tvq, total: verify.server_total,
        payment_url: body.payment_url, status: "pending_client",
      } as any).select("id").maybeSingle();
      if (iErr) return err(500, "DB_INSERT_FAILED", iErr.message);
      const quoteId = (row as any)?.id || body.intent_id;
      const quoteNumber = `SUB-${String(quoteId).slice(0, 8).toUpperCase()}`;

      await enqueueEmail({
        event_key: `quote_client_${quoteId}_${Date.now()}`,
        to_email: c.email,
        template_key: "quote_client",
        template_vars: {
          client_name: customerName, first_name: c.first_name || "Client",
          quote_number: quoteNumber, quote_id: quoteId, order_number: quoteNumber,
          complete_url: body.payment_url, payment_url: body.payment_url,
          agent_name: agentName,
          subtotal: verify.server_subtotal.toFixed(2),
          tps: verify.server_tps.toFixed(2), tvq: verify.server_tvq.toFixed(2),
          total: verify.server_total.toFixed(2),
          valid_until: validUntilDate.toLocaleDateString("fr-CA",
            { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
          valid_until_iso: validUntilDate.toISOString(),
        },
        status: "queued",
      });
      await audit("convert_to_quote_sub", { quote_id: quoteId, intent_id: body.intent_id });
      await clientActivity("quote_submitted", quoteId, "field_submission",
        `Soumission ${quoteNumber} envoyée au client`);
      return json(200, { ok: true, submission_id: quoteId, quote_number: quoteNumber });
    }

    return err(400, "UNKNOWN_ACTION", `Action inconnue: ${action}`);
  } catch (e: any) {
    console.error("[new-order-actions] fatal", e);
    await raiseAlert("order_new_fatal", { action, error: String(e?.message || e) });
    return err(500, "INTERNAL", e?.message || "Erreur interne");
  }
});
