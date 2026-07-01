/**
 * admin-preview-pdf
 *
 * Retourne le PDF (base64) d'un document pour affichage direct dans Nivra Core.
 * POST { type: "invoice"|"receipt"|"contract"|"summary", invoiceId?, orderId? }
 * Auth: Bearer <admin JWT>
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildInvoicePdfAttachment,
  buildReceiptPdfAttachment,
  buildContractPdfAttachment,
  buildSummaryPdfAttachment,
} from "../_shared/pdfFromDb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Token invalide" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", user.id).in("role", ["admin", "super_admin"]).maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admins seulement" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "").toLowerCase();
    let orderId: string | null = body.orderId ?? null;
    let invoiceId: string | null = body.invoiceId ?? null;

    // Fallback: last order / last invoice
    if (!orderId && !invoiceId) {
      const { data: lastOrder } = await admin
        .from("orders").select("id")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      orderId = lastOrder?.id ?? null;
    }
    if (!invoiceId && orderId && (type === "invoice" || type === "receipt")) {
      const { data: inv } = await admin
        .from("billing_invoices").select("id")
        .eq("order_id", orderId).order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      invoiceId = inv?.id ?? null;
    }

    let att: { filename: string; content: string } | null = null;
    switch (type) {
      case "invoice":
        if (!invoiceId) throw new Error("Aucune facture disponible");
        att = await buildInvoicePdfAttachment(invoiceId, "Facture");
        break;
      case "receipt":
        if (!invoiceId) throw new Error("Aucune facture disponible");
        att = await buildReceiptPdfAttachment(invoiceId, "Recu");
        break;
      case "contract":
        if (!orderId) throw new Error("Aucune commande disponible");
        att = await buildContractPdfAttachment(orderId, { filenamePrefix: "Contrat" });
        break;
      case "summary":
        if (!orderId) throw new Error("Aucune commande disponible");
        att = await buildSummaryPdfAttachment(orderId, "Sommaire");
        break;
      default:
        return new Response(JSON.stringify({ error: `type invalide: ${type}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    if (!att) throw new Error("PDF vide — données manquantes");

    return new Response(JSON.stringify({
      filename: att.filename,
      base64: att.content,
      order_id: orderId,
      invoice_id: invoiceId,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[admin-preview-pdf] error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
