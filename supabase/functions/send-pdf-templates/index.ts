import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { 
  generateInvoicePDF, 
  generateContractPDF, 
  generateSummaryPDF,
  formatCurrency,
  formatDate,
  COMPANY,
  type InvoiceData,
  type ContractData,
  type SummaryData,
} from "../_shared/pdfGenerator.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Sample data for demo PDFs
const SAMPLE_INVOICE: InvoiceData = {
  invoice_number: "NV-2025-001234",
  invoice_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  account_number: "ACC-123456",
  period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  period_end: new Date().toISOString(),
  client_name: "Jean-François Tremblay",
  client_email: "jean.tremblay@email.com",
  client_phone: "514-555-1234",
  client_address: "1234 Rue de l'Exemple, Montréal, QC H1A 2B3",
  services: [
    { name: "Internet 500 Mbps", description: "Illimité, routeur inclus", price: 50.00, quantity: 1 },
    { name: "TV Basic 26 chaînes", description: "Terminal Nivra 4K inclus", price: 25.00, quantity: 1 },
    { name: "Mobile 50GB", description: "Appels illimités Canada", price: 50.00, quantity: 1 },
  ],
  subtotal: 125.00,
  tps: 6.25,
  tvq: 12.47,
  total: 143.72,
  previous_balance: 0,
  payments: [],
  balance_due: 143.72,
};

const SAMPLE_CONTRACT: ContractData = {
  contract_number: "CTR-2025-001234",
  effective_date: new Date().toISOString(),
  client_name: "Jean-François Tremblay",
  client_email: "jean.tremblay@email.com",
  client_phone: "514-555-1234",
  client_address: "1234 Rue de l'Exemple, Montréal, QC H1A 2B3",
  client_dob: "1985-03-15",
  services: [
    { name: "Internet 500 Mbps", description: "Connexion illimitée", monthly_price: 50.00 },
    { name: "TV Basic 26 chaînes", description: "Avec Terminal Nivra 4K", monthly_price: 25.00 },
    { name: "Mobile 50GB", description: "Appels illimités Canada", monthly_price: 50.00 },
  ],
  equipment: [
    { name: "Routeur Nivra Born Wifi 6", price: 60.00 },
    { name: "Terminal Nivra 4K", price: 50.00 },
  ],
  total_monthly: 125.00,
  total_one_time: 110.00,
  agent_name: "Sophie Martin",
  agent_code: "SM-001",
};

const SAMPLE_SUMMARY: SummaryData = {
  order_number: "CMD-2025-001234",
  order_date: new Date().toISOString(),
  status: "En attente d'installation",
  client_name: "Jean-François Tremblay",
  client_email: "jean.tremblay@email.com",
  client_phone: "514-555-1234",
  client_address: "1234 Rue de l'Exemple, Montréal, QC H1A 2B3",
  services: [
    { name: "Internet 500 Mbps", price: 50.00, is_recurring: true },
    { name: "TV Basic 26 chaînes", price: 25.00, is_recurring: true },
    { name: "Routeur Nivra Born Wifi 6", price: 60.00, is_recurring: false },
    { name: "Terminal Nivra 4K", price: 50.00, is_recurring: false },
  ],
  subtotal_recurring: 75.00,
  subtotal_one_time: 110.00,
  tps: 9.25,
  tvq: 18.47,
  total: 212.72,
  installation_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

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
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
          Vos documents PDF Nivra Telecom sont prêts à être consultés.
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFB;padding:32px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:92vw;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg, #0066CC 0%, #004C99 100%);padding:32px 32px 28px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Nivra Telecom</h1>
                          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:1px;">TÉLÉCOMMUNICATIONS PRÉPAYÉES</p>
                        </td>
                        <td align="right" style="vertical-align:top;">
                          <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:10px 16px;">
                            <span style="font-size:12px;color:#ffffff;">📄 Documents officiels</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:32px;">
                    <h2 style="margin:0 0 16px;font-size:20px;color:#0F172A;font-weight:600;">Vos documents sont joints</h2>
                    
                    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#4A4A4A;">
                      Bonjour,<br /><br />
                      Veuillez trouver en pièces jointes les documents PDF officiels suivants :
                    </p>

                    <div style="background:#F8FAFB;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #0066CC;">
                      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:2;">
                        ${templateList}
                      </ul>
                    </div>

                    <p style="margin:24px 0 0;font-size:14px;color:#64748B;line-height:1.6;">
                      Ces documents contiennent des informations importantes concernant vos services Nivra Telecom. 
                      Veuillez les conserver pour vos dossiers.
                    </p>
                  </td>
                </tr>

                <!-- Help section -->
                <tr>
                  <td style="padding:0 32px 32px;">
                    <div style="background:linear-gradient(135deg, #E6F0FA 0%, #F0F7FF 100%);border-radius:12px;padding:20px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:40px;vertical-align:top;">
                            <div style="width:36px;height:36px;background:#0066CC;border-radius:50%;text-align:center;line-height:36px;font-size:16px;">💬</div>
                          </td>
                          <td style="padding-left:12px;">
                            <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#0F172A;">Besoin d'aide?</p>
                            <p style="margin:0;font-size:13px;color:#4A4A4A;">
                              Répondez à ce courriel ou contactez-nous à 
                              <a href="mailto:support@nivra-telecom.ca" style="color:#0066CC;text-decoration:none;font-weight:600;">support@nivra-telecom.ca</a>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#1F2937;padding:28px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#ffffff;">Nivra Telecom</p>
                          <p style="margin:0 0 12px;font-size:12px;color:#9CA3AF;">
                            Fournisseur de services de télécommunications prépayés au Québec
                          </p>
                          <p style="margin:0;font-size:11px;color:#6B7280;">
                            ${COMPANY.address}
                          </p>
                          <p style="margin:8px 0 0;font-size:11px;color:#6B7280;">
                            TPS: ${COMPANY.gstNumber} | TVQ: ${COMPANY.qstNumber}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top:20px;border-top:1px solid #374151;margin-top:16px;">
                          <p style="margin:0;font-size:10px;color:#6B7280;">
                            © ${new Date().getFullYear()} Nivra Telecom Inc. Tous droits réservés.
                          </p>
                        </td>
                      </tr>
                    </table>
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

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-pdf-templates] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, templates, invoice_data, contract_data, summary_data } = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Default: send all templates with sample data
    const templatesToSend = templates || ["invoice", "contract", "summary"];

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
      templateNames.push("📄 Facture professionnelle multi-pages");
    }

    if (templatesToSend.includes("contract")) {
      const data = contract_data || SAMPLE_CONTRACT;
      attachments.push({
        filename: `Contrat-${data.contract_number || 'Nivra'}.pdf`,
        content: generateContractPDF(data),
        contentType: "application/pdf",
      });
      templateNames.push("📝 Contrat de service (4 pages avec annexes)");
    }

    if (templatesToSend.includes("summary")) {
      const data = summary_data || SAMPLE_SUMMARY;
      attachments.push({
        filename: `Sommaire-${data.order_number || 'Nivra'}.pdf`,
        content: generateSummaryPDF(data),
        contentType: "application/pdf",
      });
      templateNames.push("📋 Sommaire de commande");
    }

    console.log(`[send-pdf-templates] Sending ${attachments.length} PDFs to: ${to}`);

    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [to],
      subject: `Nivra Telecom — Documents PDF officiels (${attachments.length} fichiers)`,
      replyTo: "support@nivra-telecom.ca",
      html: buildEmailHtml(templateNames),
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
