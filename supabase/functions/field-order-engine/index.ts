/**
 * field-order-engine — Canonical order lifecycle for field sales.
 * Actions: validate, submit, update-payment, retry-sync, add-note, history.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { requireAuth, checkBodySize, sanitizeString } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const cors = handleCorsPreflightRequest(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };

  try {
    checkBodySize(req);
    const { userId } = await requireAuth(req);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    // ── GET: Order detail ──
    if (req.method === "GET" && action === "detail") {
      const orderId = url.searchParams.get("order_id");
      if (!orderId) return new Response(JSON.stringify({ error: "order_id requis" }), { status: 400, headers });

      const [orderRes, historyRes, syncRes, notesRes] = await Promise.all([
        admin.from("field_sales_orders").select("*").eq("id", orderId).single(),
        admin.from("field_order_status_history").select("*").eq("field_order_id", orderId).order("created_at", { ascending: false }),
        admin.from("field_order_sync_events").select("*").eq("field_order_id", orderId).order("created_at", { ascending: false }),
        admin.from("field_order_notes").select("*").eq("field_order_id", orderId).order("created_at", { ascending: false }),
      ]);

      return new Response(JSON.stringify({
        order: orderRes.data,
        status_history: historyRes.data || [],
        sync_events: syncRes.data || [],
        notes: notesRes.data || [],
      }), { headers });
    }

    // ── GET: Order list ──
    if (req.method === "GET" && action === "list") {
      const status = url.searchParams.get("status");
      const paymentStatus = url.searchParams.get("payment_status");
      const syncStatus = url.searchParams.get("sync_status");
      const mine = url.searchParams.get("mine") === "true";

      let query = admin
        .from("field_sales_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (mine) query = query.eq("salesperson_id", userId);
      if (status) query = query.eq("status", status);
      if (paymentStatus) query = query.eq("payment_status", paymentStatus);
      if (syncStatus) query = query.eq("sync_status", syncStatus);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ orders: data || [] }), { headers });
    }

    // POST actions
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non supportée" }), { status: 405, headers });
    }

    const body = await req.json();

    // ── Validate order draft ──
    if (action === "validate") {
      const issues: string[] = [];
      const warnings: string[] = [];

      if (!body.customer_name?.trim()) issues.push("Nom du client requis");
      if (!body.customer_phone?.trim()) issues.push("Téléphone du client requis");
      if (!body.customer_email?.trim()) issues.push("Courriel du client requis");
      if (!body.customer_address?.trim()) issues.push("Adresse du client requise");
      if (!body.customer_postal_code?.trim()) issues.push("Code postal requis");
      if (!body.customer_date_of_birth?.trim()) issues.push("Date de naissance requise");
      if (!body.services || body.services.length === 0) issues.push("Au moins un service requis");

      // Check equipment constraints
      const routerCount = (body.equipment || []).filter((e: any) => 
        e.category === "Routeur" || e.name?.toLowerCase().includes("routeur")
      ).reduce((sum: number, e: any) => sum + (e.quantity || 1), 0);

      if (routerCount > 1) issues.push("Maximum 1 routeur par commande");

      const terminalCount = (body.equipment || []).filter((e: any) => 
        e.category === "Terminal" || e.name?.toLowerCase().includes("terminal")
      ).reduce((sum: number, e: any) => sum + (e.quantity || 1), 0);

      if (terminalCount > 5) issues.push("Maximum 5 terminaux par commande");

      // DOB validation
      if (body.customer_date_of_birth) {
        const dob = new Date(body.customer_date_of_birth);
        const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age < 18) issues.push("Le client doit avoir 18 ans ou plus");
      }

      return new Response(JSON.stringify({
        valid: issues.length === 0,
        issues,
        warnings,
      }), { headers });
    }

    // ── Submit order ──
    if (action === "submit") {
      const orderId = body.order_id;
      if (!orderId) return new Response(JSON.stringify({ error: "order_id requis" }), { status: 400, headers });

      // Log status transition
      await admin.from("field_order_status_history").insert({
        field_order_id: orderId,
        status_domain: "order",
        old_status: "draft",
        new_status: "submitted",
        changed_by_user_id: userId,
        change_reason: "Soumission par l'agent terrain",
      });

      // Create sync event
      await admin.from("field_order_sync_events").insert({
        field_order_id: orderId,
        sync_target: "core",
        sync_action: "create_order",
        sync_status: "pending",
        attempt_count: 0,
      });

      return new Response(JSON.stringify({
        success: true,
        order_id: orderId,
        sync_status: "pending",
        message: "Commande soumise avec succès",
      }), { headers });
    }

    // ── Update payment status ──
    if (action === "update-payment") {
      const orderId = body.order_id;
      const newStatus = sanitizeString(body.payment_status || "", 50);
      const reference = body.payment_reference || null;

      if (!orderId || !newStatus) {
        return new Response(JSON.stringify({ error: "order_id et payment_status requis" }), { status: 400, headers });
      }

      // Get current status
      const { data: order } = await admin
        .from("field_sales_orders")
        .select("payment_status")
        .eq("id", orderId)
        .single();

      // Update order
      await admin
        .from("field_sales_orders")
        .update({
          payment_status: newStatus,
          payment_reference: reference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      // Log status change
      await admin.from("field_order_status_history").insert({
        field_order_id: orderId,
        status_domain: "payment",
        old_status: order?.payment_status || "unknown",
        new_status: newStatus,
        changed_by_user_id: userId,
        change_reason: reference ? `Référence: ${reference}` : null,
      });

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ── Retry sync ──
    if (action === "retry-sync") {
      const orderId = body.order_id;
      if (!orderId) return new Response(JSON.stringify({ error: "order_id requis" }), { status: 400, headers });

      // Get config for max retries
      const { data: configRows } = await admin
        .from("field_sales_config")
        .select("config_key, config_value")
        .in("config_key", ["sync_retry_max_attempts", "sync_retry_delay_seconds"]);

      const maxAttempts = Number(configRows?.find((r: any) => r.config_key === "sync_retry_max_attempts")?.config_value || 3);

      // Get last sync event
      const { data: lastSync } = await admin
        .from("field_order_sync_events")
        .select("*")
        .eq("field_order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastSync && lastSync.attempt_count >= maxAttempts) {
        return new Response(JSON.stringify({
          success: false,
          message: `Maximum de ${maxAttempts} tentatives atteint. Contactez un superviseur.`,
        }), { headers });
      }

      // Create new sync event
      await admin.from("field_order_sync_events").insert({
        field_order_id: orderId,
        sync_target: "core",
        sync_action: "retry",
        sync_status: "pending",
        attempt_count: (lastSync?.attempt_count || 0) + 1,
      });

      // Update order sync_status
      await admin
        .from("field_sales_orders")
        .update({ sync_status: "pending", sync_error: null })
        .eq("id", orderId);

      // Log status change
      await admin.from("field_order_status_history").insert({
        field_order_id: orderId,
        status_domain: "sync",
        old_status: "error",
        new_status: "pending",
        changed_by_user_id: userId,
        change_reason: `Tentative de resync #${(lastSync?.attempt_count || 0) + 1}`,
      });

      // Trigger actual sync
      try {
        await admin.functions.invoke("field-sales-sync", {
          body: { orderId },
        });
      } catch (syncErr) {
        // Non-blocking — sync event will track the failure
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Synchronisation relancée",
        attempt_count: (lastSync?.attempt_count || 0) + 1,
      }), { headers });
    }

    // ── Add note ──
    if (action === "add-note") {
      const orderId = body.order_id;
      const content = sanitizeString(body.content || "", 2000);
      const noteType = body.note_type || "internal";
      const isInternal = body.is_internal !== false;

      if (!orderId || !content) {
        return new Response(JSON.stringify({ error: "order_id et content requis" }), { status: 400, headers });
      }

      await admin.from("field_order_notes").insert({
        field_order_id: orderId,
        note_type: noteType,
        created_by_user_id: userId,
        content,
        is_internal: isInternal,
      });

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });

  } catch (err: any) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});
