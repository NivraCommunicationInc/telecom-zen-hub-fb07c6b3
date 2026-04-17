/**
 * kyc-decision — Admin approves or rejects a completed KYC request.
 *
 * Body: { kyc_request_id: string, decision: 'approve' | 'reject', rejection_reason?: string }
 * - Verifies caller is staff
 * - Updates kyc_requests + orders.kyc_status
 * - Sends client notification email (rejection includes reason)
 * - Logs activity
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";

interface Body {
  kyc_request_id: string;
  decision: "approve" | "reject";
  rejection_reason?: string;
}

function approvalEmail(firstName: string, orderNumber: string) {
  return `<!DOCTYPE html><html lang="fr"><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;margin:0;padding:32px 16px;color:#1a202c;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#16a34a;padding:20px 28px;color:#fff;font-size:18px;font-weight:700;">Identité vérifiée ✓</td></tr>
    <tr><td style="padding:28px;font-size:14px;line-height:1.6;">
      <p>Bonjour ${firstName || "client"},</p>
      <p>Votre identité a été <strong>validée avec succès</strong>. Votre commande <strong>#${orderNumber}</strong> peut désormais être traitée normalement.</p>
      <p>Merci d'avoir choisi Nivra Telecom.</p>
      <p style="margin-top:24px;color:#64748b;font-size:12px;">L'équipe Nivra Telecom · support@nivra-telecom.ca</p>
    </td></tr>
  </table></body></html>`;
}

function rejectionEmail(firstName: string, orderNumber: string, reason: string) {
  return `<!DOCTYPE html><html lang="fr"><body style="font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;margin:0;padding:32px 16px;color:#1a202c;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#dc2626;padding:20px 28px;color:#fff;font-size:18px;font-weight:700;">Vérification d'identité — non acceptée</td></tr>
    <tr><td style="padding:28px;font-size:14px;line-height:1.6;">
      <p>Bonjour ${firstName || "client"},</p>
      <p>La pièce d'identité soumise pour la commande <strong>#${orderNumber}</strong> n'a pas pu être validée.</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin:16px 0;color:#991b1b;font-size:13px;"><strong>Motif:</strong> ${reason || "Document non valide"}</div>
      <p>Pour toute question ou pour soumettre une nouvelle demande, écrivez-nous à <a href="mailto:support@nivra-telecom.ca" style="color:#0066CC;">support@nivra-telecom.ca</a>.</p>
      <p style="margin-top:24px;color:#64748b;font-size:12px;">L'équipe Nivra Telecom</p>
    </td></tr>
  </table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const adminId = userData.user.id;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", adminId);
    const allowedRoles = ["admin", "supervisor", "employee", "billing_admin"];
    if (!roles?.some((r: any) => allowedRoles.includes(r.role))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: Body = await req.json();
    if (!body.kyc_request_id || !["approve", "reject"].includes(body.decision)) {
      return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: kycReq, error: kycErr } = await supabase
      .from("kyc_requests")
      .select("id, order_id, client_email, client_id, status")
      .eq("id", body.kyc_request_id)
      .maybeSingle();
    if (kycErr || !kycReq) return new Response(JSON.stringify({ error: "KYC request not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (kycReq.status !== "completed") {
      return new Response(JSON.stringify({ error: "KYC request not in completed state", status: kycReq.status }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newStatus = body.decision === "approve" ? "approved" : "rejected";

    // Update KYC + order
    const updates: Record<string, any> = { status: newStatus };
    if (body.decision === "approve") {
      updates.approved_at = new Date().toISOString();
      updates.approved_by = adminId;
    } else {
      updates.rejection_reason = body.rejection_reason || null;
    }
    const { error: updErr } = await supabase.from("kyc_requests").update(updates).eq("id", kycReq.id);
    if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await supabase.from("orders").update({ kyc_status: newStatus }).eq("id", kycReq.order_id);

    // Email client
    const { data: order } = await supabase.from("orders").select("order_number, client_first_name").eq("id", kycReq.order_id).maybeSingle();
    const firstName = order?.client_first_name || "";
    const orderNumber = order?.order_number || kycReq.order_id?.slice(0, 8);

    try {
      await enqueueEmail({
        to: kycReq.client_email,
        subject: body.decision === "approve"
          ? "Votre identité a été vérifiée — Nivra Telecom"
          : "Vérification d'identité — Action requise — Nivra Telecom",
        html: body.decision === "approve"
          ? approvalEmail(firstName, orderNumber)
          : rejectionEmail(firstName, orderNumber, body.rejection_reason || ""),
        messageType: `kyc_${newStatus}`,
        entityType: "kyc_request",
        entityId: kycReq.id,
        eventKey: `kyc_${newStatus}_${kycReq.id}`,
      });
    } catch (e) {
      console.warn("[kyc-decision] Client notify failed:", e);
    }

    await supabase.from("activity_logs").insert({
      user_id: adminId,
      entity_type: "order",
      entity_id: kycReq.order_id,
      action: `kyc_${newStatus}`,
      reason: body.decision === "approve"
        ? "Vérification d'identité approuvée"
        : `Vérification d'identité rejetée — ${body.rejection_reason || "Non spécifié"}`,
    });

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[kyc-decision] Error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
