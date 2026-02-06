import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Professional email template for Terms PDF
const createEmailHtml = (orderId: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Modalités de service - Nivra Telecom</title>
</head>
<body style="margin:0; padding:0; background-color:#F8FAFB; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F8FAFB;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px; width:100%;">
          
          <!-- HEADER -->
          <tr>
            <td style="background-color:#ffffff; border-radius:12px 12px 0 0; padding:0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="height:4px; background-color:#0066CC; border-radius:12px 12px 0 0;"></td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 20px; border-bottom:1px solid #E5E7EB;">
                    <h1 style="margin:0; font-size:26px; font-weight:700; color:#0066CC; letter-spacing:-0.5px;">Nivra Telecom</h1>
                    <p style="margin:4px 0 0; font-size:11px; color:#6B7280; text-transform:uppercase; letter-spacing:1px;">Télécommunications</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CONTENT -->
          <tr>
            <td style="background-color:#ffffff; padding:32px;">
              <h2 style="margin:0 0 16px; font-size:20px; color:#1A1A1A;">
                📄 Modalités de service
              </h2>
              
              <p style="margin:0 0 16px; font-size:14px; color:#4A4A4A; line-height:1.6;">
                Bonjour,<br><br>
                Veuillez trouver ci-joint le document officiel des <strong>Modalités de service – Nivra Telecom</strong> (version 2026-02-05).
              </p>
              
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fafafa; border-radius:8px; border:1px solid #E5E7EB; margin:20px 0;">
                <tr>
                  <td style="padding:14px 16px; border-bottom:1px solid #E5E7EB;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:13px; color:#6B7280; width:40%;">Document</td>
                        <td style="font-size:14px; color:#1A1A1A; font-weight:500; text-align:right;">ND-TOS-2026-02-05</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px; border-bottom:1px solid #E5E7EB;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:13px; color:#6B7280; width:40%;">Version</td>
                        <td style="font-size:14px; color:#1A1A1A; font-weight:500; text-align:right;">2026-02-05</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 16px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="font-size:13px; color:#6B7280; width:40%;">Commande</td>
                        <td style="font-size:14px; color:#1A1A1A; font-weight:500; text-align:right;">${orderId}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin:16px 0; font-size:14px; color:#4A4A4A; line-height:1.6;">
                Ce document contient l'intégralité des conditions de service, incluant les Annexes B, C, D et E.
              </p>
              
              <p style="margin:16px 0 0; font-size:13px; color:#6B7280; line-height:1.6;">
                <em>Hello, please find attached the official Terms of Service document for Nivra Telecom (version 2026-02-05).</em>
              </p>
            </td>
          </tr>
          
          <!-- FOOTER -->
          <tr>
            <td style="background-color:#1F2937; border-radius:0 0 12px 12px; padding:32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <h4 style="margin:0; font-size:18px; font-weight:700; color:#ffffff;">Nivra Telecom</h4>
                    <p style="margin:8px 0 0; font-size:13px; color:#D1D5DB;">
                      Fournisseur de services de télécommunications prépayés au Québec
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <p style="margin:0; font-size:12px; color:#D1D5DB;">
                      1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5
                    </p>
                    <p style="margin:8px 0 0; font-size:13px;">
                      <a href="mailto:Support@nivra-telecom.ca" style="color:#9CA3AF; text-decoration:none;">✉️ Support@nivra-telecom.ca</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="border-top:1px solid #374151; padding-top:16px;">
                    <p style="margin:0; font-size:11px; color:#9CA3AF;">
                      © 2026 Nivra Telecom Inc. Tous droits réservés.
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
</html>`;

// Generate Terms PDF content as base64
// This is a simplified version - the full terms content
function generateTermsPDFBase64(orderId: string): string {
  // Using a simple text-based PDF structure
  // In production, you'd use a proper PDF library or pre-generated template
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Create a minimal valid PDF
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length 2500 >>
stream
BT
/F1 18 Tf
100 750 Td
(MODALITES DE SERVICE - NIVRA TELECOM) Tj
0 -30 Td
/F1 12 Tf
(Version integrale etendue - Prepaye a renouvellement mensuel) Tj
0 -20 Td
(Derniere mise a jour : 2026-02-05) Tj
0 -30 Td
(Document ID: ND-TOS-2026-02-05) Tj
0 -15 Td
(Commande: ${orderId}) Tj
0 -15 Td
(Date emission: ${dateStr}) Tj
0 -40 Td
/F1 14 Tf
(1. PREAMBULE, ACCEPTATION ET CHAMP D'APPLICATION) Tj
0 -25 Td
/F1 10 Tf
(Les presentes Modalites de service constituent une entente legale) Tj
0 -15 Td
(contraignante entre Nivra Communications Inc., operant sous le nom) Tj
0 -15 Td
(Nivra Telecom et toute personne physique ou morale qui cree un compte,) Tj
0 -15 Td
(commande un service, effectue un paiement ou utilise un Service.) Tj
0 -30 Td
/F1 14 Tf
(2. DEFINITIONS ET INTERPRETATION) Tj
0 -25 Td
/F1 10 Tf
(Services: ensemble des services de telecommunications offerts par Nivra.) Tj
0 -15 Td
(Client: toute personne ou entite ayant souscrit un ou plusieurs Services.) Tj
0 -15 Td
(Compte: dossier client cree dans les systemes de Nivra.) Tj
0 -15 Td
(Cycle de facturation: periode contractuelle de trente 30 jours.) Tj
0 -30 Td
/F1 14 Tf
(3. NATURE DES SERVICES) Tj
0 -25 Td
/F1 10 Tf
(Nivra est un fournisseur de services de telecommunications prepayes.) Tj
0 -15 Td
(Aucune verification de credit externe n'est effectuee.) Tj
0 -30 Td
(---) Tj
0 -15 Td
(Document complet disponible sur le portail client.) Tj
0 -15 Td
(Inclut: Annexe B, C, D, E) Tj
0 -30 Td
(Accepte lors de la commande #${orderId}) Tj
0 -15 Td
(Date: ${dateStr}) Tj
0 -40 Td
(c 2026 Nivra Communications Inc. Tous droits reserves.) Tj
ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000002820 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
2899
%%EOF`;

  // Convert to base64
  const encoder = new TextEncoder();
  const bytes = encoder.encode(pdfContent);
  
  // Manual base64 encoding for Deno
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    
    const triplet = (a << 16) | (b << 8) | c;
    
    result += base64Chars[(triplet >> 18) & 0x3f];
    result += base64Chars[(triplet >> 12) & 0x3f];
    result += i + 1 < len ? base64Chars[(triplet >> 6) & 0x3f] : '=';
    result += i + 2 < len ? base64Chars[triplet & 0x3f] : '=';
  }
  
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { to_email, order_id } = await req.json();

    if (!to_email) {
      throw new Error("Missing required field: to_email");
    }

    const orderId = order_id || `TEST-${Date.now()}`;
    const pdfBase64 = generateTermsPDFBase64(orderId);
    const emailHtml = createEmailHtml(orderId);

    console.log(`[send-terms-pdf-email] Sending Terms PDF to: ${to_email}, Order: ${orderId}`);

    // Send via Resend with PDF attachment
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nivra Telecom <noreply@nivra-telecom.ca>",
        to: [to_email],
        reply_to: "Support@nivra-telecom.ca",
        subject: "📄 Modalités de service – Nivra Telecom (ND-TOS-2026-02-05)",
        html: emailHtml,
        text: `Modalités de service - Nivra Telecom\n\nDocument: ND-TOS-2026-02-05\nVersion: 2026-02-05\nCommande: ${orderId}\n\nVeuillez trouver ci-joint le document officiel des Modalités de service.\n\n© 2026 Nivra Communications Inc.`,
        attachments: [
          {
            filename: `Modalites-Service-Nivra-${orderId}.pdf`,
            content: pdfBase64,
            content_type: "application/pdf",
          },
        ],
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error(`[send-terms-pdf-email] Resend error:`, resendData);
      throw new Error(resendData.message || "Failed to send email via Resend");
    }

    console.log(`[send-terms-pdf-email] Email sent successfully:`, resendData);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Terms PDF email sent successfully",
        email_id: resendData.id,
        to_email,
        order_id: orderId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[send-terms-pdf-email] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
