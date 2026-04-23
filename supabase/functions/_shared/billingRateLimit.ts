/**
 * billingRateLimit — Ad-hoc rate limiting for billing & PayPal edge functions.
 *
 * Wraps the shared `checkRateLimit` with billing-specific defaults
 * (10 req/min/IP) and logs blocked requests to `security_audit_log`.
 *
 * NOTE: The backend does not have first-class rate limiting primitives;
 * this is an ad-hoc implementation built on top of the existing
 * `rate_limit_attempts` table. It is best-effort and per-instance,
 * with DB persistence for cross-instance counting.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit } from "./rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const BILLING_RATE_LIMIT = {
  maxAttempts: 10,
  windowMs: 60 * 1000, // 1 minute
} as const;

/**
 * Extract the best client IP from request headers.
 */
export function getRequestIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Enforce 10 req/min/IP on a billing/PayPal edge function.
 * Returns a 429 Response when blocked, or null when allowed.
 *
 * @param req incoming Request
 * @param functionName short identifier for logging (e.g. "billing-create-order")
 * @param corsHeaders CORS headers to attach to the 429 response
 */
export async function enforceBillingRateLimit(
  req: Request,
  functionName: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const ip = getRequestIp(req);
  const key = `${functionName}:${ip}`;

  let result;
  try {
    result = await checkRateLimit({
      key,
      maxAttempts: BILLING_RATE_LIMIT.maxAttempts,
      windowMs: BILLING_RATE_LIMIT.windowMs,
    });
  } catch (err) {
    // Fail open on infrastructure errors — do not block legitimate traffic.
    console.error(`[billingRateLimit] check failed for ${key}:`, err);
    return null;
  }

  if (result.allowed) return null;

  // Log to security_audit_log (fire-and-forget)
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from("security_audit_log").insert({
      user_id: null,
      action: "rate_limit_blocked",
      resource: functionName,
      ip,
      success: false,
      details: {
        max_per_minute: BILLING_RATE_LIMIT.maxAttempts,
        retry_after: result.retryAfter,
      },
      created_at: new Date().toISOString(),
    });
  } catch (logErr) {
    console.error(`[billingRateLimit] audit log failed:`, logErr);
  }

  return new Response(
    JSON.stringify({
      error: "rate_limit_exceeded",
      message: `Too many requests. Limit: ${BILLING_RATE_LIMIT.maxAttempts} per minute. Retry in ${result.retryAfter ?? 60}s.`,
      retry_after: result.retryAfter ?? 60,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter ?? 60),
      },
    },
  );
}
