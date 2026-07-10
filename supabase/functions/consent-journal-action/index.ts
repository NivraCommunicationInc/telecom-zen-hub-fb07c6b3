/**
 * consent-journal-action — Canonical Door for Loi 25 consent records.
 *
 * Module 37 — Phase B.
 *
 * The ONLY authorized write path for public.consent_records. Direct
 * INSERT/UPDATE/DELETE from clients is blocked at the DB level (RLS + no grants
 * on write). This function calls the SECURITY DEFINER RPC
 * `rpc_create_consent_record` which enforces append-only semantics and
 * idempotency.
 *
 * Guarantees:
 *  - JWT authenticated + active user
 *  - RBAC server-side:
 *      * a client can create ONLY their own consent
 *      * staff (admin/core_admin/core_staff/supervisor/support/kyc_agent/billing_admin)
 *        can create on behalf of another subject
 *  - Author identity (id/email/role) sourced from JWT + DB, never from client
 *  - Strict input validation (zod) + length caps + enum whitelists
 *  - Compliance fields captured server-side: IP, User-Agent, timestamp,
 *    consent_text_version, consent_text_hash
 *  - Idempotency via idempotency_key (unique index in DB, RPC returns existing)
 *  - Audit: admin_audit_log
 *  - Notification: email_queue with unique event_key
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CONSENT_TYPES = [
  "marketing_email",
  "marketing_sms",
  "marketing_phone",
  "data_processing",
  "data_sharing_partners",
  "cookies_analytics",
  "cookies_marketing",
  "credit_check",
  "identity_verification",
  "recording_calls",
  "biometrics",
  "loi25_general",
  "other",
] as const;

const CONSENT_STATUSES = [
  "granted",
  "denied",
  "withdrawn",
  "expired",
  "pending",
] as const;

const CONSENT_CHANNELS = [
  "portal",
  "core",
  "field",
  "phone",
  "email",
  "in_person",
  "chatbot",
  "public_form",
  "other",
] as const;

const STAFF_ROLES = new Set([
  "admin",
  "core_admin",
  "core_staff",
  "supervisor",
  "support",
  "kyc_agent",
  "billing_admin",
  "employee",
]);

const BodySchema = z.object({
  subject_user_id: z.string().uuid(),
  consent_type: z.enum(CONSENT_TYPES),
  status: z.enum(CONSENT_STATUSES),
  channel: z.enum(CONSENT_CHANNELS),
  idempotency_key: z.string().trim().min(8).max(120),
  account_id: z.string().uuid().optional().nullable(),
  consent_text_version: z.string().trim().max(60).optional().nullable(),
  consent_text: z.string().trim().max(20000).optional().nullable(),
  proof_ref: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  __audit_reason: z.string().optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string | null {
  const raw =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip");
  if (!raw) return null;
  // Basic sanity — inet cast will reject bad values anyway
  return raw.slice(0, 64);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsRes?.claims?.sub) return json(401, { error: "unauthorized" });

  const userId = claimsRes.claims.sub as string;
  const userEmail = (claimsRes.claims.email as string | undefined) ?? null;

  // --- Parse body ---
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "invalid_input", details: parsed.error.flatten() });
  }
  const b = parsed.data;

  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false },
  });

  // --- RBAC: fetch active roles from DB (never trust client) ---
  const { data: roleRows, error: rolesErr } = await admin
    .from("user_roles")
    .select("role, status, is_active")
    .eq("user_id", userId);
  if (rolesErr) return json(500, { error: "rbac_lookup_failed", detail: rolesErr.message });

  const activeRoles = (roleRows ?? [])
    .filter((r: any) => (r.status ?? "active") === "active" && r.is_active !== false)
    .map((r: any) => String(r.role));

  const isStaff = activeRoles.some((r) => STAFF_ROLES.has(r));
  const isSelf = b.subject_user_id === userId;

  if (!isSelf && !isStaff) {
    return json(403, { error: "forbidden_cannot_consent_for_others" });
  }

  // Canonical author role
  const authorRole = isSelf && !isStaff
    ? "subject"
    : (activeRoles.find((r) => ["core_admin", "admin"].includes(r)) ??
       activeRoles.find((r) => STAFF_ROLES.has(r)) ??
       "staff");

  // Author display name/email from profiles
  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle();
  const authorEmail = profile?.email ?? userEmail ?? null;

  // --- Compliance capture (server-side) ---
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const consentTextHash = b.consent_text ? await sha256Hex(b.consent_text) : null;

  // --- Atomic idempotent insert via RPC ---
  const { data: rpcRows, error: rpcErr } = await admin.rpc(
    "rpc_create_consent_record" as any,
    {
      p_subject_user_id: b.subject_user_id,
      p_consent_type: b.consent_type,
      p_status: b.status,
      p_channel: b.channel,
      p_idempotency_key: b.idempotency_key,
      p_account_id: b.account_id ?? null,
      p_proof_ref: b.proof_ref ?? null,
      p_proof_hash: null,
      p_consent_text_version: b.consent_text_version ?? null,
      p_consent_text_hash: consentTextHash,
      p_ip_address: clientIp,
      p_user_agent: userAgent,
      p_notes: b.notes ?? null,
      p_recorded_by_user_id: userId,
      p_recorded_by_role: authorRole,
      p_recorded_by_email: authorEmail,
    },
  );

  if (rpcErr) {
    return json(500, { error: "insert_failed", detail: rpcErr.message });
  }
  const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (!row?.id) return json(500, { error: "insert_failed", detail: "no_row_returned" });

  const consentId = row.id as string;

  // --- Audit ---
  const { error: auditErr } = await admin.from("admin_audit_log").insert({
    admin_user_id: userId,
    admin_email: authorEmail,
    action: "consent_recorded",
    target_type: "consent_record",
    target_id: consentId,
    details: {
      subject_user_id: b.subject_user_id,
      account_id: b.account_id ?? null,
      consent_type: b.consent_type,
      status: b.status,
      channel: b.channel,
      idempotency_key: b.idempotency_key,
      consent_text_version: b.consent_text_version ?? null,
      consent_text_hash: consentTextHash,
      actor_role: authorRole,
      is_self: isSelf,
      reason: b.__audit_reason ?? null,
    },
  } as any);
  if (auditErr) console.error("[consent-journal-action] audit failed:", auditErr.message);

  // --- Email queue (idempotent) ---
  // Notify the subject that a consent has been recorded (Loi 25 traceability).
  const { data: subjectProfile } = await admin
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", b.subject_user_id)
    .maybeSingle();
  const subjectEmail = subjectProfile?.email ?? null;
  const subjectName =
    [subjectProfile?.first_name, subjectProfile?.last_name].filter(Boolean).join(" ").trim() ||
    subjectEmail || "";

  if (subjectEmail) {
    const eventKey = `consent_recorded:${b.idempotency_key}`;
    const { error: mailErr } = await admin.from("email_queue").insert({
      event_key: eventKey,
      idempotency_key: b.idempotency_key,
      to_email: subjectEmail,
      subject: "Confirmation d'enregistrement de consentement (Loi 25)",
      template_key: "consent_recorded",
      template_vars: {
        client_name: subjectName,
        consent_type: b.consent_type,
        status: b.status,
        channel: b.channel,
        recorded_at: new Date().toISOString(),
        consent_text_version: b.consent_text_version ?? null,
        language: "fr",
      },
      entity_type: "consent_record",
      entity_id: consentId,
      status: "queued",
    } as any);
    if (mailErr && (mailErr as any).code !== "23505") {
      console.error("[consent-journal-action] email_queue failed:", mailErr.message);
    }
  }

  return json(200, {
    ok: true,
    consent_id: consentId,
  });
});
