import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-employee-token',
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = req.headers.get('x-employee-token');
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token de session requis" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const verification = await verifyToken(token, tokenSecret);
    
    if (!verification.valid) {
      return new Response(
        JSON.stringify({ error: "Session invalide ou expirée. Veuillez vous reconnecter." }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { employeeId, permissions } = verification.payload;
    const { action, params } = await req.json();
    
    console.log(`[employee-data] Action: ${action} for employee: ${employeeId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result: any = null;

    switch (action) {
      case "get_orders":
        if (!permissions?.can_view_orders) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: orders } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params?.limit || 100);
        result = { orders };
        break;

      case "get_appointments":
        if (!permissions?.can_view_appointments) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: appointments } = await supabase
          .from("appointments")
          .select("*")
          .order("scheduled_at", { ascending: true })
          .limit(params?.limit || 100);
        result = { appointments };
        break;

      case "get_tickets":
        if (!permissions?.can_view_tickets) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: tickets } = await supabase
          .from("support_tickets")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params?.limit || 100);
        result = { tickets };
        break;

      case "get_clients":
        if (!permissions?.can_view_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: clients } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params?.limit || 100);
        result = { clients };
        break;

      case "get_invoices":
        if (!permissions?.can_generate_invoices || !permissions?.can_edit_invoices) {
          // Allow view if they have either permission
          if (!permissions?.can_generate_invoices && !permissions?.can_edit_invoices) {
            return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
        const { data: invoices } = await supabase
          .from("billing")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params?.limit || 100);
        result = { invoices };
        break;

      case "update_order_status":
        if (!permissions?.can_edit_orders_status) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: orderError } = await supabase
          .from("orders")
          .update({ status: params.status, updated_at: new Date().toISOString() })
          .eq("id", params.orderId);
        if (orderError) throw orderError;
        result = { success: true };
        break;

      case "update_appointment":
        if (!permissions?.can_manage_appointments) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: aptError } = await supabase
          .from("appointments")
          .update({ ...params.updates, updated_at: new Date().toISOString() })
          .eq("id", params.appointmentId);
        if (aptError) throw aptError;
        result = { success: true };
        break;

      case "update_ticket":
        if (!permissions?.can_manage_tickets) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: ticketError } = await supabase
          .from("support_tickets")
          .update({ ...params.updates, updated_at: new Date().toISOString() })
          .eq("id", params.ticketId);
        if (ticketError) throw ticketError;
        result = { success: true };
        break;

      case "get_dashboard_stats":
        const [ordersCount, appointmentsCount, ticketsCount, clientsCount] = await Promise.all([
          permissions?.can_view_orders ? supabase.from("orders").select("id", { count: "exact", head: true }) : { count: 0 },
          permissions?.can_view_appointments ? supabase.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_at", new Date().toISOString()) : { count: 0 },
          permissions?.can_view_tickets ? supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open") : { count: 0 },
          permissions?.can_view_clients ? supabase.from("profiles").select("id", { count: "exact", head: true }) : { count: 0 },
        ]);
        result = {
          stats: {
            orders: ordersCount.count || 0,
            upcomingAppointments: appointmentsCount.count || 0,
            openTickets: ticketsCount.count || 0,
            totalClients: clientsCount.count || 0,
          }
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Action non reconnue" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[employee-data] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur inattendue" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
