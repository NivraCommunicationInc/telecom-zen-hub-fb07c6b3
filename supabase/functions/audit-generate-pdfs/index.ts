// Temporary audit function — generates contract+invoice+receipt+summary
// PDFs for a given order_number. If `email` is provided, also sends the PDFs
// to that address as attachments via Resend; otherwise returns them as base64.
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { requireStaff } from "../_shared/adminAuth.ts";
import {
  buildInvoicePdfAttachment,
  buildContractPdfAttachment,
  buildReceiptPdfAttachment,
  buildSummaryPdfAttachment,
} from "../_shared/pdfFromDb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Admin-only — this function can regenerate/send customer PDFs
  const auth = await requireStaff(req, sb, ["admin", "super_admin", "supervisor"]);
  if (auth instanceof Response) return auth;

  const { order_number, email } = await req.json();

  let order: { id: string; order_number: number } | null = null;
  if (order_number) {
    const { data } = await sb.from("orders").select("id, order_number").eq("order_number", order_number).maybeSingle();
    order = data as any;
  } else {
    const { data } = await sb.from("orders").select("id, order_number").order("created_at", { ascending: false }).limit(1).maybeSingle();
    order = data as any;
  }
  if (!order) return new Response(JSON.stringify({ error: "order not found" }), { status: 404, headers: corsHeaders });

  const { data: inv } = await sb.from("billing_invoices").select("id").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const [contract, invoice, receipt, summary] = await Promise.all([
    buildContractPdfAttachment(order.id),
    inv ? buildInvoicePdfAttachment(inv.id) : Promise.resolve(null),
    inv ? buildReceiptPdfAttachment(inv.id) : Promise.resolve(null),
    buildSummaryPdfAttachment(order.id),
  ]);

  if (email) {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const attachments = [contract, invoice, receipt, summary]
      .filter((a): a is { filename: string; content: string } => !!a && !!a.content)
      .map((a) => ({ filename: a.filename, content: a.content, contentType: "application/pdf" }));
    const r = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [email],
      replyTo: "support@nivra-telecom.ca",
      subject: `Nivra Telecom — Documents commande #${order.order_number}`,
      html: `<p>Voici les 4 documents PDF générés pour la commande <strong>#${order.order_number}</strong> (moteur V3).</p>
<ul>
  <li>Contrat de service</li>
  <li>Facture</li>
  <li>Reçu de paiement</li>
  <li>Sommaire de commande</li>
</ul>
<p>Pièces jointes : ${attachments.length} fichier(s).</p>`,
      attachments,
    });
    return new Response(JSON.stringify({
      sent_to: email,
      order_number: order.order_number,
      attachments: attachments.map((a) => a.filename),
      resend: r,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ contract, invoice, receipt, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
