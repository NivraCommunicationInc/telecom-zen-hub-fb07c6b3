/**
 * Edge Function: admin-review-verification
 * Admin actions for KYC sessions:
 * - get_signed_urls: view private documents
 * - request_documents: set pending_docs + insert kyc_requested_documents rows + send email
 * - review_document: accept/reject individual requested doc
 * - default: approve/reject/in_review decision
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { violetShell } from "../_shared/violetEmailShell.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: claimsError } = await userClient.auth.getUser(token);
  if (claimsError || !user) return { error: "Unauthorized", status: 401 };
  const adminUserId = user.id;

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleRows } = await serviceClient
    .from("user_roles").select("role").eq("user_id", adminUserId).eq("status", "active");
  const isAdmin = (roleRows || []).some((r: any) => ["admin", "employee", "supervisor", "technician"].includes(r.role));
  if (!isAdmin) return { error: "Admin access required", status: 403 };

  return { adminUserId, serviceClient };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAdmin(req);
    if ("error" in auth) return json({ error: auth.error }, auth.status);

    const { adminUserId, serviceClient } = auth;
    const body = await req.json();
    const { action } = body;

    // ── GET SIGNED URLS ──
    if (action === "get_signed_urls") {
      const { session_id } = body;
      if (!session_id) return json({ error: "session_id is required" }, 400);

      const { data: session } = await serviceClient
        .from("identity_verification_sessions")
        .select("document_front_path, document_back_path, selfie_path")
        .eq("id", session_id).single();
      if (!session) return json({ error: "Session not found" }, 404);

      const urls: Record<string, string | null> = { front: null, back: null, selfie: null };
      for (const [key, path] of [["front", session.document_front_path], ["back", session.document_back_path], ["selfie", session.selfie_path]] as const) {
        if (path) {
          const { data } = await serviceClient.storage.from("id-documents").createSignedUrl(path, 300);
          urls[key] = data?.signedUrl || null;
        }
      }

      // Also get signed URLs for requested documents
      const { data: reqDocs } = await serviceClient
        .from("kyc_requested_documents")
        .select("id, uploaded_file_url")
        .eq("kyc_session_id", session_id)
        .not("uploaded_file_url", "is", null);

      const docUrls: Record<string, string> = {};
      if (reqDocs) {
        for (const doc of reqDocs) {
          if (doc.uploaded_file_url) {
            const { data } = await serviceClient.storage.from("id-documents").createSignedUrl(doc.uploaded_file_url, 300);
            if (data?.signedUrl) docUrls[doc.id] = data.signedUrl;
          }
        }
      }

      await serviceClient.from("identity_verification_events").insert({
        session_id, event_type: "admin_viewed_documents", actor_id: adminUserId, actor_role: "admin",
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        user_agent: req.headers.get("user-agent"),
      });

      return json({ urls, doc_urls: docUrls });
    }

    // ── REQUEST DOCUMENTS (pending_docs) ──
    if (action === "request_documents") {
      const { session_id, requested_documents, reason, idempotency_key } = body;
      if (!session_id || !requested_documents?.length || !reason?.trim()) {
        return json({ error: "session_id, requested_documents[], and reason are required" }, 400);
      }

      // Idempotency
      if (idempotency_key) {
        const { data: existing } = await serviceClient
          .from("identity_verification_events").select("id").eq("idempotency_key", idempotency_key).maybeSingle();
        if (existing) return json({ message: "Already processed" });
      }

      // Update session status to pending_docs
      const { error: updateErr } = await serviceClient
        .from("identity_verification_sessions")
        .update({
          status: "pending_docs",
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminUserId,
          review_reason: reason,
        })
        .eq("id", session_id);
      if (updateErr) return json({ error: "Failed to update session" }, 500);

      // Insert requested documents
      const docsToInsert = requested_documents.map((d: { doc_type: string; instructions: string }) => ({
        kyc_session_id: session_id,
        doc_type: d.doc_type,
        instructions: d.instructions || null,
        status: "requested",
        requested_by_admin_id: adminUserId,
        requested_at: new Date().toISOString(),
      }));
      await serviceClient.from("kyc_requested_documents").insert(docsToInsert);

      // Log event
      await serviceClient.from("identity_verification_events").insert({
        session_id, event_type: "admin_pending_docs", actor_id: adminUserId, actor_role: "admin",
        details: { reason, requested_documents },
        idempotency_key: idempotency_key || null,
        ip_address: req.headers.get("x-forwarded-for"),
        user_agent: req.headers.get("user-agent"),
      });

      // Send email to client
      try {
        const { data: session } = await serviceClient
          .from("identity_verification_sessions")
          .select("user_id, case_number, id, public_token").eq("id", session_id).single();
        if (session) {
          const { data: profile } = await serviceClient
            .from("profiles").select("email, full_name").eq("id", session.user_id).single();
          if (profile?.email) {
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            if (resendApiKey) {
              const docList = requested_documents.map((d: any) => `• ${d.doc_type}${d.instructions ? ` — ${d.instructions}` : ""}`).join("\n");
              await enqueueEmail({
                to: profile.email,
                templateKey: "custom_html",
                subject: `Documents requis — Dossier ${session.case_number || session_id.slice(0, 8)}`,
                fromEmail: "Nivra Telecom <support@nivra-telecom.ca>",
                replyTo: "support@nivra-telecom.ca",
                messageType: "kyc_documents_requested",
                entityType: "kyc_session",
                entityId: session_id,
                eventKey: `kyc_docs_${session_id}_${Date.now()}`,
                html: violetShell({
                  preheader: "Documents supplémentaires requis pour votre vérification.",
                  badge: "ACTION REQUISE",
                  heroTitle: "Documents requis",
                  greeting: `Bonjour ${profile.full_name || ""},`,
                  bodyHtml: `Notre équipe a besoin de documents supplémentaires pour compléter votre vérification d'identité.<br><br><strong>Note de l'agent :</strong> ${reason}`,
                  cardTitle: "Documents demandés",
                  cardRows: [
                    ["Dossier", session.case_number || "—"],
                    ["Liste", docList.replace(/\n/g, " · ")],
                  ],
                  ctaPrimaryUrl: session.public_token ? `https://nivra-telecom.ca/verification/${session.public_token}` : "https://nivra-telecom.ca/verification/",
                  ctaPrimaryLabel: "Téléverser mes documents",
                  helpVariant: "warning",
                }),
              });
              console.log("[admin-review] Email queued for pending_docs to", profile.email);
            }
          }
        }
      } catch (emailErr) {
        console.error("[admin-review] Email error:", emailErr);
      }

      return json({ message: "Documents requested, session set to pending_docs", session_id });
    }

    // ── REVIEW INDIVIDUAL DOCUMENT ──
    if (action === "review_document") {
      const { document_id, decision, review_note } = body;
      if (!document_id || !["accepted", "rejected"].includes(decision)) {
        return json({ error: "document_id and decision (accepted/rejected) required" }, 400);
      }

      const { error: docErr } = await serviceClient
        .from("kyc_requested_documents")
        .update({
          status: decision,
          reviewed_by_admin_id: adminUserId,
          reviewed_at: new Date().toISOString(),
          review_note: review_note || null,
        })
        .eq("id", document_id);
      if (docErr) return json({ error: "Failed to update document" }, 500);

      // Get session_id for the doc
      const { data: doc } = await serviceClient
        .from("kyc_requested_documents").select("kyc_session_id, doc_type").eq("id", document_id).single();

      if (doc) {
        await serviceClient.from("identity_verification_events").insert({
          session_id: doc.kyc_session_id,
          event_type: `doc_${decision}`,
          actor_id: adminUserId,
          actor_role: "admin",
          details: { document_id, doc_type: doc.doc_type, decision, review_note },
        });

        // If rejected, set session back to pending_docs if not already
        if (decision === "rejected") {
          await serviceClient
            .from("identity_verification_sessions")
            .update({ status: "pending_docs", updated_at: new Date().toISOString() })
            .eq("id", doc.kyc_session_id);
        }
      }

      return json({ message: `Document ${decision}`, document_id });
    }

    // ── DELETE KYC DOCUMENTS ──
    if (action === "delete_documents") {
      const { session_id } = body;
      if (!session_id) return json({ error: "session_id is required" }, 400);

      const { data: session } = await serviceClient
        .from("identity_verification_sessions")
        .select("document_front_path, document_back_path, selfie_path, retention_status")
        .eq("id", session_id).single();
      if (!session) return json({ error: "Session not found" }, 404);

      // Delete files from storage
      const pathsToDelete: string[] = [];
      if (session.document_front_path) pathsToDelete.push(session.document_front_path);
      if (session.document_back_path) pathsToDelete.push(session.document_back_path);
      if (session.selfie_path) pathsToDelete.push(session.selfie_path);

      // Also delete requested doc files
      const { data: reqDocs } = await serviceClient
        .from("kyc_requested_documents")
        .select("uploaded_file_url")
        .eq("kyc_session_id", session_id)
        .not("uploaded_file_url", "is", null);
      if (reqDocs) {
        for (const d of reqDocs) {
          if (d.uploaded_file_url) pathsToDelete.push(d.uploaded_file_url);
        }
      }

      if (pathsToDelete.length > 0) {
        const { error: delErr } = await serviceClient.storage.from("id-documents").remove(pathsToDelete);
        if (delErr) console.error("[admin-review] Storage delete error:", delErr);
      }

      // Update session
      await serviceClient.from("identity_verification_sessions").update({
        retention_status: "deleted",
        documents_deleted_at: new Date().toISOString(),
        documents_deleted_by: adminUserId,
        document_front_path: null,
        document_back_path: null,
        selfie_path: null,
      }).eq("id", session_id);

      // Clear requested doc URLs
      await serviceClient.from("kyc_requested_documents").update({
        uploaded_file_url: null,
      }).eq("kyc_session_id", session_id);

      // Audit log
      await serviceClient.from("identity_verification_events").insert({
        session_id, event_type: "documents_deleted", actor_id: adminUserId, actor_role: "admin",
        details: { files_deleted: pathsToDelete.length },
        ip_address: req.headers.get("x-forwarded-for"),
        user_agent: req.headers.get("user-agent"),
      });

      return json({ message: "Documents deleted", files_deleted: pathsToDelete.length });
    }

    // ── DEFAULT: REVIEW DECISION (approve/reject/in_review) ──
    const { session_id, decision, reason, idempotency_key } = body;

    if (!session_id || !decision || !reason?.trim()) {
      return json({ error: "session_id, decision, and reason are required" }, 400);
    }
    if (!["approved", "rejected", "in_review"].includes(decision)) {
      return json({ error: "decision must be approved, rejected, or in_review" }, 400);
    }

    // Idempotency
    if (idempotency_key) {
      const { data: existing } = await serviceClient
        .from("identity_verification_events").select("id").eq("idempotency_key", idempotency_key).maybeSingle();
      if (existing) return json({ message: "Already processed" });
    }

    // Get session
    const { data: session, error: sessionError } = await serviceClient
      .from("identity_verification_sessions").select("*").eq("id", session_id).single();
    if (sessionError || !session) return json({ error: "Session not found" }, 404);

    // Update session - lock documents on approve/reject
    const updatePayload: Record<string, any> = {
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      review_reason: reason,
      result_payload: { decision, reason, reviewed_by_admin: adminUserId },
    };
    if (decision === "approved" || decision === "rejected") {
      updatePayload.retention_status = "locked";
    }

    const { error: updateError } = await serviceClient
      .from("identity_verification_sessions").update(updatePayload).eq("id", session_id);
    if (updateError) return json({ error: "Failed to update session" }, 500);

    // Log event
    await serviceClient.from("identity_verification_events").insert({
      session_id, event_type: `admin_${decision}`, actor_id: adminUserId, actor_role: "admin",
      details: { decision, reason },
      idempotency_key: idempotency_key || null,
      ip_address: req.headers.get("x-forwarded-for"), user_agent: req.headers.get("user-agent"),
    });

    // On approval: update ONLY id_verification_status on linked orders (NOT order status)
    if (decision === "approved") {
      const { data: linkedOrders } = await serviceClient
        .from("orders").select("id, status")
        .eq("identity_verification_session_id", session_id);

      if (linkedOrders?.length) {
        for (const order of linkedOrders) {
          await serviceClient.from("orders").update({
            id_verification_status: "verified",
            id_verified_at: new Date().toISOString(),
            id_verified_by: adminUserId,
          }).eq("id", order.id);
          await serviceClient.from("identity_verification_events").insert({
            session_id, event_type: "order_id_verified", actor_id: adminUserId, actor_role: "admin",
            details: { order_id: order.id, note: "ID verification marked as verified. Order status unchanged." },
          });
        }
      }
    }

    // On rejection: update ONLY id_verification_status on linked orders (NOT order status)
    if (decision === "rejected") {
      const { data: linkedOrders } = await serviceClient
        .from("orders").select("id, status")
        .eq("identity_verification_session_id", session_id);

      if (linkedOrders?.length) {
        for (const order of linkedOrders) {
          await serviceClient.from("orders").update({
            id_verification_status: "rejected",
            id_verification_notes: `KYC rejected: ${reason}`,
          }).eq("id", order.id);
        }
      }
    }

    return json({ message: `Session ${decision}`, session_id });
  } catch (err) {
    console.error("Admin review error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
