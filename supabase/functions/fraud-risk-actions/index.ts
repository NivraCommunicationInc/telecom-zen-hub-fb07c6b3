// fraud-risk-actions — Module 43 Phase 2
// Staff-only fraud & risk-score operations for a client account.
// Actions:
//   - list
//   - create_incident       (auto-applies risk_score_delta to account_risk_scores)
//   - update_status         (state-machine enforced; escalate → notification)
//   - upsert_score
//
// Phase 2 additions vs. legacy:
//   - Zod validation
//   - Idempotency via public.fraud_action_idempotency
//   - Client Timeline journal via rpc_account_journal_write
//   - State machine (open → investigating → {resolved|false_positive|escalated};
//     escalated → {resolved|false_positive}; terminal states block returns)
//   - Auto delta score on create_incident (clamp 0-100, recompute risk_level)
//   - Supervisor escalation notification via rpc_communication_enqueue
//   - admin_audit_log unchanged (kept for compliance)

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEVERITY = ["low", "medium", "high", "critical"] as const;
const STATUS = ["open", "investigating", "resolved", "false_positive", "escalated"] as const;
const RISK_LEVEL = ["low", "medium", "high", "critical"] as const;

const SEVERITY_DELTA: Record<(typeof SEVERITY)[number], number> = {
  low: 5,
  medium: 10,
  high: 20,
  critical: 30,
};

// State machine — canonical transitions
const TRANSITIONS: Record<string, ReadonlySet<string>> = {
  open: new Set(["investigating"]),
  investigating: new Set(["resolved", "false_positive", "escalated"]),
  escalated: new Set(["resolved", "false_positive"]),
  resolved: new Set(),
  false_positive: new Set(),
};

const PRESETS = [
  { key: "suspicious_payment", label: "Paiement suspect", severity: "high" },
  { key: "chargeback", label: "Rétrofacturation", severity: "high" },
  { key: "identity_mismatch", label: "Identité non concordante", severity: "critical" },
  { key: "multiple_failed_logins", label: "Connexions échouées répétées", severity: "medium" },
  { key: "velocity_abuse", label: "Abus de vélocité (commandes)", severity: "high" },
  { key: "promo_abuse", label: "Abus de promotions", severity: "medium" },
  { key: "stolen_device", label: "Équipement volé/non retourné", severity: "high" },
  { key: "synthetic_identity", label: "Identité synthétique suspectée", severity: "critical" },
  { key: "other", label: "Autre", severity: "medium" },
];

const BaseSchema = z.object({
  action: z.enum(["list", "create_incident", "update_status", "upsert_score"]),
  clientId: z.string().regex(uuidRe, "clientId must be a UUID"),
  accountId: z.string().regex(uuidRe).nullish(),
  idempotency_key: z.string().regex(uuidRe).optional(),
  reason: z.string().trim().max(500).optional(),

  // create_incident
  incidentType: z.string().trim().min(1).max(64).optional(),
  severity: z.enum(SEVERITY).optional(),
  description: z.string().trim().max(2000).optional(),
  internalNotes: z.string().trim().max(2000).nullish(),

  // update_status
  incidentId: z.string().regex(uuidRe).optional(),
  status: z.enum(STATUS).optional(),
  resolutionNotes: z.string().trim().max(2000).nullish(),

  // upsert_score
  score: z.number().finite().min(0).max(100).optional(),
  riskLevel: z.enum(RISK_LEVEL).optional(),
  factors: z.array(z.record(z.unknown())).optional(),
  notes: z.string().trim().max(2000).nullish(),
});
type Body = z.infer<typeof BaseSchema>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashRequest(action: string, body: Body): Promise<string> {
  const canonical = JSON.stringify({
    action,
    clientId: body.clientId,
    accountId: body.accountId ?? null,
    incidentId: body.incidentId ?? null,
    incidentType: body.incidentType ?? null,
    severity: body.severity ?? null,
    description: body.description ?? null,
    status: body.status ?? null,
    score: body.score ?? null,
    riskLevel: body.riskLevel ?? null,
    reason: body.reason ?? null,
  });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function levelFromScore(s: number): (typeof RISK_LEVEL)[number] {
  if (s >= 80) return "critical";
  if (s >= 60) return "high";
  if (s >= 30) return "medium";
  return "low";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    const admin = createClient(supabaseUrl, serviceKey);

    const { isStaff } = await checkStaffAuth(admin, user.id);
    if (!isStaff) return json({ error: "forbidden" }, 403);

    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    const isCoreAdmin = isAdminData === true;

    // Zod
    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
    const parsed = BaseSchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ error: "validation_failed", details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    const actorId = user.id;
    const actorEmail = user.email ?? null;
    const journalActor = {
      userId: actorId,
      role: isCoreAdmin ? "admin" : "employee",
      name: actorEmail ?? "staff",
      email: actorEmail,
    };

    // -------- LIST (no mutation, no idempotency) --------
    if (body.action === "list") {
      const [{ data: incidents, error: e1 }, { data: scoreRow, error: e2 }] = await Promise.all([
        admin.from("account_fraud_incidents").select("*")
          .eq("client_id", body.clientId)
          .order("detected_at", { ascending: false })
          .limit(100),
        admin.from("account_risk_scores").select("*")
          .eq("client_id", body.clientId)
          .maybeSingle(),
      ]);
      if (e1) return json({ error: e1.message }, 500);
      if (e2) return json({ error: e2.message }, 500);
      return json({ incidents: incidents ?? [], score: scoreRow ?? null, presets: PRESETS });
    }

    // Idempotency (mutations)
    const idempotencyKey = body.idempotency_key ?? req.headers.get("x-idempotency-key") ?? null;
    if (idempotencyKey) {
      const requestHash = await hashRequest(body.action, body);
      const { data: existing } = await admin
        .from("fraud_action_idempotency")
        .select("request_hash, response")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) {
        if (existing.request_hash !== requestHash) {
          return json({ error: "idempotency_key_conflict" }, 409);
        }
        return json({ ...((existing.response as object) ?? { ok: true }), idempotent: true });
      }
      const { error: insErr } = await admin.from("fraud_action_idempotency").insert({
        idempotency_key: idempotencyKey,
        action: body.action,
        actor_id: actorId,
        request_hash: requestHash,
        response: null,
      });
      if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) throw insErr;
    }

    const logAudit = async (action: string, targetType: string, targetId: string, details: Record<string, unknown>) => {
      await admin.from("admin_audit_log").insert({
        admin_user_id: actorId,
        admin_email: actorEmail,
        action: `account_ops.${action}`,
        target_type: targetType,
        target_id: targetId,
        details,
      });
    };

    const writeClientJournal = async (opts: {
      eventPrefix: string;      // fraud subdomain, e.g. "incident_created"
      businessId: string;       // stable id
      actionType: string;       // action_type for activity log
      summary: string;
      details: Record<string, unknown>;
      suffix?: string;          // extra segment for status transitions
    }) => {
      const suffix = opts.suffix ? `:${opts.suffix}` : "";
      const activityKey = `fraud:${body.clientId}:${opts.eventPrefix}:${opts.businessId}${suffix}:activity`;
      const noteKey = `fraud:${body.clientId}:${opts.eventPrefix}:${opts.businessId}${suffix}:note`;
      try {
        await writeAccountJournal(admin, {
          targetTable: "client_activity_logs",
          eventKey: activityKey,
          actor: journalActor,
          payload: {
            client_id: body.clientId,
            action_type: opts.actionType,
            summary: opts.summary,
            metadata: opts.details,
          },
        });
      } catch (err) {
        console.error("[fraud-risk-actions] journal activity failed", activityKey, err);
      }
      try {
        await writeAccountJournal(admin, {
          targetTable: "client_internal_notes",
          eventKey: noteKey,
          actor: journalActor,
          payload: {
            client_id: body.clientId,
            note_type: "security",
            body: opts.summary,
            metadata: opts.details,
          },
        });
      } catch (err) {
        console.error("[fraud-risk-actions] journal note failed", noteKey, err);
      }
    };

    // Apply delta to account_risk_scores (create if absent). Returns new score row.
    const applyDelta = async (delta: number, reason: string, sourceIncidentId: string) => {
      const { data: existing } = await admin
        .from("account_risk_scores")
        .select("*")
        .eq("client_id", body.clientId)
        .maybeSingle();

      const prev = existing?.current_score ?? 0;
      const nextScore = Math.max(0, Math.min(100, Math.round(prev + delta)));
      const nextLevel = levelFromScore(nextScore);

      const payload: Record<string, unknown> = {
        client_id: body.clientId,
        account_id: body.accountId ?? existing?.account_id ?? null,
        current_score: nextScore,
        risk_level: nextLevel,
        factors: existing?.factors ?? [],
        notes: existing?.notes ?? null,
        last_assessed_at: new Date().toISOString(),
        last_assessed_by: actorId,
        last_assessed_by_email: actorEmail,
      };

      let row;
      if (existing?.id) {
        const { data, error } = await admin.from("account_risk_scores")
          .update(payload).eq("id", existing.id).select().single();
        if (error) throw error;
        row = data;
      } else {
        const { data, error } = await admin.from("account_risk_scores")
          .insert(payload).select().single();
        if (error) throw error;
        row = data;
      }

      await logAudit("risk_score_auto_adjust", "risk_score", row.id, {
        client_id: body.clientId,
        delta,
        previous_score: prev,
        new_score: nextScore,
        new_level: nextLevel,
        source_incident_id: sourceIncidentId,
        reason,
      });
      await writeClientJournal({
        eventPrefix: "risk_score_updated",
        businessId: row.id,
        actionType: "fraud_risk_score_updated",
        summary: `Score de risque ${prev} → ${nextScore} (${nextLevel}) suite à incident`,
        details: { delta, previous_score: prev, new_score: nextScore, new_level: nextLevel, source_incident_id: sourceIncidentId },
      });
      return row;
    };

    let response: Record<string, unknown> = { ok: true };

    // -------- CREATE INCIDENT --------
    if (body.action === "create_incident") {
      if (!body.incidentType || !body.description || !body.reason) {
        return json({ error: "clientId, incidentType, description, reason required" }, 400);
      }
      const sev = body.severity ?? "medium";
      const delta = SEVERITY_DELTA[sev];

      const { data: inserted, error } = await admin
        .from("account_fraud_incidents")
        .insert({
          client_id: body.clientId,
          account_id: body.accountId ?? null,
          incident_type: body.incidentType,
          severity: sev,
          description: body.description,
          internal_notes: body.internalNotes ?? null,
          status: "open",
          risk_score_delta: delta,
          created_by: actorId,
          created_by_email: actorEmail,
          last_updated_by: actorId,
          last_updated_by_email: actorEmail,
        })
        .select()
        .single();
      if (error) throw error;

      await logAudit("fraud_incident_create", "fraud_incident", inserted.id, {
        client_id: body.clientId,
        incident_type: body.incidentType,
        severity: sev,
        reason: body.reason,
      });

      await writeClientJournal({
        eventPrefix: "incident_created",
        businessId: inserted.id,
        actionType: "fraud_incident_created",
        summary: `Incident fraude enregistré — ${body.incidentType} (${sev})`,
        details: {
          incident_id: inserted.id,
          incident_type: body.incidentType,
          severity: sev,
          delta,
          description: body.description,
          reason: body.reason,
        },
      });

      // Auto-apply delta to score
      let newScore = null;
      try {
        newScore = await applyDelta(delta, `incident:${inserted.id}`, inserted.id);
      } catch (err) {
        console.error("[fraud-risk-actions] applyDelta failed", err);
      }

      response = { ok: true, incident: inserted, score: newScore };
    }

    // -------- UPDATE STATUS --------
    if (body.action === "update_status") {
      if (!body.incidentId || !body.status || !body.reason) {
        return json({ error: "incidentId, status, reason required" }, 400);
      }
      const newStatus = body.status;

      // Load current incident
      const { data: current, error: loadErr } = await admin
        .from("account_fraud_incidents")
        .select("*")
        .eq("id", body.incidentId)
        .eq("client_id", body.clientId)
        .maybeSingle();
      if (loadErr) throw loadErr;
      if (!current) return json({ error: "incident_not_found" }, 404);

      const allowed = TRANSITIONS[current.status] ?? new Set<string>();
      if (!allowed.has(newStatus)) {
        return json({
          error: "invalid_transition",
          from: current.status,
          to: newStatus,
          allowed: [...allowed],
        }, 409);
      }

      // Admin-only clear (resolved / false_positive)
      if ((newStatus === "resolved" || newStatus === "false_positive") && !isCoreAdmin) {
        return json({ error: "Seul un administrateur Nivra Core peut retirer une alerte de fraude." }, 403);
      }
      if ((newStatus === "resolved" || newStatus === "false_positive") && !body.resolutionNotes?.trim()) {
        return json({ error: "resolutionNotes required" }, 400);
      }

      const patch: Record<string, unknown> = {
        status: newStatus,
        last_updated_by: actorId,
        last_updated_by_email: actorEmail,
      };
      if (newStatus === "resolved" || newStatus === "false_positive" || newStatus === "escalated") {
        patch.resolved_at = new Date().toISOString();
      }
      if (body.resolutionNotes?.trim()) patch.resolution_notes = body.resolutionNotes.trim();

      const { data: updated, error } = await admin
        .from("account_fraud_incidents")
        .update(patch)
        .eq("id", body.incidentId)
        .select()
        .single();
      if (error) throw error;

      await logAudit("fraud_incident_update", "fraud_incident", updated.id, {
        from: current.status,
        to: newStatus,
        reason: body.reason,
      });

      await writeClientJournal({
        eventPrefix: "incident_status",
        businessId: updated.id,
        suffix: newStatus,
        actionType: `fraud_incident_${newStatus}`,
        summary: `Incident ${current.incident_type} → ${newStatus}`,
        details: {
          incident_id: updated.id,
          from: current.status,
          to: newStatus,
          resolution_notes: body.resolutionNotes ?? null,
          reason: body.reason,
        },
      });

      // Escalation notification via canonical gateway (Module 40)
      if (newStatus === "escalated") {
        try {
          await enqueueCommunication(admin, {
            channel: "notification",
            templateKey: "fraud-incident-escalated",
            recipient: `role:supervisor`,
            idempotencyKey: `fraud:escalated:${updated.id}`,
            category: "operational",
            clientId: body.clientId,
            entityType: "fraud_incident",
            entityId: updated.id,
            actorUserId: actorId,
            actorRole: isCoreAdmin ? "admin" : "employee",
            reason: body.reason,
            templateVars: {
              incident_id: updated.id,
              client_id: body.clientId,
              account_id: body.accountId ?? null,
              incident_type: current.incident_type,
              severity: current.severity,
              description: current.description,
              escalated_by: actorEmail,
              reason: body.reason,
            },
          });
        } catch (err) {
          console.error("[fraud-risk-actions] escalation enqueue failed", err);
        }
      }

      response = { ok: true, incident: updated };
    }

    // -------- UPSERT SCORE --------
    if (body.action === "upsert_score") {
      if (typeof body.score !== "number" || !body.riskLevel || !body.reason) {
        return json({ error: "clientId, score, riskLevel, reason required" }, 400);
      }
      const clamped = Math.max(0, Math.min(100, Math.round(body.score)));

      const { data: existing } = await admin
        .from("account_risk_scores")
        .select("id")
        .eq("client_id", body.clientId)
        .maybeSingle();

      const payload: Record<string, unknown> = {
        client_id: body.clientId,
        account_id: body.accountId ?? null,
        current_score: clamped,
        risk_level: body.riskLevel,
        factors: Array.isArray(body.factors) ? body.factors : [],
        notes: body.notes ?? null,
        last_assessed_at: new Date().toISOString(),
        last_assessed_by: actorId,
        last_assessed_by_email: actorEmail,
      };

      let row;
      if (existing?.id) {
        const { data, error } = await admin.from("account_risk_scores")
          .update(payload).eq("id", existing.id).select().single();
        if (error) throw error;
        row = data;
      } else {
        const { data, error } = await admin.from("account_risk_scores")
          .insert(payload).select().single();
        if (error) throw error;
        row = data;
      }

      await logAudit("risk_score_update", "risk_score", row.id, {
        client_id: body.clientId,
        score: clamped,
        risk_level: body.riskLevel,
        reason: body.reason,
      });

      await writeClientJournal({
        eventPrefix: "risk_score_updated",
        businessId: row.id,
        actionType: "fraud_risk_score_updated",
        summary: `Score de risque mis à ${clamped}/100 (${body.riskLevel})`,
        details: {
          score: clamped,
          risk_level: body.riskLevel,
          reason: body.reason,
          factors: payload.factors,
        },
      });

      response = { ok: true, score: row };
    }

    if (idempotencyKey) {
      await admin.from("fraud_action_idempotency")
        .update({ response })
        .eq("idempotency_key", idempotencyKey);
    }

    return json(response);
  } catch (e) {
    console.error("fraud-risk-actions error", e);
    return json({ error: e instanceof Error ? e.message : "internal_error" }, 500);
  }
});
