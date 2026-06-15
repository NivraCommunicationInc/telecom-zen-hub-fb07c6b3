/**
 * billing-dunning-engine — Sequenced dunning: J+3 / J+7 / J+14
 *
 * Cron: 0 9 * * * (daily at 09:00 UTC)
 *
 * For each invoice with status='overdue' or 'failed':
 *   J+3  → Soft reminder email via Resend
 *   J+7  → Urgent email
 *   J+14 → Final email + suspend subscription
 *
 * Idempotent: checks activity_logs to avoid re-sending today's actions.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "Nivra Telecom <facturation@nivra-telecom.ca>";

async function sendResendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[billing-dunning-engine] RESEND_API_KEY not configured");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    return res.ok;
  } catch (e) {
    console.error("[billing-dunning-engine] Resend error:", e);
    return false;
  }
}

function daysDiff(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function softReminderHtml(clientName: string, amount: string, invoiceNumber: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#6b21e8">Rappel de paiement — Nivra Telecom</h2>
      <p>Bonjour ${clientName},</p>
      <p>Nous vous rappelons que votre facture <strong>${invoiceNumber}</strong> d'un montant de <strong>${amount}</strong> est en souffrance.</p>
      <p>Veuillez effectuer votre paiement dès que possible pour éviter toute interruption de service.</p>
      <p><a href="https://nivra-telecom.ca/portal/billing" style="background:#6b21e8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Payer maintenant</a></p>
      <p>Si vous avez déjà effectué ce paiement, veuillez ignorer ce courriel.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="font-size:12px;color:#6b7280">Nivra Telecom · support@nivra-telecom.ca</p>
    </div>
  `;
}

function urgentReminderHtml(clientName: string, amount: string, invoiceNumber: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#dc2626">URGENT — Paiement requis · Nivra Telecom</h2>
      <p>Bonjour ${clientName},</p>
      <p>Votre facture <strong>${invoiceNumber}</strong> de <strong>${amount}</strong> est maintenant en retard de 7 jours.</p>
      <p style="color:#dc2626;font-weight:bold">Sans paiement dans les prochains jours, votre service risque d'être suspendu.</p>
      <p><a href="https://nivra-telecom.ca/portal/billing" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Régulariser mon compte</a></p>
      <p>Pour toute question: <a href="mailto:support@nivra-telecom.ca">support@nivra-telecom.ca</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="font-size:12px;color:#6b7280">Nivra Telecom · support@nivra-telecom.ca</p>
    </div>
  `;
}

function finalNoticeHtml(clientName: string, amount: string, invoiceNumber: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#dc2626">Avis final — Suspension de service · Nivra Telecom</h2>
      <p>Bonjour ${clientName},</p>
      <p>Malgré nos relances, votre facture <strong>${invoiceNumber}</strong> de <strong>${amount}</strong> n'a pas été réglée.</p>
      <p style="color:#dc2626;font-weight:bold">Votre service a été suspendu en raison de ce non-paiement.</p>
      <p>Pour réactiver votre service, veuillez payer immédiatement:</p>
      <p><a href="https://nivra-telecom.ca/portal/billing" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Payer et réactiver</a></p>
      <p>Si vous pensez recevoir ce message par erreur, contactez-nous: <a href="mailto:support@nivra-telecom.ca">support@nivra-telecom.ca</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="font-size:12px;color:#6b7280">Nivra Telecom · support@nivra-telecom.ca</p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const todayStr = new Date().toISOString().split("T")[0];

    // Fetch overdue/failed invoices with customer info
    const { data: invoices, error: invErr } = await supabase
      .from("billing_invoices")
      .select(`
        id, invoice_number, total, balance_due, status, due_date, created_at,
        customer_id,
        customer:billing_customers(id, email, first_name, last_name, user_id),
        subscription_id
      `)
      .in("status", ["overdue", "failed"])
      .gt("balance_due", 0);

    if (invErr) throw invErr;

    const results = {
      processed: 0,
      actions: [] as string[],
      skipped: 0,
      errors: [] as string[],
    };

    for (const inv of invoices || []) {
      try {
        const customer = inv.customer as any;
        if (!customer?.email) { results.skipped++; continue; }

        // Use due_date as the reference for overdue days
        const refDate = inv.due_date || inv.created_at;
        const daysOverdue = daysDiff(refDate);

        // Determine which dunning action to take today
        let actionType: "j3_soft" | "j7_urgent" | "j14_final" | null = null;
        if (daysOverdue >= 14) actionType = "j14_final";
        else if (daysOverdue >= 7) actionType = "j7_urgent";
        else if (daysOverdue >= 3) actionType = "j3_soft";

        if (!actionType) { results.skipped++; continue; }

        // Idempotency: check if this action was already done today
        const { data: existingLog } = await supabase
          .from("activity_logs")
          .select("id")
          .eq("entity_type", "billing_invoice")
          .eq("entity_id", inv.id)
          .eq("action", `dunning_${actionType}`)
          .gte("created_at", `${todayStr}T00:00:00Z`)
          .maybeSingle();

        if (existingLog) { results.skipped++; continue; }

        const clientName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client";
        const amountFmt = Number(inv.balance_due || inv.total).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
        const invoiceNumber = inv.invoice_number;

        let emailSent = false;
        let emailSubject = "";

        if (actionType === "j3_soft") {
          emailSubject = `Rappel de paiement — ${invoiceNumber}`;
          emailSent = await sendResendEmail(
            customer.email,
            emailSubject,
            softReminderHtml(clientName, amountFmt, invoiceNumber)
          );
        } else if (actionType === "j7_urgent") {
          emailSubject = `URGENT — Facture ${invoiceNumber} en retard`;
          emailSent = await sendResendEmail(
            customer.email,
            emailSubject,
            urgentReminderHtml(clientName, amountFmt, invoiceNumber)
          );
        } else if (actionType === "j14_final") {
          emailSubject = `Avis final — Service suspendu · ${invoiceNumber}`;
          emailSent = await sendResendEmail(
            customer.email,
            emailSubject,
            finalNoticeHtml(clientName, amountFmt, invoiceNumber)
          );

          // Suspend subscription at J+14
          if (inv.subscription_id) {
            await supabase
              .from("billing_subscriptions")
              .update({
                status: "suspended",
                suspension_reason: `Non-paiement — facture ${invoiceNumber} (${daysOverdue} jours de retard)`,
                suspension_date: todayStr,
                updated_at: new Date().toISOString(),
              })
              .eq("id", inv.subscription_id);
          }
        }

        // Log action in activity_logs (idempotency key)
        await supabase.from("activity_logs").insert({
          entity_type: "billing_invoice",
          entity_id: inv.id,
          action: `dunning_${actionType}`,
          actor_name: "billing-dunning-engine",
          actor_role: "system",
          user_id: customer.user_id || "00000000-0000-0000-0000-000000000000",
          details: {
            invoice_number: invoiceNumber,
            days_overdue: daysOverdue,
            amount: inv.balance_due || inv.total,
            customer_email: customer.email,
            email_sent: emailSent,
            subscription_suspended: actionType === "j14_final" && !!inv.subscription_id,
          },
        });

        results.processed++;
        results.actions.push(`${actionType} → ${invoiceNumber} (${daysOverdue}j)`);
      } catch (e: any) {
        results.errors.push(`Invoice ${inv.id}: ${e.message}`);
        console.error("[billing-dunning-engine] invoice error:", inv.id, e);
      }
    }

    console.log("[billing-dunning-engine] run complete", results);
    return new Response(JSON.stringify({ ok: true, ...results }), { headers });
  } catch (err) {
    console.error("[billing-dunning-engine] fatal error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || String(err) }),
      { status: 500, headers },
    );
  }
});
