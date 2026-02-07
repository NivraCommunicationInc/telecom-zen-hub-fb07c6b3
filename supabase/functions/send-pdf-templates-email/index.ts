/**
 * Edge Function: Send PDF Templates by Email
 * Sends an overview of all Nivra PDF templates V2.4 to a specified email
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATES_OVERVIEW = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f8fafc; }
    .header { background: #0F172A; color: white; padding: 25px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0 0; color: #94a3b8; }
    .content { background: white; padding: 25px; border: 1px solid #e2e8f0; }
    .template-card { border: 1px solid #e2e8f0; border-radius: 8px; margin: 15px 0; overflow: hidden; }
    .template-header { background: #14B8A6; color: white; padding: 12px 15px; font-weight: bold; }
    .template-body { padding: 15px; }
    .template-body h4 { margin: 0 0 8px 0; color: #0F172A; }
    .template-body p { margin: 0 0 10px 0; color: #64748B; font-size: 14px; }
    .template-body ul { margin: 5px 0; padding-left: 20px; color: #334155; font-size: 13px; }
    .template-body li { margin: 3px 0; }
    .file-path { background: #f1f5f9; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #475569; margin-top: 10px; }
    .footer { background: #0F172A; color: #94a3b8; padding: 15px 25px; font-size: 12px; text-align: center; border-radius: 0 0 8px 8px; }
    .badge { display: inline-block; background: #14B8A6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📄 Templates PDF V2.4 — Nivra Telecom</h1>
    <p>Documentation des templates de facturation et contrats</p>
  </div>
  
  <div class="content">
    <p>Voici la liste complète des <strong>5 templates PDF V2.4</strong> utilisés dans le système de facturation Nivra :</p>
    
    <!-- Template 1: Modalités -->
    <div class="template-card">
      <div class="template-header">📋 1. MODALITÉS DE SERVICE</div>
      <div class="template-body">
        <h4>Document ID: ND-TOS-2026-02-05</h4>
        <p>Document légal multi-pages (8+ pages) contenant les termes et conditions complets du service Nivra Telecom.</p>
        <ul>
          <li>21 sections légales complètes</li>
          <li>Annexe B: Conditions spécifiques par service</li>
          <li>Annexe C: Politique d'installation et rendez-vous</li>
          <li>Annexe D: Modalités de paiement et e-Transfer</li>
          <li>Annexe E: Support, tickets, SLA Entreprise</li>
        </ul>
        <p><strong>Interface:</strong> <code>TermsModalitesData</code></p>
        <div class="file-path">📁 src/lib/pdfEngine/termsModalitesPdfGenerator.ts (946 lignes)</div>
      </div>
    </div>
    
    <!-- Template 2: Résumé de commande -->
    <div class="template-card">
      <div class="template-header">🛒 2. RÉSUMÉ DE COMMANDE (Order Summary)</div>
      <div class="template-body">
        <h4>Envoyé après paiement confirmé</h4>
        <p>Confirmation de commande avec détails complets des services et équipements achetés.</p>
        <ul>
          <li>Bannière statut: "✓ COMMANDE CONFIRMÉE"</li>
          <li>Info client + adresse de service</li>
          <li>Tableau des services récurrents (📱 Mobile, 🌐 Internet, 📺 TV, etc.)</li>
          <li>Tableau des équipements et frais uniques</li>
          <li>Totaux avec TPS/TVQ</li>
          <li>Dates clés: activation prévue, première facture</li>
        </ul>
        <p><strong>Interface:</strong> <code>OrderSummaryData</code></p>
        <div class="file-path">📁 src/lib/pdf/orderSummaryTemplate.ts (368 lignes)</div>
      </div>
    </div>
    
    <!-- Template 3: Contrat -->
    <div class="template-card">
      <div class="template-header">📝 3. CONTRAT DE SERVICE (8+ pages)</div>
      <div class="template-body">
        <h4>Entente de service de télécommunications prépayé</h4>
        <p>Contrat complet style Rogers/Telus/Bell avec toutes les annexes légales.</p>
        <ul>
          <li>Page 1: Résumé exécutif + parties</li>
          <li>Services souscrits (récurrents)</li>
          <li>Équipements (achat)</li>
          <li>Frais uniques + totaux</li>
          <li><strong>Annexe A:</strong> Termes et conditions généraux</li>
          <li><strong>Annexe B:</strong> Conditions spécifiques par service</li>
          <li><strong>Annexe C:</strong> Installation et rendez-vous</li>
          <li><strong>Annexe D:</strong> Modalités de paiement</li>
          <li><strong>Annexe E:</strong> Support, SLA, clauses avancées</li>
          <li>Bloc de signature électronique</li>
        </ul>
        <p><strong>Interface:</strong> <code>ContractData</code></p>
        <div class="file-path">📁 src/lib/pdf/contractTemplate.ts (796 lignes)</div>
      </div>
    </div>
    
    <!-- Template 4: Facture Unique -->
    <div class="template-card">
      <div class="template-header">💳 4. FACTURE UNIQUE (One-Time Invoice V2.4)</div>
      <div class="template-body">
        <h4>Pour équipements, activation, livraison, frais uniques</h4>
        <p>Design professionnel Navy/Teal avec format standardisé V2.4.</p>
        <ul>
          <li>Header: NIVRA COMMUNICATIONS INC. + accent Teal</li>
          <li>Bloc client + bloc détails facture</li>
          <li>Badge "Total à payer" Teal</li>
          <li>Tableau: Description | Qté | Prix | Montant</li>
          <li>Note encadrée (équipement, SIM/eSIM, etc.)</li>
          <li>Sous-total, rabais (vert), TPS/TVQ, Total</li>
          <li>Paiements reçus (si applicable)</li>
          <li>Instructions Interac e-Transfer</li>
          <li>Footer: Politique de facturation prépayée</li>
        </ul>
        <p><strong>Interface:</strong> <code>InvoiceDataV2</code></p>
        <div class="file-path">📁 src/lib/pdf/invoiceOneTimeTemplateV2.ts (430 lignes)</div>
      </div>
    </div>
    
    <!-- Template 5: Facture Mensuelle -->
    <div class="template-card">
      <div class="template-header">📅 5. FACTURE MENSUELLE (Monthly Invoice V2.4)</div>
      <div class="template-body">
        <h4>Facturation récurrente pour services mensuels</h4>
        <p>Design professionnel Navy/Teal avec format standardisé V2.4.</p>
        <ul>
          <li>Header: "FACTURE MENSUELLE" + devise CAD</li>
          <li>Bloc client (nom, courriel, téléphone, adresse)</li>
          <li>Bloc facture (N° compte, N° facture, période, statut)</li>
          <li>Badge "Total à payer" Teal</li>
          <li>Tableau services: Description | Période | Qté | Prix | Montant</li>
          <li>Note prépayé encadrée (rappel modèle)</li>
          <li>Sous-total, rabais, TPS(5%), TVQ(9.975%), Total</li>
          <li>Solde à payer (barre Navy)</li>
          <li>Instructions de paiement Interac/PayPal/Carte</li>
          <li>Footer légal complet</li>
        </ul>
        <p><strong>Interface:</strong> <code>InvoiceDataV2</code></p>
        <div class="file-path">📁 src/lib/pdf/invoiceMonthlyTemplateV2.ts (460 lignes)</div>
      </div>
    </div>
    
    <hr style="margin: 25px 0; border: none; border-top: 1px solid #e2e8f0;">
    
    <h3 style="color: #0F172A;">📊 Récapitulatif technique</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr style="background: #f8fafc;">
        <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0;">Template</th>
        <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0;">Interface</th>
        <th style="padding: 10px; text-align: left; border: 1px solid #e2e8f0;">Fichier</th>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Modalités</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;"><code>TermsModalitesData</code></td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">pdfEngine/termsModalitesPdfGenerator.ts</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Résumé commande</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;"><code>OrderSummaryData</code></td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">pdf/orderSummaryTemplate.ts</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Contrat</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;"><code>ContractData</code></td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">pdf/contractTemplate.ts</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Facture Unique</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;"><code>InvoiceDataV2</code></td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">pdf/invoiceOneTimeTemplateV2.ts</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Facture Mensuelle</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;"><code>InvoiceDataV2</code></td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">pdf/invoiceMonthlyTemplateV2.ts</td>
      </tr>
    </table>
    
    <div style="margin-top: 25px; padding: 15px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
      <strong style="color: #166534;">✓ Convention Règle 2-9:</strong>
      <p style="margin: 5px 0 0 0; color: #166534; font-size: 13px;">
        Tous les numéros générés (INV-2026-XXXX, CTR-2026-XXXX, ORD-2026-XXXX) commencent par "2" et ont 9 chiffres minimum.
        Les montants sont extraits du snapshot <code>billing_totals</code> du checkout.
      </p>
    </div>
  </div>
  
  <div class="footer">
    <p>© 2026 Nivra Communications Inc. — Templates PDF V2.4</p>
    <p>Généré automatiquement depuis le système Nivra Telecom</p>
  </div>
</body>
</html>
`;

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const { email } = await req.json();
    
    if (!email) {
      throw new Error("Email address is required");
    }

    const resend = new Resend(RESEND_API_KEY);

    const emailResult = await resend.emails.send({
      from: "Nivra Télécom <Support@nivra-telecom.ca>",
      to: [email],
      subject: "📄 Templates PDF V2.4 — Documentation Complète",
      html: TEMPLATES_OVERVIEW,
    });

    console.log("[send-pdf-templates-email] Email sent:", emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email envoyé à ${email}`,
        emailId: emailResult.id 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error) {
    console.error("[send-pdf-templates-email] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
