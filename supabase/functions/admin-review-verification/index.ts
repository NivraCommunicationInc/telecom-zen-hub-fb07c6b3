/**
 * Edge Function: admin-review-verification
 * Admin actions for KYC sessions:
 * - get_signed_urls: view private documents
 * - request_documents: set pending_docs + insert kyc_requested_documents rows + send email
 * - review_document: accept/reject individual requested doc
 * - default: approve/reject/in_review decision
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await adminClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) return { error: "Unauthorized", status: 401 };
  const adminUserId = claimsData.claims.sub;

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminUser } = await serviceClient
    .from("admin_users").select("id, is_active").eq("user_id", adminUserId).eq("is_active", true).maybeSingle();
  if (!adminUser) return { error: "Admin access required", status: 403 };

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
          .select("user_id, case_number, id").eq("id", session_id).single();
        if (session) {
          const { data: profile } = await serviceClient
            .from("profiles").select("email, full_name").eq("id", session.user_id).single();
          if (profile?.email) {
            const resendApiKey = Deno.env.get("RESEND_API_KEY");
            if (resendApiKey) {
              const docList = requested_documents.map((d: any) => `• ${d.doc_type}${d.instructions ? ` — ${d.instructions}` : ""}`).join("\n");
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
                body: JSON.stringify({
                  from: "Nivra Télécom <Support@nivra-telecom.ca>",
                  reply_to: "Support@nivra-telecom.ca",
                  to: [profile.email],
                  subject: `Documents requis — Dossier ${session.case_number || session_id.slice(0, 8)}`,
                  html: `
                    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
                      <div style="background:#f97316;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
                        <h2 style="margin:0">Documents requis</h2>
                      </div>
                      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
                        <p>Bonjour ${profile.full_name || ""},</p>
                        <p>Notre équipe a besoin de documents supplémentaires pour compléter votre vérification d'identité.</p>
                        <p><strong>Dossier :</strong> ${session.case_number || "—"}</p>
                        <p><strong>Note de l'agent :</strong> ${reason}</p>
                        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0">
                          <p style="margin:0 0 8px;font-weight:bold;color:#9a3412">Documents demandés :</p>
                          <pre style="margin:0;white-space:pre-wrap;font-size:14px;color:#c2410c">${docList}</pre>
                        </div>
                        <p style="text-align:center;margin:24px 0">
                          <a href="https://nivra-telecom.ca/portal/identity-verification" style="background:#f97316;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">Téléverser mes documents</a>
                        </p>
                        <p style="color:#6b7280;font-size:12px">Si vous avez des questions, contactez notre support.</p>
                      </div>
                    </div>`,
                  headers: {
                    "X-Entity-Ref-ID": `kyc-docs-${session_id}`,
                    "List-Unsubscribe": "<mailto:Support@nivra-telecom.ca>",
                    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                  },
                }),
              });
              console.log("[admin-review] Email sent for pending_docs to", profile.email);
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

    // Update session
    const updatePayload: Record<string, any> = {
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      review_reason: reason,
      result_payload: { decision, reason, reviewed_by_admin: adminUserId },
    };

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

    // On approval: confirm linked orders + send email
    if (decision === "approved") {
      const { data: linkedOrders } = await serviceClient
        .from("orders").select("id, status")
        .eq("identity_verification_session_id", session_id)
        .in("status", ["pending_verification", "pending"]);

      if (linkedOrders?.length) {
        for (const order of linkedOrders) {
          await serviceClient.from("orders").update({ status: "confirmed" }).eq("id", order.id);
          await serviceClient.from("identity_verification_events").insert({
            session_id, event_type: "order_activated_on_approval", actor_id: adminUserId, actor_role: "admin",
            details: { order_id: order.id },
          });
        }
      }

      // Send approval email
      try {
        const { data: profile } = await serviceClient
          .from("profiles").select("email, full_name").eq("id", session.user_id).single();
        if (profile?.email) {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          if (resendApiKey) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
              body: JSON.stringify({
                from: "Nivra Télécom <Support@nivra-telecom.ca>",
                to: [profile.email],
                subject: `Vérification approuvée — Dossier ${session.case_number || ""}`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#059669;color:white;padding:16px 24px;border-radius:8px 8px 0 0"><h2 style="margin:0">✓ Vérification approuvée</h2></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px"><p>Bonjour ${profile.full_name || ""},</p><p>Votre vérification d'identité a été approuvée. Votre commande est maintenant en cours de traitement.</p><p style="color:#6b7280;font-size:12px">Dossier : ${session.case_number || "—"}</p></div></div>`,
                headers: { "X-Entity-Ref-ID": `kyc-approved-${session_id}`, "List-Unsubscribe": "<mailto:Support@nivra-telecom.ca>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
              }),
            });
          }
        }
      } catch (e) { console.error("[admin-review] Approval email error:", e); }
    }

    // On rejection: cancel linked orders + send email
    if (decision === "rejected") {
      const { data: linkedOrders } = await serviceClient
        .from("orders").select("id, status")
        .eq("identity_verification_session_id", session_id)
        .in("status", ["pending_verification", "pending"]);

      if (linkedOrders?.length) {
        for (const order of linkedOrders) {
          await serviceClient.from("orders").update({ status: "verification_failed", cancellation_reason: `KYC rejected: ${reason}` }).eq("id", order.id);
        }
      }

      // Send rejection email
      try {
        const { data: profile } = await serviceClient
          .from("profiles").select("email, full_name").eq("id", session.user_id).single();
        if (profile?.email) {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          if (resendApiKey) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
              body: JSON.stringify({
                from: "Nivra Télécom <Support@nivra-telecom.ca>",
                to: [profile.email],
                subject: `Vérification refusée — Dossier ${session.case_number || ""}`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px"><div style="background:#dc2626;color:white;padding:16px 24px;border-radius:8px 8px 0 0"><h2 style="margin:0">Vérification refusée</h2></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-radius:0 0 8px 8px"><p>Bonjour ${profile.full_name || ""},</p><p>Votre vérification d'identité a été refusée.</p><p><strong>Raison :</strong> ${reason}</p><p>Si vous pensez qu'il s'agit d'une erreur, veuillez contacter notre support.</p><p style="color:#6b7280;font-size:12px">Dossier : ${session.case_number || "—"}</p></div></div>`,
                headers: { "X-Entity-Ref-ID": `kyc-rejected-${session_id}`, "List-Unsubscribe": "<mailto:Support@nivra-telecom.ca>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
              }),
            });
          }
        }
      } catch (e) { console.error("[admin-review] Rejection email error:", e); }
    }

    return json({ message: `Session ${decision}`, session_id });
  } catch (err) {
    console.error("Admin review error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
