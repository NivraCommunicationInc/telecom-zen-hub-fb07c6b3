import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    // --- Auth: require valid JWT ---
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

    // --- Role check: technician / admin / supervisor ---
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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // --- Fetch work orders assigned to this technician ---
    const { data: workOrders, error: woError } = await admin
      .from("work_orders")
      .select("id, status, priority, scheduled_start, scheduled_end, notes, internal_notes, created_at, updated_at, client_name, client_phone, client_email, service_address, service_city, service_type, work_order_number")
      .eq("assigned_technician_id", technicianId)
      .order("priority", { ascending: false })
      .order("scheduled_start", { ascending: true });

    if (woError) {
      console.error("[technician-dashboard] work_orders query error:", woError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la récupération des work orders" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allOrders = workOrders ?? [];

    // --- Today's appointments: scheduled_start within today ---
    const todayAppointments = allOrders.filter((wo: any) => {
      if (!wo.scheduled_start) return false;
      const d = new Date(wo.scheduled_start);
      return d >= todayStart && d <= todayEnd;
    });

    // --- Stats ---
    const stats = {
      pending: allOrders.filter((wo: any) => wo.status === "pending").length,
      in_progress: allOrders.filter((wo: any) => wo.status === "in_progress").length,
      completed_today: allOrders.filter((wo: any) => {
        if (wo.status !== "completed") return false;
        const d = new Date(wo.updated_at ?? wo.created_at);
        return d >= todayStart && d <= todayEnd;
      }).length,
    };

    return new Response(
      JSON.stringify({
        ok: true,
        work_orders: allOrders,
        today_appointments: todayAppointments,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[technician-dashboard] unexpected error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...getCorsHeaders(null), "Content-Type": "application/json" } },
    );
  }
});
