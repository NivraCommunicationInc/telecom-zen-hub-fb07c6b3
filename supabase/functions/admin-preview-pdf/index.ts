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
import { checkStaffAuth } from "../_shared/adminAuth.ts";

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
    const { isStaff, callerRole } = await checkStaffAuth(admin, user.id);
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Accès personnel Nivra requis" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const type = String(body.type || "").toLowerCase();
    let orderId: string | null = body.orderId ?? null;
    let invoiceId: string | null = body.invoiceId ?? null;

    if (!["invoice", "receipt", "contract", "summary"].includes(type)) {
      return new Response(JSON.stringify({ error: `type invalide: ${type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invoice/receipt preview must fall back to the latest invoice, not the
    // latest order. Many renewal invoices are not linked to an order_id.
    if (type === "invoice" || type === "receipt") {
      if (!invoiceId && orderId) {
        const { data: inv } = await admin
          .from("billing_invoices")
          .select("id, order_id")
          .eq("order_id", orderId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        invoiceId = inv?.id ?? null;
      }
      if (!invoiceId) {
        const { data: inv } = await admin
          .from("billing_invoices")
          .select("id, order_id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        invoiceId = inv?.id ?? null;
        orderId = orderId ?? inv?.order_id ?? null;
      }
    }

    // Contract/summary need an order. If the selected invoice has no order_id,
    // use the latest order so the action still produces a real PDF instead of
    // failing with a non-2xx response.
    if (type === "contract" || type === "summary") {
      if (!orderId && invoiceId) {
        const { data: inv } = await admin
          .from("billing_invoices")
          .select("order_id")
          .eq("id", invoiceId)
          .maybeSingle();
        orderId = inv?.order_id ?? null;
      }
      if (!orderId) {
        const { data: lastOrder } = await admin
          .from("orders")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        orderId = lastOrder?.id ?? null;
      }
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
    }

    if (!att) throw new Error("PDF vide — données manquantes");

    return new Response(JSON.stringify({
      filename: att.filename,
      base64: att.content,
      order_id: orderId,
      invoice_id: invoiceId,
      role: callerRole,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[admin-preview-pdf] error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
