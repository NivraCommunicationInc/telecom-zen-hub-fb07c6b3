/**
 * Server-side rate limiting for edge functions
 * 
 * Rate limit thresholds (per IP/user):
 * - login: 5 attempts / 15 minutes, then lockout 30 minutes
 * - otp_send: 3 / 15 minutes
 * - otp_verify: 5 attempts per code, then invalidate
 * - password_reset: 3 / 60 minutes
 * - api_general: 100 / minute
 * - search: 30 / minute
 * - admin_action: 20 / minute
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface RateLimitConfig {
  key: string;          // Unique key (e.g., "login:user@email.com" or "api:192.168.1.1")
  maxAttempts: number;  // Max attempts in window
  windowMs: number;     // Window duration in ms
  lockoutMs?: number;   // Optional lockout duration after limit hit
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;  // Seconds until retry allowed
  isLocked?: boolean;
}

// Rate limit presets
export const RATE_LIMITS = {
  LOGIN: { maxAttempts: 5, windowMs: 15 * 60 * 1000, lockoutMs: 30 * 60 * 1000 },
  OTP_SEND: { maxAttempts: 3, windowMs: 15 * 60 * 1000 },
  OTP_VERIFY: { maxAttempts: 5, windowMs: 10 * 60 * 1000 },
  PASSWORD_RESET: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  API_GENERAL: { maxAttempts: 100, windowMs: 60 * 1000 },
  SEARCH: { maxAttempts: 30, windowMs: 60 * 1000 },
  ADMIN_ACTION: { maxAttempts: 20, windowMs: 60 * 1000 },
  PROFILE_ACCESS: { maxAttempts: 50, windowMs: 60 * 1000 },
} as const;

/**
 * Check rate limit against database
 * Returns { allowed, remaining, retryAfter, isLocked }
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = Date.now();
  const windowStart = new Date(now - config.windowMs).toISOString();

  try {
    // Check for active lockout first
    if (config.lockoutMs) {
      const { data: lockout } = await supabase
        .from("rate_limit_lockouts")
        .select("locked_until")
        .eq("key", config.key)
        .gt("locked_until", new Date().toISOString())
        .maybeSingle();

      if (lockout) {
        const lockedUntil = new Date(lockout.locked_until).getTime();
        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.ceil((lockedUntil - now) / 1000),
          isLocked: true,
        };
      }
    }

    // Count attempts in current window
    const { count } = await supabase
      .from("rate_limit_attempts")
      .select("*", { count: "exact", head: true })
      .eq("key", config.key)
      .gte("created_at", windowStart);

    const attemptCount = count || 0;
    const remaining = Math.max(0, config.maxAttempts - attemptCount - 1);

    if (attemptCount >= config.maxAttempts) {
      // Rate limit exceeded
      if (config.lockoutMs) {
        // Create lockout
        const lockedUntil = new Date(now + config.lockoutMs).toISOString();
        await supabase.from("rate_limit_lockouts").upsert({
          key: config.key,
          locked_until: lockedUntil,
          created_at: new Date().toISOString(),
        }, { onConflict: "key" });

        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.ceil(config.lockoutMs / 1000),
          isLocked: true,
        };
      }

      // Calculate when window resets
      const { data: oldestAttempt } = await supabase
        .from("rate_limit_attempts")
        .select("created_at")
        .eq("key", config.key)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const retryAfter = oldestAttempt
        ? Math.ceil((new Date(oldestAttempt.created_at).getTime() + config.windowMs - now) / 1000)
        : Math.ceil(config.windowMs / 1000);

      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    // Record this attempt
    await supabase.from("rate_limit_attempts").insert({
      key: config.key,
      created_at: new Date().toISOString(),
    });

    return {
      allowed: true,
      remaining,
    };
  } catch (error) {
    console.error("[RateLimit] Error checking rate limit:", error);
    // Fail open on error (allow the request) but log it
    return { allowed: true, remaining: config.maxAttempts };
  }
}

/**
 * Clear rate limit attempts for a key (e.g., after successful login)
 */
export async function clearRateLimit(key: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    await supabase.from("rate_limit_attempts").delete().eq("key", key);
    await supabase.from("rate_limit_lockouts").delete().eq("key", key);
  } catch (error) {
    console.error("[RateLimit] Error clearing rate limit:", error);
  }
}

/**
 * Create 429 Too Many Requests response with FR/EN support
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
  language: "fr" | "en" = "fr"
): Response {
  let message: string;
  
  if (result.isLocked) {
    const minutes = Math.ceil((result.retryAfter || 1800) / 60);
    message = language === "fr"
      ? `Trop de tentatives. Veuillez réessayer dans ${minutes} minutes.`
      : `Too many attempts. Please retry in ${minutes} minutes.`;
  } else {
    const seconds = result.retryAfter || 60;
    message = language === "fr"
      ? `Limite de requêtes atteinte. Réessayez dans ${seconds} secondes.`
      : `Rate limit reached. Retry in ${seconds} seconds.`;
  }

  return new Response(
    JSON.stringify({
      error: "rate_limit_exceeded",
      message,
      retry_after: result.retryAfter,
      is_locked: result.isLocked,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter || 60),
      },
    }
  );
}

/**
 * Log rate limit event for security monitoring
 */
export async function logRateLimitEvent(
  key: string,
  action: string,
  details?: Record<string, any>
): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    await supabase.from("admin_audit_log").insert({
      admin_user_id: "00000000-0000-0000-0000-000000000000", // System user
      action: "rate_limit_triggered",
      target_type: "security",
      details: {
        key,
        rate_limit_action: action,
        ...details,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[RateLimit] Error logging event:", error);
  }
}
