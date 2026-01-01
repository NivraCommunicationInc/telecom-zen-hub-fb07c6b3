import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-technician-token',
};

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

    // Decode signature
    const signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureBytes = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(data));
    
    if (!valid) {
      return { valid: false, error: "Invalid signature" };
    }

    // Decode payload
    const payload = JSON.parse(atob(payloadB64));
    
    // Check expiry
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get token from header
    const token = req.headers.get('x-technician-token');
    
    if (!token) {
      console.log("[technician-work-orders] Missing token");
      return new Response(
        JSON.stringify({ error: "Token de session requis" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify token
    const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const verification = await verifyToken(token, tokenSecret);
    
    if (!verification.valid) {
      console.log("[technician-work-orders] Invalid token:", verification.error);
      return new Response(
        JSON.stringify({ error: "Session invalide ou expirée. Veuillez vous reconnecter." }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { technicianId, fullName } = verification.payload;
    console.log(`[technician-work-orders] Fetching for technician: ${fullName} (${technicianId})`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch work_orders for this technician
    const { data: workOrders, error: woError } = await supabase
      .from("work_orders")
      .select("*")
      .eq("assigned_technician_id", technicianId)
      .order("scheduled_start", { ascending: true, nullsFirst: false });

    if (woError) {
      console.error("[technician-work-orders] work_orders query error:", woError);
    }

    console.log(`[technician-work-orders] work_orders found: ${workOrders?.length || 0}`);

    // Fetch legacy orders assigned to this technician
    const { data: legacyOrders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("technician_id", technicianId)
      .order("appointment_date", { ascending: true, nullsFirst: false });

    if (ordersError) {
      console.error("[technician-work-orders] orders query error:", ordersError);
    }

    // Fetch legacy appointments assigned to this technician
    const { data: legacyAppointments, error: aptsError } = await supabase
      .from("appointments")
      .select("*")
      .eq("technician_id", technicianId)
      .order("scheduled_at", { ascending: true });

    if (aptsError) {
      console.error("[technician-work-orders] appointments query error:", aptsError);
    }

    // Fetch client profiles for context
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

    // Map order status to work order status
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

    // Map appointment status to work order status
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

    // Convert legacy orders to work order format
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

    // Convert legacy appointments to work order format
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

    // Combine work orders with legacy items (prefer work_orders if both exist)
    const workOrderIds = new Set((workOrders || []).map((wo: any) => wo.linked_order_id || wo.linked_appointment_id));
    const legacyFiltered = [...convertedOrders, ...convertedAppointments].filter((lo: any) => {
      const linkedId = lo.linked_order_id || lo.linked_appointment_id;
      return !workOrderIds.has(linkedId);
    });

    const allWorkOrders = [...(workOrders || []), ...legacyFiltered];

    console.log(`[technician-work-orders] Total items: ${allWorkOrders.length} (work_orders: ${workOrders?.length || 0}, legacy: ${legacyFiltered.length})`);

    // Split into current and history
    const current = allWorkOrders.filter((wo: any) => 
      ["assigned", "scheduled", "in_progress"].includes(wo.status)
    );
    const history = allWorkOrders.filter((wo: any) => 
      ["completed", "cancelled"].includes(wo.status)
    );

    return new Response(
      JSON.stringify({
        success: true,
        technicianId,
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
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[technician-work-orders] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur inattendue. Veuillez réessayer." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
