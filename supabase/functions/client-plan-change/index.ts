/**
 * client-plan-change
 * Client self-serve plan change with prorated charge on the monthly invoice.
 *
 * Upgrades:  applied immediately.
 *   - Subscription updated right away (billing_subscriptions + subscriptions).
 *   - Prorated difference invoice created immediately (type="adjustment", status="open").
 *   - Client receives an invoice_created email with link to pay from portal.
 *
 * Downgrades: inserted as service_change_requests (pending, effective next renewal).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { computeTaxes } from "../_shared/tax-constants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Non autorisé" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: {
    account_id?: string;
    subscription_id?: string;
    new_plan_id?: string;
    new_plan_name?: string;
    new_monthly_price?: number;
    previous_plan_name?: string;
    previous_monthly_price?: number;
    change_type?: "upgrade" | "downgrade" | "add_service" | "remove_service";
  };
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const {
    account_id, subscription_id, new_plan_id, new_plan_name,
    new_monthly_price, previous_plan_name, previous_monthly_price, change_type,
  } = body;

  if (!new_plan_name || new_monthly_price == null) {
    return json(400, { error: "new_plan_name et new_monthly_price requis" });
  }

  const changeType = change_type || "upgrade";
  const effectiveDate = new Date().toISOString().slice(0, 10);

  // Immediate-effect changes: upgrade and add_service apply now and bill prorata.
  // Deferred-effect changes: downgrade and remove_service apply at next renewal.
  const isImmediate = changeType === "upgrade" || changeType === "add_service";

  // Get billing customer — ownership proof
  const { data: bc } = await admin
    .from("billing_customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!bc) return json(403, { error: "Compte de facturation introuvable" });

  // Profile for emails
  const { data: profile } = await admin
    .from("profiles")
    .select("email, first_name, account_number")
    .eq("user_id", user.id)
    .maybeSingle();
  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";
  const accountNumber = profile?.account_number || "";

  // Insert service_change_request for audit trail
  const noteMap: Record<string, string> = {
    upgrade: "Changement immédiat. Prorata facturé immédiatement.",
    add_service: "Ajout de service immédiat. Prorata facturé immédiatement.",
    downgrade: "Demande client — effectif au prochain renouvellement.",
    remove_service: "Retrait demandé — effectif au prochain renouvellement.",
  };
  const { data: scr, error: scrErr } = await admin
    .from("service_change_requests")
    .insert({
      account_id: account_id ?? null,
      client_id: user.id,
      subscription_id: subscription_id ?? null,
      current_plan_name: previous_plan_name ?? null,
      current_plan_price: previous_monthly_price != null ? Number(previous_monthly_price) : null,
      requested_plan_id: new_plan_id ?? null,
      requested_plan_name: new_plan_name,
      requested_plan_price: Number(new_monthly_price),
      change_type: changeType,
      status: isImmediate ? "approved" : "pending",
      requested_by: user.id,
      effective_date: isImmediate ? effectiveDate : null,
      applied_at: isImmediate ? new Date().toISOString() : null,
      notes: noteMap[changeType] || noteMap.upgrade,
    })
    .select("id")
    .single();
  if (scrErr) return json(500, { error: scrErr.message });

  let targetInvoiceId: string | null = null;
  let prorationTotal: number | null = null;
  let prorationAddedTo: "adjustment_invoice" | "current_invoice" | "next_renewal" | null = null;

  // ── Immediate-effect: upgrade OR add_service — apply now + prorata invoice ──────────
  if (isImmediate) {
    const prevPrice = Number(previous_monthly_price ?? 0);
    const newPrice = Number(new_monthly_price);
    // upgrade => bill only the delta; add_service => bill the full new service
    const proratableAmount = changeType === "add_service" ? newPrice : (newPrice - prevPrice);

    // Update subscription record immediately (upgrade only — add_service does not replace plan)
    if (changeType === "upgrade" && subscription_id) {
      // Legacy `subscriptions` table mirror (non-canonical, informational)
      await admin
        .from("subscriptions")
        .update({ plan_name: new_plan_name, monthly_price: newPrice, amount: newPrice })
        .eq("id", subscription_id);
      // CANONICAL: apply_plan_change closes the old billing_subscription and creates
      // a new one with fresh frozen_* snapshot + supersedes/superseded_by link.
      // Never mutate plan_name/plan_price directly on billing_subscriptions.
      const { error: pcErr } = await admin.rpc("apply_plan_change", {
        p_old_subscription_id: subscription_id,
        p_new_plan_code: new_plan_id ?? new_plan_name,
        p_new_plan_name: new_plan_name,
        p_new_plan_price: newPrice,
        p_context: {
          source: "client-plan-change",
          change_type: changeType,
          service_change_request_id: scr.id,
          initiated_by: user.id,
        },
      });
      if (pcErr) {
        console.error("[client-plan-change] apply_plan_change failed:", pcErr);
        return json(500, { error: `apply_plan_change: ${pcErr.message}` });
      }
    }

    // Prorated charge (only if there's something positive to bill)
    if (proratableAmount > 0) {
      try {
        const { data: bSub } = await admin
          .from("billing_subscriptions")
          .select("id, customer_id, cycle_start_date, cycle_end_date")
          .eq("customer_id", bc.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (bSub?.cycle_end_date && bSub?.cycle_start_date) {
          const todayDate = new Date();
          const cycleEndDate = new Date(bSub.cycle_end_date);
          const cycleStartDate = new Date(bSub.cycle_start_date);

          const daysRemaining = Math.max(1, Math.ceil(
            (cycleEndDate.getTime() - todayDate.getTime()) / 86_400_000
          ));
          const cycleTotalDays = Math.max(28, Math.round(
            (cycleEndDate.getTime() - cycleStartDate.getTime()) / 86_400_000
          ));
          const prorationSubtotal = Math.round(proratableAmount * (daysRemaining / cycleTotalDays) * 100) / 100;

          if (prorationSubtotal >= 0.01) {
            const lineDesc = changeType === "add_service"
              ? `Ajout de service proratisé — ${new_plan_name} (${daysRemaining}/${cycleTotalDays} jours restants)`
              : `Ajustement proratisé — ${previous_plan_name ?? "ancien forfait"} → ${new_plan_name} (${daysRemaining}/${cycleTotalDays} jours restants)`;
            const { tps: proTps, tvq: proTvq, total: proTotal } = computeTaxes(prorationSubtotal);

            // Snapshot account_number at invoice creation time (avoids extra DB lookup in pdfFromDb)
            const { data: acctSnap } = await admin
              .from("accounts")
              .select("account_number")
              .eq("client_id", user.id)
              .maybeSingle();
            const snapshotAccountNumber = acctSnap?.account_number || null;

            // Generate invoice number
            const { data: invoiceNumData } = await admin.rpc("generate_billing_invoice_number");
            const invoiceNumber = invoiceNumData || `ADJ-${Date.now()}`;

            const { data: proInvoice, error: proInvErr } = await admin
              .from("billing_invoices")
              .insert({
                customer_id: bc.id,
                subscription_id: bSub.id,
                invoice_number: invoiceNumber,
                type: "adjustment",
                subtotal: prorationSubtotal,
                tps_amount: proTps,
                tvq_amount: proTvq,
                total: proTotal,
                balance_due: proTotal,
                amount_paid: 0,
                currency: "CAD",
                status: "pending",
                due_date: todayDate.toISOString().slice(0, 10),
                cycle_start_date: bSub.cycle_start_date,
                cycle_end_date: bSub.cycle_end_date,
                notes: lineDesc,
                billing_snapshot_account_number: snapshotAccountNumber,
                billing_snapshot_client: {
                  first_name: firstName,
                  email: clientEmail,
                },
              })
              .select("id, invoice_number")
              .single();

            if (proInvErr) {
              console.error("[client-plan-change] proration invoice insert error:", proInvErr);
            } else {
              await admin.from("billing_invoice_lines").insert({
                invoice_id: proInvoice.id,
                description: lineDesc,
                unit_price: prorationSubtotal,
                quantity: 1,
                line_total: prorationSubtotal,
                line_type: "adjustment",
              });

              targetInvoiceId = proInvoice.id;
              prorationTotal = proTotal;
              prorationAddedTo = "adjustment_invoice";

              if (clientEmail) {
                const { buildInvoicePdfAttachment } = await import("../_shared/pdfFromDb.ts");
                const invoicePdf = await buildInvoicePdfAttachment(proInvoice.id, "Facture");
                await admin.from("email_queue").insert({
                  to_email: clientEmail,
                  template_key: "invoice_created",
                  template_vars: {
                    first_name: firstName,
                    invoice_number: proInvoice.invoice_number,
                    total: proTotal,
                    due_date: todayDate.toISOString().slice(0, 10),
                    cycle_start: cycleStartDate.toISOString().slice(0, 10),
                    cycle_end: cycleEndDate.toISOString().slice(0, 10),
                  },
                  attachments: invoicePdf ? [invoicePdf] : null,
                  status: "queued",
                  priority: 1,
                }).catch(() => {});
              }
            }
          }
        }
      } catch (proErr) {
        console.error("[client-plan-change] proration error:", proErr);
      }
    }
  }

  // Plan change notification email to client
  if (clientEmail) {
    const effDisplay = changeType === "upgrade" ? "immédiatement" : "votre prochain renouvellement";
    const { buildAutoDocPdfAttachment } = await import("../_shared/pdfFromDb.ts");
    const amendPdf = changeType === "upgrade"
      ? await buildAutoDocPdfAttachment("contract_amendment", {
          client_email: clientEmail,
          first_name: firstName,
          account_number: accountNumber,
          changes: [
            { field: "Forfait", old_value: previous_plan_name || "—", new_value: new_plan_name },
          ],
          effective_date: new Date().toISOString(),
          reason: "Changement de forfait",
        })
      : null;
    await admin.from("email_queue").insert({
      to_email: clientEmail,
      template_key: changeType === "upgrade" ? "plan_change_approved" : "plan_change_requested",
      template_vars: {
        first_name: firstName,
        to_email: clientEmail,
        client_name: firstName,
        current_plan_name: previous_plan_name || "—",
        requested_plan_name: new_plan_name,
        effective_date: effDisplay,
        change_type: changeType,
      },
      attachments: amendPdf ? [amendPdf] : null,
      status: "queued",
      priority: 0,
    }).catch(() => {});
  }

  // Internal admin alert
  await admin.from("email_queue").insert({
    to_email: "support@nivra-telecom.ca",
    template_key: "plan_change_admin_alert",
    template_vars: {
      client_name: firstName,
      current_plan_name: previous_plan_name || "—",
      requested_plan_name: new_plan_name,
      account_number: accountNumber,
      change_type: changeType,
    },
    status: "queued",
    priority: 0,
  }).catch(() => {});

  return json(200, {
    ok: true,
    service_change_request_id: scr.id,
    invoice_id: targetInvoiceId,
    proration_total: prorationTotal,
    proration_added_to: prorationAddedTo,
  });
});
