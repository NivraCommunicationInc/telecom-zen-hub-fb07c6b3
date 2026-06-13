/**
 * technician-work-orders — Gestion des work orders pour techniciens
 *
 * GET  /                     → liste tous les WOs du technicien authentifié
 * GET  /?id=<uuid>            → détails d'un WO spécifique
 * PATCH /                    → met à jour status / notes d'un WO
 *   body: { id, status?, notes?, internal_notes?, completion_notes?, completed_at? }
 *
 * Statuts valides: pending → in_progress → completed | cancelled
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const ALLOWED_STATUSES = ["pending", "in_progress", "completed", "cancelled", "on_hold"];

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    // --- Auth ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Token d'autorisation requis" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const token = authHeader.replace("Bearer ", "").trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token invalide ou expiré" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // --- Role check ---
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role, status")
      .eq("user_id", user.id)
      .in("role", ["technician", "admin", "supervisor"])
      .eq("status", "active")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Accès technicien requis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const technicianId = user.id;
    const isAdmin = ["admin", "supervisor"].includes(roleData.role);
    const url = new URL(req.url);

    // ─────────────────────────────────────────────────────────────────────
    // GET — list or single work order
    // ─────────────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const workOrderId = url.searchParams.get("id");

      const WO_SELECT = `
        id, status, priority, service_type, work_order_number,
        scheduled_start, scheduled_end,
        started_at, completed_at,
        notes, internal_notes,
        client_name, client_phone, client_email,
        service_address, service_city, service_postal_code,
        assigned_technician_id,
        created_at, updated_at,
        equipment_details, checklist
      `;

      if (workOrderId) {
        // Single WO — admin can see any, technician only sees own
        let q = admin
          .from("work_orders")
          .select(WO_SELECT)
          .eq("id", workOrderId);

        if (!isAdmin) q = q.eq("assigned_technician_id", technicianId);

        const { data, error } = await q.maybeSingle();
        if (error) throw error;
        if (!data) {
          return new Response(
            JSON.stringify({ error: "Work order introuvable ou accès refusé" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ ok: true, work_order: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // All work orders for this technician (or all for admin)
      const statusFilter = url.searchParams.get("status");
      let q = admin
        .from("work_orders")
        .select(WO_SELECT)
        .order("priority", { ascending: false })
        .order("scheduled_start", { ascending: true });

      if (!isAdmin) q = q.eq("assigned_technician_id", technicianId);
      if (statusFilter && ALLOWED_STATUSES.includes(statusFilter)) {
        q = q.eq("status", statusFilter);
      }

      const { data: workOrders, error: woError } = await q;
      if (woError) throw woError;

      const all = workOrders ?? [];
      const stats = {
        total: all.length,
        pending: all.filter((w: any) => w.status === "pending").length,
        in_progress: all.filter((w: any) => w.status === "in_progress").length,
        completed: all.filter((w: any) => w.status === "completed").length,
        cancelled: all.filter((w: any) => w.status === "cancelled").length,
        on_hold: all.filter((w: any) => w.status === "on_hold").length,
      };

      return new Response(
        JSON.stringify({ ok: true, work_orders: all, stats }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // PATCH — update work order (status, notes, completion)
    // ─────────────────────────────────────────────────────────────────────
    if (req.method === "PATCH") {
      let body: any;
      try {
        body = await req.json();
      } catch (_e) {
        return new Response(
          JSON.stringify({ error: "Corps JSON invalide" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { id, status, notes, internal_notes, completion_notes } = body;
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Champ 'id' requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Verify ownership
      const { data: existing } = await admin
        .from("work_orders")
        .select("id, status, assigned_technician_id")
        .eq("id", id)
        .maybeSingle();

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Work order introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!isAdmin && existing.assigned_technician_id !== technicianId) {
        return new Response(
          JSON.stringify({ error: "Accès refusé à ce work order" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (status && !ALLOWED_STATUSES.includes(status)) {
        return new Response(
          JSON.stringify({ error: `Statut invalide. Valeurs acceptées: ${ALLOWED_STATUSES.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status) patch.status = status;
      if (notes !== undefined) patch.notes = notes;
      if (internal_notes !== undefined) patch.internal_notes = internal_notes;
      if (completion_notes !== undefined) patch.completion_notes = completion_notes;

      // Auto-set timestamps on status transitions
      if (status === "in_progress" && existing.status === "pending") {
        patch.started_at = new Date().toISOString();
      }
      if (status === "completed") {
        patch.completed_at = new Date().toISOString();
      }

      const { data: updated, error: updateError } = await admin
        .from("work_orders")
        .update(patch)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ ok: true, work_order: updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Méthode non supportée" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[technician-work-orders] error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...getCorsHeaders(null), "Content-Type": "application/json" } },
    );
  }
});
