import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { computeTaxes } from "../_shared/tax-constants.ts";
import { nextAnchoredDate } from "../_shared/billing-utils.ts";
import { enforceBillingRateLimit } from "../_shared/billingRateLimit.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
// STRIPE DISABLED — import removed: createNivraPaymentIntent

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmtMoney(n: number): string {
  const num = isFinite(n) ? n : 0;
  return num.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

/**
 * CRON: Daily renewal invoice generation
 * Runs at 00:00 daily
 * Generates renewal invoices for subscriptions ending in 3 days (J-3)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = await enforceBillingRateLimit(req, "billing-generate-renewals", corsHeaders);
  if (rl) return rl;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    // Window J-60 → J+3:
    //   - J+1 → J+3 : génération normale 3 jours à l'avance
    //   - J-60 → J  : rattrapage de tout cycle manqué (cron mort, redéploiement, etc.)
    // Idempotency garantie par le check existingInvoice (cycle_start_date + subscription_id).
    // Sans ce rattrapage, un cron mort ≥ 3 jours laisse des clients sans facture indéfiniment.
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() - 60);
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + 3);
    const windowStartStr = windowStart.toISOString().split('T')[0];
    const windowEndStr = windowEnd.toISOString().split('T')[0];

    console.log(`[billing-generate-renewals] Looking for subscriptions ending ${windowStartStr} → ${windowEndStr}`);

    // ── Detect active subscriptions with NULL cycle_end_date ──
    // These are never picked up by the main window query (WHERE cycle_end_date BETWEEN x AND y).
    // Auto-repair each one using cycle_start_date + anchor_day, then CONTINUE the run.
    // A single broken subscription must never block billing for all other clients.
    const { data: nullCycleSubs } = await supabase
      .from("billing_subscriptions")
      .select("id, customer_id, plan_name, created_at, cycle_start_date, billing_anchor_date")
      .eq("status", "active")
      .is("cycle_end_date", null);

    if (nullCycleSubs?.length) {
      console.error(`[billing-generate-renewals] WARNING: ${nullCycleSubs.length} active subscription(s) with NULL cycle_end_date — attempting auto-repair, run continues`);
      for (const orphan of nullCycleSubs) {
        let repaired = false;
        try {
          const refDateStr = orphan.cycle_start_date ?? orphan.created_at;
          const refDate = new Date(refDateStr);
          const anchorDay = orphan.billing_anchor_date
            ? new Date(orphan.billing_anchor_date).getDate()
            : refDate.getDate();
          const computedEnd = nextAnchoredDate(anchorDay, refDate);
          await supabase.from("billing_subscriptions").update({
            cycle_end_date: computedEnd.toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
          }).eq("id", orphan.id);
          repaired = true;
          console.log(`[billing-generate-renewals] Auto-repaired cycle_end_date → ${computedEnd.toISOString().split("T")[0]} for subscription ${orphan.id}`);
        } catch (repairErr) {
          console.error(`[billing-generate-renewals] Auto-repair failed for ${orphan.id}:`, repairErr);
        }
        await supabase.from("billing_system_alerts").insert({
          alert_type: "null_cycle_end_date",
          entity_type: "billing_subscription",
          entity_id: orphan.id,
          severity: "critical",
          details: {
            message: repaired
              ? `cycle_end_date NULL — réparé automatiquement, valider manuellement`
              : `cycle_end_date NULL — échec de réparation automatique, intervention requise`,
            customer_id: orphan.customer_id,
            plan_name: orphan.plan_name,
            created_at: orphan.created_at,
            auto_repaired: repaired,
          },
        }).catch(() => {});
      }
      // Do NOT return — continue processing all subscriptions with valid cycle_end_date.
    }

    // Find active subscriptions ending within the catch-up window
    const { data: subscriptions, error: subError } = await supabase
      .from("billing_subscriptions")
      .select(`
        *,
        customer:billing_customers(id, email, first_name, last_name)
      `)
      .eq("status", "active")
      .gte("cycle_end_date", windowStartStr)
      .lte("cycle_end_date", windowEndStr);
    
    if (subError) throw subError;
    
    console.log(`[billing-generate-renewals] Found ${subscriptions?.length || 0} subscriptions to renew`);
    
    const results = {
      processed: 0,
      invoices_created: [] as string[],
      errors: [] as string[]
    };
    
    for (const sub of subscriptions || []) {
      try {
        // ═══ GUARD: NULL next_renewal_at ═══
        // If next_renewal_at is null on an active subscription, this is a data
        // integrity issue. Log and create an alert, but DO continue using
        // cycle_end_date which is the canonical scheduling column here.
        if (sub.next_renewal_at == null) {
          console.error(
            `[billing-generate-renewals] ALERT: subscription ${sub.id} has null next_renewal_at — proceeding with cycle_end_date but flagging for repair`
          );
          await supabase.from("billing_system_alerts").insert({
            alert_type: "null_next_renewal_at",
            entity_type: "billing_subscription",
            entity_id: sub.id,
            details: { cycle_end_date: sub.cycle_end_date, status: sub.status },
          });
        }

        // Check if renewal invoice already exists for this cycle
        const newCycleStart = new Date(sub.cycle_end_date);
        // Anchor day = day of month locked at activation. Fallback to cycle_start_date day.
        const anchorDay = sub.billing_anchor_date
          ? new Date(sub.billing_anchor_date).getDate()
          : new Date(sub.cycle_start_date).getDate();
        const newCycleEnd = nextAnchoredDate(anchorDay, newCycleStart);
        
        const { data: existingInvoice } = await supabase
          .from("billing_invoices")
          .select("id")
          .eq("subscription_id", sub.id)
          .eq("type", "renewal")
          .eq("cycle_start_date", newCycleStart.toISOString().split('T')[0])
          .maybeSingle();

        if (existingInvoice) {
          console.log(`[billing-generate-renewals] Invoice already exists for subscription ${sub.id}`);
          continue;
        }
        
        // ═══ APPLY PENDING DOWNGRADES ═══
        // If the client requested a downgrade, it was deferred to next renewal.
        // Apply it NOW before the invoice is created so the new price is used.
        try {
          const { data: bcUser } = await supabase
            .from("billing_customers")
            .select("user_id")
            .eq("id", sub.customer_id)
            .maybeSingle();

          if (bcUser?.user_id) {
            const { data: pendingDowngrade } = await supabase
              .from("service_change_requests")
              .select("id, requested_plan_name, requested_plan_price, requested_plan_id, current_plan_name, subscription_id, change_type")
              .eq("client_id", bcUser.user_id)
              .eq("status", "pending")
              .in("change_type", ["downgrade", "remove_service"])
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();

            if (pendingDowngrade) {
              const newPlanName = String(pendingDowngrade.requested_plan_name || sub.plan_name);
              const newPlanPrice = Number(pendingDowngrade.requested_plan_price || sub.plan_price);
              const effectiveDateStr = newCycleStart.toISOString().split("T")[0];

              // Update billing_subscriptions (drives renewal price)
              await supabase.from("billing_subscriptions")
                .update({ plan_name: newPlanName, plan_price: newPlanPrice, updated_at: new Date().toISOString() })
                .eq("id", sub.id);

              // Update legacy subscriptions table if linked
              if (pendingDowngrade.subscription_id) {
                await supabase.from("subscriptions")
                  .update({ plan_name: newPlanName, monthly_price: newPlanPrice, amount: newPlanPrice })
                  .eq("id", pendingDowngrade.subscription_id)
                  .catch(() => {});
              }

              // Mark request as applied
              await supabase.from("service_change_requests")
                .update({ status: "applied", effective_date: effectiveDateStr, applied_at: new Date().toISOString() })
                .eq("id", pendingDowngrade.id);

              // Mutate sub so the rest of this iteration uses the new price
              sub.plan_name = newPlanName;
              sub.plan_price = newPlanPrice;

              console.log(`[billing-generate-renewals] Downgrade applied: ${pendingDowngrade.current_plan_name} → ${newPlanName} (${newPlanPrice}$) customer ${sub.customer_id}`);

              // Notify client
              if (sub.customer?.email) {
                await supabase.from("email_queue").insert({
                  to_email: sub.customer.email,
                  template_key: "plan_change_approved",
                  template_vars: {
                    first_name: sub.customer.first_name || "Client",
                    client_name: sub.customer.first_name || "Client",
                    current_plan_name: pendingDowngrade.current_plan_name || "—",
                    requested_plan_name: newPlanName,
                    effective_date: effectiveDateStr,
                    change_type: "downgrade",
                  },
                  status: "queued",
                }).catch(() => {});
              }
            }
          }
        } catch (downgradeErr) {
          console.error(`[billing-generate-renewals] downgrade error for subscription ${sub.id}:`, downgradeErr);
          // Non-fatal — proceed with existing plan price
        }

        // Generate invoice number
        const { data: invoiceNumberData } = await supabase
          .rpc("generate_billing_invoice_number");

        const invoiceNumber = invoiceNumberData || `INV-${Date.now()}`;
        
        // ═══ PROMO DURATION CHECK ═══
        // If this subscription was created with a duration-limited promo,
        // check if we're still within the promo window and apply the discount.
        let promoDiscount = 0;
        let promoNote = "";
        
        if (sub.order_id) {
          // Look up the order's pricing_snapshot for promo info
          const { data: orderData } = await supabase
            .from("orders")
            .select("pricing_snapshot, promo_code")
            .eq("id", sub.order_id)
            .single();
          
          if (orderData?.promo_code && orderData?.pricing_snapshot) {
            const snapshot = orderData.pricing_snapshot;
            const promoApplied = snapshot?.promo_applied;
            
            if (promoApplied?.duration_months && promoApplied.duration === "limited") {
              // Count how many renewal invoices exist for this subscription
              const { count: renewalCount } = await supabase
                .from("billing_invoices")
                .select("id", { count: "exact", head: true })
                .eq("subscription_id", sub.id)
                .eq("type", "renewal")
                .not("status", "in", '("void","cancelled")');
              
              // +1 because the initial order invoice counts as cycle 1
              const currentCycle = (renewalCount || 0) + 1;
              
              if (currentCycle <= promoApplied.duration_months) {
                // Still within promo window — apply discount
                promoDiscount = promoApplied.discount_amount || 0;
                promoNote = ` (Promo ${promoApplied.code}: -${promoDiscount}$ cycle ${currentCycle + 1}/${promoApplied.duration_months})`;
                console.log(`[billing-generate-renewals] Applying promo ${promoApplied.code}: -${promoDiscount}$ (cycle ${currentCycle + 1}/${promoApplied.duration_months})`);
              } else {
                console.log(`[billing-generate-renewals] Promo ${promoApplied.code} expired (cycle ${currentCycle + 1} > ${promoApplied.duration_months})`);
              }
            }
          }
        }
        
        // ═══ AUTOPAY DISCOUNT CHECK ═══
        // PayPal pre-authorized subscriptions trigger the $5 monthly autopay discount.
        // Stripe was decommissioned 2026-05-18 — PayPal is the sole recurring provider.
        let autopayDiscount = 0;
        let autopayNote = "";

        const { data: customerData } = await supabase
          .from("billing_customers")
          .select("autopay_enabled, autopay_discount_active, square_card_id")
          .eq("id", sub.customer_id)
          .single();

        const hasPayPalAutopay = !!sub.paypal_subscription_id;
        const hasSquareAutopay = !!customerData?.square_card_id;

        // Autopay discount: $5/mo for any active card-on-file (Square or PayPal)
        const isAutopayEligible = hasPayPalAutopay || hasSquareAutopay;

        if (isAutopayEligible) {
          autopayDiscount = 5;
          const provider = hasSquareAutopay ? "square" : "paypal";
          autopayNote = ` (Rabais paiement automatique -5$)`;
          console.log(`[billing-generate-renewals] Autopay discount: -5$ for customer ${sub.customer_id} (provider: ${provider})`);
        }

        // Calculate amounts via canonical tax module
        const subtotal = Math.max(0, sub.plan_price - promoDiscount - autopayDiscount);
        const { tps: tpsAmount, tvq: tvqAmount, total: baseTotal } = computeTaxes(subtotal);
        let finalTotal = baseTotal; // updated after account_adjustments
        
        // Due date = current cycle end date (J0) - prepaid model requires payment BEFORE service expires
        const dueDate = sub.cycle_end_date;
        const daysRemaining = Math.max(1, Math.ceil(
          (new Date(sub.cycle_end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        ));
        
        // Determine payment method based on subscription/autopay
        const hasPayPalSubscription = !!sub.paypal_subscription_id;
        const paymentMethod = hasSquareAutopay ? 'square' : hasPayPalSubscription ? 'paypal' : 'interac';

        // ═══ Freeze address snapshot from live data so the PDF always
        //     shows the client's real address, even if profile changes later.
        let addressSnapshot: Record<string, unknown> | null = null;
        try {
          const { data: bcLink } = await supabase
            .from("billing_customers").select("user_id, phone").eq("id", sub.customer_id).maybeSingle();
          if (bcLink?.user_id) {
            const { data: acctAddr } = await supabase
              .from("accounts")
              .select("billing_address, billing_city, billing_province, billing_postal_code, primary_service_address, primary_service_city, primary_service_province, primary_service_postal_code")
              .eq("client_id", bcLink.user_id).maybeSingle();
            const line = acctAddr?.billing_address || acctAddr?.primary_service_address || null;
            if (line) {
              addressSnapshot = {
                address: line,
                city: acctAddr?.billing_city || acctAddr?.primary_service_city || "",
                province: acctAddr?.billing_province || acctAddr?.primary_service_province || "QC",
                postal_code: acctAddr?.billing_postal_code || acctAddr?.primary_service_postal_code || "",
                phone: bcLink?.phone || null,
                frozen_at: new Date().toISOString(),
              };
            }
          }
        } catch (snapErr) {
          console.warn(`[billing-generate-renewals] address_snapshot build failed for sub ${sub.id}:`, snapErr);
        }

        // Create renewal invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from("billing_invoices")
          .insert({
            subscription_id: sub.id,
            customer_id: sub.customer_id,
            invoice_number: invoiceNumber,
            type: 'renewal',
            subtotal,
            tps_amount: tpsAmount,
            tvq_amount: tvqAmount,
            total: baseTotal,
            currency: 'CAD',
            payment_method: paymentMethod,
            status: 'pending',
            cycle_start_date: newCycleStart.toISOString().split('T')[0],
            cycle_end_date: newCycleEnd.toISOString().split('T')[0],
            due_date: dueDate,
            address_snapshot: addressSnapshot,
            notes: [promoNote, autopayNote].filter(Boolean).join("") || null
          })
          .select()
          .single();
        
        if (invoiceError) throw invoiceError;
        
        // Create invoice lines
        const invoiceLines: any[] = [
          {
            invoice_id: invoice.id,
            description: `${sub.plan_name} – Renouvellement 30 jours`,
            unit_price: sub.plan_price,
            quantity: 1,
            line_total: sub.plan_price,
            line_type: 'service'
          }
        ];
        
        // Add promo discount line if applicable
        if (promoDiscount > 0) {
          invoiceLines.push({
            invoice_id: invoice.id,
            description: `Rabais promotionnel${promoNote}`,
            unit_price: -promoDiscount,
            quantity: 1,
            line_total: -promoDiscount,
            line_type: 'discount'
          });
        }
        
        // ═══ AUTOPAY DISCOUNT LINE ═══
        if (autopayDiscount > 0) {
          invoiceLines.push({
            invoice_id: invoice.id,
            description: "Rabais prélèvement automatique",
            unit_price: -autopayDiscount,
            quantity: 1,
            line_total: -autopayDiscount,
            line_type: 'discount'
          });
        }
        
        await supabase
          .from("billing_invoice_lines")
          .insert(invoiceLines);

        // ═══ APPLY ACCOUNT ADJUSTMENTS ═══
        // billing-lifecycle at 8h finds RENEWAL_ALREADY_EXISTS and skips, so
        // adjustments MUST be applied here (midnight) when the invoice is created.
        let accountNumber: string | null = null;
        try {
          const { data: bc } = await supabase
            .from("billing_customers").select("user_id").eq("id", sub.customer_id).maybeSingle();
          const userId = bc?.user_id;
          if (userId) {
            const { data: acct } = await supabase
              .from("accounts").select("id, account_number").eq("client_id", userId).maybeSingle();
            const accountId = acct?.id;
            accountNumber = acct?.account_number ?? null;
            if (accountId) {
              const { data: adjustments } = await supabase
                .from("account_adjustments")
                .select("*")
                .eq("account_id", accountId)
                .eq("status", "active")
                .or("is_permanent.eq.true,months_remaining.gt.0");

              if (adjustments?.length) {
                let adjDelta = 0;
                const adjLines: any[] = [];
                const planPrice = Number(sub.plan_price || 0);
                // Accumulateurs nets (fees +, credits/discounts −) pour mettre à jour les champs facture
                let netSubtotalDelta = 0;
                let netTpsDelta = 0;
                let netTvqDelta = 0;

                const { data: prof } = await supabase
                  .from("profiles").select("email, full_name, first_name, last_name")
                  .eq("user_id", userId).maybeSingle();
                const toEmail = prof?.email || null;
                const fullName = prof?.full_name || [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || "Client";

                // Collect adj updates — applied AFTER adjLines are inserted (E5 atomicity fix)
                // creditPrevRemaining: stored so we can restore months_remaining on overflow
                const pendingAdjUpdates: Array<{ id: string; update: Record<string, unknown>; creditPrevRemaining?: number }> = [];

                for (const adj of adjustments as any[]) {
                  const amt = Number(adj.amount || 0);
                  const isPermanent = adj.is_permanent === true;
                  const type = String(adj.type || "credit");
                  const appliesTo = adj.applies_to ? String(adj.applies_to) : null;
                  const conditions = adj.conditions ? String(adj.conditions) : null;

                  if (conditions === "plans_80_plus" && planPrice < 80) continue;
                  if (conditions === "plans_90_plus" && planPrice < 90) continue;

                  const prevRemaining = Number(adj.months_remaining || 0);
                  const totalMonths = Number(adj.duration_months || adj.months_total || prevRemaining);

                  if (type === "remove_fee" && appliesTo === "installation") {
                    adjLines.push({ invoice_id: invoice.id, description: "Installation gratuite ✓", unit_price: 0, quantity: 1, line_total: 0, line_type: "discount" });
                    pendingAdjUpdates.push({ id: adj.id, update: { applied_count: (adj.applied_count||0)+1, last_applied_at: new Date().toISOString(), status: "completed" } });
                    continue;
                  }
                  if (type === "remove_fee" && appliesTo === "activation") {
                    adjLines.push({ invoice_id: invoice.id, description: "Activation gratuite ✓", unit_price: 0, quantity: 1, line_total: 0, line_type: "discount" });
                    pendingAdjUpdates.push({ id: adj.id, update: { applied_count: (adj.applied_count||0)+1, last_applied_at: new Date().toISOString(), status: "completed" } });
                    continue;
                  }
                  if (type === "first_month_free") {
                    const { tps: fmTps, tvq: fmTvq, total: fmTotal } = computeTaxes(planPrice);
                    adjDelta -= fmTotal;
                    netSubtotalDelta -= planPrice;
                    netTpsDelta -= fmTps;
                    netTvqDelta -= fmTvq;
                    adjLines.push({ invoice_id: invoice.id, description: `1er mois offert — ${fmtMoney(planPrice)}/mois`, unit_price: -planPrice, quantity: 1, line_total: -planPrice, line_type: "discount" });
                    pendingAdjUpdates.push({ id: adj.id, update: { months_remaining: 0, applied_count: (adj.applied_count||0)+1, last_applied_at: new Date().toISOString(), status: "completed" } });
                    continue;
                  }
                  if (type === "one_time") {
                    const { tps: otTps, tvq: otTvq, total: otTotal } = computeTaxes(amt);
                    adjDelta -= otTotal;
                    netSubtotalDelta -= amt;
                    netTpsDelta -= otTps;
                    netTvqDelta -= otTvq;
                    adjLines.push({ invoice_id: invoice.id, description: `Promotion unique — ${adj.description || fmtMoney(amt)}`, unit_price: -amt, quantity: 1, line_total: -amt, line_type: "discount" });
                    pendingAdjUpdates.push({ id: adj.id, update: { months_remaining: 0, applied_count: (adj.applied_count||0)+1, last_applied_at: new Date().toISOString(), status: "completed" } });
                    continue;
                  }

                  // ── fee: proration charge or one-time extra (pré-taxes; recalcule TPS+TVQ) ──
                  if (type === "fee") {
                    const { tps: feeTps, tvq: feeTvq, total: feeTotal } = computeTaxes(amt);
                    adjDelta += feeTotal;
                    netSubtotalDelta += amt;
                    netTpsDelta += feeTps;
                    netTvqDelta += feeTvq;
                    const feeDesc = String(adj.description || "").trim() || "Frais supplémentaires";
                    adjLines.push({ invoice_id: invoice.id, description: feeDesc, unit_price: amt, quantity: 1, line_total: amt, line_type: "fee" });
                    const nextRemFee = Math.max(0, prevRemaining - 1);
                    pendingAdjUpdates.push({ id: adj.id, update: { months_remaining: nextRemFee, applied_count: (adj.applied_count||0)+1, last_applied_at: new Date().toISOString(), status: nextRemFee <= 0 ? "completed" : "active" } });
                    continue;
                  }

                  const isCredit = type === "credit";
                  const signedTotal = isCredit ? -amt : amt;
                  const { tps: adjTps, tvq: adjTvq, total: adjTaxTotal } = computeTaxes(amt);
                  if (isCredit) {
                    adjDelta -= adjTaxTotal;
                    netSubtotalDelta -= amt;
                    netTpsDelta -= adjTps;
                    netTvqDelta -= adjTvq;
                  } else {
                    adjDelta += adjTaxTotal;
                    netSubtotalDelta += amt;
                    netTpsDelta += adjTps;
                    netTvqDelta += adjTvq;
                  }

                  const cleanDesc = String(adj.description || "").trim();
                  const prefixRabais = (suffix: string) =>
                    /^rabais\b/i.test(cleanDesc) ? `${cleanDesc}${suffix}` : `Rabais ${cleanDesc}${suffix}`;
                  let lineDesc: string;
                  if (isPermanent && isCredit) {
                    lineDesc = cleanDesc ? prefixRabais(" — permanent") : `Rabais permanent — ${fmtMoney(amt)}/mois`;
                  } else if (isCredit && totalMonths > 0) {
                    const nextRem = Math.max(0, prevRemaining - 1);
                    lineDesc = cleanDesc ? `${prefixRabais("")} — ${fmtMoney(amt)}/mois (${nextRem} mois restants)` : `Rabais — ${fmtMoney(amt)}/mois (${nextRem} mois restants)`;
                  } else {
                    lineDesc = cleanDesc || (isCredit ? "Crédit" : "Frais");
                  }
                  adjLines.push({ invoice_id: invoice.id, description: lineDesc, unit_price: signedTotal, quantity: 1, line_total: signedTotal, line_type: isCredit ? "discount" : "fee" });

                  if (isPermanent) {
                    pendingAdjUpdates.push({ id: adj.id, update: { applied_count: (adj.applied_count||0)+1, last_applied_at: new Date().toISOString() } });
                  } else {
                    const nextRemaining = Math.max(0, prevRemaining - 1);
                    pendingAdjUpdates.push({ id: adj.id, update: { months_remaining: nextRemaining, applied_count: (adj.applied_count||0)+1, last_applied_at: new Date().toISOString(), status: nextRemaining <= 0 ? "completed" : "active" }, creditPrevRemaining: prevRemaining });
                    if (isCredit && toEmail) {
                      try {
                        if (nextRemaining === 1) {
                          await supabase.from("email_queue").insert({ to_email: toEmail, template_key: "discount_expiring_soon", event_key: `discount_expiring_soon:${adj.id}`, status: "queued", variables: { client_full_name: fullName, discount_label: adj.description || "Rabais promotionnel", discount_amount: amt, full_price: planPrice, end_date: newCycleEnd.toISOString().split('T')[0] } });
                        }
                        if (nextRemaining === 0) {
                          await supabase.from("email_queue").insert({ to_email: toEmail, template_key: "discount_expired", event_key: `discount_expired:${adj.id}`, status: "queued", variables: { client_full_name: fullName, discount_label: adj.description || "Rabais promotionnel", discount_amount: amt, duration_months: totalMonths, new_amount: planPrice } });
                        }
                      } catch (_) { /* non-fatal */ }
                    }
                  }
                }

                if (adjLines.length > 0) {
                  await supabase.from("billing_invoice_lines").insert(adjLines);
                  const rawTotal = baseTotal + adjDelta;
                  finalTotal = Math.max(0, rawTotal);
                  // If credits exceed the invoice amount, preserve months_remaining for next cycle
                  const creditOverflow = rawTotal < 0 ? -rawTotal : 0;
                  if (creditOverflow > 0.005) {
                    console.log(`[billing-generate-renewals] Credit overflow ${creditOverflow.toFixed(2)} on ${invoiceNumber} — months_remaining preserved (not consumed this cycle)`);
                    for (const pu of pendingAdjUpdates) {
                      if (pu.creditPrevRemaining !== undefined) {
                        pu.update.months_remaining = pu.creditPrevRemaining;
                        pu.update.status = "active";
                      }
                    }
                  }
                  const invoiceFieldUpdate: Record<string, number> = { total: finalTotal, balance_due: finalTotal };
                  if (netSubtotalDelta !== 0) {
                    invoiceFieldUpdate.subtotal   = Math.max(0, Number(invoice.subtotal)   + netSubtotalDelta);
                    invoiceFieldUpdate.tps_amount = Math.max(0, Number(invoice.tps_amount) + netTpsDelta);
                    invoiceFieldUpdate.tvq_amount = Math.max(0, Number(invoice.tvq_amount) + netTvqDelta);
                  }
                  await supabase.from("billing_invoices").update(invoiceFieldUpdate).eq("id", invoice.id);
                  // Apply adj DB updates AFTER invoice is updated (E5 fix: prevents consumed-not-applied on crash)
                  for (const { id: adjId, update: adjUpdate } of pendingAdjUpdates) {
                    try {
                      await supabase.from("account_adjustments").update(adjUpdate).eq("id", adjId);
                    } catch (e: unknown) {
                      console.error(`[billing-generate-renewals] adj update failed for ${adjId}:`, e);
                    }
                  }
                  console.log(`[billing-generate-renewals] Applied ${adjLines.length} account_adjustments to ${invoiceNumber} (delta: ${adjDelta.toFixed(2)}, finalTotal: ${finalTotal.toFixed(2)})`);
                }
              }
            }
          }
        } catch (adjErr) {
          const adjErrMsg = adjErr instanceof Error ? adjErr.message : String(adjErr);
          console.error(`[billing-generate-renewals] account_adjustments error for ${invoiceNumber}:`, adjErrMsg);
          await reportEdgeError(adjErr, { function: "billing-generate-renewals", invoice_id: invoice.id, subscription_id: sub.id, invoice_number: invoiceNumber }).catch(() => {});
          await supabase.from("billing_system_alerts").insert({
            alert_type: "account_adjustments_failed",
            entity_type: "billing_invoice",
            entity_id: invoice.id,
            severity: "warning",
            details: { message: `account_adjustments non appliqués sur ${invoiceNumber}: ${adjErrMsg}`, subscription_id: sub.id, customer_id: sub.customer_id, invoice_number: invoiceNumber, error: adjErrMsg },
          });
        }

        // Advance subscription cycle so billing-lifecycle at 8h does not re-process
        const nextRenewalDate = new Date(newCycleEnd);
        nextRenewalDate.setDate(nextRenewalDate.getDate() - 3);
        await supabase.from("billing_subscriptions").update({
          cycle_start_date: newCycleStart.toISOString().split('T')[0],
          cycle_end_date: newCycleEnd.toISOString().split('T')[0],
          next_renewal_at: nextRenewalDate.toISOString(),
          last_invoice_id: invoice.id,
          updated_at: new Date().toISOString(),
        }).eq("id", sub.id);

        // ═══ IDEMPOTENCY: never create a duplicate pending payment ═══
        // Check if a non-failed/cancelled payment already exists for this
        // invoice (which is itself unique per subscription+cycle thanks to
        // the existingInvoice guard above). Belt-and-suspenders against
        // double-billing for PayPal-driven retries.
        const { data: existingPayment } = await supabase
          .from("billing_payments")
          .select("id, status")
          .eq("invoice_id", invoice.id)
          .not("status", "in", '("failed","cancelled")')
          .limit(1)
          .maybeSingle();

        if (existingPayment) {
          console.log(
            `[billing-generate-renewals] Skipping payment insert — already exists (${existingPayment.id}, status=${existingPayment.status}) for invoice ${invoice.id}`
          );
        } else {
          // Create pending payment with appropriate method
          const { data: payNumData } = await supabase.rpc("generate_payment_number");
          const paymentNumber = payNumData || `PAY-${Date.now()}`;

          await supabase
            .from("billing_payments")
            .insert({
              invoice_id: invoice.id,
              customer_id: sub.customer_id,
              method: paymentMethod,
              provider: hasPayPalSubscription ? 'paypal' : 'interac',
              amount: finalTotal,
              status: 'pending',
              payment_number: paymentNumber,
              source: 'live',
              created_by_name: 'billing_renewal',
              created_by_role: 'system',
            });
        }

        // ═══ RECURRING CHARGE TRIGGER ═══
        // Square is primary processor. PayPal is fallback (account under review).
        // Stripe was decommissioned 2026-05-18.

        // 1. Try Square first (card on file — checked earlier via customerData)
        if (hasSquareAutopay) {
          console.log(`[billing-generate-renewals] Triggering Square COF charge for ${sub.id}`);
          const { data: squareResult, error: squareErr } = await supabase.functions.invoke(
            "square-charge-subscription",
            { body: { subscription_id: sub.id, invoice_id: invoice.id, amount: finalTotal } }
          );

          if (!squareErr && squareResult?.ok) {
            console.log(`[billing-generate-renewals] ✅ Square charged ${finalTotal} for ${invoiceNumber}`);
          } else {
            const reason = squareErr?.message ?? squareResult?.error ?? "unknown";
            console.error(`[billing-generate-renewals] Square charge failed for ${invoiceNumber}: ${reason}`);

            // 1) Alerte système (existant)
            await supabase.from("billing_system_alerts").insert({
              alert_type: "square_charge_failed_on_renewal",
              entity_type: "billing_invoice",
              entity_id: invoice.id,
              severity: "warning",
              details: { message: `Square charge échoué pour ${invoiceNumber}: ${reason}`, subscription_id: sub.id, amount: finalTotal, reason },
            }).catch(() => {});

            // 2) Grâce 5 jours avant dunning (le job dunning doit respecter autopay_grace_until)
            const graceUntil = new Date();
            graceUntil.setUTCDate(graceUntil.getUTCDate() + 5);
            await supabase
              .from("billing_invoices")
              .update({ autopay_grace_until: graceUntil.toISOString() })
              .eq("id", invoice.id)
              .catch(() => {});

            // 3) Note interne
            try {
              const { data: bcLink } = await supabase
                .from("billing_customers").select("user_id").eq("id", sub.customer_id).maybeSingle();
              if (bcLink?.user_id) {
                await supabase.from("client_internal_notes").insert({
                  client_id: bcLink.user_id,
                  author_name: "Système Nivra",
                  author_role: "system",
                  note: `Échec paiement automatique — ${invoiceNumber} — ${reason}`,
                  category: "billing",
                });
              }
            } catch {}

            // 4) Email client (template officiel bleu) — payment_failed
            try {
              if (sub.customer?.email) {
                await supabase.from("email_queue").insert({
                  event_key: `square-charge-failed-${invoice.id}`,
                  to_email: sub.customer.email,
                  template_key: "payment_failed",
                  template_vars: {
                    client_name: `${sub.customer.first_name || ""} ${sub.customer.last_name || ""}`.trim() || sub.customer.email,
                    invoice_id: invoice.id,
                    invoice_number: invoiceNumber,
                    amount: Number(finalTotal).toFixed(2),
                    failure_reason: reason,
                    pay_url: `${Deno.env.get("APP_URL") || "https://www.nivra-telecom.ca"}/payer/${invoice.id}`,
                    grace_until: graceUntil.toISOString(),
                  },
                  status: "queued",
                  attempts: 0,
                  max_attempts: 5,
                });
              }
            } catch (emailErr) {
              console.warn("[billing-generate-renewals] failure email enqueue failed:", emailErr);
            }
          }
        } else if (hasPayPalSubscription) {
          // 2. Fallback: PayPal (account under review — may fail)
          console.log(`[billing-generate-renewals] No Square card — falling back to PayPal for ${sub.id}`);
          const { data: chargeResult, error: chargeInvokeErr } = await supabase.functions.invoke(
            "paypal-charge-subscription",
            { body: { subscription_id: sub.id, invoice_id: invoice.id, amount: finalTotal } }
          );

          const chargeOk = !chargeInvokeErr && chargeResult?.success !== false;
          if (!chargeOk) {
            const reason = chargeInvokeErr?.message ?? chargeResult?.error ?? chargeResult?.message ?? "unknown";
            console.error(`[billing-generate-renewals] PayPal fallback also failed for ${invoiceNumber}: ${reason}`);
            await supabase
              .from("billing_payments")
              .update({ status: "failed", metadata: { failure_reason: reason, failed_at: new Date().toISOString() } })
              .eq("invoice_id", invoice.id)
              .eq("status", "pending")
              .eq("provider", "paypal");

            await supabase.from("billing_system_alerts").insert({
              alert_type: "paypal_charge_failed_on_renewal",
              entity_type: "billing_invoice",
              entity_id: invoice.id,
              severity: "warning",
              details: { message: `PayPal fallback échoué pour ${invoiceNumber}: ${reason}`, subscription_id: sub.id, customer_id: sub.customer_id, amount: finalTotal, reason },
            }).catch(() => {});
          }
        }

        // Queue reminder email (with invoice PDF, non-blocking)
        // For autopay subscribers we send a SPECIFIC notice that explains the
        // upcoming automatic debit (amount, date, payment method). This is
        // both a UX improvement and a chargeback-protection measure: a client
        // who was warned is less likely to dispute the debit at PayPal.
        if (sub.customer) {
          const { buildInvoicePdfAttachment } = await import("../_shared/pdfFromDb.ts");
          const pdfAttachment = await buildInvoicePdfAttachment(invoice.id, "facture");

          // Build a discount breakdown the template can render
          const discountLines: Array<{ label: string; amount: number }> = [];
          if (promoDiscount > 0) discountLines.push({ label: `Rabais promotionnel${promoNote}`, amount: promoDiscount });
          if (autopayDiscount > 0) discountLines.push({ label: "Rabais prélèvement automatique", amount: autopayDiscount });

          const isAutopay = hasPayPalSubscription;
          const templateKey = isAutopay ? "autopay_upcoming_debit" : "invoice_created";

          await supabase.from("email_queue").insert({
            event_key: `billing_renewal_${sub.id}_${newCycleStart.toISOString().split('T')[0]}`,
            to_email: sub.customer.email,
            template_key: templateKey,
            template_vars: {
              client_name: `${sub.customer.first_name} ${sub.customer.last_name}`,
              invoice_number: invoiceNumber,
              plan_name: sub.plan_name,
              total: finalTotal.toFixed(2),
              amount: finalTotal.toFixed(2),
              due_date: dueDate,
              days_remaining: daysRemaining,
              cycle_start: newCycleStart.toISOString().split('T')[0],
              cycle_end: newCycleEnd.toISOString().split('T')[0],
              account_number: accountNumber ?? "",
              // Autopay-specific vars (ignored by invoice_created template)
              debit_amount: finalTotal.toFixed(2),
              debit_date: dueDate,
              payment_method_label: "PayPal (prélèvement pré-autorisé)",
              subtotal: sub.plan_price.toFixed(2),
              discount_lines: discountLines,
            },
            attachments: pdfAttachment ? [pdfAttachment] : null,
            status: "queued",
            attempts: 0,
            max_attempts: 5
          });
        }
        
        results.invoices_created.push(invoiceNumber);
        results.processed++;
        console.log(`[billing-generate-renewals] Created renewal invoice ${invoiceNumber} for subscription ${sub.id} (due ${dueDate}, ${daysRemaining}d remaining)`);
        
      } catch (err) {
        const errorMsg = `Failed to process subscription ${sub.id}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[billing-generate-renewals] ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }
    
    // ── CRON HEARTBEAT ──
    await supabase.from("billing_system_alerts").insert({
      alert_type: "cron_heartbeat",
      entity_type: "cron",
      entity_reference: "billing-generate-renewals",
      severity: "info",
      details: {
        message: `Cron OK — window ${windowStartStr}→${windowEndStr} — processed: ${results.processed}, errors: ${results.errors.length}`,
        window: `${windowStartStr}→${windowEndStr}`,
        ...results,
      },
    });

    if (results.errors.length > 0 && results.processed === 0) {
      await supabase.from("billing_system_alerts").insert({
        alert_type: "renewal_generation_all_failed",
        entity_type: "cron",
        entity_reference: "billing-generate-renewals",
        severity: "critical",
        details: {
          message: `CRITIQUE: ${results.errors.length} abonnement(s) en erreur, 0 facture créée`,
          window: `${windowStartStr}→${windowEndStr}`,
          errors: results.errors,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        window: `${windowStartStr} → ${windowEndStr}`,
        ...results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[billing-generate-renewals] Error:", error);
    await reportEdgeError(error, { function: "billing-generate-renewals" }).catch(() => {});
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
