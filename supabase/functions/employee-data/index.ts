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

    const { employeeId, fullName: employeeName, email: employeeEmail, permissions } = verification.payload;
    const { action, params } = await req.json();
    
    console.log(`[employee-data] Action: ${action} for employee: ${employeeId} (${employeeName})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let result: any = null;

    switch (action) {
      // ==================== READ OPERATIONS ====================
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
          .select("*, technicians(id, full_name, email)")
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

      case "get_ticket_replies":
        if (!permissions?.can_view_tickets) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: replies } = await supabase
          .from("ticket_replies")
          .select("*")
          .eq("ticket_id", params.ticketId)
          .order("created_at", { ascending: true });
        result = { replies };
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

      case "get_client_details":
        if (!permissions?.can_view_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const clientUserId = params.userId;
        const clientEmail = params.email;
        
        // Fetch all client-related data in parallel
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
        if (!permissions?.can_generate_invoices && !permissions?.can_edit_invoices) {
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
        if (!permissions?.can_view_appointments && !permissions?.can_manage_appointments) {
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

      // ==================== ORDER OPERATIONS ====================
      case "update_order_status":
        if (!permissions?.can_edit_orders_status) {
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
        if (!permissions?.can_edit_orders_status && !permissions?.can_ship_orders) {
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
        if (!permissions?.can_confirm_payments) {
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
        if (!permissions?.can_edit_orders_status) {
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
        if (!permissions?.can_view_orders) {
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
        if (!permissions?.can_manage_appointments) {
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
        
        // Also create/update work order if technician is assigned
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
        if (!permissions?.can_manage_appointments) {
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
        if (!permissions?.can_manage_appointments) {
          return new Response(JSON.stringify({ error: "Permission refusée pour assigner un technicien" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        // Update appointment
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
        
        // Create or update work order if technician assigned
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
        if (!permissions?.can_manage_appointments) {
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
            service_type: params.service_type,
            service_address: params.service_address,
            service_city: params.service_city,
            service_postal_code: params.service_postal_code,
            status: "scheduled",
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

      case "add_ticket_reply":
        if (!permissions?.can_manage_tickets) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        // Get ticket to find user_id for the reply
        const { data: ticketData } = await supabase
          .from("support_tickets")
          .select("user_id")
          .eq("id", params.ticketId)
          .single();
        
        const { data: newReply, error: replyError } = await supabase
          .from("ticket_replies")
          .insert({
            ticket_id: params.ticketId,
            user_id: ticketData?.user_id || employeeId,
            content: params.content,
            is_admin: true
          })
          .select()
          .single();
        if (replyError) throw replyError;
        
        // Update ticket status to in_progress if open
        await supabase
          .from("support_tickets")
          .update({ 
            status: params.newStatus || "in_progress", 
            updated_at: new Date().toISOString() 
          })
          .eq("id", params.ticketId)
          .eq("status", "open");
        
        result = { reply: newReply };
        break;

      // ==================== CLIENT OPERATIONS ====================
      case "update_client":
        if (!permissions?.can_edit_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée pour modifier les clients" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: clientUpdateError } = await supabase
          .from("profiles")
          .update({ ...params.updates, updated_at: new Date().toISOString() })
          .eq("id", params.clientId);
        if (clientUpdateError) throw clientUpdateError;
        result = { success: true };
        break;

      case "update_client_status":
        if (!permissions?.can_edit_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: clientStatusError } = await supabase
          .from("profiles")
          .update({ 
            account_status: params.status, 
            updated_at: new Date().toISOString(),
            internal_notes: params.append_note 
              ? (params.existing_notes ? `${params.existing_notes}\n\n[${new Date().toLocaleDateString("fr-CA")}] ${params.append_note}` : `[${new Date().toLocaleDateString("fr-CA")}] ${params.append_note}`)
              : undefined
          })
          .eq("id", params.clientId);
        if (clientStatusError) throw clientStatusError;
        result = { success: true };
        break;

      case "verify_client_identity":
        if (!permissions?.can_edit_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: verifyClientIdError } = await supabase
          .from("profiles")
          .update({
            id_type: params.id_type,
            id_number: params.id_number,
            id_province: params.id_province,
            id_expiration: params.id_expiration,
            updated_at: new Date().toISOString()
          })
          .eq("id", params.clientId);
        if (verifyClientIdError) throw verifyClientIdError;
        result = { success: true };
        break;

      case "create_client_profile":
        if (!permissions?.can_edit_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée pour créer des clients" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        // Generate a placeholder user_id for manual client entries
        const placeholderId = crypto.randomUUID();
        
        const { data: newProfile, error: createProfileError } = await supabase
          .from("profiles")
          .insert({
            user_id: placeholderId,
            email: params.email,
            first_name: params.first_name,
            last_name: params.last_name,
            full_name: `${params.first_name} ${params.last_name}`.trim(),
            phone: params.phone,
            date_of_birth: params.date_of_birth,
            service_address: params.service_address,
            service_city: params.service_city,
            service_postal_code: params.service_postal_code,
            service_province: params.service_province || "QC",
            account_status: "pending",
            internal_notes: `Client créé manuellement par ${employeeName} (${employeeEmail}) le ${new Date().toLocaleDateString("fr-CA")}`
          })
          .select()
          .single();
        if (createProfileError) throw createProfileError;
        result = { client: newProfile };
        break;

      case "adjust_client_balance":
        if (!permissions?.can_edit_clients) {
          return new Response(JSON.stringify({ error: "Permission refusée pour modifier le solde" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        // Get current value
        const { data: currentProfile, error: fetchBalanceError } = await supabase
          .from("profiles")
          .select(params.field)
          .eq("id", params.clientId)
          .single();
        if (fetchBalanceError) throw fetchBalanceError;
        
        const currentValue = Number(currentProfile?.[params.field] || 0);
        const newBalanceValue = params.operation === 'add' 
          ? currentValue + params.amount 
          : Math.max(0, currentValue - params.amount);
        
        const { error: updateBalanceError } = await supabase
          .from("profiles")
          .update({ 
            [params.field]: newBalanceValue,
            updated_at: new Date().toISOString() 
          })
          .eq("id", params.clientId);
        if (updateBalanceError) throw updateBalanceError;
        
        result = { success: true, newValue: newBalanceValue };
        break;

      // ==================== INVOICE/BILLING OPERATIONS ====================
      case "create_invoice":
        if (!permissions?.can_generate_invoices) {
          return new Response(JSON.stringify({ error: "Permission refusée pour créer des factures" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: newInvoice, error: createInvoiceError } = await supabase
          .from("billing")
          .insert({
            user_id: params.user_id,
            client_email: params.client_email,
            subtotal: params.subtotal,
            amount: params.subtotal, // Will be recalculated by trigger
            delivery_fee: params.delivery_fee || 0,
            activation_fee: params.activation_fee || 0,
            installation_fee: params.installation_fee || 0,
            due_date: params.due_date,
            notes: params.notes ? `${params.notes}\n\nCréé par ${employeeName} (${employeeEmail})` : `Créé par ${employeeName} (${employeeEmail})`,
            status: "pending"
          })
          .select()
          .single();
        if (createInvoiceError) throw createInvoiceError;
        result = { invoice: newInvoice };
        break;

      case "update_invoice":
        if (!permissions?.can_edit_invoices) {
          return new Response(JSON.stringify({ error: "Permission refusée pour modifier les factures" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { error: invoiceUpdateError } = await supabase
          .from("billing")
          .update({ ...params.updates })
          .eq("id", params.invoiceId);
        if (invoiceUpdateError) throw invoiceUpdateError;
        result = { success: true };
        break;

      case "record_payment":
        if (!permissions?.can_confirm_payments) {
          return new Response(JSON.stringify({ error: "Permission refusée pour enregistrer les paiements" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        // Create payment record
        const { data: payment, error: paymentError } = await supabase
          .from("payments")
          .insert({
            user_id: params.user_id,
            billing_id: params.billing_id,
            amount: params.amount,
            payment_method: params.payment_method,
            payment_reference: params.payment_reference,
            card_last_four: params.card_last_four,
            card_type: params.card_type,
            notes: params.notes,
            received_by: employeeName,
            status: "completed"
          })
          .select()
          .single();
        if (paymentError) throw paymentError;
        
        // Update billing status
        if (params.billing_id) {
          await supabase
            .from("billing")
            .update({ 
              status: "paid", 
              paid_at: new Date().toISOString(),
              payment_reference: payment.reference_number
            })
            .eq("id", params.billing_id);
        }
        
        result = { payment };
        break;

      // ==================== INTERNAL TICKETS ====================
      case "get_internal_tickets":
        const { data: intTickets } = await supabase
          .from("internal_tickets")
          .select("*")
          .or(`assigned_to_department.eq.employee,assigned_to_department.eq.all,created_by_role.eq.employee`)
          .order("created_at", { ascending: false })
          .limit(100);
        result = { tickets: intTickets || [] };
        break;

      case "get_internal_ticket_replies":
        const { data: intReplies } = await supabase
          .from("internal_ticket_replies")
          .select("*")
          .eq("ticket_id", params.ticketId)
          .order("created_at", { ascending: true });
        result = { replies: intReplies || [] };
        break;

      case "create_internal_ticket":
        const { data: newIntTicket, error: createIntError } = await supabase
          .from("internal_tickets")
          .insert({
            created_by_id: employeeId,
            created_by_name: employeeName,
            created_by_role: "employee",
            created_by_email: employeeEmail,
            subject: params.subject,
            description: params.description,
            category: params.category || "general",
            priority: params.priority || "normal",
            assigned_to_department: params.assigned_to_department || "all",
            cc_departments: params.cc_departments || [],
          })
          .select()
          .single();
        if (createIntError) throw createIntError;
        result = { ticket: newIntTicket };
        break;

      case "add_internal_ticket_reply":
        const { error: internalReplyError } = await supabase
          .from("internal_ticket_replies")
          .insert({
            ticket_id: params.ticketId,
            author_id: employeeId,
            author_name: employeeName,
            author_role: "employee",
            author_email: employeeEmail,
            content: params.content,
          });
        if (internalReplyError) throw internalReplyError;
        result = { success: true };
        break;

      case "update_internal_ticket_status":
        const { error: statusUpdateError } = await supabase
          .from("internal_tickets")
          .update({ status: params.status, updated_at: new Date().toISOString() })
          .eq("id", params.ticketId);
        if (statusUpdateError) throw statusUpdateError;
        result = { success: true };
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

  } catch (error: unknown) {
    console.error("[employee-data] Error:", error);
    const message = error instanceof Error ? error.message : "Erreur inattendue";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
