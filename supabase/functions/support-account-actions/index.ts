/**
 * support-account-actions — Canonical Edge Function for Module 35.
 *
 * SINGLE DOOR for all support ticket writes. Every producer (Core 360 UI,
 * employee portal, chatbot, Nova, contact form, support-email-inbound,
 * agent-support, etc.) MUST invoke this function.
 *
 * Actions:
 *   - create_ticket
 *   - reply_ticket
 *   - transition_status
 *   - add_participant
 *   - close / reopen / resolve / cancel  (thin wrappers over transition_status)
 *
 * All writes are transactional (RPC atomic).
 * Email enqueue is best-effort post-commit; SMTP failures do NOT rollback.
 * Idempotency via caller-provided idempotency_key (unique per event).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  serviceClient, createTicket, replyTicket, transitionTicket, addParticipant,
  type TicketActor,
} from "../_shared/ticketService.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = new Set(["admin", "employee", "supervisor", "support", "billing_admin", "sales"]);
const CLIENT_ROLES = new Set(["client"]);

// ------------------------------------------------------------
// Authenticate caller: staff via JWT, or internal service call
// ------------------------------------------------------------
async function authCaller(req: Request): Promise<{ actor: TicketActor; ok: boolean; error?: string }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  // Internal service-to-service call (chatbot, Nova, contact-form, etc.)
  const internalSecret = req.headers.get("x-support-internal-secret");
  if (internalSecret && internalSecret === Deno.env.get("SUPPORT_INTERNAL_SECRET")) {
    return {
      ok: true,
      actor: {
        user_id: null,
        role: (req.headers.get("x-actor-role") as TicketActor["role"]) ?? "system",
        name: req.headers.get("x-actor-name") ?? "System",
        email: req.headers.get("x-actor-email") ?? null,
      },
    };
  }

  if (!token) return { ok: false, error: "missing_auth", actor: { user_id: null, role: "system" } };

  const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return { ok: false, error: "invalid_token", actor: { user_id: null, role: "system" } };

  const admin = serviceClient();
  const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const isStaff = roles.some((r) => STAFF_ROLES.has(r));
  const role: TicketActor["role"] = isStaff ? (roles.includes("admin") ? "admin" : "employee") : "client";

  return {
    ok: true,
    actor: {
      user_id: user.id,
      role,
      name: user.user_metadata?.full_name ?? user.email ?? null,
      email: user.email ?? null,
    },
  };
}

async function assertOwnership(admin: ReturnType<typeof serviceClient>, actor: TicketActor, ticketId: string) {
  if (["admin", "employee", "system", "bot"].includes(actor.role)) return true;
  const { data } = await admin
    .from("support_tickets")
    .select("id,user_id,owner_user_id")
    .eq("id", ticketId).maybeSingle();
  if (!data) return false;
  if (data.user_id === actor.user_id || data.owner_user_id === actor.user_id) return true;
  const { data: part } = await admin
    .from("ticket_participants").select("id")
    .eq("ticket_id", ticketId).eq("user_id", actor.user_id ?? "").maybeSingle();
  return !!part;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const rid = crypto.randomUUID().slice(0, 8);
  try {
    const { actor, ok, error } = await authCaller(req);
    if (!ok) return json(401, { error });

    const body = await req.json();
    const action = String(body.action || "");
    const admin = serviceClient();

    // Log every invocation
    console.log(`[support-account-actions][${rid}] action=${action} actor.role=${actor.role} actor.uid=${actor.user_id ?? "-"}`);

    switch (action) {
      case "create_ticket": {
        // client role can only open ticket for themselves
        const owner = body.owner_user_id ?? body.client_user_id ?? actor.user_id;
        if (CLIENT_ROLES.has(actor.role) && owner !== actor.user_id) {
          return json(403, { error: "forbidden_ownership" });
        }
        const ticket = await createTicket(admin, actor, {
          owner_user_id: owner,
          account_id: body.account_id ?? null,
          subject: body.subject,
          description: body.description,
          category: body.category,
          priority: body.priority,
          source: body.source ?? (actor.role === "client" ? "portal" : "core"),
          client_email: body.client_email ?? actor.email ?? null,
          client_name: body.client_name ?? actor.name ?? null,
          related_order_id: body.related_order_id ?? null,
          idempotency_key: body.idempotency_key ?? null,
          metadata: body.metadata ?? {},
        });
        return json(200, { ok: true, ticket_id: ticket.id, ticket_number: ticket.ticket_number });
      }

      case "reply_ticket": {
        if (!body.ticket_id) return json(400, { error: "ticket_id_required" });
        if (!(await assertOwnership(admin, actor, body.ticket_id))) return json(403, { error: "forbidden" });
        const reply = await replyTicket(admin, actor, {
          ticket_id: body.ticket_id,
          content: body.content ?? body.message,
          is_internal_note: !!body.is_internal_note,
          email_message_id: body.email_message_id ?? null,
          subject: body.subject ?? null,
          attachments: body.attachments ?? [],
          idempotency_key: body.idempotency_key ?? null,
        });
        return json(200, { ok: true, reply_id: reply.id });
      }

      case "transition_status":
      case "resolve":
      case "close":
      case "reopen":
      case "cancel": {
        if (!body.ticket_id) return json(400, { error: "ticket_id_required" });
        if (!(await assertOwnership(admin, actor, body.ticket_id))) return json(403, { error: "forbidden" });
        // clients cannot resolve/close, only cancel their own or reopen
        const toStatusMap: Record<string, string> = {
          resolve: "resolved", close: "closed", reopen: "open", cancel: "cancelled",
        };
        const toStatus = action === "transition_status" ? body.to_status : toStatusMap[action];
        if (!toStatus) return json(400, { error: "to_status_required" });
        if (CLIENT_ROLES.has(actor.role) && !["cancelled", "open"].includes(toStatus)) {
          return json(403, { error: "forbidden_status_for_client" });
        }
        const ticket = await transitionTicket(admin, actor, {
          ticket_id: body.ticket_id,
          to_status: toStatus as never,
          reason: body.reason ?? body.__audit_reason ?? "no_reason",
          source: body.source ?? "core",
          metadata: body.metadata ?? {},
        });
        return json(200, { ok: true, ticket_id: ticket.id, status: ticket.status });
      }

      case "add_participant": {
        if (actor.role !== "admin" && actor.role !== "employee" && actor.role !== "system" && actor.role !== "bot") {
          return json(403, { error: "staff_only" });
        }
        if (!body.ticket_id || !body.user_id) return json(400, { error: "ticket_id_and_user_id_required" });
        const p = await addParticipant(admin, actor, {
          ticket_id: body.ticket_id, user_id: body.user_id,
          user_email: body.user_email ?? null, user_name: body.user_name ?? null,
          role: body.participant_role, can_reply: body.can_reply, can_reassign: body.can_reassign,
        });
        return json(200, { ok: true, participant_id: p.id });
      }

      case "assign_ticket": {
        // Staff-only. Assigns / reassigns a ticket to an internal user.
        if (!["admin", "employee", "system", "bot"].includes(actor.role)) {
          return json(403, { error: "staff_only" });
        }
        if (!body.ticket_id) return json(400, { error: "ticket_id_required" });
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.assigned_to_user_id !== undefined) update.assigned_to_user_id = body.assigned_to_user_id;
        if (body.assigned_to !== undefined) update.assigned_to = body.assigned_to;
        if (body.assigned_department !== undefined) update.assigned_department = body.assigned_department;
        const { error: upErr } = await admin.from("support_tickets").update(update).eq("id", body.ticket_id);
        if (upErr) return json(400, { error: upErr.message });
        await admin.from("admin_audit_log").insert({
          action: "ticket.assigned",
          admin_user_id: actor.user_id,
          target_id: body.ticket_id,
          target_type: "support_ticket",
          details: { role: actor.role, ...update, reason: body.reason ?? null },
        }).then(() => undefined, () => undefined);
        return json(200, { ok: true, ticket_id: body.ticket_id });
      }

      case "update_ticket_meta": {
        // Staff-only. Update non-state metadata (priority/category/related_order/etc).
        if (!["admin", "employee", "system", "bot"].includes(actor.role)) {
          return json(403, { error: "staff_only" });
        }
        if (!body.ticket_id) return json(400, { error: "ticket_id_required" });
        const allow = [
          "priority", "category", "issue_type",
          "related_order_id", "related_order_reference",
          "requires_id_upload", "id_verification_status",
          "cc_user_ids", "attachments", "internal_notes",
          "tags", "route_to",
        ];
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of allow) if (body[k] !== undefined) update[k] = body[k];
        // "status" MUST go through transition_status — forbid here
        if ("status" in body) {
          return json(400, { error: "use_transition_status_for_status_changes" });
        }
        const { error: upErr } = await admin.from("support_tickets").update(update).eq("id", body.ticket_id);
        if (upErr) return json(400, { error: upErr.message });
        await admin.from("admin_audit_log").insert({
          action: "ticket.meta_updated",
          admin_user_id: actor.user_id,
          target_id: body.ticket_id,
          target_type: "support_ticket",
          details: { role: actor.role, fields: Object.keys(update) },
        }).then(() => undefined, () => undefined);
        return json(200, { ok: true, ticket_id: body.ticket_id });
      }

      case "enqueue_ticket_notification": {
        // Staff-only. Enqueue internal-participant notification emails.
        if (!["admin", "employee", "system", "bot"].includes(actor.role)) {
          return json(403, { error: "staff_only" });
        }
        const rows = Array.isArray(body.rows) ? body.rows : [];
        if (rows.length === 0) return json(200, { ok: true, inserted: 0 });
        const cleaned = rows.map((r: any) => ({
          to_email: r.to_email,
          template_key: r.template_key,
          template_vars: r.template_vars ?? {},
          dedupe_key: r.dedupe_key ?? r.event_key ?? null,
          status: "queued",
          priority: r.priority ?? 0,
        }));
        const { error: qErr } = await admin.from("email_queue").insert(cleaned);
        if (qErr && !qErr.message?.includes("duplicate key")) {
          return json(400, { error: qErr.message });
        }
        return json(200, { ok: true, inserted: cleaned.length });
      }

      default:
        return json(400, { error: `unknown_action:${action}` });
    }
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    console.error(`[support-account-actions][${rid}] ERROR ${msg}`);
    return json(500, { error: msg, request_id: rid });
  }
});
