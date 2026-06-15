/**
 * send-pdf-audit-all
 * ------------------
 * One-shot audit function: fetches the most recent order, generates every
 * PDF template (4 locked + up to 17 auto-document types), and sends a
 * single email to the business inbox with all PDFs attached.
 *
 * Invoke:  POST /functions/v1/send-pdf-audit-all  (no body required)
 * Auth:    service-role key in Authorization header, OR verify_jwt = false
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildInvoicePdfAttachment,
  buildReceiptPdfAttachment,
  buildContractPdfAttachment,
  buildSummaryPdfAttachment,
} from "../_shared/pdfFromDb.ts";
import { dispatchAutoDocument, type AutoDocType } from "../_shared/pdf/dispatcher.ts";

/** Convert Uint8Array â†’ base64 string */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const BUSINESS_EMAIL = "support@nivra-telecom.ca";
const FROM_EMAIL = "Nivra Telecom <support@nivra-telecom.ca>";

// â”€â”€ Resend direct (bypass pgmq for this one-shot audit) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendViaResend(
  resendKey: string,
  subject: string,
  html: string,
  attachments: Array<{ filename: string; content: string; contentType: string }>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [BUSINESS_EMAIL],
      subject,
      html,
      attachments,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;

    const sb = createClient(supabaseUrl, serviceKey);

    // â”€â”€ 1. Fetch last order â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { data: order, error: orderErr } = await sb
      .from("orders")
      .select("*, profiles(*), accounts(*)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "No orders found", detail: orderErr?.message }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // â”€â”€ 2. Fetch related records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [profileRes, accountRes, invoiceRes, contractRes] = await Promise.all([
      sb.from("profiles").select("*").eq("user_id", order.user_id).maybeSingle(),
      sb.from("accounts").select("*").eq("client_id", order.user_id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
      sb.from("billing_invoices").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("contracts").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const account = accountRes.data;
    const invoice = invoiceRes.data;
    const contract = contractRes.data;

    // Build resolved client info for auto-doc templates
    const clientName = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ")
      || profile?.full_name
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
      || "Client Nivra";

    const clientEmail = order.client_email || profile?.email || BUSINESS_EMAIL;
    const clientPhone = order.client_phone || profile?.phone || "438-000-0000";
    const clientAddress = order.shipping_address || account?.billing_address || profile?.address || "1 Rue Test";
    const clientCity = order.shipping_city || account?.billing_city || profile?.city || "Laval";
    const clientProvince = order.shipping_province || account?.billing_province || "QC";
    const clientPostal = order.shipping_postal_code || account?.billing_postal_code || profile?.postal_code || "H7T 2Y5";
    const accountNumber = account?.account_number || "000000";
    const orderNumber = order.order_number?.toString() || order.id.slice(0, 8);
    const invoiceNumber = invoice?.invoice_number || `INV-${orderNumber}`;
    const contractNumber = contract?.contract_number || `CTR-${orderNumber}`;
    const nowIso = new Date().toISOString();
    const serviceType = order.service_type || "Internet";
    const planName = order.plan_name || `Forfait ${serviceType}`;
    const invoiceAmount = Number(invoice?.total ?? order.total_amount ?? 50);

    const baseClient = {
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone,
      client_address: clientAddress,
      client_city: clientCity,
      client_province: clientProvince,
      client_postal: clientPostal,
      account_number: accountNumber,
    };

    console.log(`[AuditAll] Order: ${orderNumber} | Client: ${clientName} | Invoice: ${invoiceNumber}`);

    // â”€â”€ 3. Generate locked PDFs (4) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const attachments: Array<{ filename: string; content: string; contentType: string }> = [];
    const results: Record<string, string> = {};

    // Invoice
    if (invoice?.id) {
      try {
        const att = await buildInvoicePdfAttachment(invoice.id);
        if (att?.content) {
          attachments.push({ filename: `01_Facture_${invoiceNumber}.pdf`, content: att.content, contentType: "application/pdf" });
          results["invoice"] = "OK";
        } else results["invoice"] = "empty";
      } catch (e) { results["invoice"] = `ERR: ${e.message}`; }
    } else results["invoice"] = "no invoice";

    // Receipt
    if (invoice?.id) {
      try {
        const att = await buildReceiptPdfAttachment(invoice.id);
        if (att?.content) {
          attachments.push({ filename: `02_Recu_${invoiceNumber}.pdf`, content: att.content, contentType: "application/pdf" });
          results["receipt"] = "OK";
        } else results["receipt"] = "empty";
      } catch (e) { results["receipt"] = `ERR: ${e.message}`; }
    } else results["receipt"] = "no invoice";

    // Contract
    if (order?.id) {
      try {
        const att = await buildContractPdfAttachment(order.id);
        if (att?.content) {
          attachments.push({ filename: `03_Contrat_${contractNumber}.pdf`, content: att.content, contentType: "application/pdf" });
          results["contract"] = "OK";
        } else results["contract"] = "empty";
      } catch (e) { results["contract"] = `ERR: ${e.message}`; }
    }

    // Order Summary
    if (order?.id) {
      try {
        const att = await buildSummaryPdfAttachment(order.id);
        if (att?.content) {
          attachments.push({ filename: `04_Sommaire_${orderNumber}.pdf`, content: att.content, contentType: "application/pdf" });
          results["summary"] = "OK";
        } else results["summary"] = "empty";
      } catch (e) { results["summary"] = `ERR: ${e.message}`; }
    }

    // â”€â”€ 4. Generate auto-document PDFs (17) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const autoDocTypes: Array<[string, string, Record<string, any>]> = [
      ["welcome_letter", "05_Lettre_Bienvenue", {
        letter_number: `LTR-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        service_name: planName, activation_date: nowIso, plan_name: planName,
        issue_date: nowIso,
      }],
      ["activation_confirmation", "06_Confirmation_Activation", {
        confirmation_number: `ACT-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        service_name: planName, plan_name: planName, activation_date: nowIso,
        issue_date: nowIso,
      }],
      ["suspension_notice", "07_Avis_Suspension", {
        notice_number: `SUS-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        service_name: planName, plan_name: planName,
        suspension_date: nowIso, reason: "Solde impayé â€” test d'audit",
        amount_due: invoiceAmount,
        invoice_numbers: [invoiceNumber],
        reactivation_fee: 15,
        issue_date: nowIso,
      }],
      ["cancellation_confirmation", "08_Confirmation_Annulation", {
        confirmation_number: `CAN-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        service_name: planName, plan_name: planName,
        cancellation_date: nowIso, effective_date: nowIso,
        reason: "Annulation Ã  la demande du client â€” test d'audit",
        final_balance: 0,
        issue_date: nowIso,
      }],
      ["chargeback_notice", "09_Avis_Chargeback", {
        notice_number: `CHB-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        chargeback_date: nowIso, invoice_number: invoiceNumber,
        invoice_date: invoice?.created_at || nowIso, invoice_amount: invoiceAmount,
        chargeback_amount: invoiceAmount, reactivation_fee: 25,
        total_due: invoiceAmount + 25, response_deadline: nowIso,
        issue_date: nowIso,
      }],
      ["final_refund_receipt", "10_Recu_Remboursement_Final", {
        receipt_number: `REF-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        refund_amount: invoiceAmount, processed_date: nowIso,
        refund_method: "Virement Interac",
        related_invoice: invoiceNumber,
        reason: "Remboursement suite Ã  annulation â€” test d'audit",
        account_closed: false,
        issue_date: nowIso,
      }],
      ["delivery_slip", "11_Bon_Livraison", {
        slip_number: `LIV-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        account_number: accountNumber,
        order_number: orderNumber, carrier: "Postes Canada", tracking_number: "CA123456789",
        delivery_address: clientAddress, delivery_city: clientCity,
        delivery_province: clientProvince, delivery_postal: clientPostal,
        items: [{ description: "Routeur Nivra", quantity: 1 }, { description: "Carte SIM", quantity: 1 }],
        issue_date: nowIso,
      }],
      ["return_instructions", "12_Instructions_Retour", {
        instruction_number: `RET-${orderNumber}`,
        client_name: clientName, client_email: clientEmail,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        order_number: orderNumber,
        items: [{ description: "Routeur Nivra", serial_number: "SN-12345678" }],
        return_deadline: nowIso,
        return_address: "1799 Av. Pierre-Péladeau",
        return_city: "Laval", return_province: "QC", return_postal: "H7T 2Y5",
        non_return_fee: 60,
        issue_date: nowIso,
      }],
      ["installation_report", "13_Rapport_Installation", {
        report_number: `INS-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        appointment_date: nowIso, technician_name: "Technicien Nivra",
        service_address: clientAddress, service_city: clientCity,
        service_province: clientProvince, service_postal: clientPostal,
        service_installed: planName, equipment_installed: ["Routeur Nivra v2"],
        outcome: "success",
        issue_date: nowIso,
      }],
      ["contract_amendment", "14_Avenant_Contrat", {
        amendment_number: `AMD-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        contract_number: contractNumber, effective_date: nowIso,
        amendment_summary: "Modification du forfait â€” test d'audit",
        issue_date: nowIso,
      }],
      ["formal_demand", "15_Mise_en_Demeure", {
        demand_number: `MED-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        demand_date: nowIso, total_due: invoiceAmount,
        invoices: [{ invoice_number: invoiceNumber, invoice_date: invoice?.created_at || nowIso, amount: invoiceAmount, days_overdue: 30 }],
        response_deadline: nowIso,
        issue_date: nowIso,
      }],
      ["collections_transfer", "16_Transfert_Recouvrement", {
        transfer_number: `COL-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        transfer_effective_date: nowIso, total_transferred: invoiceAmount,
        collection_agency_name: "Agence de recouvrement partenaire",
        credit_bureau_reported: false,
        issue_date: nowIso,
      }],
      ["complaint_acknowledgment", "17_Accuse_Plainte", {
        acknowledgment_number: `PLT-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        complaint_received_date: nowIso,
        complaint_summary: "Demande de vérification â€” test d'audit",
        case_number: `PLT-${orderNumber}`, expected_resolution_date: nowIso,
        issue_date: nowIso,
      }],
      ["preauthorization_confirmation", "18_Confirmation_Preautorisation", {
        confirmation_number: `PRE-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        authorized_amount: invoiceAmount, payment_method: order.payment_method || "Carte de crédit",
        capture_deadline: nowIso, purpose: "Pré-autorisation de paiement â€” test d'audit",
        issue_date: nowIso,
      }],
      ["payment_method_change", "19_Changement_Paiement", {
        notice_number: `PAY-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        old_method: "Virement Interac", new_method: "PayPal",
        effective_date: nowIso, autopay_enabled: false,
        issue_date: nowIso,
      }],
      ["address_change", "20_Changement_Adresse", {
        notice_number: `ADR-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        account_number: accountNumber,
        old_address: "123 Ancienne Rue", old_city: "Montréal", old_province: "QC", old_postal: "H2X 1Y3",
        new_address: clientAddress, new_city: clientCity, new_province: clientProvince, new_postal: clientPostal,
        effective_date: nowIso, service_continuity: "no_interruption",
        issue_date: nowIso,
      }],
      ["service_certificate", "21_Attestation_Service", {
        certificate_number: `CERT-${orderNumber}`,
        client_name: clientName, client_email: clientEmail, client_phone: clientPhone,
        client_address: clientAddress, client_city: clientCity, client_province: clientProvince, client_postal: clientPostal,
        account_number: accountNumber,
        service_name: planName, plan_name: planName,
        activation_date: nowIso, issue_date: nowIso,
      }],
    ];

    for (const [docType, prefix, payload] of autoDocTypes) {
      try {
        const result = dispatchAutoDocument(docType as AutoDocType, payload);
        if (result?.bytes?.length) {
          attachments.push({
            filename: `${prefix}.pdf`,
            content: uint8ToBase64(result.bytes),
            contentType: "application/pdf",
          });
          results[docType] = "OK";
        } else {
          results[docType] = "empty";
        }
      } catch (e) {
        results[docType] = `ERR: ${e.message?.slice(0, 80)}`;
        console.error(`[AuditAll] ${docType} failed:`, e.message);
      }
    }

    // â”€â”€ 5. Send ONE email with all PDFs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const okCount = Object.values(results).filter((r) => r === "OK").length;
    const errList = Object.entries(results)
      .filter(([, v]) => v !== "OK")
      .map(([k, v]) => `<li><b>${k}</b>: ${v}</li>`)
      .join("");

    const html = `
<h2>Audit PDF â€” Tous les gabarits</h2>
<p><b>Commande:</b> ${orderNumber} &nbsp;|&nbsp; <b>Client:</b> ${clientName} &nbsp;|&nbsp; <b>Courriel:</b> ${clientEmail}</p>
<p><b>Facture:</b> ${invoiceNumber} &nbsp;|&nbsp; <b>Contrat:</b> ${contractNumber}</p>
<p><b>${attachments.length} PDF${attachments.length > 1 ? "s" : ""} générés sur ${autoDocTypes.length + 4} gabarits.</b></p>
${errList ? `<h3>Erreurs (${Object.values(results).filter((r) => r !== "OK").length})</h3><ul>${errList}</ul>` : "<p>âœ… Tous les gabarits générés sans erreur.</p>"}
<hr/>
<p style="font-size:11px;color:#888;">Généré par send-pdf-audit-all â€” ${new Date().toLocaleString("fr-CA")}</p>
    `.trim();

    const emailResult = await sendViaResend(
      resendKey,
      `Audit PDF Nivra â€” ${okCount} gabarits â€” Commande ${orderNumber}`,
      html,
      attachments,
    );

    return new Response(
      JSON.stringify({
        ok: emailResult.ok,
        emailError: emailResult.error,
        orderNumber,
        clientName,
        invoiceNumber,
        pdfCount: attachments.length,
        results,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[AuditAll] Fatal:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
