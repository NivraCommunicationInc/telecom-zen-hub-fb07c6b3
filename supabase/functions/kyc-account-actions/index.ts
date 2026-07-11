// KYC review actions — staff-only operations on a client's identity verification.
// Actions:
//   - request_verification     : creates a kyc_verifications row + queues client email
//   - approve_session          : marks an identity_verification_sessions row 'approved'
//   - reject_session           : marks a session 'rejected' (review_reason required)
//   - request_additional_docs  : marks 'pending_docs' + inserts requested-doc rows + sends email with note
//   - resend_request           : re-sends the KYC request email for an existing row
//   - generate_signed_urls     : returns 5-min signed URLs for the session's docs
// Each transition is audited under account_ops.kyc_*; identity_verification_events
// also gets an append row for traceability.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAFF_ROLES = new Set([
  "admin", "supervisor", "employee", "kyc_agent", "support",
]);

type Action =
  | "request_verification"
  | "approve_session"
  | "reject_session"
  | "request_additional_docs"
  | "resend_request"
  | "generate_signed_urls";

interface Body {
  action: Action;
  client_user_id: string;
  account_id?: string | null;
  // request_verification
  requested_id_type?: string;
  reason?: string;
  notes?: string;
  // session-targeted
  session_id?: string;
  review_reason?: string;
  required_docs?: string[];   // for pending_docs
  // resend_request
  verification_id?: string;
}

const ALLOWED_ID_TYPES = new Set([
  "drivers_license", "passport", "provincial_id", "health_card", "other",
]);

const json = (s: number, p: unknown) =>
  new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://nivra-telecom.ca";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Non autorisé" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: roles } = await admin
    .from("user_roles").select("role").eq("user_id", user.id);
  const { isStaff, callerRole: _callerRole, roles: _roles } = await checkStaffAuth(admin, user.id);
  const roleList = _roles;
  if (!isStaff) return json(403, { error: "Action réservée à l'équipe KYC" });
  const callerRole = roleList.find((r: string) => STAFF_ROLES.has(r)) || "support";

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return json(400, { error: "Champs requis: action, client_user_id" });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("user_id", client_user_id)
    .maybeSingle();
  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const callerName = [callerProfile?.first_name, callerProfile?.last_name]
    .filter(Boolean).join(" ") || "Personnel Nivra";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";

  const audit = async (label: string, payload: Record<string, unknown>) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `account_ops.kyc_${label}`,
        admin_id: user.id,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        metadata: payload,
      });
    } catch (_e) { /* swallow */ }
  };

  const ivsEvent = async (session_id: string, event_type: string, details: Record<string, unknown> = {}) => {
    try {
      await admin.from("identity_verification_events").insert({
        session_id,
        event_type,
        actor_id: user.id,
        actor_role: callerRole,
        details,
        ip_address: ip,
        user_agent: ua,
      });
    } catch (_e) { /* swallow */ }
  };

  const enqueueEmail = async (template_key: string, vars: Record<string, unknown>) => {
    if (!clientEmail) return;
    try {
      await enqueueCommunication(admin, {
      channel: "email",
      recipient: clientEmail,
      templateKey: template_key,
      priority: 10,
      idempotencyKey: `acct360:kyc:${body.account_id ?? "na"}:${template_key}:${body.idempotency_key ?? body.__audit_reason ?? "default"}`,
      templateVars: { ...vars, first_name: firstName, to_email: clientEmail },
    });
    } catch (_e) { /* swallow */ }
  };

  // Ensure a canonical identity_verification_sessions (IVS) row + a linked
  // kyc_requests row so the client gets https://nivra-telecom.ca/verification/:token
  // AND Client 360 reads/shows everything from the IVS canonical model.
  //
  // Account-level KYC requests have no order_id — this is legitimate.
  // The public wizard resolves by kyc_requests.token; kyc-public-upload
  // mirrors uploaded files onto the linked IVS row (see that function).
  const ensureKycRequest = async (opts: { reuse?: boolean; notes?: string | null; sessionId?: string | null }) => {
    if (!clientEmail) return null as null | { id: string; token: string; kyc_link: string; expires_at: string; session_id: string };

    if (opts.reuse) {
      let existingQuery = admin
        .from("kyc_requests")
        .select("id, token, expires_at, status, session_id")
        .eq("client_id", client_user_id)
        .in("status", ["pending", "sent"])
        .gt("expires_at", new Date().toISOString());
      if (opts.sessionId) existingQuery = existingQuery.eq("session_id", opts.sessionId);
      const { data: existing } = await existingQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.session_id) {
        return {
          id: existing.id,
          token: existing.token,
          expires_at: existing.expires_at,
          session_id: existing.session_id,
          kyc_link: `${APP_URL}/verification/${existing.token}`,
        };
      }
      // Existing request without a session — heal by attaching one below.
    }

    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    let ivsId = opts.sessionId ?? null;

    if (!ivsId) {
      // 1) Create the canonical IVS row first (Client 360 source of truth).
      const { data: ivs, error: ivsErr } = await admin
        .from("identity_verification_sessions")
        .insert({
          user_id: client_user_id,
          status: "created",
          expires_at: expiresAt,
          checkout_type: "account_level",
          order_context: { source: "client_360", account_id: body.account_id ?? null },
        })
        .select("id")
        .single();
      if (ivsErr || !ivs) return null;
      ivsId = ivs.id;
    }

    // 2) Create (or reattach) the kyc_requests row that carries the wizard token.
    let requestRow: { id: string; token: string; expires_at: string } | null = null;
    if (opts.reuse) {
      let reusableQuery = admin
        .from("kyc_requests")
        .select("id, token, expires_at, status")
        .eq("client_id", client_user_id)
        .in("status", ["pending", "sent"])
        .gt("expires_at", new Date().toISOString());
      if (opts.sessionId) reusableQuery = reusableQuery.eq("session_id", opts.sessionId);
      const { data: reusable } = await reusableQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reusable) {
        // Attach the canonical IVS to the existing request.
        await admin.from("kyc_requests").update({ session_id: ivsId }).eq("id", reusable.id);
        requestRow = { id: reusable.id, token: reusable.token, expires_at: reusable.expires_at };
      }
    }
    if (!requestRow) {
      const { data: created, error } = await admin
        .from("kyc_requests")
        .insert({
          order_id: null,
          client_id: client_user_id,
          client_email: clientEmail,
          requested_by: user.id,
          notes: opts.notes ?? null,
          session_id: ivsId,
        })
        .select("id, token, expires_at")
        .single();
      if (error || !created) return null;
      requestRow = created;
    }

    // 3) Emit an event so Client 360 timeline shows the request immediately.
    await ivsEvent(ivsId, opts.sessionId ? "staff_request_link_created" : "staff_requested", { via: "client_360", notes: opts.notes ?? null });

    return {
      id: requestRow.id,
      token: requestRow.token,
      expires_at: requestRow.expires_at,
      session_id: ivsId,
      kyc_link: `${APP_URL}/verification/${requestRow.token}`,
    };
  };

  const verifyClientSession = async (session_id: string) => {
    const { data: s } = await admin
      .from("identity_verification_sessions")
      .select("id, user_id, status")
      .eq("id", session_id)
      .maybeSingle();
    if (!s) return { err: "Session introuvable", row: null as any };
    if (s.user_id !== client_user_id) return { err: "Session hors compte", row: null as any };
    return { err: null, row: s };
  };

  try {
    switch (action) {
      case "request_verification": {
        const idType = (body.requested_id_type || "drivers_license").trim();
        if (!ALLOWED_ID_TYPES.has(idType)) return json(400, { error: "Type d'identité invalide" });

        // Create the IVS session + linked kyc_requests row first so we have session_id for kyc_verifications.
        const kycReq = await ensureKycRequest({ reuse: false, notes: body.notes ?? body.reason ?? null });

        const { data, error } = await admin
          .from("kyc_verifications")
          .insert({
            client_id: client_user_id,
            account_id: body.account_id ?? null,
            requested_id_type: idType,
            reason: (body.reason || "Vérification d'identité requise").slice(0, 500),
            notes: body.notes ?? null,
            requested_by: user.id,
            status: "pending",
            session_id: kycReq?.session_id ?? null,
          })
          .select("id, expires_at")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("request_verification", { verification_id: data.id, id_type: idType, kyc_request_id: kycReq?.id ?? null, session_id: kycReq?.session_id ?? null });
        await enqueueEmail("client_kyc_requested", {
          id_type_label: idType,
          reason: body.reason || "Vérification d'identité requise",
          expires_at: new Date(kycReq?.expires_at || data.expires_at).toLocaleDateString("fr-CA"),
          kyc_link: kycReq?.kyc_link ?? null,
        });

        return json(200, { ok: true, verification_id: data.id, kyc_request_id: kycReq?.id ?? null, session_id: kycReq?.session_id ?? null });
      }

      case "resend_request": {
        if (!body.verification_id) return json(400, { error: "verification_id requis" });
        const { data: v } = await admin
          .from("kyc_verifications")
          .select("id, client_id, requested_id_type, reason, expires_at, status")
          .eq("id", body.verification_id)
          .maybeSingle();
        if (!v) return json(404, { error: "Demande introuvable" });
        if (v.client_id !== client_user_id) return json(403, { error: "Demande hors compte" });
        if (v.status === "approved" || v.status === "rejected") {
          return json(400, { error: "Demande déjà finalisée" });
        }
        const kycReq = await ensureKycRequest({ reuse: true, notes: v.reason ?? null });
        await audit("resend_request", { verification_id: v.id, kyc_request_id: kycReq?.id ?? null });
        await enqueueEmail("client_kyc_requested", {
          id_type_label: v.requested_id_type,
          reason: v.reason || "Rappel — vérification d'identité requise",
          expires_at: new Date(kycReq?.expires_at || v.expires_at).toLocaleDateString("fr-CA"),
          kyc_link: kycReq?.kyc_link ?? null,
        });
        return json(200, { ok: true, kyc_request_id: kycReq?.id ?? null });
      }

      case "approve_session": {
        if (!["admin", "supervisor", "kyc_agent"].includes(callerRole)) {
          return json(403, { error: "Approbation KYC réservée aux admin, superviseurs et agents KYC" });
        }
        if (!body.session_id) return json(400, { error: "session_id requis" });
        const { err } = await verifyClientSession(body.session_id);
        if (err) return json(400, { error: err });

        const { error } = await admin
          .from("identity_verification_sessions")
          .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            review_reason: body.review_reason || null,
          })
          .eq("id", body.session_id);
        if (error) return json(500, { error: error.message });

        // Mark ONLY the kyc_verifications row(s) linked to THIS session.
        // Previous version eq("client_id").eq("status", "pending") marked
        // EVERY pending verification for the client — meaning approving one
        // session would silently approve any other unrelated pending KYC
        // for the same client. Scope strictly to the session being acted on.
        await admin
          .from("kyc_verifications")
          .update({
            status: "approved",
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            notes: body.review_reason ?? null,
          })
          .eq("client_id", client_user_id)
          .eq("session_id", body.session_id)
          .eq("status", "pending");

        await ivsEvent(body.session_id, "staff_approved", { reason: body.review_reason ?? null });
        await audit("approve_session", { session_id: body.session_id });
        await enqueueEmail("client_kyc_approved", {
          message: body.review_reason || "Votre identité a été vérifiée avec succès.",
        });

        return json(200, { ok: true });
      }

      case "reject_session": {
        if (!["admin", "supervisor", "kyc_agent"].includes(callerRole)) {
          return json(403, { error: "Refus KYC réservé aux admin, superviseurs et agents KYC" });
        }
        if (!body.session_id) return json(400, { error: "session_id requis" });
        if (!body.review_reason?.trim()) return json(400, { error: "Motif de refus requis" });
        const { err } = await verifyClientSession(body.session_id);
        if (err) return json(400, { error: err });

        const { error } = await admin
          .from("identity_verification_sessions")
          .update({
            status: "rejected",
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            review_reason: body.review_reason.trim(),
          })
          .eq("id", body.session_id);
        if (error) return json(500, { error: error.message });

        await admin
          .from("kyc_verifications")
          .update({
            status: "rejected",
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            rejection_reason: body.review_reason.trim(),
          })
          .eq("client_id", client_user_id)
          .eq("session_id", body.session_id)
          .eq("status", "pending");

        const rejectKyc = await ensureKycRequest({ reuse: false, notes: `Rejet: ${body.review_reason.trim()}`, sessionId: body.session_id });
        await ivsEvent(body.session_id, "staff_rejected", { reason: body.review_reason });
        await audit("reject_session", { session_id: body.session_id, kyc_request_id: rejectKyc?.id ?? null });
        await enqueueEmail("client_kyc_rejected", {
          rejection_reason: body.review_reason.trim(),
          kyc_link: rejectKyc?.kyc_link ?? null,
        });

        return json(200, { ok: true, kyc_request_id: rejectKyc?.id ?? null });
      }

      case "request_additional_docs": {
        if (!body.session_id) return json(400, { error: "session_id requis" });
        if (!body.review_reason?.trim()) return json(400, { error: "Instructions au client requises" });
        const { err } = await verifyClientSession(body.session_id);
        if (err) return json(400, { error: err });

        const required = Array.isArray(body.required_docs) ? body.required_docs.slice(0, 8) : [];

        const { error } = await admin
          .from("identity_verification_sessions")
          .update({
            status: "pending_docs",
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            review_reason: body.review_reason.trim(),
            additional_docs: required,
          })
          .eq("id", body.session_id);
        if (error) return json(500, { error: error.message });

        if (required.length > 0) {
          const rows = required.map((docType) => ({
            kyc_session_id: body.session_id,
            doc_type: docType,
            instructions: body.review_reason.trim(),
            status: "requested",
            requested_by_admin_id: user.id,
            requested_at: new Date().toISOString(),
          }));
          await admin.from("kyc_requested_documents").insert(rows);
        }

        const addKyc = await ensureKycRequest({ reuse: true, notes: `Docs additionnels: ${body.review_reason.trim()}`, sessionId: body.session_id });
        await ivsEvent(body.session_id, "staff_additional_required", {
          reason: body.review_reason, required_docs: required,
        });
        await audit("request_additional_docs", { session_id: body.session_id, required, kyc_request_id: addKyc?.id ?? null });
        await enqueueEmail("client_kyc_additional_docs", {
          instructions: body.review_reason.trim(),
          required_docs_list: required.join(", ") || "—",
          kyc_link: addKyc?.kyc_link ?? null,
        });

        return json(200, { ok: true, kyc_request_id: addKyc?.id ?? null });
      }

      case "generate_signed_urls": {
        if (!body.session_id) return json(400, { error: "session_id requis" });
        const { err } = await verifyClientSession(body.session_id);
        if (err) return json(400, { error: err });

        const { data: docs } = await admin
          .from("identity_documents")
          .select("id, doc_type, storage_bucket, object_path, mime_type")
          .eq("kyc_session_id", body.session_id);

        const { data: requestedDocs } = await admin
          .from("kyc_requested_documents")
          .select("id, doc_type, uploaded_file_url")
          .eq("kyc_session_id", body.session_id)
          .not("uploaded_file_url", "is", null);

        const out: Array<{ id: string; doc_type: string; mime_type: string | null; url: string | null; source?: string }> = [];
        for (const d of (docs || [])) {
          const { data: signed } = await admin
            .storage.from(d.storage_bucket).createSignedUrl(d.object_path, 300);
          out.push({
            id: d.id, doc_type: d.doc_type, mime_type: d.mime_type,
            url: signed?.signedUrl || null,
          });
        }
        for (const d of (requestedDocs || [])) {
          if (!d.uploaded_file_url) continue;
          const { data: signed } = await admin
            .storage.from("id-documents").createSignedUrl(d.uploaded_file_url, 300);
          out.push({
            id: d.id,
            doc_type: d.doc_type,
            mime_type: null,
            url: signed?.signedUrl || null,
            source: "kyc_requested_documents",
          });
        }

        await ivsEvent(body.session_id, "staff_viewed_docs", { count: out.length });
        await audit("view_docs", { session_id: body.session_id, count: out.length });
        return json(200, { ok: true, documents: out });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
