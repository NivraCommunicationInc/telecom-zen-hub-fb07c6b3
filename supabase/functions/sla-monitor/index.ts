import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";

const SLA_THRESHOLD_HOURS = 48;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    // --- Auth: service role only ---
    const authHeader = req.headers.get("authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Accept either the raw service role key or a Bearer token matching it
    const providedToken = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : authHeader ?? "";

    if (providedToken !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Service role requis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
    );

    // --- Find SLA violations: pending/assigned work orders older than 48h ---
    const cutoff = new Date(Date.now() - SLA_THRESHOLD_HOURS * 60 * 60 * 1000);

    const { data: overdueOrders, error: queryError } = await admin
      .from("work_orders")
      .select("id, status, created_at, assigned_technician_id")
      .in("status", ["pending", "assigned"])
      .lt("created_at", cutoff.toISOString());

    if (queryError) {
      console.error("[sla-monitor] work_orders query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la récupération des work orders" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!overdueOrders || overdueOrders.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, violations_found: 0, violations: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date();
    const violations: Array<{
      work_order_id: string;
      hours_overdue: number;
      created_at: string;
      notified_at: string;
    }> = [];

    // --- Check which work orders already have an existing violation record ---
    const workOrderIds = overdueOrders.map((wo: any) => wo.id);
    const { data: existingViolations } = await admin
      .from("sla_violations")
      .select("work_order_id")
      .in("work_order_id", workOrderIds);

    const alreadyRecorded = new Set(
      (existingViolations ?? []).map((v: any) => v.work_order_id),
    );

    // --- Build new violations ---
    for (const wo of overdueOrders) {
      if (alreadyRecorded.has(wo.id)) continue;

      const createdAt = new Date(wo.created_at);
      const hoursOverdue = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60),
      );

      violations.push({
        work_order_id: wo.id,
        hours_overdue: hoursOverdue,
        created_at: wo.created_at,
        notified_at: now.toISOString(),
      });
    }

    if (violations.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, violations_found: 0, violations: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Insert into sla_violations ---
    const { error: insertError } = await admin
      .from("sla_violations")
      .insert(violations);

    if (insertError) {
      console.error("[sla-monitor] sla_violations insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'insertion des violations SLA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Build email body ---
    const violationRows = violations
      .map(
        (v) =>
          `• Work Order ${v.work_order_id} — ${v.hours_overdue}h de retard (créé le ${new Date(v.created_at).toLocaleString("fr-CA", { timeZone: "America/Toronto" })})`,
      )
      .join("\n");

    const emailBody = `Bonjour,

Le moniteur SLA a détecté ${violations.length} violation(s) en date du ${now.toLocaleString("fr-CA", { timeZone: "America/Toronto" })}.

Work orders en retard (>${SLA_THRESHOLD_HOURS}h sans résolution) :

${violationRows}

Action requise : vérifier et relancer les techniciens assignés.

— Système automatisé Nivra Telecom`;

    // --- Canonical gateway (Module 40 SINGLE DOOR) ---
    // Deterministic key = day + sorted work_order_ids fingerprint.
    const woFingerprint = violations.map((v) => v.work_order_id).sort().join(",");
    const dayKey = now.toISOString().slice(0, 10);
    try {
      await enqueueCommunication(admin, {
        channel: "email",
        recipient: "support@nivra-telecom.ca",
        templateKey: "custom_html",
        subject: `[SLA] ${violations.length} violation(s) détectée(s) — ${now.toLocaleDateString("fr-CA")}`,
        templateVars: {
          subject: `[SLA] ${violations.length} violation(s)`,
          body_text: emailBody,
          body_html: emailBody.replace(/\n/g, "<br/>"),
          source: "sla-monitor",
          violation_count: violations.length,
          work_order_ids: violations.map((v) => v.work_order_id),
        },
        idempotencyKey: `sla-monitor:${dayKey}:${woFingerprint}`,
      });
    } catch (emailError) {
      // Non-fatal: violations are already recorded, log the email failure
      console.error("[sla-monitor] enqueue failed:", emailError);
    }

    console.log(
      `[sla-monitor] ${violations.length} violation(s) enregistrée(s), notification envoyée.`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        violations_found: violations.length,
        violations,
        email_queued: !emailError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[sla-monitor] unexpected error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...getCorsHeaders(null), "Content-Type": "application/json" } },
    );
  }
});
