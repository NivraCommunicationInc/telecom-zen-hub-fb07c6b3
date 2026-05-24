import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const STAFF_ROLES = ["admin", "employee", "supervisor", "support"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("status", "active");
    const userRoles = (roles ?? []).map((r: any) => r.role);
    if (!userRoles.some((r: string) => STAFF_ROLES.includes(r))) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const {
      action, clientId, accountId, incidentId,
      incidentType, severity, description, internalNotes,
      status, resolutionNotes, reason,
      score, riskLevel, factors, notes,
    } = body;

    if (!action) return json({ error: "Missing action" }, 400);

    if (action === "list") {
      if (!clientId) return json({ error: "Missing clientId" }, 400);
      const [{ data: incidents, error: e1 }, { data: scoreRow, error: e2 }] = await Promise.all([
        admin.from("account_fraud_incidents").select("*").eq("client_id", clientId).order("detected_at", { ascending: false }).limit(100),
        admin.from("account_risk_scores").select("*").eq("client_id", clientId).maybeSingle(),
      ]);
      if (e1) return json({ error: e1.message }, 500);
      if (e2) return json({ error: e2.message }, 500);
      const presets = [
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
      return json({ incidents: incidents ?? [], score: scoreRow ?? null, presets });
    }

    if (action === "create_incident") {
      if (!clientId || !incidentType || !description?.trim() || !reason?.trim()) {
        return json({ error: "Champs requis: clientId, incidentType, description, reason" }, 400);
      }
      const validSev = ["low", "medium", "high", "critical"];
      const sev = validSev.includes(severity) ? severity : "medium";
      const delta = sev === "critical" ? 30 : sev === "high" ? 20 : sev === "medium" ? 10 : 5;

      const { data, error } = await admin.from("account_fraud_incidents").insert({
        client_id: clientId,
        account_id: accountId ?? null,
        incident_type: incidentType,
        severity: sev,
        description: description.trim(),
        internal_notes: internalNotes?.trim() || null,
        risk_score_delta: delta,
        created_by: user.id,
        created_by_email: user.email,
        last_updated_by: user.id,
        last_updated_by_email: user.email,
      }).select().single();
      if (error) return json({ error: error.message }, 500);

      await admin.from("admin_audit_log").insert({
        actor_id: user.id, actor_email: user.email, action: "account_ops.fraud_incident_create",
        target_type: "fraud_incident", target_id: data.id,
        metadata: { client_id: clientId, incident_type: incidentType, severity: sev, reason },
      });
      return json({ ok: true, incident: data });
    }

    if (action === "update_status") {
      if (!incidentId || !status || !reason?.trim()) return json({ error: "Champs requis: incidentId, status, reason" }, 400);
      const valid = ["open", "investigating", "resolved", "false_positive", "escalated"];
      if (!valid.includes(status)) return json({ error: "Statut invalide" }, 400);
      if ((status === "resolved" || status === "false_positive") && !resolutionNotes?.trim()) {
        return json({ error: "Notes de résolution requises" }, 400);
      }

      const patch: any = {
        status,
        last_updated_by: user.id,
        last_updated_by_email: user.email,
      };
      if (status === "resolved" || status === "false_positive" || status === "escalated") {
        patch.resolved_at = new Date().toISOString();
      }
      if (resolutionNotes?.trim()) patch.resolution_notes = resolutionNotes.trim();

      const { data, error } = await admin.from("account_fraud_incidents").update(patch).eq("id", incidentId).select().single();
      if (error) return json({ error: error.message }, 500);

      await admin.from("admin_audit_log").insert({
        actor_id: user.id, actor_email: user.email, action: "account_ops.fraud_incident_update",
        target_type: "fraud_incident", target_id: incidentId,
        metadata: { status, reason },
      });
      return json({ ok: true, incident: data });
    }

    if (action === "upsert_score") {
      if (!clientId || typeof score !== "number" || !riskLevel || !reason?.trim()) {
        return json({ error: "Champs requis: clientId, score, riskLevel, reason" }, 400);
      }
      const validLevels = ["low", "medium", "high", "critical"];
      if (!validLevels.includes(riskLevel)) return json({ error: "Niveau invalide" }, 400);
      const clamped = Math.max(0, Math.min(100, Math.round(score)));

      const { data: existing } = await admin.from("account_risk_scores").select("id").eq("client_id", clientId).maybeSingle();

      const payload: any = {
        client_id: clientId,
        account_id: accountId ?? null,
        current_score: clamped,
        risk_level: riskLevel,
        factors: Array.isArray(factors) ? factors : [],
        notes: notes?.trim() || null,
        last_assessed_at: new Date().toISOString(),
        last_assessed_by: user.id,
        last_assessed_by_email: user.email,
      };

      let result;
      if (existing?.id) {
        const { data, error } = await admin.from("account_risk_scores").update(payload).eq("id", existing.id).select().single();
        if (error) return json({ error: error.message }, 500);
        result = data;
      } else {
        const { data, error } = await admin.from("account_risk_scores").insert(payload).select().single();
        if (error) return json({ error: error.message }, 500);
        result = data;
      }

      await admin.from("admin_audit_log").insert({
        actor_id: user.id, actor_email: user.email, action: "account_ops.risk_score_update",
        target_type: "risk_score", target_id: result.id,
        metadata: { client_id: clientId, score: clamped, risk_level: riskLevel, reason },
      });
      return json({ ok: true, score: result });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
