/**
 * send-kyc-request — Admin requests an identity verification from a client
 *
 * - Verifies caller is staff (admin/supervisor/employee/billing_admin)
 * - Creates a kyc_requests row (48h expiry, secure token)
 * - Updates orders.kyc_status = 'pending' and links kyc_request_id
 * - Sends a branded email to the client with the secure /verification/:token link
 * - Logs an activity entry
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";

const PUBLIC_BASE = "https://nivra-telecom.ca";

interface Body {
  order_id: string;
  notes?: string;
}

function buildKycEmailHtml(opts: {
  firstName: string;
  orderNumber: string;
  planName: string;
  kycLink: string;
  expiresAt: string;
}) {
  const expires = new Date(opts.expiresAt).toLocaleString("fr-CA", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1a202c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#0066CC;padding:24px 32px;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:2px;opacity:0.85;text-transform:uppercase;">Action requise</div>
          <div style="font-size:22px;font-weight:700;margin-top:6px;">Vérification d'identité</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Bonjour <strong>${opts.firstName || "client"}</strong>,</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Merci d'avoir choisi Nivra Telecom. Afin de traiter votre commande, nous devons valider votre identité. Cette étape est requise pour assurer la sécurité de votre compte et de vos services.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;">
            <tr><td style="padding:16px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
              <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;">Votre commande</div>
            </td></tr>
            <tr><td style="padding:16px 20px;font-size:14px;line-height:1.7;color:#334155;">
              <div><strong>Commande:</strong> #${opts.orderNumber}</div>
              <div><strong>Forfait:</strong> ${opts.planName}</div>
            </td></tr>
          </table>

          <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin:24px 0 12px;">Comment compléter la vérification</div>
          <ol style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.7;color:#334155;">
            <li>Cliquez sur le bouton ci-dessous</li>
            <li>Prenez une photo de votre pièce d'identité (permis de conduire, passeport, ou carte d'identité)</li>
            <li>La vérification est complétée en moins de 2 minutes</li>
          </ol>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;"><tr><td>
            <a href="${opts.kycLink}" style="display:inline-block;background:#0066CC;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;">Vérifier mon identité →</a>
          </td></tr></table>

          <p style="margin:16px 0 0;font-size:12px;color:#64748b;text-align:center;">Lien valide jusqu'au ${expires}</p>

          <div style="margin-top:28px;padding:14px 16px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:8px;font-size:13px;color:#1e40af;line-height:1.6;">
            🔒 Vos documents d'identité sont chiffrés et supprimés automatiquement dès que votre identité est validée par notre équipe. Nous ne conservons aucune copie de vos informations sensibles.
          </div>

          <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;">Des questions? Écrivez à <a href="mailto:support@nivra-telecom.ca" style="color:#0066CC;">support@nivra-telecom.ca</a>.</p>
          <p style="margin:24px 0 0;font-size:14px;color:#1a202c;">L'équipe Nivra Telecom</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
          © ${new Date().getFullYear()} Nivra Telecom · nivra-telecom.ca
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth: verify caller is staff
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const adminId = userData.user.id;

    // Role check via has_role
    const { data: roles } = await supabaseService.from("user_roles").select("role").eq("user_id", adminId);
    const allowedRoles = ["admin", "supervisor", "employee", "billing_admin"];
    const isStaff = roles?.some((r: any) => allowedRoles.includes(r.role));
    if (!isStaff) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body: Body = await req.json();
    if (!body.order_id) return new Response(JSON.stringify({ error: "order_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch order
    const { data: order, error: orderErr } = await supabaseService
      .from("orders")
      .select("id, order_number, user_id, client_email, client_first_name, client_last_name, service_type, kyc_status")
      .eq("id", body.order_id)
      .maybeSingle();
    if (orderErr || !order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Resolve client email + name
    let clientEmail = order.client_email;
    let firstName = order.client_first_name || "";
    if (order.user_id) {
      const { data: profile } = await supabaseService.from("profiles").select("email, full_name").eq("user_id", order.user_id).maybeSingle();
      if (!clientEmail && profile?.email) clientEmail = profile.email;
      if (!firstName && profile?.full_name) firstName = profile.full_name.split(" ")[0];
    }
    if (!clientEmail) return new Response(JSON.stringify({ error: "No client email on order" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Create KYC request
    const { data: kycReq, error: kycErr } = await supabaseService
      .from("kyc_requests")
      .insert({
        order_id: order.id,
        client_id: order.user_id,
        client_email: clientEmail,
        requested_by: adminId,
        notes: body.notes ?? null,
      })
      .select("id, token, expires_at")
      .single();
    if (kycErr || !kycReq) return new Response(JSON.stringify({ error: kycErr?.message || "Failed to create KYC request" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Update order
    await supabaseService
      .from("orders")
      .update({ kyc_status: "pending", kyc_request_id: kycReq.id })
      .eq("id", order.id);

    // Send email to client
    const kycLink = `${PUBLIC_BASE}/verification/${kycReq.token}`;
    const html = buildKycEmailHtml({
      firstName,
      orderNumber: order.order_number || order.id.slice(0, 8),
      planName: order.service_type || "Service Nivra",
      kycLink,
      expiresAt: kycReq.expires_at,
    });

    await enqueueEmail({
      to: clientEmail,
      subject: "Action requise — Vérification d'identité | Nivra Telecom",
      html,
      messageType: "kyc_request",
      entityType: "kyc_request",
      entityId: kycReq.id,
      eventKey: `kyc_request_${kycReq.id}`,
    });

    // Activity log
    await supabaseService.from("activity_logs").insert({
      user_id: adminId,
      entity_type: "order",
      entity_id: order.id,
      action: "kyc_requested",
      reason: `Vérification d'identité demandée — envoyée à ${clientEmail}`,
    });

    return new Response(JSON.stringify({ success: true, kyc_request_id: kycReq.id, expires_at: kycReq.expires_at }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-kyc-request] Error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
