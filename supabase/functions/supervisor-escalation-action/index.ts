/**
 * supervisor-escalation-action — Canonical Door for Supervisor Escalations.
 *
 * Module 36 (create) + Module 45 (state machine, journal, notifications).
 *
 * Actions:
 *  - create          : create a new supervisor escalation ticket
 *  - assign          : assigned_to_id set + status open -> assigned
 *  - transition      : investigating / waiting_information / resolved / closed
 *
 * All writes go through:
 *  - rpc_create_supervisor_escalation      (create)
 *  - rpc_supervisor_escalation_transition  (assign + transition)
 *
 * Every action:
 *  - JWT authenticated (except server-to-server via BOOTSTRAP_TOKEN)
 *  - RBAC enforced server-side
 *  - Idempotency via escalation_action_idempotency (SHA-256 request hash)
 *  - Audit: admin_audit_log
 *  - Journal Client 360: writeAccountJournal(client_activity_logs, staff)
 *  - Notification: rpc_communication_enqueue
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOOTSTRAP_TOKEN = Deno.env.get("BOOTSTRAP_TOKEN") ?? "";

const ESCALATION_TYPES = ["billing","technical","retention","complaint","fraud","other"] as const;
const AUTHORIZED_ROLES = new Set(["core_admin","core_staff","supervisor","support","admin","employee"]);
const TERMINAL = new Set(["resolved","closed"]);

const CreateSchema = z.object({
  action: z.literal("create").optional(),
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

const TransitionSchema = z.object({
  action: z.enum(["assign","transition"]),
  ticket_id: z.string().uuid(),
  new_status: z.enum(["assigned","investigating","waiting_information","resolved","closed"]),
  reason: z.string().trim().min(3).max(500),
  idempotency_key: z.string().trim().min(8).max(120),
  assignee_id: z.string().uuid().optional().nullable(),
  assignee_name: z.string().trim().max(200).optional().nullable(),
  __audit_reason: z.string().optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  // --- Auth: JWT OR bootstrap token (QA runner) ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const bootstrapHeader = req.headers.get("x-bootstrap-token") ?? "";
  const bodyBypass = req.headers.get("x-qa-actor-id");
  let userId = "";
  let userEmail: string | null = null;

  if (BOOTSTRAP_TOKEN && bootstrapHeader === BOOTSTRAP_TOKEN && bodyBypass) {
    userId = bodyBypass;
    userEmail = req.headers.get("x-qa-actor-email");
  } else {
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsRes, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) return json(401, { error: "unauthorized" });
    userId = claimsRes.claims.sub as string;
    userEmail = (claimsRes.claims.email as string | undefined) ?? null;
  }

  // --- Parse body ---
  let raw: any;
  try { raw = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  const actionName = (raw?.action as string | undefined) ?? "create";

  // --- RBAC: check active role from DB ---
  const { data: roles, error: rolesErr } = await admin
    .from("user_roles").select("role, status").eq("user_id", userId).eq("status", "active");
  if (rolesErr) return json(500, { error: "rbac_lookup_failed", detail: rolesErr.message });
  const actorRoles = (roles ?? []).map((r: any) => String(r.role));
  const authorized = actorRoles.some((r) => AUTHORIZED_ROLES.has(r));
  if (!authorized) return json(403, { error: "forbidden_role", roles: actorRoles });

  const authorRole =
    actorRoles.find((r) => ["core_admin","admin"].includes(r)) ??
    actorRoles.find((r) => ["core_staff","supervisor","support"].includes(r)) ??
    actorRoles.find((r) => ["employee","technician"].includes(r)) ??
    "employee";

  // Author display name
  const { data: profile } = await admin.from("profiles")
    .select("first_name, last_name, email").eq("id", userId).maybeSingle();
  const authorName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim()
    || profile?.email || userEmail || "Core";

  // --- Idempotency common ---
  const idempotencyKey = raw?.idempotency_key as string;
  const reqHash = idempotencyKey ? await sha256(JSON.stringify(raw)) : "";
  if (idempotencyKey) {
    const { data: cached } = await admin
      .from("escalation_action_idempotency")
      .select("request_hash, response, expires_at")
      .eq("idempotency_key", idempotencyKey).maybeSingle();
    if (cached && new Date(cached.expires_at) > new Date()) {
      if (cached.request_hash !== reqHash) {
        return json(409, { error: "idempotency_conflict" });
      }
      return json(200, { ...(cached.response as any), replayed: true });
    }
  }

  // ============================================================
  // CREATE
  // ============================================================
  if (actionName === "create") {
    const parsed = CreateSchema.safeParse(raw);
    if (!parsed.success) return json(400, { error: "invalid_input", details: parsed.error.flatten() });
    const b = parsed.data;

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
    if (rpcErr) return json(500, { error: "insert_failed", detail: rpcErr.message });
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!row?.id) return json(500, { error: "insert_failed", detail: "no_row_returned" });

    const ticketId = row.id as string;
    const ticketNumber = (row.ticket_number ?? null) as string | null;
    const wasIdempotent = Boolean(row.idempotent);
    const response = { ok: true, ticket_id: ticketId, ticket_number: ticketNumber, idempotent: wasIdempotent };

    if (!wasIdempotent) {
      await admin.from("admin_audit_log").insert({
        admin_user_id: userId, admin_email: userEmail,
        action: "supervisor_escalation:create",
        target_type: "internal_ticket", target_id: ticketId,
        details: { account_id: b.account_id, client_user_id: b.client_user_id, escalation_type: b.escalation_type, ticket_number: ticketNumber, idempotency_key: b.idempotency_key, reason: b.__audit_reason ?? null, actor_role: authorRole },
      } as any);

      // Journal Client 360 (staff visibility)
      try {
        await writeAccountJournal(admin, {
          targetTable: "client_activity_logs",
          eventKey: `escalation:${ticketId}:created`,
          correlationId: ticketId,
          visibility: "staff",
          payload: {
            client_id: b.client_user_id,
            action_type: "supervisor_escalation_created",
            summary: `Escalade superviseur — ${b.escalation_type}: ${b.subject}`,
            details: { ticket_id: ticketId, ticket_number: ticketNumber, escalation_type: b.escalation_type },
            actor_name: authorName, actor_role: authorRole,
          },
          actor: { userId, role: authorRole, name: authorName, email: userEmail },
        });
      } catch (e) { console.error("[m45] journal create failed:", (e as Error).message); }

      // Client email + supervisor internal notification
      let clientEmail = b.client_email ?? null;
      let clientName = b.client_name ?? null;
      if (!clientEmail || !clientName) {
        const { data: cp } = await admin.from("profiles").select("email, first_name, last_name").eq("id", b.client_user_id).maybeSingle();
        clientEmail ??= cp?.email ?? null;
        clientName ??= [cp?.first_name, cp?.last_name].filter(Boolean).join(" ").trim() || cp?.email || null;
      }
      if (clientEmail) {
        try { await enqueueCommunication({
          channel: "email", templateKey: "supervisor_escalation",
          recipient: clientEmail, idempotencyKey: b.idempotency_key,
          templateVars: { client_name: clientName, subject: b.subject, description: b.description, ticket_number: ticketNumber, escalation_type: b.escalation_type, language: "fr" },
          subject: "Votre demande a été escaladée",
          entityType: "internal_ticket", entityId: ticketId,
        }); } catch (e) { console.error("[m45] email failed:", (e as Error).message); }
      }
      // Internal supervisor notification (best-effort)
      try { await enqueueCommunication({
        channel: "notification", templateKey: "supervisor_escalation_created_internal",
        recipient: `internal:supervisor`, idempotencyKey: `${b.idempotency_key}:internal`,
        templateVars: { ticket_id: ticketId, ticket_number: ticketNumber, escalation_type: b.escalation_type, subject: b.subject, actor: authorName },
        entityType: "internal_ticket", entityId: ticketId,
      }); } catch (e) { console.error("[m45] internal notif failed:", (e as Error).message); }
    }

    if (idempotencyKey && !wasIdempotent) {
      await admin.from("escalation_action_idempotency").upsert({ idempotency_key: idempotencyKey, request_hash: reqHash, response });
    }
    return json(200, response);
  }

  // ============================================================
  // ASSIGN / TRANSITION
  // ============================================================
  if (actionName === "assign" || actionName === "transition") {
    const parsed = TransitionSchema.safeParse(raw);
    if (!parsed.success) return json(400, { error: "invalid_input", details: parsed.error.flatten() });
    const b = parsed.data;

    // For 'resolved' and 'closed', require admin/supervisor role (not plain support/employee)
    const canTerminal = actorRoles.some((r) => ["core_admin","admin","supervisor","core_staff"].includes(r));
    if (TERMINAL.has(b.new_status) && !canTerminal) {
      return json(403, { error: "forbidden_terminal_transition" });
    }
    if (b.action === "assign" && !b.assignee_id) {
      return json(400, { error: "assignee_required" });
    }

    const { data: rpcRows, error: rpcErr } = await admin.rpc(
      "rpc_supervisor_escalation_transition" as any,
      {
        p_ticket_id: b.ticket_id,
        p_new_status: b.new_status,
        p_actor_id: userId,
        p_actor_name: authorName,
        p_actor_role: authorRole,
        p_reason: b.reason,
        p_assignee_id: b.assignee_id ?? null,
        p_assignee_name: b.assignee_name ?? null,
      },
    );
    if (rpcErr) {
      const msg = rpcErr.message || "";
      if (msg.includes("invalid_transition")) return json(409, { error: "invalid_transition", detail: msg });
      if (msg.includes("ticket_not_found")) return json(404, { error: "ticket_not_found" });
      return json(500, { error: "transition_failed", detail: msg });
    }
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

    // Audit
    await admin.from("admin_audit_log").insert({
      admin_user_id: userId, admin_email: userEmail,
      action: `supervisor_escalation:${b.new_status}`,
      target_type: "internal_ticket", target_id: b.ticket_id,
      details: { old_status: row.old_status, new_status: row.new_status, ticket_number: row.ticket_number, reason: b.reason, assignee_id: b.assignee_id ?? null, actor_role: authorRole },
    } as any);

    // Journal Client 360 (staff)
    try {
      await writeAccountJournal(admin, {
        targetTable: "client_activity_logs",
        eventKey: `escalation:${b.ticket_id}:${b.new_status}`,
        correlationId: b.ticket_id,
        visibility: "staff",
        payload: {
          client_id: row.client_user_id,
          action_type: `supervisor_escalation_${b.new_status}`,
          summary: `Escalade superviseur — ${row.old_status} → ${b.new_status}`,
          details: { ticket_id: b.ticket_id, ticket_number: row.ticket_number, reason: b.reason, assignee_id: b.assignee_id ?? null },
          actor_name: authorName, actor_role: authorRole,
        },
        actor: { userId, role: authorRole, name: authorName, email: userEmail },
      });
    } catch (e) { console.error("[m45] journal transition failed:", (e as Error).message); }

    // Notifications
    try {
      if (b.new_status === "assigned" && b.assignee_id) {
        const { data: ap } = await admin.from("profiles").select("email, first_name, last_name").eq("id", b.assignee_id).maybeSingle();
        if (ap?.email) {
          await enqueueCommunication({
            channel: "email", templateKey: "supervisor_escalation_assigned",
            recipient: ap.email, idempotencyKey: `${b.idempotency_key}:notif`,
            templateVars: { ticket_number: row.ticket_number, actor: authorName, reason: b.reason },
            subject: "Escalade superviseur assignée",
            entityType: "internal_ticket", entityId: b.ticket_id,
          });
        }
      } else if (b.new_status === "resolved" || b.new_status === "closed") {
        if (row.created_by_email) {
          await enqueueCommunication({
            channel: "email", templateKey: `supervisor_escalation_${b.new_status}`,
            recipient: row.created_by_email, idempotencyKey: `${b.idempotency_key}:notif`,
            templateVars: { ticket_number: row.ticket_number, actor: authorName, reason: b.reason, new_status: b.new_status },
            subject: b.new_status === "resolved" ? "Votre escalade est résolue" : "Votre escalade est fermée",
            entityType: "internal_ticket", entityId: b.ticket_id,
          });
        }
      }
    } catch (e) { console.error("[m45] transition notif failed:", (e as Error).message); }

    const response = { ok: true, ticket_id: b.ticket_id, ticket_number: row.ticket_number, old_status: row.old_status, new_status: row.new_status };
    if (idempotencyKey) {
      await admin.from("escalation_action_idempotency").upsert({ idempotency_key: idempotencyKey, request_hash: reqHash, response });
    }
    return json(200, response);
  }

  return json(400, { error: "unknown_action", action: actionName });
});
