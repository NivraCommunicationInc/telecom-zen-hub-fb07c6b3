import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Employee Operations Edge Function
 * 
 * Handles all sensitive employee operations server-side:
 * - PIN verification and unlock session management
 * - Payment recording (append-only)
 * - Streaming subscription create/cancel
 * - Ticket creation
 * - Client search with rate limiting + PII masking
 * 
 * SECURITY:
 * - JWT validation for all requests
 * - Employee role verification via user_id
 * - PBKDF2 with per-user salt for PIN hashing
 * - Constant-time comparison
 * - Server-authoritative lockout per (employee_id, account_id)
 * - Comprehensive audit logging
 * - Strict CORS allowlist
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Constants
const UNLOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 3;
const PBKDF2_ITERATIONS = 100000;
const SEARCH_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const SEARCH_RATE_LIMIT_MAX = 30; // max 30 searches per minute

// Strict CORS allowlist
const ALLOWED_ORIGINS = [
  "https://nivratelecom.ca",
  "https://www.nivratelecom.ca",
];

interface EmployeeInfo {
  id: string;
  email: string;
  fullName: string;
  pinHash: string;
  pinSalt: string | null;
  userId: string;
}

/**
 * Get CORS headers with strict origin validation
 */
function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = requestOrigin || "";
  
  // Check strict allowlist
  let isAllowed = ALLOWED_ORIGINS.includes(origin);
  
  // Also allow Lovable preview domains for development
  if (!isAllowed && (origin.endsWith(".lovableproject.com") || origin.endsWith(".lovable.app"))) {
    isAllowed = true;
  }
  
  // Allow localhost for development
  if (!isAllowed && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    isAllowed = true;
  }
  
  // If not allowed, reject by not setting origin (browser will block)
  const corsOrigin = isAllowed ? origin : "";
  
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

/**
 * Handle CORS preflight
 */
function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    const headers = getCorsHeaders(origin);
    
    // If origin not allowed, return 403
    if (!headers["Access-Control-Allow-Origin"]) {
      return new Response("Forbidden", { status: 403 });
    }
    
    return new Response(null, { status: 204, headers });
  }
  return null;
}

/**
 * Generate cryptographically secure salt
 */
function generateSalt(): string {
  const saltBytes = new Uint8Array(32);
  crypto.getRandomValues(saltBytes);
  return Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * PBKDF2 hash with per-user salt
 */
async function hashPinPBKDF2(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  const saltData = encoder.encode(salt);
  
  // Import PIN as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    pinData,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  // Derive bits using PBKDF2
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltData,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  // Convert to hex string
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still compare to avoid length-based timing
    let result = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate employee from JWT using user_id (not email)
 */
async function validateEmployee(authHeader: string, supabaseAdmin: any): Promise<EmployeeInfo | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  
  // Validate JWT and get user
  const supabaseClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    console.error("[employee-operations] JWT validation failed:", userError);
    return null;
  }

  const userId = user.id;

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

  // Get employee details by user_id (NOT email)
  const { data: employee, error: empError } = await supabaseAdmin
    .from("employees")
    .select("id, email, full_name, pin_hash, pin_salt, user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (empError || !employee) {
    console.error("[employee-operations] Employee record not found by user_id:", empError);
    return null;
  }

  return {
    id: employee.id,
    email: employee.email,
    fullName: employee.full_name,
    pinHash: employee.pin_hash,
    pinSalt: employee.pin_salt,
    userId: employee.user_id,
  };
}

/**
 * Log operation to audit table
 */
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

/**
 * Get or create lockout record for (employee_id, account_id)
 */
async function getLockoutRecord(
  supabaseAdmin: any,
  employeeId: string,
  accountId: string
): Promise<{ failed_attempts: number; locked_until: string | null; id?: string }> {
  const { data, error } = await supabaseAdmin
    .from("employee_pin_lockouts")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    console.error("[employee-operations] Error fetching lockout:", error);
  }

  return data || { failed_attempts: 0, locked_until: null };
}

/**
 * Update lockout record
 */
async function updateLockoutRecord(
  supabaseAdmin: any,
  employeeId: string,
  accountId: string,
  failedAttempts: number,
  lockedUntil: string | null
) {
  const { error } = await supabaseAdmin
    .from("employee_pin_lockouts")
    .upsert({
      employee_id: employeeId,
      account_id: accountId,
      failed_attempts: failedAttempts,
      locked_until: lockedUntil,
      last_attempt_at: new Date().toISOString(),
    }, {
      onConflict: "employee_id,account_id",
    });

  if (error) {
    console.error("[employee-operations] Error updating lockout:", error);
  }
}

/**
 * Check if an active unlock exists for (employee_id, account_id)
 */
async function checkActiveUnlock(
  supabaseAdmin: any,
  employeeId: string,
  accountId: string
): Promise<{ unlocked: boolean; expiresAt?: string; remainingMs?: number }> {
  const { data: unlock } = await supabaseAdmin
    .from("employee_pin_unlocks")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("account_id", accountId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .order("unlocked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (unlock) {
    const remainingMs = new Date(unlock.expires_at).getTime() - Date.now();
    return {
      unlocked: true,
      expiresAt: unlock.expires_at,
      remainingMs: Math.max(0, remainingMs),
    };
  }

  return { unlocked: false };
}

// ================== HANDLERS ==================

/**
 * PIN Verification and Unlock - Server-side only
 */
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

  // Get server-authoritative lockout record for this (employee, account)
  const lockout = await getLockoutRecord(supabaseAdmin, employee.id, accountId);

  // Check if currently locked out
  if (lockout.locked_until) {
    const lockedUntilTime = new Date(lockout.locked_until).getTime();
    const now = Date.now();
    
    if (lockedUntilTime > now) {
      const remainingMs = lockedUntilTime - now;
      const mins = Math.ceil(remainingMs / 60000);
      
      await logAudit(supabaseAdmin, employee, "pin_attempt", "account", accountId, "lockout", reason,
        { failedAttempts: lockout.failed_attempts }, clientId, accountId, req);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Compte verrouillé. Réessayez dans ${mins} minute(s).`,
          locked: true,
          lockoutExpiresAt: lockout.locked_until,
          remainingMs,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Get client's PIN hash and salt from profiles
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("client_pin_hash, client_pin_salt, full_name, email")
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

  // Hash entered PIN with client's salt using PBKDF2
  const salt = profile.client_pin_salt || "legacy_salt";
  const enteredHash = await hashPinPBKDF2(pin, salt);
  
  // Constant-time comparison to prevent timing attacks
  const isValid = constantTimeCompare(enteredHash, profile.client_pin_hash);

  // Log the attempt (WITHOUT storing entered PIN hash - security requirement)
  await supabaseAdmin.from("employee_pin_attempts").insert({
    employee_id: employee.id,
    employee_email: employee.email,
    account_id: accountId,
    client_id: clientId,
    client_name: profile.full_name,
    attempt_result: isValid ? "success" : "fail",
    failed_count_at_attempt: isValid ? 0 : lockout.failed_attempts + 1,
    // NOTE: pin_entered_hash column removed for security
    ip_address: req.headers.get("x-forwarded-for") || null,
    user_agent: req.headers.get("user-agent") || null,
  });

  if (isValid) {
    // Reset lockout on success
    await updateLockoutRecord(supabaseAdmin, employee.id, accountId, 0, null);

    // Create unlock session
    const expiresAt = new Date(Date.now() + UNLOCK_DURATION_MS);

    // Deactivate any existing unlocks for this (employee, account)
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
    // Failed attempt - update lockout record
    const newFailedCount = lockout.failed_attempts + 1;
    let lockedUntil: string | null = null;

    if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
    }

    await updateLockoutRecord(supabaseAdmin, employee.id, accountId, newFailedCount, lockedUntil);

    await logAudit(supabaseAdmin, employee, "pin_attempt", "account", accountId, "fail", reason,
      { failedCount: newFailedCount }, clientId, accountId, req);

    if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Trop de tentatives. Compte verrouillé pour 15 minutes.",
          locked: true,
          lockoutExpiresAt: lockedUntil,
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

/**
 * Check Unlock Status - Account-scoped
 */
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

  // Check for active unlock (account-scoped)
  const unlockStatus = await checkActiveUnlock(supabaseAdmin, employee.id, accountId);

  if (unlockStatus.unlocked) {
    return new Response(
      JSON.stringify({
        unlocked: true,
        expiresAt: unlockStatus.expiresAt,
        remainingMs: unlockStatus.remainingMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check for lockout
  const lockout = await getLockoutRecord(supabaseAdmin, employee.id, accountId);

  if (lockout.locked_until) {
    const lockedUntilTime = new Date(lockout.locked_until).getTime();
    const now = Date.now();
    
    if (lockedUntilTime > now) {
      return new Response(
        JSON.stringify({
          unlocked: false,
          locked: true,
          lockoutExpiresAt: lockout.locked_until,
          remainingMs: lockedUntilTime - now,
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

/**
 * Record Payment - Append-only, requires account unlock
 */
async function handleRecordPayment(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { billingId, accountId, amount, paymentMethod, reference, notes, idempotencyKey } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Validate required fields
  if (!billingId || !amount || !paymentMethod) {
    return new Response(
      JSON.stringify({ success: false, error: "billingId, amount et paymentMethod requis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate amount > 0
  if (typeof amount !== "number" || amount <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: "Le montant doit être supérieur à 0" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get billing record to find account
  const { data: billing, error: billingError } = await supabaseAdmin
    .from("billing")
    .select("*, orders(account_id, user_id)")
    .eq("id", billingId)
    .single();

  if (billingError || !billing) {
    return new Response(
      JSON.stringify({ success: false, error: "Facture non trouvée" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const targetAccountId = accountId || billing.orders?.account_id;
  const clientId = billing.user_id;

  // Require unlock for account-linked payments
  if (targetAccountId) {
    const unlockStatus = await checkActiveUnlock(supabaseAdmin, employee.id, targetAccountId);
    if (!unlockStatus.unlocked) {
      return new Response(
        JSON.stringify({ success: false, error: "Déverrouillage NIP requis pour enregistrer un paiement" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Check idempotency
  if (idempotencyKey) {
    const { data: existingPayment } = await supabaseAdmin
      .from("employee_recorded_payments")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingPayment) {
      return new Response(
        JSON.stringify({ success: false, error: "Ce paiement a déjà été enregistré", duplicate: true }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Insert into append-only payments table
  const { data: paymentRecord, error: insertError } = await supabaseAdmin
    .from("employee_recorded_payments")
    .insert({
      billing_id: billingId,
      client_id: clientId,
      account_id: targetAccountId || null,
      amount,
      payment_method: paymentMethod,
      payment_reference: reference || null,
      notes: notes || null,
      recorded_by_employee_id: employee.id,
      recorded_by_employee_email: employee.email,
      idempotency_key: idempotencyKey || null,
      status: "pending_verification",
    })
    .select()
    .single();

  if (insertError) {
    console.error("[employee-operations] Failed to insert payment:", insertError);
    return new Response(
      JSON.stringify({ success: false, error: "Échec de l'enregistrement du paiement" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update billing status to received_pending_verification (DO NOT overwrite amount_paid)
  const { error: updateError } = await supabaseAdmin
    .from("billing")
    .update({
      status: "received_pending_verification",
      proof_submitted_at: new Date().toISOString(),
    })
    .eq("id", billingId);

  if (updateError) {
    console.error("[employee-operations] Failed to update billing status:", updateError);
  }

  await logAudit(supabaseAdmin, employee, "payment_recorded", "billing", billingId, "success", null,
    { amount, paymentMethod, reference, paymentRecordId: paymentRecord.id }, clientId, targetAccountId, req);

  return new Response(
    JSON.stringify({ 
      success: true, 
      status: "pending_verification",
      paymentId: paymentRecord.id,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Create Streaming Subscription - Requires account unlock
 */
async function handleStreamingCreate(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { clientId, accountId, streamingServiceId, monthlyPrice, promoCode, notes } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!clientId || !accountId || !streamingServiceId) {
    return new Response(
      JSON.stringify({ success: false, error: "Client, compte et service requis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify PIN unlock for this account (account-scoped)
  const unlockStatus = await checkActiveUnlock(supabaseAdmin, employee.id, accountId);
  if (!unlockStatus.unlocked) {
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

  // Create subscription with pending_verification status
  const { data: subscription, error: createError } = await supabaseAdmin
    .from("client_streaming_subscriptions")
    .insert({
      user_id: clientId,
      account_id: accountId,
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

/**
 * Cancel Streaming Subscription - Requires account unlock
 */
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

  // Verify PIN unlock for this account (account-scoped)
  const unlockStatus = await checkActiveUnlock(supabaseAdmin, employee.id, subscription.account_id);
  if (!unlockStatus.unlocked) {
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
      effective_end_date: effectiveEndDate.toISOString().split("T")[0],
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
      effectiveEndDate: effectiveEndDate.toISOString().split("T")[0],
      cancelAtPeriodEnd: !immediateCancel,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Create Ticket (Internal or External)
 */
async function handleTicketCreate(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { type, subject, description, priority, clientId, accountId, category, assignedDepartment } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!subject || !description || !type) {
    return new Response(
      JSON.stringify({ success: false, error: "Sujet, description et type requis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // For external tickets with account, require unlock
  if (type === "external" && accountId) {
    const unlockStatus = await checkActiveUnlock(supabaseAdmin, employee.id, accountId);
    if (!unlockStatus.unlocked) {
      return new Response(
        JSON.stringify({ success: false, error: "Déverrouillage NIP requis pour créer un ticket client" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
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
      { subject, priority, category, clientId }, clientId, accountId, req);

    return new Response(
      JSON.stringify({ success: true, ticket, ticketNumber: ticket.ticket_number }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Search clients - Rate limited, audit logged, PII masked without unlock
 */
async function handleClientSearch(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { query, accountIdForUnlock } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!query || query.length < 2) {
    return new Response(
      JSON.stringify({ success: true, clients: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limiting check
  const windowStart = new Date(Date.now() - SEARCH_RATE_LIMIT_WINDOW_MS).toISOString();
  
  const { data: rateLimitRecord } = await supabaseAdmin
    .from("employee_search_rate_limits")
    .select("*")
    .eq("employee_id", employee.id)
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rateLimitRecord && rateLimitRecord.search_count >= SEARCH_RATE_LIMIT_MAX) {
    return new Response(
      JSON.stringify({ success: false, error: "Trop de recherches. Veuillez attendre une minute." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update rate limit counter
  if (rateLimitRecord) {
    await supabaseAdmin
      .from("employee_search_rate_limits")
      .update({ search_count: rateLimitRecord.search_count + 1 })
      .eq("id", rateLimitRecord.id);
  } else {
    await supabaseAdmin.from("employee_search_rate_limits").insert({
      employee_id: employee.id,
      search_count: 1,
      window_start: new Date().toISOString(),
    });
  }

  // Log search to audit
  await logAudit(supabaseAdmin, employee, "client_search", "profile", null, "success", null,
    { query: query.substring(0, 50) }, null, null, req);

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

  // Get accounts for each client to check unlock status
  const clientIds = clients?.map((c: any) => c.user_id) || [];
  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select("id, client_id")
    .in("client_id", clientIds);

  const clientAccountMap = new Map<string, string>();
  accounts?.forEach((acc: any) => {
    clientAccountMap.set(acc.client_id, acc.id);
  });

  // Mask PII unless employee has active unlock for the client's account
  const maskedClients = await Promise.all(
    (clients || []).map(async (client: any) => {
      const clientAccountId = clientAccountMap.get(client.user_id);
      let hasUnlock = false;

      if (clientAccountId) {
        const unlockStatus = await checkActiveUnlock(supabaseAdmin, employee.id, clientAccountId);
        hasUnlock = unlockStatus.unlocked;
      }

      // If an accountIdForUnlock is provided and matches, check that unlock
      if (!hasUnlock && accountIdForUnlock) {
        const unlockStatus = await checkActiveUnlock(supabaseAdmin, employee.id, accountIdForUnlock);
        hasUnlock = unlockStatus.unlocked;
      }

      if (hasUnlock) {
        // Return full data
        return client;
      } else {
        // Mask email and phone
        return {
          user_id: client.user_id,
          full_name: client.full_name,
          first_name: client.first_name,
          last_name: client.last_name,
          email: client.email ? maskEmail(client.email) : null,
          phone: client.phone ? maskPhone(client.phone) : null,
          client_number: client.client_number,
          masked: true,
        };
      }
    })
  );

  return new Response(
    JSON.stringify({ success: true, clients: maskedClients }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Mask email: j***@g***.com
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***.***";
  
  const maskedLocal = local.length > 1 ? local[0] + "***" : "***";
  const domainParts = domain.split(".");
  const maskedDomain = domainParts.length > 1
    ? domainParts[0][0] + "***." + domainParts.slice(1).join(".")
    : "***";
  
  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Mask phone: (514) ***-**89
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***-***-****";
  
  const lastTwo = digits.slice(-2);
  return `***-***-**${lastTwo}`;
}

/**
 * Employee Permissions - Server-side permission check
 * Returns actual permissions from employees.permissions_json
 */
async function handleEmployeePermissions(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  req: Request
): Promise<Response> {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Get employee permissions from database
  const { data: empData, error: empError } = await supabaseAdmin
    .from("employees")
    .select("permissions_json, is_active")
    .eq("id", employee.id)
    .single();

  if (empError || !empData) {
    return new Response(
      JSON.stringify({ success: false, error: "Employé non trouvé" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!empData.is_active) {
    return new Response(
      JSON.stringify({ success: false, error: "Compte employé désactivé" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const permissions = empData.permissions_json || {};

  return new Response(
    JSON.stringify({
      success: true,
      permissions,
      employeeId: employee.id,
      employeeEmail: employee.email,
      employeeName: employee.fullName,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Client 360 - Full client data with PIN gate
 * Returns masked data if no unlock, full data if unlocked
 */
async function handleClient360(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { clientId, accountId } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Check permission - DEFAULT DENY
  const { data: empData } = await supabaseAdmin
    .from("employees")
    .select("permissions_json")
    .eq("id", employee.id)
    .single();

  const permissions = empData?.permissions_json || {};
  if (permissions.can_view_profiles !== true) {
    return new Response(
      JSON.stringify({ success: false, error: "Permission refusée" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!clientId) {
    return new Response(
      JSON.stringify({ success: false, error: "clientId requis" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get client profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("user_id", clientId)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ success: false, error: "Client non trouvé" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get client's accounts
  const { data: accounts } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .eq("client_id", clientId);

  // Check for active unlock for this account (if provided) or any of client's accounts
  let hasUnlock = false;
  let unlockedAccountId: string | null = null;

  if (accountId) {
    const unlockStatus = await checkActiveUnlock(supabaseAdmin, employee.id, accountId);
    hasUnlock = unlockStatus.unlocked;
    if (hasUnlock) unlockedAccountId = accountId;
  }

  // If no specific account, check all client's accounts
  if (!hasUnlock && accounts && accounts.length > 0) {
    for (const acc of accounts) {
      const unlockStatus = await checkActiveUnlock(supabaseAdmin, employee.id, acc.id);
      if (unlockStatus.unlocked) {
        hasUnlock = true;
        unlockedAccountId = acc.id;
        break;
      }
    }
  }

  // Log access to audit
  await logAudit(supabaseAdmin, employee, "client_360_access", "profile", clientId, 
    hasUnlock ? "full_access" : "masked_access", null,
    { hasUnlock, unlockedAccountId }, clientId, unlockedAccountId, req);

  if (hasUnlock) {
    // Return full data
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("user_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: billing } = await supabaseAdmin
      .from("billing")
      .select("*")
      .eq("user_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: tickets } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("user_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: streaming } = await supabaseAdmin
      .from("client_streaming_subscriptions")
      .select("*, streaming_services(*)")
      .eq("user_id", clientId);

    return new Response(
      JSON.stringify({
        success: true,
        unlocked: true,
        unlockedAccountId,
        profile,
        accounts,
        orders: orders || [],
        billing: billing || [],
        tickets: tickets || [],
        streaming: streaming || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } else {
    // Return masked data
    const maskedProfile = {
      user_id: profile.user_id,
      full_name: profile.full_name,
      first_name: profile.first_name,
      last_name: profile.last_name,
      client_number: profile.client_number,
      account_status: profile.account_status,
      online_access_status: profile.online_access_status,
      created_at: profile.created_at,
      // Masked fields
      email: profile.email ? maskEmail(profile.email) : null,
      phone: profile.phone ? maskPhone(profile.phone) : null,
      service_address: profile.service_address ? "***" : null,
      service_city: profile.service_city,
      service_postal_code: profile.service_postal_code ? profile.service_postal_code.substring(0, 3) + " ***" : null,
      // Mark as masked
      masked: true,
    };

    const maskedAccounts = (accounts || []).map((acc: any) => ({
      id: acc.id,
      account_number: acc.account_number,
      status: acc.status,
      client_id: acc.client_id,
      // Mask addresses
      billing_address: "***",
      billing_city: acc.billing_city,
      primary_service_address: "***",
      primary_service_city: acc.primary_service_city,
      masked: true,
    }));

    // Get limited order info (no sensitive data)
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, service_type, created_at, total_amount")
      .eq("user_id", clientId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get limited billing info (no sensitive data)
    const { data: billing } = await supabaseAdmin
      .from("billing")
      .select("id, invoice_number, status, amount, created_at, due_date")
      .eq("user_id", clientId)
      .order("created_at", { ascending: false })
      .limit(10);

    return new Response(
      JSON.stringify({
        success: true,
        unlocked: false,
        requiresPin: true,
        profile: maskedProfile,
        accounts: maskedAccounts,
        orders: orders || [],
        billing: billing || [],
        tickets: [], // Don't show tickets without unlock
        streaming: [], // Don't show streaming without unlock
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Get clients list - Paginated, masked by default
 */
async function handleClientsList(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { page = 0, pageSize = 50, search = "" } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Check permission - DEFAULT DENY
  const { data: empData } = await supabaseAdmin
    .from("employees")
    .select("permissions_json")
    .eq("id", employee.id)
    .single();

  const permissions = empData?.permissions_json || {};
  if (permissions.can_view_profiles !== true) {
    return new Response(
      JSON.stringify({ success: false, error: "Permission refusée" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Rate limiting
  const windowStart = new Date(Date.now() - SEARCH_RATE_LIMIT_WINDOW_MS).toISOString();
  const { data: rateLimitRecord } = await supabaseAdmin
    .from("employee_search_rate_limits")
    .select("*")
    .eq("employee_id", employee.id)
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rateLimitRecord && rateLimitRecord.search_count >= SEARCH_RATE_LIMIT_MAX) {
    return new Response(
      JSON.stringify({ success: false, error: "Trop de recherches. Veuillez attendre." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update rate limit
  if (rateLimitRecord) {
    await supabaseAdmin
      .from("employee_search_rate_limits")
      .update({ search_count: rateLimitRecord.search_count + 1 })
      .eq("id", rateLimitRecord.id);
  } else {
    await supabaseAdmin.from("employee_search_rate_limits").insert({
      employee_id: employee.id,
      search_count: 1,
      window_start: new Date().toISOString(),
    });
  }

  // Log search
  await logAudit(supabaseAdmin, employee, "clients_list", "profile", null, "success", null,
    { page, pageSize, searchLength: search.length }, null, null, req);

  // Build query
  let query = supabaseAdmin
    .from("profiles")
    .select("user_id, full_name, first_name, last_name, email, phone, client_number, account_status, created_at", { count: "exact" });

  if (search && search.length >= 2) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,client_number.ilike.%${search}%`);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  const { data: clients, count, error } = await query;

  if (error) {
    console.error("[employee-operations] clients-list error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur lors de la récupération" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Mask PII (always masked in list view)
  const maskedClients = (clients || []).map((client: any) => ({
    user_id: client.user_id,
    full_name: client.full_name,
    first_name: client.first_name,
    last_name: client.last_name,
    client_number: client.client_number,
    account_status: client.account_status,
    created_at: client.created_at,
    email: client.email ? maskEmail(client.email) : null,
    phone: client.phone ? maskPhone(client.phone) : null,
    masked: true,
  }));

  return new Response(
    JSON.stringify({
      success: true,
      clients: maskedClients,
      total: count || 0,
      page,
      pageSize,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Get orders list - Paginated, respects permissions
 */
async function handleOrdersList(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { page = 0, pageSize = 50, status, search } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Check permission
  const { data: empData } = await supabaseAdmin
    .from("employees")
    .select("permissions_json")
    .eq("id", employee.id)
    .single();

  const permissions = empData?.permissions_json || {};
  // DEFAULT DENY: Permission must be explicitly true
  if (permissions.can_view_orders !== true) {
    return new Response(
      JSON.stringify({ success: false, error: "Permission refusée" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let query = supabaseAdmin
    .from("orders")
    .select("id, order_number, confirmation_number, status, service_type, total_amount, created_at, client_first_name, client_last_name", { count: "exact" });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search && search.length >= 2) {
    query = query.or(`order_number.ilike.%${search}%,client_first_name.ilike.%${search}%,client_last_name.ilike.%${search}%`);
  }

  const { data: orders, count, error } = await query
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Erreur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, orders: orders || [], total: count || 0, page, pageSize }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Get billing list - Paginated, respects permissions
 */
async function handleBillingList(
  supabaseAdmin: any,
  employee: EmployeeInfo,
  body: any,
  req: Request
): Promise<Response> {
  const { page = 0, pageSize = 50, status, search } = body;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Check permission
  const { data: empData } = await supabaseAdmin
    .from("employees")
    .select("permissions_json")
    .eq("id", employee.id)
    .single();

  const permissions = empData?.permissions_json || {};
  // DEFAULT DENY: Permission must be explicitly true
  if (permissions.can_view_billing !== true) {
    return new Response(
      JSON.stringify({ success: false, error: "Permission refusée" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let query = supabaseAdmin
    .from("billing")
    .select("id, invoice_number, status, amount, created_at, due_date, client_email, etransfer_status", { count: "exact" });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search && search.length >= 2) {
    query = query.or(`invoice_number.ilike.%${search}%,client_email.ilike.%${search}%`);
  }

  const { data: billing, count, error } = await query
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: "Erreur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Mask client emails
  const maskedBilling = (billing || []).map((b: any) => ({
    ...b,
    client_email: b.client_email ? maskEmail(b.client_email) : null,
  }));

  return new Response(
    JSON.stringify({ success: true, billing: maskedBilling, total: count || 0, page, pageSize }),
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

  // Reject if origin not allowed
  if (!corsHeaders["Access-Control-Allow-Origin"]) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

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

  const authHeader = req.headers.get("authorization");
  const hasBearer = !!authHeader && authHeader.toLowerCase().startsWith("bearer ");
  const hasApiKey = !!req.headers.get("apikey");

  console.log(
    `[employee-operations] request action=${action} origin=${origin ?? ""} bearer=${hasBearer} apikey=${hasApiKey}`
  );

  if (!hasBearer) {
    return new Response(
      JSON.stringify({ ok: false, code: "MISSING_AUTH_BEARER", error: "Non autorisé" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!hasApiKey) {
    return new Response(
      JSON.stringify({ ok: false, code: "MISSING_API_KEY", error: "Non autorisé" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create admin client
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Validate employee
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

      case "employee-permissions":
        return await handleEmployeePermissions(supabaseAdmin, employee, req);

      case "client-360":
        return await handleClient360(supabaseAdmin, employee, body, req);

      case "clients-list":
        return await handleClientsList(supabaseAdmin, employee, body, req);

      case "orders-list":
        return await handleOrdersList(supabaseAdmin, employee, body, req);

      case "billing-list":
        return await handleBillingList(supabaseAdmin, employee, body, req);

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
