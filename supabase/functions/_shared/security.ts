/**
 * Shared security helpers for Edge Functions.
 *
 * Authentication, input validation, request guards, and audit logging.
 * Works alongside existing _shared/cors.ts, _shared/rateLimit.ts, _shared/errorUtils.ts.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// ── Auth helpers ──────────────────────────────────────────────

/**
 * Extract and validate the authenticated user from the request.
 * Returns the user and a Supabase client scoped to their session.
 */
export async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw { status: 401, message: "Non authentifié" };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw { status: 401, message: "Session invalide" };
  }

  return {
    userId: data.user.id,
    claims: data.user,
    supabase,
  };
}

/**
 * Require the caller to have a specific app_role via the has_role() DB function.
 */
export async function requireRole(
  req: Request,
  role: "admin" | "employee"
) {
  const auth = await requireAuth(req);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await admin.rpc("has_role", {
    _user_id: auth.userId,
    _role: role,
  });

  if (!data) {
    throw { status: 403, message: "Accès non autorisé" };
  }

  return { ...auth, adminClient: admin };
}

// ── Input validation ──────────────────────────────────────────

export function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") throw { status: 400, message: "Valeur de texte attendue" };
  return value.trim().slice(0, maxLength).replace(/<[^>]*>/g, "");
}

export function sanitizeEmail(value: unknown): string {
  const str = sanitizeString(value, 254);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(str)) throw { status: 400, message: "Adresse courriel invalide" };
  return str.toLowerCase();
}

export function sanitizePhone(value: unknown): string {
  const str = sanitizeString(value, 20);
  const digits = str.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) throw { status: 400, message: "Numéro de téléphone invalide" };
  return str;
}

export function sanitizeAmount(value: unknown): number {
  const num = Number(value);
  if (isNaN(num) || num < 0 || num > 100000) throw { status: 400, message: "Montant invalide" };
  return Math.round(num * 100) / 100;
}

// ── Request guards ────────────────────────────────────────────

/**
 * Reject requests with body larger than maxBytes (default 50KB).
 */
export function checkBodySize(req: Request, maxBytes = 50_000): void {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw { status: 413, message: "Requête trop volumineuse" };
  }
}

/**
 * Require specific HTTP method(s).
 */
export function requireMethod(req: Request, methods: string | string[]): void {
  const allowed = Array.isArray(methods) ? methods : [methods];
  if (!allowed.includes(req.method)) {
    throw { status: 405, message: "Méthode non autorisée" };
  }
}

// ── Security audit logging ────────────────────────────────────

/**
 * Fire-and-forget security event logging.
 * Never blocks the main flow; silently drops on error.
 */
export async function logSecurityEvent(
  event: {
    user_id: string | null;
    action: string;
    resource: string;
    ip: string | null;
    success: boolean;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("security_audit_log").insert({
      user_id: event.user_id,
      action: event.action,
      resource: event.resource,
      ip: event.ip,
      success: event.success,
      details: event.details || {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // Silent — audit logging must never crash the main flow
  }
}

/**
 * Extract client IP from request headers (Cloudflare / proxy chain).
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
