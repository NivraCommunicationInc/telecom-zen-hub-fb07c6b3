import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Generate request ID for tracking
function generateRequestId(): string {
  return `emp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
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

// Normalize permissions to a unified format
// Handles both "can_view_orders" and "view_orders" formats
function normalizePermissions(perms: Record<string, boolean>): Record<string, boolean> {
  if (!perms || typeof perms !== 'object') return {};
  
  const normalized: Record<string, boolean> = {};
  
  for (const [key, value] of Object.entries(perms)) {
    // Add the original key
    normalized[key] = value === true;
    
    // Also add normalized versions
    if (key.startsWith('can_')) {
      // can_view_orders -> view_orders
      const withoutCan = key.replace('can_', '');
      normalized[withoutCan] = value === true;
    } else {
      // view_orders -> can_view_orders
      normalized[`can_${key}`] = value === true;
    }
  }
  
  return normalized;
}

// Check if user has permission (checks both formats)
function hasPermission(perms: Record<string, boolean>, ...keys: string[]): boolean {
  if (!perms) return false;
  return keys.some(key => perms[key] === true);
}

// Resolve permissions from user_roles table (SINGLE SOURCE OF TRUTH)
async function resolvePermissions(
  supabase: any,
  tokenPermissions: any,
  employeeId: string,
  employeeEmail: string
): Promise<{ permissions: Record<string, boolean>; source: string; role: string; status: string }> {
  
  console.log(`[resolvePermissions] Resolving permissions for ${employeeEmail}`);

  // Always fetch from DB - user_roles.permissions is the ONLY source of truth
  // First find the user's profile to get their user_id
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("email", employeeEmail)
    .maybeSingle();

  if (profileError) {
    console.error(`[resolvePermissions] profiles query error:`, profileError);
  }

  if (profile?.user_id) {
    // Get permissions from user_roles table (SINGLE SOURCE OF TRUTH)
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("permissions, role, status, is_active")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    if (roleError) {
      console.error(`[resolvePermissions] user_roles query error:`, roleError);
    }

    if (userRole) {
      const isActive = userRole.is_active !== false && userRole.status !== 'disabled' && userRole.status !== 'hold';
      console.log(`[resolvePermissions] Found user_roles: role=${userRole.role}, status=${userRole.status}, is_active=${userRole.is_active}`);
      console.log(`[resolvePermissions] Permissions from DB:`, JSON.stringify(userRole.permissions));
      
      return { 
        permissions: normalizePermissions(userRole.permissions || {}), 
        source: "user_roles_table", 
        role: userRole.role || "employee",
        status: isActive ? "active" : (userRole.status || "disabled")
      };
    }
  }

  // No user_roles found - return empty permissions (NOT defaults!)
  console.log(`[resolvePermissions] No user_roles found for ${employeeEmail} - returning empty permissions`);
  return { 
    permissions: {}, 
    source: "no_user_roles", 
    role: "unknown",
    status: "unknown"
  };
}

// Return structured 403 response
function forbidden(corsHeaders: Record<string, string>, requestId: string, neededPermission: string, resolvedPerms: any, appliedFilters: string[] = []) {
  console.log(`[employee-data] 403 FORBIDDEN: ${neededPermission} | request_id=${requestId}`);
  return new Response(
    JSON.stringify({
      ok: false,
      request_id: requestId,
      reason: "not_allowed",
      needed_permission: neededPermission,
      message: `Permission requise: ${neededPermission}`,
      resolved_permissions: resolvedPerms.permissions,
      permission_source: resolvedPerms.source,
      applied_filters: appliedFilters,
    }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = generateRequestId();

  try {
    const token = req.headers.get('x-employee-token');
    
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Token de session requis" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const verification = await verifyToken(token, tokenSecret);
    
    if (!verification.valid) {
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Session invalide ou expirée. Veuillez vous reconnecter." }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { employeeId, fullName: employeeName, email: employeeEmail, permissions: tokenPermissions } = verification.payload;
    const { action, params } = await req.json();

    // Use SERVICE ROLE KEY to bypass RLS - employees need to see all data based on permissions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Resolve permissions from DB (single source of truth)
    const resolvedPerms = await resolvePermissions(supabase, tokenPermissions, employeeId, employeeEmail);
    const resolvedPermissions = resolvedPerms.permissions;
    
    console.log(`[employee-data] Action: ${action} | RequestID: ${requestId} | Employee: ${employeeName} (${employeeEmail})`);
    console.log(`[employee-data] Permissions source: ${resolvedPerms.source} | Role: ${resolvedPerms.role} | Status: ${resolvedPerms.status}`);
    console.log(`[employee-data] Resolved permissions:`, JSON.stringify(resolvedPermissions));

    // Check if user is disabled or has no valid role
    if (resolvedPerms.status === "disabled" || resolvedPerms.status === "hold") {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          request_id: requestId, 
          reason: `status_${resolvedPerms.status}`,
          message: resolvedPerms.status === "hold" ? "Compte suspendu" : "Compte désactivé"
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (resolvedPerms.source === "no_user_roles") {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          request_id: requestId, 
          reason: "no_role_assigned",
          message: "Aucun rôle assigné. Contactez un administrateur."
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: any = null;

    switch (action) {
      // ==================== DIAGNOSTIC ====================
      case "run_visibility_diagnostic": {
        console.log(`[employee-data] Running visibility diagnostic for ${employeeEmail}`);
        
        // Count all tables (no filters - just raw counts)
        const [ordersCount, clientsCount, ticketsCount, appointmentsCount] = await Promise.all([
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("user_id", { count: "exact", head: true }).neq("user_id", employeeId),
          supabase.from("support_tickets").select("id", { count: "exact", head: true }),
          supabase.from("appointments").select("id", { count: "exact", head: true }),
        ]);
        
        result = {
          ok: true,
          request_id: requestId,
          diagnostic: {
            employee_email: employeeEmail,
            employee_id: employeeId,
            resolved_permissions: resolvedPermissions,
            permission_source: resolvedPerms.source,
            role: resolvedPerms.role,
            status: resolvedPerms.status,
            db_counts: {
              orders: ordersCount.count || 0,
              clients: clientsCount.count || 0,
              tickets: ticketsCount.count || 0,
              appointments: appointmentsCount.count || 0,
            },
            permission_checks: {
              can_view_orders: hasPermission(resolvedPermissions, 'can_view_orders', 'view_orders'),
              can_view_clients: hasPermission(resolvedPermissions, 'can_view_clients', 'view_clients'),
              can_view_tickets: hasPermission(resolvedPermissions, 'can_view_tickets', 'view_tickets'),
              can_view_appointments: hasPermission(resolvedPermissions, 'can_view_appointments', 'view_appointments'),
            },
          },
        };
        break;
      }

      // ==================== DASHBOARD STATS ====================
      case "get_dashboard_stats": {
        // Get counts for dashboard stats - only for sections user has permission to view
        const stats: any = {};
        
        if (hasPermission(resolvedPermissions, 'can_view_orders', 'view_orders')) {
          const { count } = await supabase.from("orders").select("id", { count: "exact", head: true });
          stats.orders = count || 0;
        }
        
        if (hasPermission(resolvedPermissions, 'can_view_clients', 'view_clients')) {
          const { count } = await supabase.from("profiles").select("user_id", { count: "exact", head: true });
          stats.totalClients = count || 0;
        }
        
        if (hasPermission(resolvedPermissions, 'can_view_tickets', 'view_tickets')) {
          const { count } = await supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]);
          stats.openTickets = count || 0;
        }
        
        if (hasPermission(resolvedPermissions, 'can_view_appointments', 'view_appointments')) {
          const { count } = await supabase.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_at", new Date().toISOString());
          stats.upcomingAppointments = count || 0;
        }
        
        result = { ok: true, request_id: requestId, stats };
        break;
      }

      // ==================== ORDERS ====================
      case "get_orders": {
        // Check view permission
        if (!hasPermission(resolvedPermissions, 'can_view_orders', 'view_orders')) {
          console.log(`[employee-data] get_orders DENIED for ${employeeEmail}`);
          return forbidden(corsHeaders, requestId, "can_view_orders", resolvedPerms, ["permission_denied"]);
        }
        
        // Return ALL orders - no employee-specific filtering
        const { data: orders, error: ordersError, count: ordersCount } = await supabase
          .from("orders")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(params?.limit || 500);
          
        if (ordersError) {
          console.error(`[employee-data] get_orders ERROR:`, ordersError);
        }
        
        console.log(`[employee-data] get_orders returned ${orders?.length || 0} items (total: ${ordersCount})`);
        
        result = { 
          ok: true,
          request_id: requestId,
          orders: orders || [], 
          total_count: ordersCount || 0,
          total_count_db: ordersCount || 0,
          total_count_returned: orders?.length || 0,
          resolved_permissions: resolvedPermissions,
          permission_source: resolvedPerms.source,
          applied_filters: ["none - returning all orders"],
          role: resolvedPerms.role,
        };
        break;
      }

      // ==================== APPOINTMENTS ====================
      case "get_appointments": {
        if (!hasPermission(resolvedPermissions, 'can_view_appointments', 'view_appointments')) {
          return forbidden(corsHeaders, requestId, "can_view_appointments", resolvedPerms, ["permission_denied"]);
        }
        
        // Return ALL appointments - no employee-specific filtering
        const { data: appointments, error: aptError, count: appointmentsCount } = await supabase
          .from("appointments")
          .select("*, technicians(id, full_name, email)", { count: "exact" })
          .order("scheduled_at", { ascending: true })
          .limit(params?.limit || 500);
        
        if (aptError) {
          console.error(`[employee-data] get_appointments ERROR:`, aptError);
        }
        
        console.log(`[employee-data] get_appointments returned ${appointments?.length || 0} items (total: ${appointmentsCount})`);
        
        result = { 
          ok: true,
          request_id: requestId,
          appointments: appointments || [],
          total_count: appointmentsCount || 0,
          total_count_db: appointmentsCount || 0,
          total_count_returned: appointments?.length || 0,
          resolved_permissions: resolvedPermissions,
          permission_source: resolvedPerms.source,
          applied_filters: ["none - returning all appointments"],
          role: resolvedPerms.role,
        };
        break;
      }

      // ==================== TICKETS ====================
      case "get_tickets": {
        if (!hasPermission(resolvedPermissions, 'can_view_tickets', 'view_tickets')) {
          console.log(`[employee-data] get_tickets DENIED for ${employeeEmail}`);
          return forbidden(corsHeaders, requestId, "can_view_tickets", resolvedPerms, ["permission_denied"]);
        }
        
        // Return ALL tickets - no employee-specific filtering
        const { data: tickets, error: ticketsError, count: ticketsCount } = await supabase
          .from("support_tickets")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(params?.limit || 500);
          
        if (ticketsError) {
          console.error(`[employee-data] get_tickets ERROR:`, ticketsError);
        }
        
        console.log(`[employee-data] get_tickets returned ${tickets?.length || 0} items (total: ${ticketsCount})`);
        
        result = { 
          ok: true,
          request_id: requestId,
          tickets: tickets || [], 
          total_count: ticketsCount || 0,
          total_count_db: ticketsCount || 0,
          total_count_returned: tickets?.length || 0,
          resolved_permissions: resolvedPermissions,
          permission_source: resolvedPerms.source,
          applied_filters: ["none - returning all tickets"],
          role: resolvedPerms.role,
        };
        break;
      }

      case "get_ticket_replies": {
        if (!hasPermission(resolvedPermissions, 'can_view_tickets', 'view_tickets')) {
          return forbidden(corsHeaders, requestId, "can_view_tickets", resolvedPerms);
        }
        const { data: replies } = await supabase
          .from("ticket_replies")
          .select("*")
          .eq("ticket_id", params.ticketId)
          .order("created_at", { ascending: true });
        result = { ok: true, request_id: requestId, replies };
        break;
      }

      // ==================== CLIENTS ====================
      case "get_clients": {
        if (!hasPermission(resolvedPermissions, 'can_view_clients', 'view_clients')) {
          console.log(`[employee-data] get_clients DENIED for ${employeeEmail}`);
          return forbidden(corsHeaders, requestId, "can_view_clients", resolvedPerms, ["permission_denied"]);
        }
        
        // Return ALL clients - no employee-specific filtering
        const { data: clients, error: clientsError, count: clientsCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(params?.limit || 500);
          
        if (clientsError) {
          console.error(`[employee-data] get_clients ERROR:`, clientsError);
        }
        
        console.log(`[employee-data] get_clients returned ${clients?.length || 0} items (total: ${clientsCount})`);
        
        result = { 
          ok: true,
          request_id: requestId,
          clients: clients || [], 
          total_count: clientsCount || 0,
          total_count_db: clientsCount || 0,
          total_count_returned: clients?.length || 0,
          resolved_permissions: resolvedPermissions,
          permission_source: resolvedPerms.source,
          applied_filters: ["none - returning all clients"],
          role: resolvedPerms.role,
        };
        break;
      }

      case "get_client_details": {
        if (!hasPermission(resolvedPermissions, 'can_view_clients', 'view_clients')) {
          return forbidden(corsHeaders, requestId, "can_view_clients", resolvedPerms);
        }
        const { data: client } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", params.clientId)
          .single();
        result = { ok: true, request_id: requestId, client };
        break;
      }

      // ==================== STREAMING ====================
      case "get_streaming_services": {
        const { data: services, error: servicesError } = await supabase
          .from("streaming_services")
          .select("*")
          .order("name");
        
        if (servicesError) {
          console.error(`[employee-data] get_streaming_services ERROR:`, servicesError);
        }
        
        result = { ok: true, request_id: requestId, services: services || [] };
        break;
      }

      case "get_client_streaming": {
        if (!hasPermission(resolvedPermissions, 'can_view_clients', 'view_clients')) {
          return forbidden(corsHeaders, requestId, "can_view_clients", resolvedPerms);
        }
        
        const { data: subscriptions, error: subError } = await supabase
          .from("client_streaming_subscriptions")
          .select("*, streaming_services(*)")
          .eq("user_id", params.clientId);
        
        if (subError) {
          console.error(`[employee-data] get_client_streaming ERROR:`, subError);
        }
        
        result = { ok: true, request_id: requestId, subscriptions: subscriptions || [] };
        break;
      }

      // ==================== INVOICES ====================
      case "get_invoices": {
        if (!hasPermission(resolvedPermissions, 'can_view_billing', 'view_billing', 'can_generate_invoices', 'can_edit_invoices')) {
          return forbidden(corsHeaders, requestId, "can_view_billing", resolvedPerms, ["permission_denied"]);
        }
        
        const { data: invoices, error: invoicesError, count: invoicesCount } = await supabase
          .from("billing")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(params?.limit || 500);
        
        if (invoicesError) {
          console.error(`[employee-data] get_invoices ERROR:`, invoicesError);
        }
        
        result = { 
          ok: true, 
          request_id: requestId, 
          invoices: invoices || [],
          total_count: invoicesCount || 0,
        };
        break;
      }

      // ==================== DEFAULT ====================
      default:
        result = { 
          ok: false, 
          request_id: requestId, 
          error: `Action inconnue: ${action}`,
          available_actions: [
            "run_visibility_diagnostic",
            "get_dashboard_stats", 
            "get_orders", 
            "get_appointments", 
            "get_tickets", 
            "get_clients",
            "get_streaming_services",
            "get_invoices"
          ]
        };
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[employee-data] Unexpected error:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ ok: false, error: "Erreur inattendue. Veuillez réessayer.", request_id: requestId }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
