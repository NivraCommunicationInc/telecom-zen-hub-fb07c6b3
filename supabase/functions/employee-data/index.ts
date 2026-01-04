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

// Resolve permissions with server-side fallback
async function resolvePermissions(
  supabase: any,
  tokenPermissions: any,
  employeeId: string,
  employeeEmail: string
): Promise<{ permissions: Record<string, boolean>; source: string; role: string; status: string }> {
  // If token has permissions, use them
  if (tokenPermissions && typeof tokenPermissions === 'object' && Object.keys(tokenPermissions).length > 0) {
    return { 
      permissions: tokenPermissions, 
      source: "token", 
      role: "employee",
      status: "active"
    };
  }

  console.log(`[resolvePermissions] Token permissions empty, fetching from DB for ${employeeEmail}`);

  // Fallback 1: Try employees table
  const { data: employee } = await supabase
    .from("employees")
    .select("permissions_json, role, is_active")
    .ilike("email", employeeEmail)
    .maybeSingle();

  if (employee?.permissions_json && Object.keys(employee.permissions_json).length > 0) {
    return { 
      permissions: employee.permissions_json, 
      source: "employees_table", 
      role: employee.role || "employee",
      status: employee.is_active ? "active" : "disabled"
    };
  }

  // Fallback 2: Try user_roles table via profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("email", employeeEmail)
    .maybeSingle();

  if (profile?.user_id) {
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("permissions, role, status")
      .eq("user_id", profile.user_id)
      .eq("role", "employee")
      .maybeSingle();

    if (userRole?.permissions) {
      return { 
        permissions: userRole.permissions, 
        source: "user_roles_table", 
        role: userRole.role,
        status: userRole.status || "active"
      };
    }
  }

  // Default minimal permissions for employee if nothing found
  console.log(`[resolvePermissions] No permissions found, using default employee permissions`);
  return { 
    permissions: {
      can_view_orders: true,
      can_view_clients: true,
      can_view_tickets: true,
      can_view_appointments: true,
    }, 
    source: "default_employee", 
    role: "employee",
    status: "active"
  };
}

// Return structured 403 response
function forbidden(corsHeaders: Record<string, string>, requestId: string, neededPermission: string, resolvedPerms: any) {
  return new Response(
    JSON.stringify({
      ok: false,
      request_id: requestId,
      reason: "not_allowed",
      needed_permission: neededPermission,
      message: `Permission requise: ${neededPermission}`,
      resolved_permissions: resolvedPerms.permissions,
      permission_source: resolvedPerms.source,
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
      // ==================== READ OPERATIONS ====================
      case "get_orders": {
        // Check view permission
        if (!resolvedPermissions?.can_view_orders && !resolvedPermissions?.manage_orders) {
          console.log(`[employee-data] get_orders DENIED for ${employeeEmail}`);
          return forbidden(corsHeaders, requestId, "can_view_orders", resolvedPerms);
        }
        
        // Build query with appropriate filters
        let query = supabase.from("orders").select("*", { count: "exact" });
        
        // If manage_orders = true -> all orders, otherwise filter by assigned/created
        const hasManageOrders = resolvedPermissions?.manage_orders === true || 
                                resolvedPermissions?.can_manage_orders === true;
        
        let appliedFilters: string[] = [];
        
        if (!hasManageOrders) {
          // Try to filter by created_by or processed_by (employee's orders)
          // Note: We return all for now since there's no clear "assigned_to" for orders
          // In real implementation, you'd filter by created_by matching employee ID
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
          resolved_permissions: resolvedPermissions,
          applied_filters: appliedFilters,
        };
        break;
      }

      case "get_appointments": {
        if (!resolvedPermissions?.can_view_appointments && !resolvedPermissions?.manage_appointments) {
          return forbidden(corsHeaders, requestId, "can_view_appointments", resolvedPerms);
        }
        
        const hasManageAppointments = resolvedPermissions?.manage_appointments === true || 
                                      resolvedPermissions?.can_manage_appointments === true;
        let aptFilters: string[] = [];
        
        const { data: appointments, count: appointmentsCount } = await supabase
          .from("appointments")
          .select("*, technicians(id, full_name, email)", { count: "exact" })
          .order("scheduled_at", { ascending: true })
          .limit(params?.limit || 300);
        
        aptFilters.push(hasManageAppointments ? "manage_all" : "view_only");
        
        result = { 
          ok: true,
          request_id: requestId,
          appointments: appointments || [],
          total_count: appointmentsCount || 0,
          resolved_permissions: resolvedPermissions,
          applied_filters: aptFilters,
        };
        break;
      }

      case "get_tickets": {
        if (!resolvedPermissions?.can_view_tickets && !resolvedPermissions?.manage_tickets) {
          console.log(`[employee-data] get_tickets DENIED for ${employeeEmail}`);
          return forbidden(corsHeaders, requestId, "can_view_tickets", resolvedPerms);
        }
        
        const hasManageTickets = resolvedPermissions?.manage_tickets === true || 
                                 resolvedPermissions?.can_manage_tickets === true;
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
          resolved_permissions: resolvedPermissions,
          applied_filters: ticketFilters,
        };
        break;
      }

      case "get_ticket_replies": {
        if (!resolvedPermissions?.can_view_tickets && !resolvedPermissions?.manage_tickets) {
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
        if (!resolvedPermissions?.can_view_clients && !resolvedPermissions?.manage_clients) {
          console.log(`[employee-data] get_clients DENIED for ${employeeEmail}`);
          return forbidden(corsHeaders, requestId, "can_view_clients", resolvedPerms);
        }
        
        const hasManageClients = resolvedPermissions?.manage_clients === true || 
                                 resolvedPermissions?.can_manage_clients === true;
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
          resolved_permissions: resolvedPermissions,
          applied_filters: clientFilters,
        };
        break;
      }

      case "get_client_details":
        if (!resolvedPermissions?.can_view_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
        if (!resolvedPermissions?.can_generate_invoices && !resolvedPermissions?.can_edit_invoices) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: invoices } = await supabase
          .from("billing")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params?.limit || 100);
        result = { invoices };
        break;

      case "get_technicians":
        if (!resolvedPermissions?.can_view_appointments && !resolvedPermissions?.can_manage_appointments) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: technicians } = await supabase
          .from("technicians")
          .select("id, full_name, email, status, specializations")
          .eq("status", "active")
          .order("full_name", { ascending: true });
        result = { technicians };
        break;

      case "get_dashboard_stats":
        console.log(`[employee-data] get_dashboard_stats for ${employeeEmail}, permissions:`, resolvedPermissions);
        const [dashOrdersRes, dashAppointmentsRes, dashTicketsRes, dashClientsRes] = await Promise.all([
          resolvedPermissions?.can_view_orders 
            ? supabase.from("orders").select("id", { count: "exact", head: true }) 
            : Promise.resolve({ count: 0, error: null }),
          resolvedPermissions?.can_view_appointments 
            ? supabase.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_at", new Date().toISOString()) 
            : Promise.resolve({ count: 0, error: null }),
          resolvedPermissions?.can_view_tickets 
            ? supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open") 
            : Promise.resolve({ count: 0, error: null }),
          resolvedPermissions?.can_view_clients 
            ? supabase.from("profiles").select("id", { count: "exact", head: true }) 
            : Promise.resolve({ count: 0, error: null }),
        ]);
        
        // Log any errors
        if (dashOrdersRes.error) console.error("[employee-data] stats orders error:", dashOrdersRes.error);
        if (dashAppointmentsRes.error) console.error("[employee-data] stats appointments error:", dashAppointmentsRes.error);
        if (dashTicketsRes.error) console.error("[employee-data] stats tickets error:", dashTicketsRes.error);
        if (dashClientsRes.error) console.error("[employee-data] stats clients error:", dashClientsRes.error);
        
        const statsResult = {
          orders: dashOrdersRes.count || 0,
          upcomingAppointments: dashAppointmentsRes.count || 0,
          openTickets: dashTicketsRes.count || 0,
          totalClients: dashClientsRes.count || 0,
        };
        console.log(`[employee-data] get_dashboard_stats result:`, statsResult);
        result = { stats: statsResult };
        break;

      // ==================== ORDER OPERATIONS ====================
      case "update_order_status":
        if (!resolvedPermissions?.can_edit_orders_status) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: orderStatusError } = await supabase
          .from("orders")
          .update({ status: params.status, updated_at: new Date().toISOString() })
          .eq("id", params.orderId);
        if (orderStatusError) throw orderStatusError;
        result = { success: true };
        break;

      case "update_order":
        if (!resolvedPermissions?.can_edit_orders_status && !resolvedPermissions?.can_ship_orders) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ ...params.updates, updated_at: new Date().toISOString() })
          .eq("id", params.orderId);
        if (orderUpdateError) throw orderUpdateError;
        result = { success: true };
        break;

      case "update_order_payment":
        if (!resolvedPermissions?.can_confirm_payments) {
          return new Response(JSON.stringify({ error: "Permission refusée pour confirmer les paiements" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: paymentUpdateError } = await supabase
          .from("orders")
          .update({
            payment_status: params.payment_status,
            payment_reference: params.payment_reference,
            amount_paid: params.amount_paid,
            updated_at: new Date().toISOString()
          })
          .eq("id", params.orderId);
        if (paymentUpdateError) throw paymentUpdateError;
        result = { success: true };
        break;

      case "verify_order_identity":
        if (!resolvedPermissions?.can_edit_orders_status) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: verifyIdError } = await supabase
          .from("orders")
          .update({
            id_verification_status: params.status,
            id_verification_notes: params.notes,
            id_verified_at: new Date().toISOString(),
            id_verified_by: employeeId,
            updated_at: new Date().toISOString()
          })
          .eq("id", params.orderId);
        if (verifyIdError) throw verifyIdError;
        result = { success: true };
        break;

      case "create_order":
        if (!resolvedPermissions?.can_view_orders) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: newOrder, error: createOrderError } = await supabase
          .from("orders")
          .insert({
            user_id: params.user_id,
            client_email: params.client_email,
            service_type: params.service_type,
            category: params.category,
            subtotal: params.subtotal || 0,
            status: params.status || "pending",
            created_by: "employee",
            notes: params.notes,
            internal_notes: `Créé par ${employeeName} (${employeeEmail}) le ${new Date().toLocaleDateString("fr-CA")}`
          })
          .select()
          .single();
        if (createOrderError) throw createOrderError;
        result = { order: newOrder };
        break;

      case "assign_technician_to_order":
        if (!resolvedPermissions?.can_manage_appointments) {
          return new Response(JSON.stringify({ error: "Permission refusée pour assigner un technicien" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: assignTechOrderError } = await supabase
          .from("orders")
          .update({
            technician_id: params.technician_id || null,
            updated_at: new Date().toISOString()
          })
          .eq("id", params.orderId);
        if (assignTechOrderError) throw assignTechOrderError;
        
        if (params.technician_id) {
          const { data: existingWO } = await supabase
            .from("work_orders")
            .select("id")
            .eq("linked_order_id", params.orderId)
            .maybeSingle();
          
          if (existingWO) {
            await supabase
              .from("work_orders")
              .update({
                assigned_technician_id: params.technician_id,
                status: "assigned",
                assigned_at: new Date().toISOString(),
                assigned_by: employeeName,
                updated_at: new Date().toISOString()
              })
              .eq("id", existingWO.id);
          }
        }
        result = { success: true };
        break;

      case "update_appointment":
        if (!resolvedPermissions?.can_manage_appointments) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: aptError } = await supabase
          .from("appointments")
          .update({ ...params.updates, updated_at: new Date().toISOString(), updated_by: employeeId })
          .eq("id", params.appointmentId);
        if (aptError) throw aptError;
        result = { success: true };
        break;

      case "assign_technician":
        if (!resolvedPermissions?.can_manage_appointments) {
          return new Response(JSON.stringify({ error: "Permission refusée pour assigner un technicien" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        const { error: assignAptError } = await supabase
          .from("appointments")
          .update({
            technician_id: params.technician_id,
            status: params.technician_id ? "technician_assigned" : "scheduled",
            updated_at: new Date().toISOString(),
            updated_by: employeeId
          })
          .eq("id", params.appointmentId);
        if (assignAptError) throw assignAptError;
        
        if (params.technician_id && params.order_id) {
          const { data: existingWO } = await supabase
            .from("work_orders")
            .select("id")
            .eq("linked_appointment_id", params.appointmentId)
            .maybeSingle();
          
          if (existingWO) {
            await supabase
              .from("work_orders")
              .update({
                assigned_technician_id: params.technician_id,
                status: "assigned",
                updated_at: new Date().toISOString()
              })
              .eq("id", existingWO.id);
          } else {
            await supabase.from("work_orders").insert({
              order_id: params.order_id,
              appointment_id: params.appointmentId,
              assigned_technician_id: params.technician_id,
              work_type: "installation",
              status: "assigned",
              priority: "normal",
              client_email: params.client_email,
              service_address: params.service_address
            });
          }
        }
        result = { success: true };
        break;

      case "create_appointment":
        if (!resolvedPermissions?.can_manage_appointments) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: newApt, error: createAptError } = await supabase
          .from("appointments")
          .insert({
            client_id: params.client_id,
            client_email: params.client_email,
            client_phone: params.client_phone,
            title: params.title,
            description: params.description,
            scheduled_at: params.scheduled_at,
            status: "scheduled",
            service_type: params.service_type,
            service_address: params.service_address,
            service_city: params.service_city,
            service_postal_code: params.service_postal_code,
            order_id: params.order_id,
            created_by: employeeId,
            internal_notes: `Créé par ${employeeName} le ${new Date().toLocaleDateString("fr-CA")}`
          })
          .select()
          .single();
        if (createAptError) throw createAptError;
        result = { appointment: newApt };
        break;

      // ==================== TICKET OPERATIONS ====================
      case "update_ticket":
        if (!resolvedPermissions?.can_manage_tickets) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: ticketError } = await supabase
          .from("support_tickets")
          .update({ ...params.updates, updated_at: new Date().toISOString() })
          .eq("id", params.ticketId);
        if (ticketError) throw ticketError;
        result = { success: true };
        break;

      case "add_ticket_reply":
        if (!resolvedPermissions?.can_manage_tickets) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: newReply, error: replyError } = await supabase
          .from("ticket_replies")
          .insert({
            ticket_id: params.ticketId,
            content: params.content,
            author_id: employeeId,
            author_name: employeeName,
            author_email: employeeEmail,
            author_role: "employee",
            is_internal_note: params.is_internal_note || false,
          })
          .select()
          .single();
        if (replyError) throw replyError;
        
        await supabase
          .from("support_tickets")
          .update({ updated_at: new Date().toISOString(), status: params.newStatus || "in_progress" })
          .eq("id", params.ticketId);
        
        result = { reply: newReply };
        break;

      // ==================== INVOICE OPERATIONS ====================
      case "update_invoice":
        if (!resolvedPermissions?.can_edit_invoices) {
          return new Response(JSON.stringify({ error: "Permission refusée pour modifier les factures" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: invoiceUpdateError } = await supabase
          .from("billing")
          .update(params.updates)
          .eq("id", params.invoiceId);
        if (invoiceUpdateError) throw invoiceUpdateError;
        result = { success: true };
        break;

      case "confirm_payment":
        if (!resolvedPermissions?.can_confirm_payments) {
          return new Response(JSON.stringify({ error: "Permission refusée pour confirmer les paiements" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: confirmPaymentError } = await supabase
          .from("billing")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            amount_paid: params.amount_paid,
            payment_reference: params.payment_reference,
          })
          .eq("id", params.invoiceId);
        if (confirmPaymentError) throw confirmPaymentError;
        result = { success: true };
        break;

      // ==================== CLIENT OPERATIONS ====================
      case "update_client":
        if (!resolvedPermissions?.can_edit_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée pour modifier les clients" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: clientUpdateError } = await supabase
          .from("profiles")
          .update(params.updates)
          .eq("user_id", params.userId);
        if (clientUpdateError) throw clientUpdateError;
        result = { success: true };
        break;

      // ==================== STREAMING OPERATIONS ====================
      case "get_streaming_subscriptions":
        if (!resolvedPermissions?.can_view_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: streamingSubs } = await supabase
          .from("client_streaming_subscriptions")
          .select("*, streaming_services(*)")
          .order("created_at", { ascending: false })
          .limit(params?.limit || 100);
        result = { subscriptions: streamingSubs };
        break;

      case "get_streaming_services":
        const { data: streamingServices } = await supabase
          .from("streaming_services")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true });
        result = { services: streamingServices };
        break;

      case "update_streaming_subscription":
        if (!resolvedPermissions?.can_edit_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: streamingUpdateError } = await supabase
          .from("client_streaming_subscriptions")
          .update({
            ...params.updates,
            updated_at: new Date().toISOString()
          })
          .eq("id", params.subscriptionId);
        if (streamingUpdateError) throw streamingUpdateError;
        result = { success: true };
        break;

      case "create_streaming_subscription":
        if (!resolvedPermissions?.can_edit_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: newStreamingSub, error: streamingCreateError } = await supabase
          .from("client_streaming_subscriptions")
          .insert({
            user_id: params.user_id,
            streaming_service_id: params.streaming_service_id,
            status: params.status || "pending",
            monthly_price: params.monthly_price,
            start_date: params.start_date || new Date().toISOString().split('T')[0],
            internal_notes: `Créé par ${employeeName} le ${new Date().toLocaleDateString("fr-CA")}`
          })
          .select("*, streaming_services(*)")
          .single();
        if (streamingCreateError) throw streamingCreateError;
        result = { subscription: newStreamingSub };
        break;

      // ==================== SYSTEM STATUS ====================
      case "get_system_status":
        const { data: statusData } = await supabase
          .from("system_status")
          .select("*")
          .single();
        result = { status: statusData };
        break;

      // ==================== DIAGNOSTIC / DEBUG ====================
      case "diagnostic_visibility_test":
        console.log(`[employee-data] Running diagnostic_visibility_test for ${employeeEmail}`);
        
        // Get raw counts from database using service role (no RLS)
        const [diagOrders, diagTickets, diagClients, diagAppointments] = await Promise.all([
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase.from("support_tickets").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("appointments").select("id", { count: "exact", head: true }),
        ]);
        
        const diagResult = {
          timestamp: new Date().toISOString(),
          employee: { id: employeeId, email: employeeEmail, name: employeeName },
          permissions: resolvedPermissions,
          counts: {
            orders: { total: diagOrders.count || 0, error: diagOrders.error?.message || null },
            tickets: { total: diagTickets.count || 0, error: diagTickets.error?.message || null },
            clients: { total: diagClients.count || 0, error: diagClients.error?.message || null },
            appointments: { total: diagAppointments.count || 0, error: diagAppointments.error?.message || null },
          }
        };
        
        console.log(`[employee-data] diagnostic_visibility_test result:`, diagResult);
        
        // Log to admin_audit_log if params.log_to_audit is true
        if (params?.log_to_audit) {
          await supabase.from("admin_audit_log").insert({
            admin_user_id: employeeId,
            admin_email: employeeEmail,
            action: "employee_visibility_diagnostic",
            details: diagResult,
          });
        }
        
        result = { diagnostic: diagResult };
        break;

      default:
        return new Response(JSON.stringify({ error: "Action non reconnue" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("[employee-data] Error:", error);
    const message = error instanceof Error ? error.message : "Erreur inattendue";
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
