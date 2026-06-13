/**
 * kyc-decision â€” Admin approves or rejects a completed KYC request.
 * Emails are rendered with the unified Violet Bold shell.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

interface Body {
  kyc_request_id: string;
  decision: "approve" | "reject";
  rejection_reason?: string;
}

function approvalEmail(firstName: string, orderNumber: string) {
  return violetShell({
    preheader: "Votre identitÃ© a Ã©tÃ© vÃ©rifiÃ©e avec succÃ¨s.",
    badge: "IDENTITÃ‰ VÃ‰RIFIÃ‰E",
    heroTitle: "Votre identitÃ© a Ã©tÃ© vÃ©rifiÃ©e",
    heroSub: "Votre dossier est complet.",
    greeting: `Bonjour ${firstName || "client"},`,
    bodyHtml: `Votre identitÃ© a Ã©tÃ© <strong>validÃ©e avec succÃ¨s</strong>. Votre commande peut dÃ©sormais Ãªtre traitÃ©e normalement.`,
    cardTitle: "DÃ©tails",
    cardRows: [
      ["Commande", `#${orderNumber}`],
      ["Statut", "ApprouvÃ©"],
      ["Date", new Date().toLocaleDateString("fr-CA", { dateStyle: "long" })],
    ],
  });
}

function rejectionEmail(firstName: string, orderNumber: string, reason: string) {
  return violetShell({
    preheader: "Votre document d'identitÃ© n'a pas Ã©tÃ© acceptÃ©.",
    badge: "ACTION REQUISE",
    heroTitle: "Document d'identitÃ© refusÃ©",
    greeting: `Bonjour ${firstName || "client"},`,
    bodyHtml: `La piÃ¨ce d'identitÃ© soumise pour la commande <strong>#${orderNumber}</strong> n'a pas pu Ãªtre validÃ©e.`,
    cardTitle: "DÃ©tails",
    cardRows: [
      ["Commande", `#${orderNumber}`],
      ["Raison", reason || "Document non valide"],
    ],
    ctaPrimaryUrl: "https://nivra-telecom.ca/portal/identity-verification",
    ctaPrimaryLabel: "Resoumettre",
    helpVariant: "warning",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

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
    const allowedRoles = ["admin", "supervisor"];
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

    const { data: order } = await supabase.from("orders").select("order_number, client_first_name").eq("id", kycReq.order_id).maybeSingle();
    const firstName = order?.client_first_name || "";
    const orderNumber = order?.order_number || kycReq.order_id?.slice(0, 8);

    try {
      await enqueueEmail({
        to: kycReq.client_email,
        subject: body.decision === "approve"
          ? "Votre identitÃ© a Ã©tÃ© vÃ©rifiÃ©e â€” Nivra Telecom"
          : "Document d'identitÃ© refusÃ© â€” Nivra Telecom",
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
        ? "VÃ©rification d'identitÃ© approuvÃ©e"
        : `VÃ©rification d'identitÃ© rejetÃ©e â€” ${body.rejection_reason || "Non spÃ©cifiÃ©"}`,
    });

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[kyc-decision] Error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
