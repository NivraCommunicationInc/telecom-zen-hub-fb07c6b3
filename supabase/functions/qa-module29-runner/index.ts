// QA runner — Module 29 (Service TV)
// E2E validation of tv-account-actions
//   {change_plan, add_themed_pack, remove_themed_pack, purchase_vod,
//    terminal_action, set_parental, set_channels,
//    approve_channel_selection, reject_channel_selection}
//
// Isolated: aucun vrai client, aucun provisioning réel (simulated=true côté serveur).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Check = { id: string; name: string; ok: boolean; details?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const keep = !!body?.keep;
  const checks: Check[] = [];
  const push = (c: Check) => checks.push(c);

  const callEF = async (accessToken: string, payload: unknown) => {
    const r = await fetch(`${url}/functions/v1/tv-account-actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify(payload),
    });
    let j: any = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
  };

  const ensureCaller = async (email: string, role: string) => {
    const password = `Qa29!${crypto.randomUUID()}`;
    const { data: ep } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    let userId: string;
    if (ep?.user_id) {
      await admin.auth.admin.updateUserById(ep.user_id, { password });
      userId = ep.user_id;
    } else {
      const { data: nu, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { qa: "m29" },
      });
      if (error || !nu?.user) throw new Error(`createUser ${email}: ${error?.message}`);
      userId = nu.user.id;
      await admin.from("profiles").insert({
        user_id: userId, client_number: `QA29-${Date.now().toString().slice(-6)}-${role[0]}`,
        first_name: role, last_name: "QA-M29", email,
      });
    }
    await admin.from("user_roles").delete().eq("user_id", userId);
    await admin.from("user_roles").insert({ user_id: userId, role });
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
    });
    const tj = await r.json();
    if (!tj?.access_token) throw new Error(`signin ${email}: ${JSON.stringify(tj)}`);
    return { userId, jwt: tj.access_token as string };
  };

  const ensureClient = async (email: string, label: string) => {
    const { data: ep } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    let userId: string;
    if (ep?.user_id) userId = ep.user_id;
    else {
      const { data: nu, error } = await admin.auth.admin.createUser({
        email, password: `Qa29!${crypto.randomUUID()}`, email_confirm: true, user_metadata: { qa: "m29_client" },
      });
      if (error || !nu?.user) throw new Error(`createClient ${email}: ${error?.message}`);
      userId = nu.user.id;
      await admin.from("profiles").insert({
        user_id: userId, client_number: `QA29C-${Date.now().toString().slice(-6)}-${label}`,
        first_name: `Client${label}`, last_name: "QA-M29", email,
      });
    }
    const { data: existing } = await admin.from("accounts")
      .select("id").eq("client_id", userId).maybeSingle();
    if (existing) return { userId, accountId: existing.id as string };
    const { data: acc, error } = await admin.from("accounts").insert({
      client_id: userId,
      account_number: `QA29-${label}-${Date.now().toString().slice(-6)}`,
      account_name: `QA M29 ${label}`, status: "active",
      billing_address: "1 QA St", billing_city: "Laval",
      billing_province: "QC", billing_postal_code: "H7T 2Y5",
      primary_service_address: "1 QA St", primary_service_city: "Laval",
      primary_service_province: "QC", primary_service_postal_code: "H7T 2Y5",
    }).select("id").single();
    if (error) throw new Error(`account ${label}: ${error.message}`);
    return { userId, accountId: acc.id as string };
  };

  const ensureCatalogPlanTV = async (name: string, price: number) => {
    const { data: existing } = await admin
      .from("services")
      .select("id, name, price")
      .eq("category", "TV")
      .ilike("name", name)
      .maybeSingle();
    if (existing) return existing;
    const { data, error } = await admin.from("services").insert({
      name, category: "TV", price, status: "active", is_active: true,
    }).select("id, name, price").single();
    if (error) throw new Error(`catalog: ${error.message}`);
    return data;
  };

  const ensureTvPack = async () => {
    const { data: existing } = await admin.from("tv_packs")
      .select("id, name, category").ilike("name", "QA Sports+").maybeSingle();
    if (existing) {
      if (existing.category !== "sports") {
        await admin.from("tv_packs").update({ category: "sports" }).eq("id", existing.id);
      }
      return { id: existing.id, name: existing.name };
    }
    const { data, error } = await admin.from("tv_packs").insert({
      name: "QA Sports+", slug: "qa-sports-plus", category: "sports",
      original_price: 15, discounted_price: 12, is_active: true,
    }).select("id, name").single();
    if (error) throw new Error(`tv_packs: ${error.message}`);
    return data;
  };

  const ensureChannels = async (): Promise<string[]> => {
    const names = ["QA-CH-1", "QA-CH-2"];
    const ids: string[] = [];
    for (const n of names) {
      const { data: e } = await admin.from("tv_channels")
        .select("id").eq("name", n).maybeSingle();
      if (e?.id) { ids.push(e.id); continue; }
      const { data, error } = await admin.from("tv_channels").insert({
        name: n, category: "paid", price: 1.0, is_active: true,
      }).select("id").single();
      if (error) throw new Error(`tv_channels: ${error.message}`);
      ids.push(data.id);
    }
    return ids;
  };

  const cleanupClient = async (userId: string) => {
    await admin.from("tv_plan_changes").delete().eq("user_id", userId);
    await admin.from("tv_addon_subscriptions").delete().eq("user_id", userId);
    await admin.from("tv_vod_purchases").delete().eq("user_id", userId);
    await admin.from("tv_terminal_actions").delete().eq("user_id", userId);
    await admin.from("tv_parental_controls").delete().eq("user_id", userId);
    await admin.from("channel_selections").delete().eq("user_id", userId);
    await admin.from("client_activity_logs").delete().eq("client_id", userId);
    await admin.from("client_internal_notes").delete().eq("client_id", userId);
    const email = (await admin.from("profiles").select("email").eq("user_id", userId).maybeSingle()).data?.email;
    if (email) await admin.from("email_queue").delete().eq("to_email", email);
  };

  const cleanupAudit = async (callerIds: string[]) => {
    for (const id of callerIds) {
      await admin.from("admin_audit_log").delete().eq("admin_user_id", id).like("action", "tv.%");
    }
  };

  try {
    // ---- Setup catalog ------------------------------------------------
    const canonicalPlan = await ensureCatalogPlanTV("QA TV Premium", 60);
    const pack = await ensureTvPack();
    const channelIds = await ensureChannels();

    // ---- Setup callers & clients --------------------------------------
    const adminCaller = await ensureCaller("qa-m29-admin@nivra-test.ca", "admin");
    const salesCaller = await ensureCaller("qa-m29-sales@nivra-test.ca", "sales");
    const supportCaller = await ensureCaller("qa-m29-support@nivra-test.ca", "support");
    const clientA = await ensureClient("qa-m29-client-a@nivra-test.ca", "A");
    const clientB = await ensureClient("qa-m29-client-b@nivra-test.ca", "B");

    await cleanupClient(clientA.userId);
    await cleanupClient(clientB.userId);
    await cleanupAudit([adminCaller.userId, salesCaller.userId, supportCaller.userId]);

    // =============== CHANGE_PLAN ===============
    // C1 sales (not in ROLES_CHANGE_PLAN)
    {
      const r = await callEF(salesCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 60, reason: "sales tries change_plan",
      });
      push({ id: "C1", name: "sales change_plan → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.error_code === "FORBIDDEN_ROLE", details: r });
    }

    // C2 reason too short
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 60, reason: "abc",
      });
      push({ id: "C2", name: "reason < 5 → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.error_code === "REASON_REQUIRED", details: r });
    }

    // C3 unknown plan
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        new_plan_name: "Forfait TV Inexistant 9999", new_monthly_price: 99,
        reason: "trying unknown TV plan",
      });
      push({ id: "C3", name: "plan TV hors catalogue → UNKNOWN_PLAN",
        ok: r.status === 400 && r.body?.error_code === "UNKNOWN_PLAN", details: r });
    }

    // C4 cross-client account
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientB.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 60,
        reason: "cross-client account attempt",
      });
      push({ id: "C4", name: "cross-client account → 403 CROSS_CLIENT_TARGET",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // C5 client inconnu
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: "00000000-0000-0000-0000-000000000000",
        account_id: clientA.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 60,
        reason: "unknown client_user_id",
      });
      push({ id: "C5", name: "client inconnu → 404 NOT_FOUND",
        ok: r.status === 404 && r.body?.error_code === "NOT_FOUND", details: r });
    }

    // C6 change_plan OK + idempotency
    const planIdemKey = `qa29-plan-${crypto.randomUUID()}`;
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        previous_plan_name: "QA TV Basic", previous_monthly_price: 30,
        new_plan_name: canonicalPlan.name, new_monthly_price: 60,
        change_type: "upgrade", reason: "official upgrade to canonical TV plan",
        idempotency_key: planIdemKey,
      });
      push({ id: "C6", name: "admin change_plan valide → 200 + plan_change_id",
        ok: r.status === 200 && r.body?.ok === true && !!r.body?.plan_change_id, details: r });
    }

    // C7 idempotency replay
    {
      const r = await callEF(adminCaller.jwt, {
        action: "change_plan", client_user_id: clientA.userId, account_id: clientA.accountId,
        new_plan_name: canonicalPlan.name, new_monthly_price: 60,
        reason: "replay same key", idempotency_key: planIdemKey,
      });
      push({ id: "C7", name: "idempotency replay → 200 replayed=true",
        ok: r.status === 200 && r.body?.replayed === true, details: r });
    }

    // C8 simulated=true dans tv_plan_changes
    {
      const { data: rows } = await admin.from("tv_plan_changes")
        .select("id, metadata").eq("user_id", clientA.userId);
      const ok = (rows || []).length > 0 && rows!.every((r: any) => r.metadata?.simulated === true);
      push({ id: "C8", name: "tv_plan_changes.metadata.simulated=true",
        ok, details: { count: rows?.length, sample: rows?.[0]?.metadata } });
    }

    // =============== ADD/REMOVE PACK ===============
    // C9 pack invalide → UNKNOWN_ADDON
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add_themed_pack", client_user_id: clientA.userId, account_id: clientA.accountId,
        pack_id: "00000000-0000-0000-0000-000000000000",
        reason: "unknown pack id",
      });
      push({ id: "C9", name: "pack inconnu → UNKNOWN_ADDON",
        ok: r.status === 400 && r.body?.error_code === "UNKNOWN_ADDON", details: r });
    }

    // C10 add_themed_pack OK
    let addonId: string | null = null;
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add_themed_pack", client_user_id: clientA.userId, account_id: clientA.accountId,
        pack_id: pack.id, reason: "activate QA sports pack",
      });
      addonId = r.body?.addon_id ?? null;
      push({ id: "C10", name: "add_themed_pack pack_id valide → 200",
        ok: r.status === 200 && !!addonId, details: r });
    }

    // C11 dup → 409
    {
      const r = await callEF(adminCaller.jwt, {
        action: "add_themed_pack", client_user_id: clientA.userId, account_id: clientA.accountId,
        pack_id: pack.id, reason: "duplicate activation",
      });
      push({ id: "C11", name: "add_themed_pack dup → 409 DUPLICATE_ACTIVE",
        ok: r.status === 409 && r.body?.error_code === "DUPLICATE_ACTIVE", details: r });
    }

    // C12 remove pack cross-client (as clientB)
    {
      const r = await callEF(adminCaller.jwt, {
        action: "remove_themed_pack", client_user_id: clientB.userId,
        addon_id: addonId, reason: "cross-client remove attempt",
      });
      push({ id: "C12", name: "remove_themed_pack cross-client → 403 CROSS_CLIENT_TARGET",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // C13 remove OK
    {
      const r = await callEF(adminCaller.jwt, {
        action: "remove_themed_pack", client_user_id: clientA.userId,
        addon_id: addonId, reason: "cleanup pack after QA",
      });
      push({ id: "C13", name: "remove_themed_pack admin → 200",
        ok: r.status === 200, details: r });
    }

    // =============== VOD ===============
    // C14 support VOD → 403 (ROLES_VOD n'a pas support)
    {
      const r = await callEF(supportCaller.jwt, {
        action: "purchase_vod", client_user_id: clientA.userId, account_id: clientA.accountId,
        title: "QA Movie", amount: 6.99, reason: "support tries VOD",
      });
      push({ id: "C14", name: "support purchase_vod → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.error_code === "FORBIDDEN_ROLE", details: r });
    }

    // C15 amount invalide
    {
      const r = await callEF(adminCaller.jwt, {
        action: "purchase_vod", client_user_id: clientA.userId, account_id: clientA.accountId,
        title: "QA Movie", amount: -1, reason: "invalid amount",
      });
      push({ id: "C15", name: "VOD amount ≤ 0 → INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // C16 VOD OK
    let vodPaymentRef: string | null = null;
    {
      const r = await callEF(adminCaller.jwt, {
        action: "purchase_vod", client_user_id: clientA.userId, account_id: clientA.accountId,
        title: "QA Movie", amount: 6.99, currency: "CAD",
        payment_reference: "CLIENT-FAKE-REF-SHOULD-BE-IGNORED",
        reason: "purchase VOD for QA validation",
      });
      vodPaymentRef = r.body?.payment_reference ?? null;
      push({ id: "C16", name: "purchase_vod admin → 200 + payment_reference serveur",
        ok: r.status === 200 && !!vodPaymentRef && vodPaymentRef.startsWith("VOD-"),
        details: r });
    }

    // C17 payment_reference client bypass rejeté (le serveur génère toujours VOD-*)
    {
      const { data: rows } = await admin.from("tv_vod_purchases")
        .select("payment_reference").eq("user_id", clientA.userId);
      const allServerGenerated = (rows || []).length > 0 &&
        rows!.every((r: any) => typeof r.payment_reference === "string" && r.payment_reference.startsWith("VOD-"));
      push({ id: "C17", name: "F29-18 payment_reference toujours généré serveur (VOD-*)",
        ok: allServerGenerated, details: { count: rows?.length, samples: rows?.map((r: any) => r.payment_reference) } });
    }

    // =============== TERMINAL_ACTION ===============
    // C18 support factory_reset → 403 (critique)
    {
      const r = await callEF(supportCaller.jwt, {
        action: "terminal_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "factory_reset", terminal_serial: "QA-TERM-001",
        reason: "support tries critical factory reset",
      });
      push({ id: "C18", name: "support factory_reset → 403 FORBIDDEN_ROLE",
        ok: r.status === 403 && r.body?.error_code === "FORBIDDEN_ROLE", details: r });
    }

    // C19 factory_reset motif <10
    {
      const r = await callEF(adminCaller.jwt, {
        action: "terminal_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "factory_reset", terminal_serial: "QA-TERM-001", reason: "short",
      });
      push({ id: "C19", name: "factory_reset motif <10 → REASON_REQUIRED",
        ok: r.status === 400 && r.body?.error_code === "REASON_REQUIRED", details: r });
    }

    // C20 reboot admin OK
    {
      const r = await callEF(adminCaller.jwt, {
        action: "terminal_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "reboot", terminal_serial: "QA-TERM-001",
        reason: "planned reboot",
      });
      push({ id: "C20", name: "reboot admin → 200",
        ok: r.status === 200 && !!r.body?.terminal_action_id, details: r });
    }

    // C21 reboot cooldown
    {
      const r = await callEF(adminCaller.jwt, {
        action: "terminal_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "reboot", terminal_serial: "QA-TERM-001",
        reason: "second reboot within cooldown",
      });
      push({ id: "C21", name: "reboot cooldown → 429 RATE_LIMIT",
        ok: r.status === 429 && r.body?.error_code === "RATE_LIMIT", details: r });
    }

    // C22 factory_reset OK (different serial)
    {
      const r = await callEF(adminCaller.jwt, {
        action: "terminal_action", client_user_id: clientA.userId, account_id: clientA.accountId,
        action_type: "factory_reset", terminal_serial: "QA-TERM-002",
        reason: "admin performs certified factory reset for QA",
      });
      push({ id: "C22", name: "factory_reset admin motif OK → 200",
        ok: r.status === 200 && !!r.body?.terminal_action_id, details: r });
    }

    // C23 simulated=true partout
    {
      const { data: rows } = await admin.from("tv_terminal_actions")
        .select("metadata").eq("user_id", clientA.userId);
      const ok = (rows || []).length > 0 && rows!.every((r: any) => r.metadata?.simulated === true);
      push({ id: "C23", name: "tv_terminal_actions.metadata.simulated=true",
        ok, details: { count: rows?.length } });
    }

    // =============== PARENTAL ===============
    // C24 PIN invalide
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_parental", client_user_id: clientA.userId, account_id: clientA.accountId,
        enabled: true, max_rating: "PG-13", pin: "abcd",
        reason: "set parental PIN invalide",
      });
      push({ id: "C24", name: "PIN non numérique → INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // C25 max_rating invalide
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_parental", client_user_id: clientA.userId, account_id: clientA.accountId,
        enabled: true, max_rating: "X-99" as any,
        reason: "set parental invalid rating",
      });
      push({ id: "C25", name: "max_rating hors bornes → INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // C26 set_parental OK + PIN
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_parental", client_user_id: clientA.userId, account_id: clientA.accountId,
        enabled: true, max_rating: "PG-13", pin: "1234",
        blocked_channels: ["ch-x"],
        reason: "enable parental PG-13 with pin",
      });
      push({ id: "C26", name: "set_parental admin PG-13 → 200",
        ok: r.status === 200, details: r });
    }

    // C27 PIN hashé (jamais en clair)
    {
      const { data: rows } = await admin.from("tv_parental_controls")
        .select("pin_hash").eq("user_id", clientA.userId);
      const ok = (rows || []).length > 0 && rows!.every((r: any) =>
        typeof r.pin_hash === "string" && r.pin_hash.includes(":") && !r.pin_hash.includes("1234"));
      push({ id: "C27", name: "F29-17 PIN hashé avec salt (jamais en clair)",
        ok, details: { sample_head: (rows?.[0]?.pin_hash as string || "").slice(0, 12) + "…" } });
    }

    // =============== SET_CHANNELS ===============
    // C28 chaînes vides
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_channels", client_user_id: clientA.userId, account_id: clientA.accountId,
        channel_ids: [], reason: "empty list",
      });
      push({ id: "C28", name: "channel_ids vide → INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // C29 chaînes inconnues
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_channels", client_user_id: clientA.userId, account_id: clientA.accountId,
        channel_ids: ["00000000-0000-0000-0000-000000000000"],
        reason: "unknown channel ids",
      });
      push({ id: "C29", name: "chaînes inconnues → INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // C30 set_channels OK
    let selectionId: string | null = null;
    {
      const r = await callEF(adminCaller.jwt, {
        action: "set_channels", client_user_id: clientA.userId, account_id: clientA.accountId,
        channel_ids: channelIds, reason: "confirm channel selection",
      });
      selectionId = r.body?.selection_id ?? null;
      push({ id: "C30", name: "set_channels admin → 200",
        ok: r.status === 200 && !!selectionId, details: r });
    }

    // =============== APPROVE/REJECT ===============
    // Create a pending selection directly to test approve/reject
    let pendingId: string | null = null;
    {
      const { data } = await admin.from("channel_selections").insert({
        user_id: clientA.userId, account_id: clientA.accountId,
        channels: [{ id: channelIds[0], name: "QA-CH-1", category: "test", price: 1 }],
        total_price: 1, status: "pending",
      }).select("id").single();
      pendingId = data?.id ?? null;
    }

    // C31 approve cross-client
    {
      const r = await callEF(adminCaller.jwt, {
        action: "approve_channel_selection", client_user_id: clientB.userId,
        selection_id: pendingId, reason: "cross client approve",
      });
      push({ id: "C31", name: "approve cross-client → 403 CROSS_CLIENT_TARGET",
        ok: r.status === 403 && r.body?.error_code === "CROSS_CLIENT_TARGET", details: r });
    }

    // C32 approve OK
    {
      const r = await callEF(adminCaller.jwt, {
        action: "approve_channel_selection", client_user_id: clientA.userId,
        account_id: clientA.accountId, selection_id: pendingId,
        reason: "approve pending selection",
      });
      push({ id: "C32", name: "approve_channel_selection admin → 200 confirmed",
        ok: r.status === 200 && r.body?.status === "confirmed", details: r });
    }

    // C33 reject déjà confirmée → INVALID_STATE
    {
      const r = await callEF(adminCaller.jwt, {
        action: "reject_channel_selection", client_user_id: clientA.userId,
        selection_id: pendingId, reason: "reject already confirmed selection",
      });
      push({ id: "C33", name: "reject déjà confirmée → 409 INVALID_STATE",
        ok: r.status === 409 && r.body?.error_code === "INVALID_STATE", details: r });
    }

    // =============== UNKNOWN ACTION ===============
    {
      const r = await callEF(adminCaller.jwt, {
        action: "does_not_exist", client_user_id: clientA.userId,
      } as any);
      push({ id: "C34", name: "action inconnue → 400 INVALID_INPUT",
        ok: r.status === 400 && r.body?.error_code === "INVALID_INPUT", details: r });
    }

    // =============== LOGS / EMAILS / AUDIT ===============
    {
      const { count: auditCount } = await admin.from("admin_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("admin_user_id", adminCaller.userId)
        .like("action", "tv.%");
      push({ id: "C35", name: "admin_audit_log tv.* > 0",
        ok: (auditCount ?? 0) > 0, details: { auditCount } });

      const { count: cal } = await admin.from("client_activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientA.userId);
      push({ id: "C36", name: "client_activity_logs > 0",
        ok: (cal ?? 0) > 0, details: { cal } });

      const { count: notes } = await admin.from("client_internal_notes")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientA.userId)
        .eq("note_type", "system");
      push({ id: "C37", name: "client_internal_notes system > 0",
        ok: (notes ?? 0) > 0, details: { notes } });

      const { count: emails } = await admin.from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("to_email", "qa-m29-client-a@nivra-test.ca")
        .like("template_key", "client_tv_%");
      push({ id: "C38", name: "email_queue client_tv_* > 0",
        ok: (emails ?? 0) > 0, details: { emails } });

      const { data: sample } = await admin.from("admin_audit_log")
        .select("details").eq("admin_user_id", adminCaller.userId)
        .like("action", "tv.%").limit(1).maybeSingle();
      push({ id: "C39", name: "admin_audit_log.details.actor_role présent",
        ok: !!sample?.details && typeof (sample.details as any).actor_role === "string",
        details: sample?.details });

      // simulated=true propagé dans audit
      const { data: auditRows } = await admin.from("admin_audit_log")
        .select("details").eq("admin_user_id", adminCaller.userId)
        .like("action", "tv.%").limit(50);
      const allSim = (auditRows || []).length > 0 &&
        auditRows!.every((r: any) => (r.details as any)?.simulated === true);
      push({ id: "C40", name: "admin_audit_log.details.simulated=true partout",
        ok: allSim, details: { sampled: auditRows?.length } });
    }

    // =============== ANTI-FLOOD ===============
    try {
      const nowIso = new Date().toISOString();
      // Insert one-by-one with delays to avoid platform trace ingestion throttling
      for (let i = 0; i < 20; i++) {
        await admin.from("admin_audit_log").insert({
          admin_user_id: salesCaller.userId,
          admin_email: "qa-m29-sales@nivra-test.ca",
          action: "tv.flood_seed",
          target_type: "client",
          target_id: clientA.userId,
          details: { seed: "flood_m29", ts: nowIso, i },
        });
        await new Promise((res) => setTimeout(res, 300));
      }
      const r = await callEF(salesCaller.jwt, {
        action: "add_themed_pack", client_user_id: clientA.userId, account_id: clientA.accountId,
        pack_id: pack.id, reason: "flood check",
      });
      push({ id: "C41", name: "anti-flood → 429 RATE_LIMIT",
        ok: r.status === 429 && r.body?.error_code === "RATE_LIMIT", details: r });
      await admin.from("admin_audit_log").delete()
        .eq("admin_user_id", salesCaller.userId)
        .contains("details", { seed: "flood_m29" });
    } catch (e) {
      push({ id: "C41", name: "anti-flood → 429 RATE_LIMIT",
        ok: false, details: { error: (e as Error).message } });
    }

    // =============== CLEANUP + ORPHAN CHECK ===============
    if (!keep) {
      await cleanupClient(clientA.userId);
      await cleanupClient(clientB.userId);
      await cleanupAudit([adminCaller.userId, salesCaller.userId, supportCaller.userId]);

      // Orphan verification
      const orphanChecks: Array<[string, number]> = [];
      for (const table of ["tv_plan_changes","tv_addon_subscriptions","tv_vod_purchases","tv_terminal_actions","tv_parental_controls","channel_selections"]) {
        const { count } = await admin.from(table).select("id", { count: "exact", head: true })
          .in("user_id", [clientA.userId, clientB.userId]);
        orphanChecks.push([table, count ?? 0]);
      }
      const { count: auditLeft } = await admin.from("admin_audit_log")
        .select("id", { count: "exact", head: true })
        .in("admin_user_id", [adminCaller.userId, salesCaller.userId, supportCaller.userId])
        .like("action", "tv.%");
      const totalOrphans = orphanChecks.reduce((s, [,c]) => s + c, 0) + (auditLeft ?? 0);
      push({ id: "C42", name: "Cleanup — 0 orphelin",
        ok: totalOrphans === 0, details: { orphanChecks, auditLeft } });
    }

    const pass = checks.filter((c) => c.ok).length;
    const fail = checks.length - pass;
    return json({
      module: "M29",
      total: checks.length, pass, fail,
      status: fail === 0 ? "PASS" : "FAIL",
      checks,
    });
  } catch (e) {
    return json({ error: (e as Error).message, checks }, 500);
  }
});

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
