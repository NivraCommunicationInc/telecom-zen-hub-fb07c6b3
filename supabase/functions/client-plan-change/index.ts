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
    change_type?: "upgrade" | "downgrade";
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
  const { data: scr, error: scrErr } = await admin
    .from("service_change_requests")
    .insert({
      account_id: account_id ?? null,
      client_id: user.id,
      subscription_id: subscription_id ?? null,
      current_plan_name: previous_plan_name ?? null,
      requested_plan_id: new_plan_id ?? null,
      requested_plan_name: new_plan_name,
      requested_plan_price: Number(new_monthly_price),
      change_type: changeType,
      status: changeType === "upgrade" ? "approved" : "pending",
      requested_by: user.id,
      effective_date: changeType === "upgrade" ? effectiveDate : null,
      notes: changeType === "upgrade"
        ? `Changement immédiat. Prorata ajouté à la prochaine facture mensuelle.`
        : `Demande client — effectif au prochain renouvellement.`,
    })
    .select("id")
    .single();
  if (scrErr) return json(500, { error: scrErr.message });

  let targetInvoiceId: string | null = null;
  let prorationTotal: number | null = null;
  let prorationAddedTo: "adjustment_invoice" | "current_invoice" | "next_renewal" | null = null;

  // ── Upgrade: apply immediately + queue proration on next renewal invoice ──────────
  if (changeType === "upgrade") {
    const prevPrice = Number(previous_monthly_price ?? 0);
    const newPrice = Number(new_monthly_price);
    const priceDiff = newPrice - prevPrice;

    // Update subscription record immediately (both tables)
    if (subscription_id) {
      await admin
        .from("subscriptions")
        .update({ plan_name: new_plan_name, monthly_price: newPrice, amount: newPrice })
        .eq("id", subscription_id);
    }
    // billing_subscriptions drives renewal invoices — must stay in sync
    await admin
      .from("billing_subscriptions")
      .update({ plan_name: new_plan_name, plan_price: newPrice })
      .eq("customer_id", bc.id)
      .eq("status", "active");

    // Prorated charge (only if price actually increased)
    if (priceDiff > 0 && prevPrice > 0) {
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
          const prorationSubtotal = Math.round(priceDiff * (daysRemaining / cycleTotalDays) * 100) / 100;

          if (prorationSubtotal >= 0.01) {
            const lineDesc = `Ajustement proratisé — ${previous_plan_name ?? "ancien forfait"} → ${new_plan_name} (${daysRemaining}/${cycleTotalDays} jours restants)`;
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
    await admin.from("email_queue").insert({
      to_email: clientEmail,
      template_key: "plan_change_requested",
      template_vars: {
        first_name: firstName,
        to_email: clientEmail,
        client_name: firstName,
        current_plan_name: previous_plan_name || "—",
        requested_plan_name: new_plan_name,
        effective_date: effDisplay,
        change_type: changeType,
      },
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
