import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * Employee Operations Edge Function
 * 
 * Handles all sensitive employee operations server-side:
 * - PIN verification and unlock session management
 * - Payment recording
 * - Streaming subscription create/cancel
 * - Ticket creation
 * 
 * SECURITY:
 * - JWT validation for all requests
 * - Employee role verification
 * - Server-side lockout enforcement
 * - Comprehensive audit logging
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Constants
const UNLOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 3;

interface EmployeeInfo {
  id: string;
  email: string;
  fullName: string;
  pinHash: string;
  lockoutUntil: string | null;
  failedAttempts: number;
}

// Simple hash function for PIN comparison (must match frontend)
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "_nivra_salt_2024");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate employee from JWT
async function validateEmployee(authHeader: string, supabaseAdmin: any): Promise<EmployeeInfo | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  
  // Validate JWT and get user using the auth header
  const supabaseClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    console.error("[employee-operations] JWT validation failed:", userError);
    return null;
  }

  const userId = user.id;
  const userEmail = user.email;

  // Verify employee role exists and is active
  const { data: roleData, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role, status, is_active")
    .eq("user_id", userId)
    .eq("role", "employee")
    .maybeSingle();

  if (roleError || !roleData) {
    console.error("[employee-operations] No employee role found for user:", userId);
    return null;
  }

  if (roleData.status !== "active" || roleData.is_active === false) {
    console.error("[employee-operations] Employee role not active:", roleData);
    return null;
  }

  // Get employee details
  const { data: employee, error: empError } = await supabaseAdmin
    .from("employees")
    .select("id, email, full_name, pin_hash, lockout_until, failed_login_attempts")
    .eq("email", userEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (empError || !employee) {
    console.error("[employee-operations] Employee record not found:", empError);
    return null;
  }

  return {
    id: employee.id,
    email: employee.email,
    fullName: employee.full_name,
    pinHash: employee.pin_hash,
    lockoutUntil: employee.lockout_until,
    failedAttempts: employee.failed_login_attempts || 0,
  };
}

// Log operation to audit table
async function logAudit(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  action: string,
  entityType: string,
  entityId: string | null,
  result: string,
  reason: string | null,
  details: any,
  clientId?: string | null,
  accountId?: string | null,
  req?: Request
) {
  try {
    await supabaseAdmin.from("employee_operations_audit").insert({
      employee_id: employee.id,
      employee_email: employee.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      client_id: clientId || null,
      account_id: accountId || null,
      result,
      reason,
      details,
      ip_address: req?.headers.get("x-forwarded-for") || req?.headers.get("cf-connecting-ip") || null,
      user_agent: req?.headers.get("user-agent") || null,
    });
  } catch (error) {
    console.error("[employee-operations] Failed to log audit:", error);
  }
}

// ================== HANDLERS ==================

// PIN Verification and Unlock
async function handlePinVerifyUnlock(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { accountId, clientId, pin, reason } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Validate required fields
  if (!accountId || !clientId || !pin || !reason) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing required fields" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate PIN format (6 digits)
  if (!/^\d{6}$/.test(pin)) {
    return new Response(
      JSON.stringify({ success: false, error: "Le NIP doit contenir exactement 6 chiffres" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check server-side lockout for this account
  const { data: existingUnlocks } = await supabaseAdmin
    .from("employee_pin_unlocks")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("account_id", accountId)
    .eq("is_active", true)
    .order("unlocked_at", { ascending: false })
    .limit(1);

  // Check for active lockout from failed attempts
  const { data: recentAttempts } = await supabaseAdmin
    .from("employee_pin_attempts")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("account_id", accountId)
    .eq("attempt_result", "fail")
    .gte("attempted_at", new Date(Date.now() - LOCKOUT_DURATION_MS).toISOString())
    .order("attempted_at", { ascending: false });

  const recentFailedCount = recentAttempts?.length || 0;

  // Check if locked out
  if (recentFailedCount >= MAX_FAILED_ATTEMPTS) {
    const lastAttempt = recentAttempts?.[0];
    const lockoutExpiry = new Date(new Date(lastAttempt.attempted_at).getTime() + LOCKOUT_DURATION_MS);
    const remainingMs = lockoutExpiry.getTime() - Date.now();

    if (remainingMs > 0) {
      await logAudit(supabaseAdmin, employee, "pin_attempt", "account", accountId, "lockout", reason, 
        { failedCount: recentFailedCount }, clientId, accountId, req);

      const mins = Math.ceil(remainingMs / 60000);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Compte verrouillé. Réessayez dans ${mins} minute(s).`,
          locked: true,
          lockoutExpiresAt: lockoutExpiry.toISOString(),
          remainingMs
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Get client's PIN hash from profiles
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("client_pin_hash, full_name, email")
    .eq("user_id", clientId)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ success: false, error: "Client non trouvé" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!profile.client_pin_hash) {
    return new Response(
      JSON.stringify({ success: false, error: "Ce client n'a pas configuré de NIP" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Hash entered PIN and compare
  const enteredHash = await hashPin(pin);
  const isValid = enteredHash === profile.client_pin_hash;

  // Log the attempt
  await supabaseAdmin.from("employee_pin_attempts").insert({
    employee_id: employee.id,
    employee_email: employee.email,
    account_id: accountId,
    client_id: clientId,
    client_name: profile.full_name,
    attempt_result: isValid ? "success" : "fail",
    failed_count_at_attempt: isValid ? 0 : recentFailedCount + 1,
    pin_entered_hash: enteredHash,
    ip_address: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });

  if (isValid) {
    // Create unlock session
    const expiresAt = new Date(Date.now() + UNLOCK_DURATION_MS);

    // Deactivate any existing unlocks for this account/employee
    await supabaseAdmin
      .from("employee_pin_unlocks")
      .update({ is_active: false })
      .eq("employee_id", employee.id)
      .eq("account_id", accountId);

    // Create new unlock
    await supabaseAdmin.from("employee_pin_unlocks").insert({
      employee_id: employee.id,
      employee_email: employee.email,
      account_id: accountId,
      client_id: clientId,
      client_name: profile.full_name,
      expires_at: expiresAt.toISOString(),
      unlock_reason: reason,
      is_active: true,
      created_by_server: true,
    });

    await logAudit(supabaseAdmin, employee, "pin_unlock", "account", accountId, "success", reason,
      { clientName: profile.full_name, expiresAt: expiresAt.toISOString() }, clientId, accountId, req);

    return new Response(
      JSON.stringify({
        success: true,
        expiresAt: expiresAt.toISOString(),
        remainingMs: UNLOCK_DURATION_MS,
        clientName: profile.full_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } else {
    // Failed attempt
    const newFailedCount = recentFailedCount + 1;

    await logAudit(supabaseAdmin, employee, "pin_attempt", "account", accountId, "fail", reason,
      { failedCount: newFailedCount }, clientId, accountId, req);

    if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
      const lockoutExpiry = new Date(Date.now() + LOCKOUT_DURATION_MS);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Trop de tentatives. Compte verrouillé pour 15 minutes.",
          locked: true,
          lockoutExpiresAt: lockoutExpiry.toISOString(),
          remainingMs: LOCKOUT_DURATION_MS,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: `NIP incorrect. ${MAX_FAILED_ATTEMPTS - newFailedCount} tentative(s) restante(s).`,
        attemptsRemaining: MAX_FAILED_ATTEMPTS - newFailedCount,
      }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Check Unlock Status
async function handleCheckUnlock(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { accountId } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!accountId) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing accountId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check for active unlock
  const { data: unlock } = await supabaseAdmin
    .from("employee_pin_unlocks")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("account_id", accountId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .order("unlocked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (unlock) {
    const remainingMs = new Date(unlock.expires_at).getTime() - Date.now();
    return new Response(
      JSON.stringify({
        unlocked: true,
        expiresAt: unlock.expires_at,
        remainingMs: Math.max(0, remainingMs),
        clientName: unlock.client_name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check for lockout
  const { data: recentAttempts } = await supabaseAdmin
    .from("employee_pin_attempts")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("account_id", accountId)
    .eq("attempt_result", "fail")
    .gte("attempted_at", new Date(Date.now() - LOCKOUT_DURATION_MS).toISOString())
    .order("attempted_at", { ascending: false });

  const recentFailedCount = recentAttempts?.length || 0;

  if (recentFailedCount >= MAX_FAILED_ATTEMPTS) {
    const lastAttempt = recentAttempts?.[0];
    const lockoutExpiry = new Date(new Date(lastAttempt.attempted_at).getTime() + LOCKOUT_DURATION_MS);
    const remainingMs = lockoutExpiry.getTime() - Date.now();

    if (remainingMs > 0) {
      return new Response(
        JSON.stringify({
          unlocked: false,
          locked: true,
          lockoutExpiresAt: lockoutExpiry.toISOString(),
          remainingMs,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ unlocked: false, locked: false }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Record Payment
async function handleRecordPayment(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { billingId, amount, paymentMethod, reference, notes } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!billingId || !amount || !paymentMethod) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing required fields" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get billing record
  const { data: billing, error: billingError } = await supabaseAdmin
    .from("billing")
    .select("*")
    .eq("id", billingId)
    .single();

  if (billingError || !billing) {
    return new Response(
      JSON.stringify({ success: false, error: "Facture non trouvée" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update billing with pending verification status
  const { error: updateError } = await supabaseAdmin
    .from("billing")
    .update({
      status: "received_pending_verification",
      amount_paid: amount,
      payment_method_type: paymentMethod,
      payment_reference: reference || null,
      notes: notes ? `${billing.notes || ""}\n[Employé] ${notes}` : billing.notes,
      proof_submitted_at: new Date().toISOString(),
    })
    .eq("id", billingId);

  if (updateError) {
    console.error("[employee-operations] Failed to update billing:", updateError);
    return new Response(
      JSON.stringify({ success: false, error: "Échec de la mise à jour" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await logAudit(supabaseAdmin, employee, "payment_recorded", "billing", billingId, "success", null,
    { amount, paymentMethod, reference, previousStatus: billing.status }, billing.user_id, null, req);

  return new Response(
    JSON.stringify({ success: true, status: "received_pending_verification" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Create Streaming Subscription
async function handleStreamingCreate(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { clientId, accountId, streamingServiceId, monthlyPrice, promoCode, notes } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!clientId || !streamingServiceId) {
    return new Response(
      JSON.stringify({ success: false, error: "Client et service requis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify PIN unlock for this account/client
  const unlockAccountId = accountId || clientId;
  const { data: unlock } = await supabaseAdmin
    .from("employee_pin_unlocks")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (!unlock) {
    return new Response(
      JSON.stringify({ success: false, error: "Déverrouillage NIP requis pour cette opération" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get streaming service
  const { data: service, error: serviceError } = await supabaseAdmin
    .from("streaming_services")
    .select("*")
    .eq("id", streamingServiceId)
    .single();

  if (serviceError || !service) {
    return new Response(
      JSON.stringify({ success: false, error: "Service streaming non trouvé" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create subscription
  const { data: subscription, error: createError } = await supabaseAdmin
    .from("client_streaming_subscriptions")
    .insert({
      user_id: clientId,
      account_id: accountId || null,
      streaming_service_id: streamingServiceId,
      monthly_price: monthlyPrice || service.base_price,
      promo_code: promoCode || null,
      internal_notes: notes || null,
      status: "pending_verification",
      start_date: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError) {
    console.error("[employee-operations] Failed to create subscription:", createError);
    return new Response(
      JSON.stringify({ success: false, error: "Échec de la création" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await logAudit(supabaseAdmin, employee, "streaming_created", "streaming_subscription", subscription.id, "success", null,
    { serviceName: service.name, monthlyPrice: monthlyPrice || service.base_price, promoCode }, clientId, accountId, req);

  return new Response(
    JSON.stringify({ success: true, subscription }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Cancel Streaming Subscription
async function handleStreamingCancel(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { subscriptionId, reason, immediateCancel = false } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!subscriptionId || !reason) {
    return new Response(
      JSON.stringify({ success: false, error: "ID abonnement et raison requis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get subscription
  const { data: subscription, error: subError } = await supabaseAdmin
    .from("client_streaming_subscriptions")
    .select("*, accounts:account_id(*)")
    .eq("id", subscriptionId)
    .single();

  if (subError || !subscription) {
    return new Response(
      JSON.stringify({ success: false, error: "Abonnement non trouvé" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify PIN unlock for this client
  const { data: unlock } = await supabaseAdmin
    .from("employee_pin_unlocks")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("client_id", subscription.user_id)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (!unlock) {
    return new Response(
      JSON.stringify({ success: false, error: "Déverrouillage NIP requis pour cette opération" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Calculate effective end date (next billing cycle)
  let effectiveEndDate: Date;
  if (immediateCancel) {
    effectiveEndDate = new Date();
  } else {
    // Default: end of billing cycle
    const account = subscription.accounts;
    const billingCycleDay = account?.billing_cycle_day || 1;
    const today = new Date();
    effectiveEndDate = new Date(today.getFullYear(), today.getMonth() + 1, billingCycleDay);
    
    // If we're past the billing day this month, go to next month
    if (today.getDate() >= billingCycleDay) {
      effectiveEndDate = new Date(today.getFullYear(), today.getMonth() + 2, billingCycleDay);
    }
  }

  // Update subscription
  const { error: updateError } = await supabaseAdmin
    .from("client_streaming_subscriptions")
    .update({
      cancel_at_period_end: !immediateCancel,
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      cancelled_by_employee_id: employee.id,
      cancelled_by_employee_email: employee.email,
      effective_end_date: effectiveEndDate.toISOString().split('T')[0],
      status: immediateCancel ? "cancelled" : "pending_cancellation",
      internal_notes: `${subscription.internal_notes || ""}\n[${new Date().toISOString()}] Annulation par ${employee.email}: ${reason}`,
    })
    .eq("id", subscriptionId);

  if (updateError) {
    console.error("[employee-operations] Failed to cancel subscription:", updateError);
    return new Response(
      JSON.stringify({ success: false, error: "Échec de l'annulation" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  await logAudit(supabaseAdmin, employee, "streaming_cancelled", "streaming_subscription", subscriptionId, "success", reason,
    { effectiveEndDate: effectiveEndDate.toISOString(), immediateCancel }, subscription.user_id, subscription.account_id, req);

  return new Response(
    JSON.stringify({ 
      success: true, 
      effectiveEndDate: effectiveEndDate.toISOString().split('T')[0],
      cancelAtPeriodEnd: !immediateCancel 
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Create Ticket (Internal or External)
async function handleTicketCreate(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { type, subject, description, priority, clientId, category, assignedDepartment } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!subject || !description || !type) {
    return new Response(
      JSON.stringify({ success: false, error: "Sujet, description et type requis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (type === "internal") {
    // Internal ticket
    const { data: ticket, error: createError } = await supabaseAdmin
      .from("internal_tickets")
      .insert({
        subject,
        description,
        priority: priority || "normal",
        category: category || null,
        assigned_to_department: assignedDepartment || "support",
        created_by_id: employee.id,
        created_by_name: employee.fullName,
        created_by_email: employee.email,
        created_by_role: "employee",
        status: "open",
      })
      .select()
      .single();

    if (createError) {
      console.error("[employee-operations] Failed to create internal ticket:", createError);
      return new Response(
        JSON.stringify({ success: false, error: "Échec de la création du ticket" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logAudit(supabaseAdmin, employee, "ticket_created", "internal_ticket", ticket.id, "success", null,
      { subject, priority, category, assignedDepartment }, null, null, req);

    return new Response(
      JSON.stringify({ success: true, ticket, ticketNumber: ticket.ticket_number }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } else {
    // External/support ticket
    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, error: "Client requis pour un ticket externe" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: ticket, error: createError } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: clientId,
        subject,
        description,
        priority: priority || "normal",
        category: category || null,
        status: "open",
        created_by_employee_id: employee.id,
        created_by_employee_name: employee.fullName,
      })
      .select()
      .single();

    if (createError) {
      console.error("[employee-operations] Failed to create support ticket:", createError);
      return new Response(
        JSON.stringify({ success: false, error: "Échec de la création du ticket" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logAudit(supabaseAdmin, employee, "ticket_created", "support_ticket", ticket.id, "success", null,
      { subject, priority, category, clientId }, clientId, null, req);

    return new Response(
      JSON.stringify({ success: true, ticket, ticketNumber: ticket.ticket_number }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Search clients
async function handleClientSearch(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { query } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!query || query.length < 2) {
    return new Response(
      JSON.stringify({ success: true, clients: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Search by name, email, or phone
  const { data: clients, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, full_name, first_name, last_name, email, phone, client_number")
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,client_number.ilike.%${query}%`)
    .limit(20);

  if (error) {
    console.error("[employee-operations] Client search failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Recherche échouée" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, clients: clients || [] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ================== MAIN HANDLER ==================

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const action = pathParts[pathParts.length - 1] || "";

  // Create admin client
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Validate employee
  const authHeader = req.headers.get("Authorization");
  const employee = await validateEmployee(authHeader!, supabaseAdmin);

  if (!employee) {
    return new Response(
      JSON.stringify({ error: "Non autorisé - employé non valide" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse body
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is OK for some actions
  }

  // Route to handler
  try {
    switch (action) {
      case "pin-verify-unlock":
        return await handlePinVerifyUnlock(supabaseAdmin, employee, body, req);

      case "check-unlock":
        return await handleCheckUnlock(supabaseAdmin, employee, body, req);

      case "record-payment":
        return await handleRecordPayment(supabaseAdmin, employee, body, req);

      case "streaming-create":
        return await handleStreamingCreate(supabaseAdmin, employee, body, req);

      case "streaming-cancel":
        return await handleStreamingCancel(supabaseAdmin, employee, body, req);

      case "ticket-create":
        return await handleTicketCreate(supabaseAdmin, employee, body, req);

      case "client-search":
        return await handleClientSearch(supabaseAdmin, employee, body, req);

      default:
        return new Response(
          JSON.stringify({ error: `Action inconnue: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error(`[employee-operations] Error in ${action}:`, error);
    return new Response(
      JSON.stringify({ error: "Erreur interne du serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
