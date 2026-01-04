import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Generate request ID for tracking
function generateRequestId(): string {
  return `tech-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

// Verify and decode JWT-like token
async function verifyToken(token: string, secret: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid token format" };
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureBytes = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(data));
    
    if (!valid) {
      return { valid: false, error: "Invalid signature" };
    }

    const payload = JSON.parse(atob(payloadB64));
    
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: "Token expired" };
    }

    return { valid: true, payload };
  } catch (error) {
    console.error("[verifyToken] Error:", error);
    return { valid: false, error: "Token verification failed" };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = generateRequestId();

  try {
    const token = req.headers.get('x-technician-token');
    
    if (!token) {
      console.log("[technician-work-orders] Missing token");
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Token de session requis" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const verification = await verifyToken(token, tokenSecret);
    
    if (!verification.valid) {
      console.log("[technician-work-orders] Invalid token:", verification.error);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Session invalide ou expirée. Veuillez vous reconnecter." }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { technicianId, fullName, permissions } = verification.payload;
    console.log(`[technician-work-orders] RequestID: ${requestId} | Fetching for technician: ${fullName} (${technicianId})`);
    
    // Check view appointments permission (technicians should have this by default)
    const hasViewPermission = permissions?.can_view_appointments !== false && 
                              permissions?.view_appointments !== false;
    
    // Log permissions status
    console.log(`[technician-work-orders] Permissions:`, JSON.stringify(permissions || {}));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch work orders assigned to this technician
    const { data: workOrders, error: woError, count: woCount } = await supabase
      .from("work_orders")
      .select("*", { count: "exact" })
      .eq("assigned_technician_id", technicianId)
      .order("scheduled_start", { ascending: true, nullsFirst: false });

    if (woError) {
      console.error("[technician-work-orders] work_orders query error:", woError);
    }

    console.log(`[technician-work-orders] work_orders found: ${workOrders?.length || 0} (total in DB: ${woCount})`);

    const { data: legacyOrders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("technician_id", technicianId)
      .order("appointment_date", { ascending: true, nullsFirst: false });

    if (ordersError) {
      console.error("[technician-work-orders] orders query error:", ordersError);
    }

    const { data: legacyAppointments, error: aptsError } = await supabase
      .from("appointments")
      .select("*")
      .eq("technician_id", technicianId)
      .order("scheduled_at", { ascending: true });

    if (aptsError) {
      console.error("[technician-work-orders] appointments query error:", aptsError);
    }

    const orders = legacyOrders || [];
    const appointments = legacyAppointments || [];
    
    const userIds = [...new Set([
      ...orders.map((o: any) => o.user_id),
      ...appointments.filter((a: any) => a.client_id).map((a: any) => a.client_id),
    ])].filter(Boolean);

    let profiles: any[] = [];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, service_address, service_city, service_postal_code")
        .in("user_id", userIds);
      profiles = profilesData || [];
    }

    const mapOrderStatus = (status: string): string => {
      const mapping: Record<string, string> = {
        pending: "assigned",
        hold: "assigned",
        verification: "assigned",
        back_order: "assigned",
        shipped: "scheduled",
        processing: "in_progress",
        completed: "completed",
        completed_installation: "completed",
        cancelled: "cancelled",
      };
      return mapping[status] || "assigned";
    };

    const mapAppointmentStatus = (status: string): string => {
      const mapping: Record<string, string> = {
        scheduled: "scheduled",
        technician_assigned: "assigned",
        in_progress: "in_progress",
        completed: "completed",
        cancelled: "cancelled",
      };
      return mapping[status] || "assigned";
    };

    const convertedOrders = orders.map((order: any) => {
      const profile = profiles.find((p: any) => p.user_id === order.user_id);
      return {
        id: `order-${order.id}`,
        work_order_number: order.order_number,
        type: "installation",
        linked_order_id: order.id,
        client_id: order.user_id,
        client_name: profile?.full_name || order.client_email?.split('@')[0],
        client_email: order.client_email || profile?.email,
        client_phone: profile?.phone,
        service_address: profile?.service_address,
        service_city: profile?.service_city,
        service_postal_code: profile?.service_postal_code,
        scheduled_start: order.appointment_date,
        assigned_technician_id: order.technician_id,
        status: mapOrderStatus(order.status),
        service_type: order.service_type,
        notes: order.notes,
        equipment_details: order.equipment_details || [],
        created_at: order.created_at,
        updated_at: order.updated_at,
        _source: "order",
      };
    });

    const convertedAppointments = appointments
      .filter((apt: any) => !orders.some((o: any) => o.id === apt.order_id))
      .map((apt: any) => {
        const profile = profiles.find((p: any) => p.user_id === apt.client_id);
        return {
          id: `appointment-${apt.id}`,
          work_order_number: apt.appointment_number,
          type: "installation",
          linked_appointment_id: apt.id,
          client_id: apt.client_id,
          client_name: profile?.full_name || apt.client_email?.split('@')[0],
          client_email: apt.client_email || profile?.email,
          client_phone: apt.client_phone || profile?.phone,
          service_address: apt.service_address || profile?.service_address,
          service_city: apt.service_city || profile?.service_city,
          service_postal_code: apt.service_postal_code || profile?.service_postal_code,
          scheduled_start: apt.scheduled_at,
          assigned_technician_id: apt.technician_id,
          status: mapAppointmentStatus(apt.status),
          service_type: apt.service_type,
          notes: apt.description,
          equipment_details: apt.equipment_details || [],
          created_at: apt.created_at,
          updated_at: apt.updated_at,
          _source: "appointment",
        };
      });

    const workOrderIds = new Set((workOrders || []).map((wo: any) => wo.linked_order_id || wo.linked_appointment_id));
    const legacyFiltered = [...convertedOrders, ...convertedAppointments].filter((lo: any) => {
      const linkedId = lo.linked_order_id || lo.linked_appointment_id;
      return !workOrderIds.has(linkedId);
    });

    const allWorkOrders = [...(workOrders || []), ...legacyFiltered];

    console.log(`[technician-work-orders] Total items: ${allWorkOrders.length} (work_orders: ${workOrders?.length || 0}, legacy: ${legacyFiltered.length})`);

    const current = allWorkOrders.filter((wo: any) => 
      ["assigned", "scheduled", "in_progress"].includes(wo.status)
    );
    const history = allWorkOrders.filter((wo: any) => 
      ["completed", "cancelled"].includes(wo.status)
    );

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        request_id: requestId,
        technicianId,
        technicianName: fullName,
        current,
        history,
        counts: {
          total: allWorkOrders.length,
          current: current.length,
          history: history.length,
          workOrders: workOrders?.length || 0,
          legacyOrders: orders.length,
          legacyAppointments: appointments.length,
        },
        applied_filters: ["assigned_to_technician"],
        resolved_permissions: permissions || {},
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[technician-work-orders] Unexpected error:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ ok: false, error: "Erreur inattendue. Veuillez réessayer." }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
