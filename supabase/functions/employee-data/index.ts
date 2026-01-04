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

// Resolve permissions with server-side fallback
async function resolvePermissions(
  supabase: any,
  tokenPermissions: any,
  employeeId: string,
  employeeEmail: string
): Promise<{ permissions: Record<string, boolean>; source: string; role: string; status: string }> {
  // Default result
  const defaultResult = { 
    permissions: normalizePermissions({
      can_view_orders: true,
      can_view_clients: true,
      can_view_tickets: true,
      can_view_appointments: true,
    }), 
    source: "default_employee", 
    role: "employee",
    status: "active"
  };

  // If token has permissions, use them (normalized)
  if (tokenPermissions && typeof tokenPermissions === 'object' && Object.keys(tokenPermissions).length > 0) {
    console.log(`[resolvePermissions] Using token permissions for ${employeeEmail}`);
    return { 
      permissions: normalizePermissions(tokenPermissions), 
      source: "token", 
      role: "employee",
      status: "active"
    };
  }

  console.log(`[resolvePermissions] Token permissions empty, fetching from DB for ${employeeEmail}`);

  // Fallback 1: Try employees table
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("permissions_json, role, is_active")
    .ilike("email", employeeEmail)
    .maybeSingle();

  if (empError) {
    console.error(`[resolvePermissions] employees query error:`, empError);
  }

  if (employee?.permissions_json && Object.keys(employee.permissions_json).length > 0) {
    console.log(`[resolvePermissions] Found permissions in employees table:`, JSON.stringify(employee.permissions_json));
    return { 
      permissions: normalizePermissions(employee.permissions_json), 
      source: "employees_table", 
      role: employee.role || "employee",
      status: employee.is_active ? "active" : "disabled"
    };
  }

  // Fallback 2: Try user_roles table via profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("email", employeeEmail)
    .maybeSingle();

  if (profileError) {
    console.error(`[resolvePermissions] profiles query error:`, profileError);
  }

  if (profile?.user_id) {
    // Try to find user_roles for this user (any staff role)
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("permissions, role, status")
      .eq("user_id", profile.user_id)
      .in("role", ["employee", "admin", "technician"])
      .maybeSingle();

    if (roleError) {
      console.error(`[resolvePermissions] user_roles query error:`, roleError);
    }

    if (userRole?.permissions && Object.keys(userRole.permissions).length > 0) {
      console.log(`[resolvePermissions] Found permissions in user_roles table:`, JSON.stringify(userRole.permissions));
      return { 
        permissions: normalizePermissions(userRole.permissions), 
        source: "user_roles_table", 
        role: userRole.role,
        status: userRole.status || "active"
      };
    }
  }

  // Default minimal permissions for employee if nothing found
  console.log(`[resolvePermissions] No permissions found, using default employee permissions`);
  return defaultResult;
}

// Return structured 403 response
function forbidden(corsHeaders: Record<string, string>, requestId: string, neededPermission: string, resolvedPerms: any, appliedFilters: string[] = []) {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Resolve permissions with fallback
    const resolvedPerms = await resolvePermissions(supabase, tokenPermissions, employeeId, employeeEmail);
    const resolvedPermissions = resolvedPerms.permissions;
    
    console.log(`[employee-data] Action: ${action} | RequestID: ${requestId} | Employee: ${employeeName} (${employeeEmail})`);
    console.log(`[employee-data] Permissions source: ${resolvedPerms.source} | Status: ${resolvedPerms.status}`);
    console.log(`[employee-data] Resolved permissions:`, JSON.stringify(resolvedPermissions));

    // Check if user is disabled
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

    let result: any = null;

    switch (action) {
      // ==================== DIAGNOSTIC ====================
      case "run_visibility_diagnostic": {
        console.log(`[employee-data] Running visibility diagnostic for ${employeeEmail}`);
        
        // Count all tables
        const [ordersCount, clientsCount, ticketsCount, appointmentsCount] = await Promise.all([
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
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
              can_manage_orders: hasPermission(resolvedPermissions, 'can_manage_orders', 'manage_orders', 'can_edit_orders_status'),
              can_manage_clients: hasPermission(resolvedPermissions, 'can_manage_clients', 'manage_clients', 'can_edit_clients'),
              can_manage_tickets: hasPermission(resolvedPermissions, 'can_manage_tickets', 'manage_tickets'),
              can_manage_appointments: hasPermission(resolvedPermissions, 'can_manage_appointments', 'manage_appointments'),
            },
          },
        };
        break;
      }

      // ==================== READ OPERATIONS ====================
      case "get_orders": {
        // Check view permission (both formats)
        if (!hasPermission(resolvedPermissions, 'can_view_orders', 'view_orders', 'manage_orders', 'can_manage_orders')) {
          console.log(`[employee-data] get_orders DENIED for ${employeeEmail} - perms:`, resolvedPermissions);
          return forbidden(corsHeaders, requestId, "can_view_orders", resolvedPerms, ["permission_denied"]);
        }
        
        // Build query with appropriate filters
        let query = supabase.from("orders").select("*", { count: "exact" });
        
        // If manage_orders = true -> all orders, otherwise filter by assigned/created
        const hasManageOrders = hasPermission(resolvedPermissions, 'manage_orders', 'can_manage_orders', 'can_edit_orders_status');
        
        let appliedFilters: string[] = [];
        
        if (!hasManageOrders) {
          appliedFilters.push("view_only_mode");
        } else {
          appliedFilters.push("manage_all");
        }
        
        const { data: orders, error: ordersError, count: ordersCount } = await query
          .order("created_at", { ascending: false })
          .limit(params?.limit || 300);
          
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
          applied_filters: appliedFilters,
          role: resolvedPerms.role,
        };
        break;
      }

      case "get_appointments": {
        if (!hasPermission(resolvedPermissions, 'can_view_appointments', 'view_appointments', 'manage_appointments', 'can_manage_appointments')) {
          return forbidden(corsHeaders, requestId, "can_view_appointments", resolvedPerms, ["permission_denied"]);
        }
        
        const hasManageAppointments = hasPermission(resolvedPermissions, 'manage_appointments', 'can_manage_appointments');
        let aptFilters: string[] = [];
        
        const { data: appointments, error: aptError, count: appointmentsCount } = await supabase
          .from("appointments")
          .select("*, technicians(id, full_name, email)", { count: "exact" })
          .order("scheduled_at", { ascending: true })
          .limit(params?.limit || 300);
        
        if (aptError) {
          console.error(`[employee-data] get_appointments ERROR:`, aptError);
        }
        
        aptFilters.push(hasManageAppointments ? "manage_all" : "view_only");
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
          applied_filters: aptFilters,
          role: resolvedPerms.role,
        };
        break;
      }

      case "get_tickets": {
        if (!hasPermission(resolvedPermissions, 'can_view_tickets', 'view_tickets', 'manage_tickets', 'can_manage_tickets')) {
          console.log(`[employee-data] get_tickets DENIED for ${employeeEmail}`);
          return forbidden(corsHeaders, requestId, "can_view_tickets", resolvedPerms, ["permission_denied"]);
        }
        
        const hasManageTickets = hasPermission(resolvedPermissions, 'manage_tickets', 'can_manage_tickets');
        let ticketFilters: string[] = [];
        
        const { data: tickets, error: ticketsError, count: ticketsCount } = await supabase
          .from("support_tickets")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(params?.limit || 300);
          
        if (ticketsError) {
          console.error(`[employee-data] get_tickets ERROR:`, ticketsError);
        }
        
        ticketFilters.push(hasManageTickets ? "manage_all" : "view_only");
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
          applied_filters: ticketFilters,
          role: resolvedPerms.role,
        };
        break;
      }

      case "get_ticket_replies": {
        if (!hasPermission(resolvedPermissions, 'can_view_tickets', 'view_tickets', 'manage_tickets', 'can_manage_tickets')) {
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

      case "get_clients": {
        if (!hasPermission(resolvedPermissions, 'can_view_clients', 'view_clients', 'manage_clients', 'can_manage_clients')) {
          console.log(`[employee-data] get_clients DENIED for ${employeeEmail}`);
          return forbidden(corsHeaders, requestId, "can_view_clients", resolvedPerms, ["permission_denied"]);
        }
        
        const hasManageClients = hasPermission(resolvedPermissions, 'manage_clients', 'can_manage_clients', 'can_edit_clients');
        let clientFilters: string[] = [];
        
        const { data: clients, error: clientsError, count: clientsCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(params?.limit || 500);
          
        if (clientsError) {
          console.error(`[employee-data] get_clients ERROR:`, clientsError);
        }
        
        clientFilters.push(hasManageClients ? "manage_all" : "view_only");
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
          applied_filters: clientFilters,
          role: resolvedPerms.role,
        };
        break;
      }

      case "get_client_details":
        if (!hasPermission(resolvedPermissions, 'can_view_clients', 'view_clients')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée", request_id: requestId }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const clientUserId = params.userId;
        const clientEmail = params.email;
        
        const [clientOrders, clientBilling, clientPayments, clientTickets, clientAppointments, clientSubscriptions, clientDocuments] = await Promise.all([
          supabase.from("orders").select("*").or(`user_id.eq.${clientUserId},client_email.eq.${clientEmail}`).order("created_at", { ascending: false }).limit(50),
          supabase.from("billing").select("*").or(`user_id.eq.${clientUserId},client_email.eq.${clientEmail}`).order("created_at", { ascending: false }).limit(50),
          supabase.from("payments").select("*").eq("user_id", clientUserId).order("created_at", { ascending: false }).limit(50),
          supabase.from("support_tickets").select("*").or(`user_id.eq.${clientUserId},client_email.eq.${clientEmail}`).order("created_at", { ascending: false }).limit(50),
          supabase.from("appointments").select("*").or(`client_id.eq.${clientUserId},client_email.eq.${clientEmail}`).order("scheduled_at", { ascending: false }).limit(50),
          supabase.from("subscriptions").select("*").eq("user_id", clientUserId).order("created_at", { ascending: false }).limit(50),
          supabase.from("client_documents").select("*").eq("user_id", clientUserId).order("created_at", { ascending: false }).limit(50),
        ]);
        
        result = {
          ok: true,
          request_id: requestId,
          orders: clientOrders.data || [],
          billing: clientBilling.data || [],
          payments: clientPayments.data || [],
          tickets: clientTickets.data || [],
          appointments: clientAppointments.data || [],
          subscriptions: clientSubscriptions.data || [],
          documents: clientDocuments.data || [],
        };
        break;

      case "get_invoices":
        if (!hasPermission(resolvedPermissions, 'can_generate_invoices', 'can_edit_invoices', 'view_billing', 'manage_billing')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée", request_id: requestId }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: invoices } = await supabase
          .from("billing")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params?.limit || 100);
        result = { ok: true, invoices, request_id: requestId };
        break;

      case "get_technicians":
        if (!hasPermission(resolvedPermissions, 'can_view_appointments', 'view_appointments', 'can_manage_appointments', 'manage_appointments')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée", request_id: requestId }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: technicians } = await supabase
          .from("technicians")
          .select("id, full_name, email, status, specializations")
          .eq("status", "active")
          .order("full_name", { ascending: true });
        result = { ok: true, technicians, request_id: requestId };
        break;

      case "get_dashboard_stats":
        console.log(`[employee-data] get_dashboard_stats for ${employeeEmail}, permissions:`, resolvedPermissions);
        
        const canViewOrders = hasPermission(resolvedPermissions, 'can_view_orders', 'view_orders');
        const canViewAppointments = hasPermission(resolvedPermissions, 'can_view_appointments', 'view_appointments');
        const canViewTickets = hasPermission(resolvedPermissions, 'can_view_tickets', 'view_tickets');
        const canViewClients = hasPermission(resolvedPermissions, 'can_view_clients', 'view_clients');
        
        const [dashOrdersRes, dashAppointmentsRes, dashTicketsRes, dashClientsRes] = await Promise.all([
          canViewOrders 
            ? supabase.from("orders").select("id", { count: "exact", head: true }) 
            : Promise.resolve({ count: 0, error: null }),
          canViewAppointments 
            ? supabase.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_at", new Date().toISOString()) 
            : Promise.resolve({ count: 0, error: null }),
          canViewTickets 
            ? supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open") 
            : Promise.resolve({ count: 0, error: null }),
          canViewClients 
            ? supabase.from("profiles").select("id", { count: "exact", head: true }) 
            : Promise.resolve({ count: 0, error: null }),
        ]);
        
        // Log any errors
        if (dashOrdersRes.error) console.error("[employee-data] stats orders error:", dashOrdersRes.error);
        if (dashAppointmentsRes.error) console.error("[employee-data] stats appointments error:", dashAppointmentsRes.error);
        if (dashTicketsRes.error) console.error("[employee-data] stats tickets error:", dashTicketsRes.error);
        if (dashClientsRes.error) console.error("[employee-data] stats clients error:", dashClientsRes.error);
        
        result = {
          ok: true,
          request_id: requestId,
          stats: {
            orders: dashOrdersRes.count || 0,
            appointments: dashAppointmentsRes.count || 0,
            tickets: dashTicketsRes.count || 0,
            clients: dashClientsRes.count || 0,
          },
          permission_flags: {
            can_view_orders: canViewOrders,
            can_view_appointments: canViewAppointments,
            can_view_tickets: canViewTickets,
            can_view_clients: canViewClients,
          },
          resolved_permissions: resolvedPermissions,
          permission_source: resolvedPerms.source,
        };
        break;

      // ==================== WRITE OPERATIONS ====================
      case "update_order": {
        if (!hasPermission(resolvedPermissions, 'can_edit_orders_status', 'manage_orders', 'can_manage_orders')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { orderId, updates } = params;
        const { data: updatedOrder, error: updateError } = await supabase
          .from("orders")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", orderId)
          .select()
          .single();
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, order: updatedOrder, request_id: requestId };
        break;
      }

      case "update_ticket": {
        if (!hasPermission(resolvedPermissions, 'can_manage_tickets', 'manage_tickets')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { ticketId: updateTicketId, updates: ticketUpdates } = params;
        const { data: updatedTicket, error: ticketUpdateError } = await supabase
          .from("support_tickets")
          .update({ ...ticketUpdates, updated_at: new Date().toISOString() })
          .eq("id", updateTicketId)
          .select()
          .single();
        if (ticketUpdateError) {
          return new Response(JSON.stringify({ error: ticketUpdateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, ticket: updatedTicket, request_id: requestId };
        break;
      }

      case "add_ticket_reply": {
        if (!hasPermission(resolvedPermissions, 'can_view_tickets', 'view_tickets', 'can_manage_tickets', 'manage_tickets')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { ticketId: replyTicketId, content, isInternal } = params;
        const { data: newReply, error: replyError } = await supabase
          .from("ticket_replies")
          .insert({
            ticket_id: replyTicketId,
            content,
            author_id: employeeId,
            author_name: employeeName,
            author_email: employeeEmail,
            author_role: "employee",
            is_internal: isInternal || false,
          })
          .select()
          .single();
        if (replyError) {
          return new Response(JSON.stringify({ error: replyError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, reply: newReply, request_id: requestId };
        break;
      }

      case "update_client": {
        if (!hasPermission(resolvedPermissions, 'can_edit_clients', 'manage_clients', 'can_manage_clients')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { clientId, updates: clientUpdates } = params;
        const { data: updatedClient, error: clientUpdateError } = await supabase
          .from("profiles")
          .update({ ...clientUpdates, updated_at: new Date().toISOString() })
          .eq("user_id", clientId)
          .select()
          .single();
        if (clientUpdateError) {
          return new Response(JSON.stringify({ error: clientUpdateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, client: updatedClient, request_id: requestId };
        break;
      }

      case "create_appointment": {
        if (!hasPermission(resolvedPermissions, 'can_manage_appointments', 'manage_appointments')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: newAppointment, error: aptCreateError } = await supabase
          .from("appointments")
          .insert({
            ...params.appointment,
            created_by: employeeId,
          })
          .select()
          .single();
        if (aptCreateError) {
          return new Response(JSON.stringify({ error: aptCreateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, appointment: newAppointment, request_id: requestId };
        break;
      }

      case "update_appointment": {
        if (!hasPermission(resolvedPermissions, 'can_manage_appointments', 'manage_appointments')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { appointmentId, updates: aptUpdates } = params;
        const { data: updatedAppointment, error: aptUpdateError } = await supabase
          .from("appointments")
          .update({ ...aptUpdates, updated_by: employeeId, updated_at: new Date().toISOString() })
          .eq("id", appointmentId)
          .select()
          .single();
        if (aptUpdateError) {
          return new Response(JSON.stringify({ error: aptUpdateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, appointment: updatedAppointment, request_id: requestId };
        break;
      }

      case "ship_order": {
        if (!hasPermission(resolvedPermissions, 'can_ship_orders', 'manage_orders', 'can_manage_orders')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { orderId: shipOrderId, trackingNumber, trackingUrl, carrier } = params;
        const { data: shippedOrder, error: shipError } = await supabase
          .from("orders")
          .update({
            status: "shipped",
            tracking_number: trackingNumber,
            tracking_url: trackingUrl,
            carrier: carrier,
            shipped_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", shipOrderId)
          .select()
          .single();
        if (shipError) {
          return new Response(JSON.stringify({ error: shipError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, order: shippedOrder, request_id: requestId };
        break;
      }

      case "update_invoice": {
        if (!hasPermission(resolvedPermissions, 'can_edit_invoices', 'manage_billing', 'can_manage_billing')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { invoiceId, updates: invoiceUpdates } = params;
        const { data: updatedInvoice, error: invoiceUpdateError } = await supabase
          .from("billing")
          .update(invoiceUpdates)
          .eq("id", invoiceId)
          .select()
          .single();
        if (invoiceUpdateError) {
          return new Response(JSON.stringify({ error: invoiceUpdateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, invoice: updatedInvoice, request_id: requestId };
        break;
      }

      case "confirm_payment": {
        if (!hasPermission(resolvedPermissions, 'can_confirm_payments', 'manage_billing', 'can_manage_billing')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { invoiceId: paymentInvoiceId, paymentReference, amountPaid } = params;
        const { data: paidInvoice, error: paymentError } = await supabase
          .from("billing")
          .update({
            status: "paid",
            payment_reference: paymentReference,
            amount_paid: amountPaid,
            paid_at: new Date().toISOString(),
          })
          .eq("id", paymentInvoiceId)
          .select()
          .single();
        if (paymentError) {
          return new Response(JSON.stringify({ error: paymentError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, invoice: paidInvoice, request_id: requestId };
        break;
      }

      case "get_internal_tickets": {
        // Internal tickets visible to all employees
        const { data: internalTickets, error: intTicketsError, count: intTicketsCount } = await supabase
          .from("internal_tickets")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(params?.limit || 100);
          
        if (intTicketsError) {
          console.error(`[employee-data] get_internal_tickets ERROR:`, intTicketsError);
        }
        
        result = { 
          ok: true, 
          request_id: requestId,
          tickets: internalTickets || [],
          total_count: intTicketsCount || 0,
        };
        break;
      }

      case "create_internal_ticket": {
        const { subject, description, priority, category, assignedToDepartment, ccDepartments } = params;
        const { data: newIntTicket, error: intTicketError } = await supabase
          .from("internal_tickets")
          .insert({
            subject,
            description,
            priority: priority || "medium",
            category,
            assigned_to_department: assignedToDepartment,
            cc_departments: ccDepartments || [],
            created_by_id: employeeId,
            created_by_name: employeeName,
            created_by_email: employeeEmail,
            created_by_role: "employee",
            status: "open",
          })
          .select()
          .single();
        if (intTicketError) {
          return new Response(JSON.stringify({ error: intTicketError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, ticket: newIntTicket, request_id: requestId };
        break;
      }

      case "update_internal_ticket": {
        const { ticketId: intTicketId, updates: intTicketUpdates } = params;
        const { data: updatedIntTicket, error: intTicketUpdateError } = await supabase
          .from("internal_tickets")
          .update({ ...intTicketUpdates, updated_at: new Date().toISOString() })
          .eq("id", intTicketId)
          .select()
          .single();
        if (intTicketUpdateError) {
          return new Response(JSON.stringify({ error: intTicketUpdateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, ticket: updatedIntTicket, request_id: requestId };
        break;
      }

      case "get_internal_ticket_replies": {
        const { data: intReplies } = await supabase
          .from("internal_ticket_replies")
          .select("*")
          .eq("ticket_id", params.ticketId)
          .order("created_at", { ascending: true });
        result = { ok: true, replies: intReplies || [], request_id: requestId };
        break;
      }

      case "add_internal_ticket_reply": {
        const { ticketId: intReplyTicketId, content: intReplyContent, isInternalNote } = params;
        const { data: newIntReply, error: intReplyError } = await supabase
          .from("internal_ticket_replies")
          .insert({
            ticket_id: intReplyTicketId,
            content: intReplyContent,
            author_id: employeeId,
            author_name: employeeName,
            author_email: employeeEmail,
            author_role: "employee",
            is_internal_note: isInternalNote || false,
          })
          .select()
          .single();
        if (intReplyError) {
          return new Response(JSON.stringify({ error: intReplyError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, reply: newIntReply, request_id: requestId };
        break;
      }

      case "get_streaming_subscriptions": {
        if (!hasPermission(resolvedPermissions, 'manage_streaming', 'can_manage_streaming')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: subscriptions, count: subsCount } = await supabase
          .from("client_streaming_subscriptions")
          .select("*, streaming_services(*)", { count: "exact" })
          .order("created_at", { ascending: false })
          .limit(params?.limit || 200);
        result = { ok: true, subscriptions: subscriptions || [], total_count: subsCount || 0, request_id: requestId };
        break;
      }

      case "update_streaming_subscription": {
        if (!hasPermission(resolvedPermissions, 'manage_streaming', 'can_manage_streaming')) {
          return new Response(JSON.stringify({ ok: false, error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { subscriptionId, updates: subUpdates } = params;
        const { data: updatedSub, error: subUpdateError } = await supabase
          .from("client_streaming_subscriptions")
          .update({ ...subUpdates, updated_at: new Date().toISOString() })
          .eq("id", subscriptionId)
          .select()
          .single();
        if (subUpdateError) {
          return new Response(JSON.stringify({ error: subUpdateError.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        result = { ok: true, subscription: updatedSub, request_id: requestId };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ ok: false, error: "Action non reconnue", request_id: requestId }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[employee-data] Unexpected error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Erreur inattendue. Veuillez réessayer.", request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
