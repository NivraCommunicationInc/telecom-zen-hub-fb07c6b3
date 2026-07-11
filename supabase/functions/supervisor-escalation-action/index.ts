/**
 * supervisor-escalation-action — Canonical Door for Supervisor Escalations.
 *
 * Module 36 — Phase B.
 *
 * The ONLY authorized write path for internal_tickets rows where
 * assigned_to_department = 'supervisor'. Direct client-side INSERTs are blocked
 * at the DB level by the INVARIANT-ESCALATION-SINGLE-DOOR trigger; this
 * function bypasses that guard via the `app.escalation_write_ok` session flag.
 *
 * Guarantees:
 *  - JWT authenticated + active user
 *  - RBAC enforced server-side (core_admin / core_staff / supervisor / support)
 *  - Author identity (id/email/role) sourced from JWT + DB, never from client
 *  - Strict input validation (zod)
 *  - Idempotency via idempotency_key (unique partial index)
 *  - Server-generated: category, assigned_to_department, priority, status,
 *    ticket_number (via DB), escalation_type sanitized enum
 *  - Audit: admin_audit_log entry
 *  - Notification: email_queue entry with unique event_key (bilingual-ready)
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ESCALATION_TYPES = [
  "billing",
  "technical",
  "retention",
  "complaint",
  "fraud",
  "other",
] as const;

const AUTHORIZED_ROLES = new Set([
  "core_admin",
  "core_staff",
  "supervisor",
  "support",
  "admin",
]);

const BodySchema = z.object({
  account_id: z.string().uuid(),
  client_user_id: z.string().uuid(),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(5000),
  escalation_type: z.enum(ESCALATION_TYPES),
  idempotency_key: z.string().trim().min(8).max(120),
  client_email: z.string().email().max(320).optional().nullable(),
  client_name: z.string().trim().max(200).optional().nullable(),
  related_support_ticket_id: z.string().uuid().optional().nullable(),
  __audit_reason: z.string().optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  // Admin/service client for privileged reads + writes
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false },
  });

  // --- RBAC: check active role from DB (never from client) ---
  const { data: roles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (rolesErr) return json(500, { error: "rbac_lookup_failed", detail: rolesErr.message });

  const actorRoles = (roles ?? []).map((r: any) => String(r.role));
  const authorized = actorRoles.some((r) => AUTHORIZED_ROLES.has(r));
  if (!authorized) return json(403, { error: "forbidden_role", roles: actorRoles });

  // Canonical author role for the ticket (prefer core_staff/admin/supervisor)
  const authorRole =
    actorRoles.find((r) => ["core_admin", "admin"].includes(r)) ??
    actorRoles.find((r) => ["core_staff", "supervisor", "support"].includes(r)) ??
    actorRoles[0];

  // Author display name from profiles (server-sourced)
  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", userId)
    .maybeSingle();
  const authorName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.email ||
    userEmail ||
    "Core";

  // --- Atomic idempotent insert via SECURITY DEFINER RPC ---
  // The RPC sets app.escalation_write_ok in the same transaction as the INSERT,
  // which is required to bypass INVARIANT-ESCALATION-SINGLE-DOOR.
  const { data: rpcRows, error: rpcErr } = await admin.rpc(
    "rpc_create_supervisor_escalation" as any,
    {
      p_account_id: b.account_id,
      p_client_user_id: b.client_user_id,
      p_related_support_ticket_id: b.related_support_ticket_id ?? null,
      p_idempotency_key: b.idempotency_key,
      p_escalation_type: b.escalation_type,
      p_subject: `[ESCALATION] ${b.subject}`,
      p_description: b.description,
      p_created_by_id: userId,
      p_created_by_name: authorName,
      p_created_by_role: authorRole,
      p_created_by_email: userEmail,
    },
  );

  if (rpcErr) {
    return json(500, { error: "insert_failed", detail: rpcErr.message });
  }
  const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
  if (!row?.id) return json(500, { error: "insert_failed", detail: "no_row_returned" });

  const ticketId = row.id as string;
  const ticketNumber = (row.ticket_number ?? null) as string | null;
  const wasIdempotent = Boolean(row.idempotent);

  if (wasIdempotent) {
    return json(200, {
      ok: true,
      idempotent: true,
      ticket_id: ticketId,
      ticket_number: ticketNumber,
    });
  }

  // --- Audit (best-effort but logged) ---
  const { error: auditErr } = await admin.from("admin_audit_log").insert({
    admin_user_id: userId,
    admin_email: userEmail,
    action: "supervisor_escalation",
    target_type: "internal_ticket",
    target_id: ticketId,
    details: {
      account_id: b.account_id,
      client_user_id: b.client_user_id,
      escalation_type: b.escalation_type,
      ticket_number: ticketNumber,
      idempotency_key: b.idempotency_key,
      reason: b.__audit_reason ?? null,
      actor_role: authorRole,
    },
  } as any);
  if (auditErr) console.error("[supervisor-escalation-action] audit failed:", auditErr.message);

  // --- Email queue (idempotent via event_key) ---
  // Server-source client email/name from profiles when not supplied by caller.
  let clientEmail = b.client_email ?? null;
  let clientName = b.client_name ?? null;
  if (!clientEmail || !clientName) {
    const { data: clientProfile } = await admin
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", b.client_user_id)
      .maybeSingle();
    if (!clientEmail) clientEmail = clientProfile?.email ?? null;
    if (!clientName) {
      clientName =
        [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ").trim() ||
        clientProfile?.email ||
        null;
    }
  }

  if (clientEmail) {
    const eventKey = `supervisor_escalation:${b.idempotency_key}`;
    let mailErr: any = null;
    try { await enqueueCommunication({
      channel: "email",
      templateKey: "supervisor_escalation",
      recipient: clientEmail,
      idempotencyKey: b.idempotency_key,
      templateVars: {
        client_name: clientName,
        subject: b.subject,
        description: b.description,
        ticket_number: ticketNumber,
        escalation_type: b.escalation_type,
        language: "fr",
      },
      subject: "Votre demande a été escaladée",
      entityType: "internal_ticket",
      entityId: ticketId,
    }); } catch (__e) { mailErr = __e; }
    if (mailErr && (mailErr as any).code !== "23505") {
      console.error("[supervisor-escalation-action] email_queue failed:", mailErr.message);
    }
  }


  return json(200, {
    ok: true,
    ticket_id: ticketId,
    ticket_number: ticketNumber,
  });
});
