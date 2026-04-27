/**
 * kyc-additional-docs-request — Employee asks the client to submit
 * an additional identity document. Updates order_identity_data and
 * sends a Violet Bold email to the client.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";
import { violetShell, violetEsc } from "../_shared/violetEmailShell.ts";

interface Body {
  identity_record_id: string;
  document_requested: string; // "Permis de conduire" | "Passeport" | "Carte d'identité" | "Autre"
  note: string;
}

function buildEmail(firstName: string, orderNumber: string, doc: string, note: string) {
  return violetShell({
    preheader: "Document supplémentaire requis pour finaliser votre vérification.",
    badge: "DOCUMENT REQUIS",
    heroTitle: "Document supplémentaire demandé",
    heroSub: "Quelques minutes suffisent pour le soumettre.",
    greeting: `Bonjour ${violetEsc(firstName) || "client"},`,
    bodyHtml:
      `Pour finaliser la vérification de votre identité sur la commande ` +
      `<strong>#${violetEsc(orderNumber)}</strong>, notre équipe a besoin du document suivant : ` +
      `<strong>${violetEsc(doc)}</strong>.` +
      (note ? `<br/><br/><em>${violetEsc(note)}</em>` : ""),
    cardTitle: "Détails",
    cardRows: [
      ["Commande", `#${violetEsc(orderNumber)}`],
      ["Document demandé", violetEsc(doc)],
      ["Date", new Date().toLocaleDateString("fr-CA", { dateStyle: "long" })],
    ],
    ctaPrimaryUrl: "https://nivra-telecom.ca/portal/identity-verification",
    ctaPrimaryLabel: "Soumettre le document",
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const staffId = userData.user.id;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", staffId);
    const allowed = ["admin", "supervisor", "employee", "billing_admin"];
    if (!roles?.some((r: any) => allowed.includes(r.role))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: Body = await req.json();
    if (!body.identity_record_id || !body.document_requested) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load identity record + order to resolve client email & order_number
    const { data: rec, error: recErr } = await supabase
      .from("order_identity_data")
      .select("id, order_id, verification_status")
      .eq("id", body.identity_record_id)
      .maybeSingle();
    if (recErr || !rec) {
      return new Response(JSON.stringify({ error: "Identity record not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const noteLine = `[${new Date().toISOString().slice(0, 10)}] Documents supplémentaires demandés (${body.document_requested}): ${body.note || "—"}`;

    const { error: updErr } = await supabase
      .from("order_identity_data")
      .update({
        verification_status: "additional_docs_required",
        verified_by: staffId,
        verified_at: new Date().toISOString(),
        notes: noteLine,
      })
      .eq("id", rec.id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup client info via order
    let clientEmail: string | null = null;
    let firstName = "";
    let orderNumber = rec.order_id?.slice(0, 8) ?? "";
    if (rec.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("order_number, customer_email, client_first_name, customer_name, user_id")
        .eq("id", rec.order_id)
        .maybeSingle();
      if (order) {
        clientEmail = order.customer_email ?? null;
        firstName = order.client_first_name ?? (order.customer_name?.split(" ")?.[0] ?? "");
        orderNumber = order.order_number ?? orderNumber;
        if (!clientEmail && order.user_id) {
          const { data: prof } = await supabase
            .from("profiles").select("email, full_name").eq("user_id", order.user_id).maybeSingle();
          clientEmail = prof?.email ?? null;
          if (!firstName) firstName = prof?.full_name?.split(" ")?.[0] ?? "";
        }
      }
    }

    if (clientEmail) {
      try {
        await enqueueEmail({
          to: clientEmail,
          subject: "Document supplémentaire requis — Nivra Telecom",
          html: buildEmail(firstName, orderNumber, body.document_requested, body.note || ""),
          messageType: "kyc_additional_docs_request",
          entityType: "order_identity_data",
          entityId: rec.id,
          eventKey: `kyc_additional_${rec.id}_${Date.now()}`,
        });
      } catch (e) {
        console.warn("[kyc-additional-docs-request] enqueueEmail failed:", e);
      }
    }

    await supabase.from("activity_logs").insert({
      user_id: staffId,
      entity_type: "order_identity_data",
      entity_id: rec.id,
      action: "kyc_additional_docs_requested",
      reason: `Document demandé: ${body.document_requested}${body.note ? " — " + body.note : ""}`,
    });

    return new Response(JSON.stringify({ success: true, status: "additional_docs_required" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[kyc-additional-docs-request] Error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
