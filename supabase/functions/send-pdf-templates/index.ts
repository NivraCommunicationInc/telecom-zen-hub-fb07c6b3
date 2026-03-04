import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { 
  generateInvoicePDF, 
  generateContractPDF, 
  generateSummaryPDF,
  generateContractSummaryPDF,
  formatCurrency,
  formatDate,
  COMPANY,
  type InvoiceData,
  type ContractData,
  type SummaryData,
  type ContractSummaryData,
} from "../_shared/pdfGenerator.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Realistic sample data ───────────────────────────────────────────────────

const SAMPLE_INVOICE: InvoiceData = {
  invoice_number: "INV-2603-TEST-001",
  invoice_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  account_number: "784512",
  period_start: new Date().toISOString(),
  period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  client_name: "Marie-Claire Dufresne",
  client_email: "marie.dufresne@courriel.ca",
  client_phone: "514-892-4567",
  client_address: "4521 Boulevard Saint-Laurent, App. 302, Montreal, QC H2T 1R2",
  services: [
    { name: "Mobile 20GB", description: "Appels/textos illimites Canada", price: 45.00, quantity: 1 },
    { name: "Internet 200 Mbps", description: "Telechargement illimite", price: 55.00, quantity: 1 },
    { name: "TV Essentiel 30 chaines", description: "HD inclus", price: 25.00, quantity: 1 },
    { name: "Carte SIM physique", description: "Equipement", price: 10.00, quantity: 1 },
    { name: "Frais d'activation mobile", description: "Frais unique", price: 25.00, quantity: 1 },
    { name: "Frais de livraison", description: "Expedition standard", price: 5.00, quantity: 1 },
    { name: "Installation Internet", description: "Technicien sur place", price: 50.00, quantity: 1 },
  ],
  subtotal: 215.00,
  discount_label: "Promotion nouveau client (-15%)",
  discount_amount: -18.75,
  tps: 9.81,
  tvq: 19.58,
  total: 225.64,
  previous_balance: 0,
  payments: [
    { date: new Date().toISOString(), method: "PayPal", amount: 225.64, reference: "PP-8X4J29KL" },
  ],
  balance_due: 0,
  status: "paid",
};

const SAMPLE_CONTRACT: ContractData = {
  contract_number: "CTR-QC-TEST-001",
  effective_date: new Date().toISOString(),
  client_name: "Marie-Claire Dufresne",
  client_email: "marie.dufresne@courriel.ca",
  client_phone: "514-892-4567",
  client_address: "4521 Boulevard Saint-Laurent, App. 302, Montreal, QC H2T 1R2",
  client_dob: "1990-07-22",
  services: [
    { name: "Mobile 20GB", description: "Appels/textos illimites Canada", monthly_price: 45.00 },
    { name: "Internet 200 Mbps", description: "Telechargement illimite, routeur inclus", monthly_price: 55.00 },
    { name: "TV Essentiel 30 chaines", description: "HD inclus, terminal 4K", monthly_price: 25.00 },
  ],
  equipment: [
    { name: "Carte SIM physique", price: 10.00 },
    { name: "Routeur Nivra Born WiFi 6", price: 0.00 },
    { name: "Terminal Nivra 4K", price: 0.00 },
  ],
  total_monthly: 125.00,
  total_one_time: 90.00,
  agent_name: "Jonathan Pelletier",
  agent_code: "JP-042",
};

const SAMPLE_SUMMARY: SummaryData = {
  order_number: "CMD-TEST-001",
  order_date: new Date().toISOString(),
  status: "Confirmee",
  client_name: "Marie-Claire Dufresne",
  client_email: "marie.dufresne@courriel.ca",
  client_phone: "514-892-4567",
  client_address: "4521 Boulevard Saint-Laurent, App. 302, Montreal, QC H2T 1R2",
  services: [
    { name: "Mobile 20GB — Appels/textos illimites", price: 45.00, is_recurring: true },
    { name: "Internet 200 Mbps — Illimite", price: 55.00, is_recurring: true },
    { name: "TV Essentiel 30 chaines — HD", price: 25.00, is_recurring: true },
    { name: "Carte SIM physique", price: 10.00, is_recurring: false },
    { name: "Frais d'activation mobile", price: 25.00, is_recurring: false },
    { name: "Frais de livraison", price: 5.00, is_recurring: false },
    { name: "Installation Internet (technicien)", price: 50.00, is_recurring: false },
  ],
  subtotal_recurring: 125.00,
  subtotal_one_time: 90.00,
  tps: 10.75,
  tvq: 21.44,
  total: 247.19,
  installation_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
};

const SAMPLE_CONTRACT_SUMMARY: ContractSummaryData = {
  account_number: "784512",
  contract_number: "CTR-QC-TEST-001",
  order_number: "CMD-TEST-001",
  effective_date: new Date().toISOString(),
  client_name: "Marie-Claire Dufresne",
  client_email: "marie.dufresne@courriel.ca",
  client_phone: "514-892-4567",
  client_address: "4521 Boulevard Saint-Laurent, App. 302, Montreal, QC H2T 1R2",
  services: [
    { name: "Mobile 20GB — Appels/textos illimites Canada", monthly_price: 45.00 },
    { name: "Internet 200 Mbps — Telechargement illimite", monthly_price: 55.00 },
    { name: "TV Essentiel 30 chaines — HD inclus", monthly_price: 25.00 },
  ],
  equipment: [
    { name: "Carte SIM physique", price: 10.00 },
    { name: "Frais d'activation mobile", price: 25.00 },
    { name: "Frais de livraison", price: 5.00 },
    { name: "Installation Internet", price: 50.00 },
  ],
  total_monthly: 125.00,
  total_one_time: 90.00,
  tps_monthly: 6.25,
  tvq_monthly: 12.47,
  total_monthly_with_tax: 143.72,
  payment_method: "PayPal",
  bill_cycle_day: 3,
  terms_version: "Version 2026-02-05",
};

// ─── Email HTML ──────────────────────────────────────────────────────────────

function buildEmailHtml(templates: string[]): string {
  const templateList = templates.map((t) => `<li style="margin-bottom:8px;color:#334155;">${t}</li>`).join("");

  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Nivra Telecom - Documents PDF</title>
      </head>
      <body style="margin:0;padding:0;background:#F8FAFB;color:#0F172A;font-family:Arial,Helvetica,'Segoe UI',sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFB;padding:32px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:92vw;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background:linear-gradient(135deg, #0066CC 0%, #004C99 100%);padding:32px 32px 28px;">
                    <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Nivra Telecom</h1>
                    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:1px;">DOCUMENTS OFFICIELS</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <h2 style="margin:0 0 16px;font-size:20px;color:#0F172A;font-weight:600;">Vos documents sont joints</h2>
                    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4A4A4A;">
                      Bonjour,<br /><br />
                      Veuillez trouver en pieces jointes les documents PDF officiels suivants :
                    </p>
                    <div style="background:#F8FAFB;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #0066CC;">
                      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:2;">
                        ${templateList}
                      </ul>
                    </div>
                    <p style="margin:24px 0 0;font-size:14px;color:#64748B;line-height:1.6;">
                      Ces documents contiennent des informations importantes. Veuillez les conserver pour vos dossiers.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#1F2937;padding:28px 32px;">
                    <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#ffffff;text-align:center;">Nivra Telecom</p>
                    <p style="margin:0 0 12px;font-size:12px;color:#9CA3AF;text-align:center;">${COMPANY.address}</p>
                    <p style="margin:0;font-size:11px;color:#6B7280;text-align:center;">TPS: ${COMPANY.gstNumber} | TVQ: ${COMPANY.qstNumber}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-pdf-templates] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, templates, invoice_data, contract_data, summary_data, contract_summary_data } = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const templatesToSend = templates || ["invoice", "contract", "summary", "contract_summary"];

    console.log(`[send-pdf-templates] Generating PDFs for: ${templatesToSend.join(", ")}`);

    const attachments: { filename: string; content: string; contentType: string }[] = [];
    const templateNames: string[] = [];

    if (templatesToSend.includes("invoice")) {
      const data = invoice_data || SAMPLE_INVOICE;
      attachments.push({
        filename: `Facture-${data.invoice_number || 'Nivra'}.pdf`,
        content: generateInvoicePDF(data),
        contentType: "application/pdf",
      });
      templateNames.push("Facture officielle (Invoice)");
    }

    if (templatesToSend.includes("summary")) {
      const data = summary_data || SAMPLE_SUMMARY;
      attachments.push({
        filename: `Sommaire-${data.order_number || 'Nivra'}.pdf`,
        content: generateSummaryPDF(data),
        contentType: "application/pdf",
      });
      templateNames.push("Sommaire de commande (Order Summary)");
    }

    if (templatesToSend.includes("contract")) {
      const data = contract_data || SAMPLE_CONTRACT;
      attachments.push({
        filename: `Contrat-${data.contract_number || 'Nivra'}.pdf`,
        content: generateContractPDF(data),
        contentType: "application/pdf",
      });
      templateNames.push("Contrat de service (Service Contract)");
    }

    if (templatesToSend.includes("contract_summary")) {
      const data = contract_summary_data || SAMPLE_CONTRACT_SUMMARY;
      attachments.push({
        filename: `Resume-Contrat-${data.contract_number || 'Nivra'}.pdf`,
        content: generateContractSummaryPDF(data),
        contentType: "application/pdf",
      });
      templateNames.push("Resume du contrat / RRE (Contract Summary)");
    }

    console.log(`[send-pdf-templates] Sending ${attachments.length} PDFs to: ${to}`);

    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [to],
      subject: `Nivra Telecom — ${attachments.length} documents PDF officiels`,
      replyTo: "support@nivra-telecom.ca",
      html: buildEmailHtml(templateNames),
      headers: {
        "List-Unsubscribe": "<mailto:support@nivra-telecom.ca>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Entity-Ref-ID": `pdf-templates-${Date.now()}`,
        "Precedence": "bulk",
      },
      attachments,
    });

    console.log("[send-pdf-templates] Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResponse.id, 
        templatesSent: templateNames,
        attachmentCount: attachments.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-pdf-templates] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
