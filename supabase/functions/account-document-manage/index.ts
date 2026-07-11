/**
 * account-document-manage — Admin-only manual document upload / delete
 *
 * Actions:
 *   POST { action: 'resend_signature', contract_id }        → re-queue signature email
 *   POST { action: 'upload', client_user_id, file_b64, filename, document_type }
 *   POST { action: 'delete', document_id }                  → delete uploaded doc + storage
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

async function resolveAccountId(sb: any, clientUserId: string): Promise<string | null> {
  try {
    const { data } = await sb.from("accounts").select("id").eq("client_id", clientUserId).maybeSingle();
    return (data as any)?.id ?? null;
  } catch { return null; }
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "client-documents";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify caller is authenticated staff
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) {
    return new Response(JSON.stringify({ ok: false, error: "UNAUTHENTICATED" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Confirm staff role
  const { data: isStaff } = await supabase.rpc("has_role" as any, { _user_id: userData.user.id, _role: "admin" });
  const { data: isAgent } = await supabase.rpc("has_role" as any, { _user_id: userData.user.id, _role: "agent" });
  if (!isStaff && !isAgent) {
    return new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "resend_signature") {
      const contractId = String(body?.contract_id || "");
      if (!contractId) throw new Error("contract_id required");

      const { data: contract, error: cerr } = await supabase
        .from("contracts")
        .select("id, user_id, order_id, contract_name, contract_number, signature_token, status, is_signed")
        .eq("id", contractId).maybeSingle();
      if (cerr || !contract) throw new Error("Contract not found");
      if (contract.is_signed) throw new Error("Already signed");

      const { data: profile } = await supabase
        .from("profiles").select("email, full_name").eq("user_id", contract.user_id).maybeSingle();
      if (!profile?.email) throw new Error("Client email missing");

      await enqueueCommunication({
        channel: "email",
        templateKey: "contract_ready",
        recipient: profile.email,
        idempotencyKey: `contract_resent_${contractId}_${Date.now()}`,
        templateVars: {
          client_name: profile.full_name || "Client",
          contract_name: contract.contract_name || "Contrat de service",
          contract_number: contract.contract_number || "",
          portal_path: "/portal/contracts",
          is_reminder: true,
          reminder_stage: "manual",
          subject_override: "Contrat à signer — Nivra Télécom",
        } as any,
        priority: 3,
      });

      await supabase.from("contracts").update({
        sent_at: new Date().toISOString(),
        sent_count: ((contract as any).sent_count ?? 0) + 1,
        status: contract.status === "draft" ? "sent" : contract.status,
      } as any).eq("id", contractId);

      const newSentCount = ((contract as any).sent_count ?? 0) + 1;
      const accountIdC = await resolveAccountId(supabase, contract.user_id);
      try {
        await writeAccountJournal(supabase as any, {
          targetTable: "client_internal_notes",
          eventKey: `contract:${contractId}:resend:${newSentCount}:note`,
          actor: { userId: userData.user.id, role: "admin", name: userData.user.email || "Staff", email: userData.user.email ?? null },
          payload: {
            account_id: accountIdC,
            client_id: contract.user_id,
            note_type: "system",
            body: `Contrat ${contract.contract_number || contractId.slice(0, 8)} renvoyé pour signature (action manuelle).`,
            created_by_user_id: userData.user.id,
            created_by_name: userData.user.email || "Staff",
            created_by_role: "admin",
          },
        });
      } catch (_e) { /* best-effort */ }

      return new Response(JSON.stringify({ ok: true, action, contract_id: contractId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upload") {
      if (!isStaff) throw new Error("Admin only");
      const clientUserId = String(body?.client_user_id || "");
      const fileB64 = String(body?.file_b64 || "");
      const filename = String(body?.filename || "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      const documentType = String(body?.document_type || "manual_upload");
      if (!clientUserId || !fileB64) throw new Error("client_user_id + file_b64 required");

      const bytes = Uint8Array.from(atob(fileB64), c => c.charCodeAt(0));
      if (bytes.length > 10 * 1024 * 1024) throw new Error("File too large (>10MB)");
      const path = `${clientUserId}/manual/${Date.now()}-${filename}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        cacheControl: "3600", upsert: false,
        contentType: filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
      });
      if (upErr) throw upErr;

      const { data: doc, error: dErr } = await supabase.from("client_documents").insert({
        user_id: clientUserId,
        document_name: filename,
        document_type: documentType,
        document_url: path,
      } as any).select("id").maybeSingle();
      if (dErr) throw dErr;

      await supabase.from("client_internal_notes").insert({
        client_user_id: clientUserId,
        category: "document",
        note: `Document manuel « ${filename} » téléversé par ${userData.user.email || "admin"}.`,
        created_by: userData.user.id,
        author_name: userData.user.email || "Admin",
      } as any);

      return new Response(JSON.stringify({ ok: true, action, document_id: doc?.id, path }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!isStaff) throw new Error("Admin only");
      const documentId = String(body?.document_id || "");
      const { data: doc } = await supabase.from("client_documents")
        .select("id, user_id, document_url, document_name").eq("id", documentId).maybeSingle();
      if (!doc) throw new Error("Document not found");
      if (doc.document_url && !/^https?:/i.test(doc.document_url)) {
        await supabase.storage.from(BUCKET).remove([doc.document_url]).catch(() => {});
      }
      await supabase.from("client_documents").delete().eq("id", documentId);
      await supabase.from("client_internal_notes").insert({
        client_user_id: doc.user_id,
        category: "document",
        note: `Document « ${doc.document_name || documentId} » supprimé par ${userData.user.email || "admin"}.`,
        created_by: userData.user.id,
        author_name: userData.user.email || "Admin",
      } as any);
      return new Response(JSON.stringify({ ok: true, action }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (err: any) {
    console.error("[account-document-manage] error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
