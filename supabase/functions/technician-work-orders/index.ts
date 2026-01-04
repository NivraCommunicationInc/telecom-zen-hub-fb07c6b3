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

// Normalize permissions to handle both formats
function normalizePermissions(perms: Record<string, boolean>): Record<string, boolean> {
  if (!perms || typeof perms !== 'object') return {};
  
  const normalized: Record<string, boolean> = {};
  
  for (const [key, value] of Object.entries(perms)) {
    normalized[key] = value === true;
    
    if (key.startsWith('can_')) {
      const withoutCan = key.replace('can_', '');
      normalized[withoutCan] = value === true;
    } else {
      normalized[`can_${key}`] = value === true;
    }
  }
  
  return normalized;
}

// Check if user has permission
function hasPermission(perms: Record<string, boolean>, ...keys: string[]): boolean {
  if (!perms) return false;
  return keys.some(key => perms[key] === true);
}

// Resolve technician identity and permissions from DB
async function resolveTechnicianInfo(
  supabase: any,
  technicianId: string,
  technicianEmail: string
): Promise<{ 
  permissions: Record<string, boolean>; 
  source: string; 
  status: string;
  technicianDbId: string | null;
  authUserId: string | null;
}> {
  console.log(`[resolveTechnicianInfo] Resolving for email=${technicianEmail}, tokenId=${technicianId}`);

  // Step 1: Find technician row by email
  const { data: technician, error: techError } = await supabase
    .from("technicians")
    .select("id, user_id, email, status")
    .ilike("email", technicianEmail)
    .maybeSingle();

  if (techError) {
    console.error(`[resolveTechnicianInfo] technicians query error:`, techError);
  }

  let technicianDbId = technician?.id || null;
  let authUserId = technician?.user_id || null;
  const techStatus = technician?.status || "unknown";

  console.log(`[resolveTechnicianInfo] technicians table: id=${technicianDbId}, user_id=${authUserId}, status=${techStatus}`);

  // Step 2: Find profile to get auth user_id if not in technicians table
  if (!authUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("email", technicianEmail)
      .maybeSingle();
    
    if (profile?.user_id) {
      authUserId = profile.user_id;
      console.log(`[resolveTechnicianInfo] Found auth user_id from profiles: ${authUserId}`);
    }
  }

  // Step 3: Get permissions from user_roles (SINGLE SOURCE OF TRUTH)
  if (authUserId) {
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("permissions, role, status, is_active")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (roleError) {
      console.error(`[resolveTechnicianInfo] user_roles query error:`, roleError);
    }

    if (userRole) {
      const isActive = userRole.is_active !== false && userRole.status !== 'disabled' && userRole.status !== 'hold';
      console.log(`[resolveTechnicianInfo] user_roles: role=${userRole.role}, status=${userRole.status}`);
      console.log(`[resolveTechnicianInfo] permissions:`, JSON.stringify(userRole.permissions));
      
      return { 
        permissions: normalizePermissions(userRole.permissions || {}), 
        source: "user_roles_table",
        status: isActive ? "active" : (userRole.status || techStatus),
        technicianDbId,
        authUserId,
      };
    }
  }

  // No user_roles found - use empty permissions
  console.log(`[resolveTechnicianInfo] No user_roles found - returning empty permissions`);
  return { 
    permissions: {}, 
    source: "no_user_roles",
    status: techStatus,
    technicianDbId,
    authUserId,
  };
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

    const { technicianId: tokenTechId, fullName, email: technicianEmail, permissions: tokenPermissions } = verification.payload;
    console.log(`[technician-work-orders] RequestID: ${requestId} | Technician: ${fullName} (${technicianEmail})`);
    
    // Use SERVICE ROLE KEY to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve technician info and permissions from DB
    const techInfo = await resolveTechnicianInfo(supabase, tokenTechId, technicianEmail || '');
    const resolvedPermissions = techInfo.permissions;
    
    console.log(`[technician-work-orders] Resolved: technicianDbId=${techInfo.technicianDbId}, authUserId=${techInfo.authUserId}`);
    console.log(`[technician-work-orders] Permissions source: ${techInfo.source} | Status: ${techInfo.status}`);
    console.log(`[technician-work-orders] Resolved permissions:`, JSON.stringify(resolvedPermissions));

    // Check status
    if (techInfo.status === "disabled" || techInfo.status === "hold" || techInfo.status === "inactive") {
      return new Response(
        JSON.stringify({ 
          ok: false, 
          request_id: requestId, 
          reason: `status_${techInfo.status}`,
          message: "Compte désactivé ou suspendu"
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check view appointments permission
    if (!hasPermission(resolvedPermissions, 'can_view_appointments', 'view_appointments')) {
      console.log(`[technician-work-orders] DENIED - no view_appointments permission`);
      return forbidden(corsHeaders, requestId, "can_view_appointments", { permissions: resolvedPermissions, source: techInfo.source }, ["permission_denied"]);
    }

    // Track applied filters
    const appliedFilters: string[] = [];
    
    // Determine technician ID to filter by
    // Priority: technicians.id from DB > token technicianId
    const techIdToFilter = techInfo.technicianDbId || tokenTechId;
    
    if (!techIdToFilter) {
      console.log(`[technician-work-orders] No technician ID found for filtering`);
      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          request_id: requestId,
          technicianId: tokenTechId,
          technicianName: fullName,
          current: [],
          history: [],
          counts: { total: 0, current: 0, history: 0 },
          db_counts: { work_orders: 0, orders: 0, appointments: 0 },
          applied_filters: ["no_technician_id_found"],
          resolved_permissions: resolvedPermissions,
          permission_source: techInfo.source,
          message: "Aucun ID technicien trouvé - impossible de filtrer les rendez-vous",
          assignment_field_used: "none",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[technician-work-orders] Filtering by technician ID: ${techIdToFilter}`);
    appliedFilters.push(`technician_id=${techIdToFilter}`);

    // Fetch work orders assigned to this technician
    const { data: workOrders, error: woError, count: woCount } = await supabase
      .from("work_orders")
      .select("*", { count: "exact" })
      .eq("assigned_technician_id", techIdToFilter)
      .order("scheduled_start", { ascending: true, nullsFirst: false });

    if (woError) {
      console.error("[technician-work-orders] work_orders query error:", woError);
    }
    appliedFilters.push("work_orders.assigned_technician_id");

    console.log(`[technician-work-orders] work_orders found: ${workOrders?.length || 0} (total matching: ${woCount})`);

    // Fetch legacy orders assigned to technician
    const { data: legacyOrders, error: ordersError, count: ordersCount } = await supabase
      .from("orders")
      .select("*", { count: "exact" })
      .eq("technician_id", techIdToFilter)
      .order("appointment_date", { ascending: true, nullsFirst: false });

    if (ordersError) {
      console.error("[technician-work-orders] orders query error:", ordersError);
    }
    appliedFilters.push("orders.technician_id");

    console.log(`[technician-work-orders] legacy orders found: ${legacyOrders?.length || 0} (total matching: ${ordersCount})`);

    // Fetch appointments assigned to technician
    const { data: legacyAppointments, error: aptsError, count: aptsCount } = await supabase
      .from("appointments")
      .select("*", { count: "exact" })
      .eq("technician_id", techIdToFilter)
      .order("scheduled_at", { ascending: true });

    if (aptsError) {
      console.error("[technician-work-orders] appointments query error:", aptsError);
    }
    appliedFilters.push("appointments.technician_id");

    console.log(`[technician-work-orders] legacy appointments found: ${legacyAppointments?.length || 0} (total matching: ${aptsCount})`);

    const orders = legacyOrders || [];
    const appointments = legacyAppointments || [];
    
    // Get client profiles for display
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

    // Build response with explicit message if no assignments found
    const hasNoAssignments = allWorkOrders.length === 0;
    
    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        request_id: requestId,
        technicianId: techIdToFilter,
        technicianDbId: techInfo.technicianDbId,
        authUserId: techInfo.authUserId,
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
        db_counts: {
          work_orders: woCount || 0,
          orders: ordersCount || 0,
          appointments: aptsCount || 0,
        },
        applied_filters: appliedFilters,
        resolved_permissions: resolvedPermissions,
        permission_source: techInfo.source,
        assignment_field_used: "technician_id (all tables)",
        message: hasNoAssignments ? "Aucun rendez-vous assigné à ce technicien" : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[technician-work-orders] Unexpected error:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ ok: false, error: "Erreur inattendue. Veuillez réessayer.", request_id: requestId }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
