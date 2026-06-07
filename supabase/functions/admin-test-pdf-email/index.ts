/**
 * admin-test-pdf-email
 *
 * Finds the last order in the DB, generates all 4 PDFs (invoice, receipt,
 * contract, order summary), and sends each as a separate email to the
 * specified address (defaults to support@nivra-telecom.ca).
 *
 * POST { "to"?: "email@example.com", "orderId"?: "uuid" }
 * Authorization: Bearer <admin JWT>
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";
import {
  buildInvoicePdfAttachment,
  buildReceiptPdfAttachment,
  buildContractPdfAttachment,
  buildSummaryPdfAttachment,
} from "../_shared/pdfFromDb.ts";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;
const resend           = new Resend(Deno.env.get("RESEND_API_KEY"));

async function sendWithPdf(opts: {
  to: string;
  subject: string;
  badge: string;
  heroTitle: string;
  heroSub: string;
  cardRows: Array<[string, string]>;
  filename: string;
  pdfBase64: string;
}) {
  const html = violetShell({
    preheader: opts.heroSub,
    badge: opts.badge,
    heroTitle: opts.heroTitle,
    heroSub: opts.heroSub,
    cardRows: opts.cardRows,
    helpHtml: 'Des questions? Répondez à ce courriel ou écrivez à <a href="mailto:support@nivra-telecom.ca">support@nivra-telecom.ca</a>.',
  });

  return resend.emails.send({
    from: "Nivra Telecom <noreply@nivra-telecom.ca>",
    to: [opts.to],
    subject: opts.subject,
    replyTo: "support@nivra-telecom.ca",
    html,
    attachments: [{
      filename: opts.filename,
      content: opts.pdfBase64,
      contentType: "application/pdf",
    }],
  });
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req.headers.get("origin"));

  /* ── Auth ── */
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Token invalide" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: roleRow } = await admin
    .from("user_roles").select("role")
    .eq("user_id", user.id).in("role", ["admin", "super_admin"]).maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Admins seulement" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const to: string = body.to || "support@nivra-telecom.ca";

  /* ── Find last order ── */
  let orderId: string = body.orderId;
  if (!orderId) {
    const { data: lastOrder } = await admin
      .from("orders")
      .select("id, order_number, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastOrder) {
      return new Response(JSON.stringify({ error: "Aucune commande trouvée" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    orderId = lastOrder.id;
  }

  /* ── Find last invoice for that order ── */
  const { data: lastInvoice } = await admin
    .from("billing_invoices")
    .select("id, invoice_number, status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const invoiceId: string | null = lastInvoice?.id ?? null;

  /* ── Get order info for labels ── */
  const { data: orderInfo } = await admin
    .from("orders")
    .select("order_number, created_at")
    .eq("id", orderId)
    .maybeSingle();
  const orderNum = (orderInfo as any)?.order_number ?? orderId.slice(0, 8).toUpperCase();
  const invoiceNum = (lastInvoice as any)?.invoice_number ?? invoiceId?.slice(0, 8).toUpperCase() ?? "N/A";

  const results: Array<{ type: string; status: "ok" | "skipped" | "error"; detail?: string }> = [];

  /* ── 1. Facture ── */
  if (invoiceId) {
    try {
      const att = await buildInvoicePdfAttachment(invoiceId, "Facture");
      if (att) {
        await sendWithPdf({
          to,
          subject: `Nivra Telecom — Facture #${invoiceNum}`,
          badge: "FACTURE",
          heroTitle: `Facture #${invoiceNum}`,
          heroSub: "Votre facture est disponible en pièce jointe.",
          cardRows: [
            ["Commande", orderNum],
            ["Facture", invoiceNum],
            ["Statut", (lastInvoice as any)?.status ?? "—"],
          ],
          filename: att.filename,
          pdfBase64: att.content,
        });
        results.push({ type: "facture", status: "ok" });
      } else {
        results.push({ type: "facture", status: "error", detail: "PDF null — données manquantes" });
      }
    } catch (e: any) {
      results.push({ type: "facture", status: "error", detail: e.message });
    }
  } else {
    results.push({ type: "facture", status: "skipped", detail: "Aucune facture pour cette commande" });
  }

  /* ── 2. Reçu ── */
  if (invoiceId) {
    try {
      const att = await buildReceiptPdfAttachment(invoiceId, "Recu");
      if (att) {
        await sendWithPdf({
          to,
          subject: `Nivra Telecom — Reçu de paiement #${invoiceNum}`,
          badge: "REÇU DE PAIEMENT",
          heroTitle: "Reçu de paiement",
          heroSub: "Votre reçu de paiement est disponible en pièce jointe.",
          cardRows: [
            ["Commande", orderNum],
            ["Facture", invoiceNum],
          ],
          filename: att.filename,
          pdfBase64: att.content,
        });
        results.push({ type: "recu", status: "ok" });
      } else {
        results.push({ type: "recu", status: "error", detail: "PDF null — données manquantes" });
      }
    } catch (e: any) {
      results.push({ type: "recu", status: "error", detail: e.message });
    }
  } else {
    results.push({ type: "recu", status: "skipped", detail: "Aucune facture pour cette commande" });
  }

  /* ── 3. Contrat ── */
  try {
    const att = await buildContractPdfAttachment(orderId, { filenamePrefix: "Contrat" });
    if (att) {
      await sendWithPdf({
        to,
        subject: `Nivra Telecom — Contrat de service #${orderNum}`,
        badge: "CONTRAT DE SERVICE",
        heroTitle: "Votre contrat de service",
        heroSub: "Votre contrat est disponible en pièce jointe.",
        cardRows: [["Commande", orderNum]],
        filename: att.filename,
        pdfBase64: att.content,
      });
      results.push({ type: "contrat", status: "ok" });
    } else {
      results.push({ type: "contrat", status: "error", detail: "PDF null — données manquantes" });
    }
  } catch (e: any) {
    results.push({ type: "contrat", status: "error", detail: e.message });
  }

  /* ── 4. Sommaire de commande ── */
  try {
    const att = await buildSummaryPdfAttachment(orderId, "Sommaire");
    if (att) {
      await sendWithPdf({
        to,
        subject: `Nivra Telecom — Sommaire de commande #${orderNum}`,
        badge: "SOMMAIRE DE COMMANDE",
        heroTitle: `Commande #${orderNum}`,
        heroSub: "Votre sommaire de commande est disponible en pièce jointe.",
        cardRows: [["Commande", orderNum]],
        filename: att.filename,
        pdfBase64: att.content,
      });
      results.push({ type: "sommaire", status: "ok" });
    } else {
      results.push({ type: "sommaire", status: "error", detail: "PDF null — données manquantes" });
    }
  } catch (e: any) {
    results.push({ type: "sommaire", status: "error", detail: e.message });
  }

  const ok = results.filter(r => r.status === "ok").length;
  console.log(`[admin-test-pdf-email] done — sent=${ok}/${results.length} → ${to}`);

  return new Response(JSON.stringify({
    to,
    order_id: orderId,
    invoice_id: invoiceId,
    order_number: orderNum,
    results,
  }, null, 2), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
