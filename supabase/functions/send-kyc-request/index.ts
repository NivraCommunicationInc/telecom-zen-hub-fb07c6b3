/**
 * send-kyc-request â€” Admin requests an identity verification from a client
 *
 * Sends a Violet Bold branded email containing the secure /verification/:token link.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";
import { checkStaffAuth } from "../_shared/adminAuth.ts";

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
  return violetShell({
    preheader: "Vérification d'identité requise pour activer votre service.",
    badge: "VÉRIFICATION REQUISE",
    heroTitle: "Vérification d'identité requise",
    heroSub: "Pour activer votre service, nous devons vérifier votre identité.",
    greeting: `Bonjour ${opts.firstName || "client"},`,
    bodyHtml: `Soumettez une pièce d'identité valide (passeport, permis de conduire ou carte d'identité). La vérification se fait en moins de 2 minutes.`,
    cardTitle: "Détails",
    cardRows: [
      ["Commande", `#${opts.orderNumber}`],
      ["Forfait", opts.planName],
      ["Expire le", expires],
    ],
    ctaPrimaryUrl: opts.kycLink,
    ctaPrimaryLabel: "Soumettre mes documents",
    helpHtml:
      `ðŸ”’ Vos documents sont chiffrés et supprimés automatiquement dès que votre identité est validée. Aucune copie n'est conservée.`,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const adminId = userData.user.id;

    const { isStaff } = await checkStaffAuth(supabaseService, adminId);
    if (!isStaff) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body: Body = await req.json();
    if (!body.order_id) return new Response(JSON.stringify({ error: "order_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: order, error: orderErr } = await supabaseService
      .from("orders")
      .select("id, order_number, user_id, client_email, client_first_name, client_last_name, service_type, kyc_status")
      .eq("id", body.order_id)
      .maybeSingle();
    if (orderErr || !order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let clientEmail = order.client_email;
    let firstName = order.client_first_name || "";
    if (order.user_id) {
      const { data: profile } = await supabaseService.from("profiles").select("email, full_name").eq("user_id", order.user_id).maybeSingle();
      if (!clientEmail && profile?.email) clientEmail = profile.email;
      if (!firstName && profile?.full_name) firstName = profile.full_name.split(" ")[0];
    }
    if (!clientEmail) return new Response(JSON.stringify({ error: "No client email on order" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    await supabaseService
      .from("orders")
      .update({ kyc_status: "pending", kyc_request_id: kycReq.id })
      .eq("id", order.id);

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
      subject: "Vérification d'identité requise â€” Nivra Telecom",
      html,
      messageType: "kyc_request",
      entityType: "kyc_request",
      entityId: kycReq.id,
      eventKey: `kyc_request_${kycReq.id}`,
    });

    await supabaseService.from("activity_logs").insert({
      user_id: adminId,
      entity_type: "order",
      entity_id: order.id,
      action: "kyc_requested",
      reason: `Vérification d'identité demandée â€” envoyée Ã  ${clientEmail}`,
    });

    return new Response(JSON.stringify({ success: true, kyc_request_id: kycReq.id, expires_at: kycReq.expires_at }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-kyc-request] Error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
