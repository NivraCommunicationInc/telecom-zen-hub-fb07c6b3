import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { computeTaxes } from "../_shared/tax-constants.ts";

/**
 * Field Sales Sync Edge Function
 * Handles server-side synchronization of field sales orders
 * 
 * CRITICAL: This function converts field_sales_orders into the main "orders" table
 * so they can be processed by Admin/Staff like any other order.
 * 
 * Actions:
 * - sync_single: Sync a single sale immediately after creation
 * - force_sync_all: Admin action to sync all pending sales
 * - get_stats: Get synchronization statistics
 */

// CORS — permissive for internal supabase.functions.invoke() calls.
// origin may be empty (server-to-server) or a Lovable preview/prod domain.
const ALLOWED_ORIGINS = [
  'https://nivra-telecom.ca',
  'https://www.nivra-telecom.ca',
  'https://telecom-zen-hub.lovable.app',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5173',
];

const buildCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const isAllowed = !origin
    || ALLOWED_ORIGINS.includes(origin)
    || origin.endsWith('.lovable.app')
    || origin.endsWith('.lovableproject.com');
  console.log(`[field-sales-sync CORS] origin="${origin}" isAllowed=${isAllowed}`);
  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
};

// Generate order number from DB sequence — NO local generation
async function generateOrderNumberFromDB(admin: any): Promise<string> {
  const { data, error } = await admin.rpc("generate_order_number");
  if (error || !data) throw new Error(`FATAL: generate_order_number RPC failed: ${error?.message}`);
  return String(data);
}

function splitName(fullName?: string | null): { firstName?: string; lastName?: string } {
  const cleaned = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return {};
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeServiceTypeLabel(services: any[]): string {
  const names = (Array.isArray(services) ? services : [])
    .map((s) => String(s?.name || s?.plan_name || s?.label || s?.category || "").trim())
    .filter(Boolean);

  const label = names.length > 0 ? names.join(" + ") : "Vente terrain";
  // Keep it reasonably short for lists/tables
  return label.slice(0, 120);
}

function mapLineItemType(raw?: any): string {
  const v = String(raw || "").toLowerCase();
  if (v.includes("internet") || v.includes("fibre")) return "internet";
  if (v.includes("tv") || v.includes("tele") || v.includes("télé")) return "tv";
  if (v.includes("mobile") || v.includes("cell")) return "mobile";
  if (v.includes("stream")) return "streaming";
  if (v.includes("secur")) return "security";
  return "other";
}

// Orders table allows: card, etransfer, e_transfer, apple_pay, google_pay (or NULL)
function normalizeOrdersPaymentMethod(raw?: any): string | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;

  const allowed = new Set(["card", "card_manual", "etransfer", "e_transfer", "apple_pay", "google_pay"]);
  if (allowed.has(v)) return v;

  // Field sales payment_method allows: interac, paypal, deferred
  if (v === "interac") return "e_transfer";
  if (v === "paypal") return "card";
  if (v === "deferred") return null;

  return null;
}

const BILLABLE_ORDER_STATUSES = new Set([
  "pending",
  "pending_payment",
  "submitted",
  "pending_admin_review",
  "confirmed",
  "completed",
  "activated",
  "delivered",
]);

function isBillableOrderStatus(status?: string | null): boolean {
  return BILLABLE_ORDER_STATUSES.has(String(status || "").toLowerCase());
}

function deriveCanonicalOrderStatus(paymentStatus?: string | null, paymentMethod?: string | null): string {
  if (String(paymentMethod || "").toLowerCase() === "card_manual") return "pending_payment";
  return String(paymentStatus || "").toLowerCase() === "confirmed" ? "activated" : "submitted";
}

function wrapLineItemsForOrder(lineItems: any[]): Record<string, any> {
  return {
    line_items: lineItems,
    generated_at: new Date().toISOString(),
    version: 2,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight — always return 204 with permissive headers.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé' }),
        { status: 401, headers: buildCorsHeaders(req) }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Service-role bypass: allow internal server-to-server calls (e.g. paypal-capture-order
    // bridging Field sales). Caller must present the project service-role key AND set
    // body.internal=true to opt-in.
    const isServiceRoleCall = token === serviceRoleKey;
    let claims: { user: { id: string } | null } = { user: null };

    if (!isServiceRoleCall) {
      const { data: c, error: claimsError } = await supabaseAdmin.auth.getUser(token);
      if (claimsError || !c.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Session invalide' }),
          { status: 401, headers: buildCorsHeaders(req) }
        );
      }
      claims = c as any;
    }

    const body = await req.json();
    const { action, sale_id } = body;
    const internalCall = isServiceRoleCall && body.internal === true;

    // For internal calls, synthesize claims from the sale's salesperson_id (resolved later).
    if (internalCall && !claims.user) {
      claims = { user: { id: '00000000-0000-0000-0000-000000000000' } } as any;
    }

    // Helper function to sync a single field sale to the orders table
    async function syncSaleToOrders(
      sale: any
    ): Promise<{ success: boolean; orderId?: string; order_number?: string; invoice_id?: string; payment_id?: string; error?: string }> {
      console.log(`[field-sales-sync] Syncing sale ${sale.id} to orders table`);

      try {
        const { firstName: customerFirstName, lastName: customerLastName } = splitName(sale.customer_name);
        let canonicalOrder: { id: string; order_number: string | null; status?: string | null } | null = null;

        // Check if this sale was already synced to orders and has a complete billing chain
        if (sale.converted_order_id) {
          const { data: existingOrder } = await supabaseAdmin
            .from("orders")
            .select("id, order_number, status")
            .eq("id", sale.converted_order_id)
            .maybeSingle();

          if (existingOrder) {
            const { count: existingInvoiceCount, error: invoiceCheckError } = await supabaseAdmin
              .from("billing_invoices")
              .select("id", { count: "exact", head: true })
              .eq("order_id", existingOrder.id);

            if (!invoiceCheckError && (existingInvoiceCount ?? 0) > 0) {
              console.log(`[field-sales-sync] Sale ${sale.id} already fully synced (order + invoice): ${existingOrder.id}`);
              return { success: true, orderId: existingOrder.id, order_number: existingOrder.order_number || undefined };
            }

            console.warn(`[field-sales-sync] Sale ${sale.id} has order ${existingOrder.id} but no invoice yet — resuming billing pipeline`);
            canonicalOrder = existingOrder;
          }
        }

        if (!canonicalOrder) {
          const { data: orphanOrder } = await supabaseAdmin
            .from("orders")
            .select("id, order_number, status")
            .eq("created_by", "field_sales")
            .ilike("notes", `%Vente terrain (ID: ${sale.id})%`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (orphanOrder) {
            console.warn(`[field-sales-sync] Re-attaching orphan order ${orphanOrder.id} for sale ${sale.id}`);
            canonicalOrder = orphanOrder;
          }
        }

        // ═══ SERVER-SIDE VALIDATION — Block incomplete submissions ═══
        // For card_manual sales (in-person card), email/phone/address may be missing.
        // Apply fallbacks before validation and before orders/account insertion.
        const isCardManual = sale.payment_method === "card_manual";
        if (isCardManual && !sale.customer_email?.trim()) {
          sale.customer_email = "noreply@nivra-telecom.ca";
        }
        if (isCardManual && !sale.customer_phone?.trim()) {
          sale.customer_phone = "000-000-0000";
        }
        if (isCardManual && !sale.customer_address?.trim()) {
          sale.customer_address = "Non fournie";
        }
        const validationErrors: string[] = [];
        if (!sale.customer_name?.trim()) validationErrors.push("Nom du client manquant");
        if (!sale.customer_email?.trim()) validationErrors.push("Courriel du client manquant");
        if (!sale.customer_phone?.trim()) validationErrors.push("Téléphone du client manquant");
        if (!sale.customer_address?.trim()) validationErrors.push("Adresse du client manquante");
        if (!Array.isArray(sale.services) || sale.services.length === 0) validationErrors.push("Aucun service sélectionné");
        
        if (validationErrors.length > 0) {
          const errorMsg = `Validation échouée: ${validationErrors.join(", ")}`;
          console.error(`[field-sales-sync] ${errorMsg}`);
          throw new Error(errorMsg);
        }

        // Get salesperson profile for rep info
        const { data: repProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email, phone, agent_number, professional_email')
          .eq('user_id', sale.salesperson_id)
          .maybeSingle();

        // Resolve / create a real client user_id (orders.user_id is NOT NULL)
        const customerEmail = String(sale.customer_email || "").trim().toLowerCase();

        let clientUserId: string | null = null;

        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
          .from("profiles")
          .select("user_id, email")
          .ilike("email", customerEmail)
          .maybeSingle();

        if (existingProfileError) {
          console.warn("[field-sales-sync] profile lookup error:", existingProfileError);
        }

        if (existingProfile?.user_id) {
          clientUserId = existingProfile.user_id;
        }

        if (!clientUserId) {
          console.log("[field-sales-sync] No profile found for email, creating auth user:", customerEmail);
          const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: customerEmail,
            email_confirm: true,
            user_metadata: {
              full_name: sale.customer_name || null,
              phone: sale.customer_phone || null,
              source: "field_sales",
            },
          });

          if (createUserError || !createdUser?.user) {
            console.error("[field-sales-sync] createUser error:", createUserError);
            throw new Error(createUserError?.message || "Impossible de créer le compte client");
          }

          clientUserId = createdUser.user.id;

          // Ensure a profile row exists (some projects rely on profile trigger; we enforce it here)
          const { error: upsertProfileError } = await supabaseAdmin
            .from("profiles")
            .upsert(
              {
                user_id: clientUserId,
                email: customerEmail,
                full_name: sale.customer_name || null,
                phone: sale.customer_phone || null,
              } as any,
              { onConflict: "user_id" }
            );
          if (upsertProfileError) {
            console.warn("[field-sales-sync] profile upsert warning:", upsertProfileError);
          }
        }

        // Calculate totals from services
        const services = Array.isArray(sale.services) ? sale.services : [];
        let monthlyTotal = 0;
        let oneTimeFeesTotal = 0;

        const lineItems: any[] = [];
        for (const svc of services) {
          const qty = Number(svc?.quantity ?? 1) || 1;
          const monthly = Number(svc?.price_monthly ?? svc?.monthly_price ?? 0) || 0;
          const setup = Number(svc?.price_setup ?? svc?.setup_fee ?? 0) || 0;

          const itemName = String(svc?.name || svc?.plan_name || svc?.label || svc?.category || "Service");
          const itemType = mapLineItemType(svc?.type || svc?.category);

          if (monthly > 0) {
            monthlyTotal += monthly * qty;
            lineItems.push({
              category: "service",
              type: itemType,
              name: itemName,
              qty,
              unit_price: monthly,
              period: "monthly",
              taxable: true,
            });
          }

          if (setup > 0) {
            oneTimeFeesTotal += setup * qty;
            lineItems.push({
              category: "fee",
              type: "activation",
              name: `Frais de mise en service - ${itemName}`,
              qty,
              unit_price: setup,
              period: "one_time",
              taxable: true,
            });
          }
        }

        // Base fees model aligned to orders schema
        let subtotal = monthlyTotal;
        let activationFee = oneTimeFeesTotal;
        const deliveryFee = 0;
        const installationFee = 0;

        // Taxes (Quebec) — canonical tax module
        const baseAmount = subtotal + activationFee + deliveryFee + installationFee;
        let { tps: tpsAmount, tvq: tvqAmount, total: totalAmount } = computeTaxes(baseAmount);

        // ═══ AUTHORITATIVE TOTAL — sale.total_amount is the agent-displayed total ═══
        // The field portal computes the total client-side (including discounts the
        // agent applied at the door). We MUST honour that value so the PayPal link,
        // the invoice and the visible order all stay aligned to the cent.
        const agentTotal = Number(sale.total_amount || 0);
        if (agentTotal > 0 && Math.abs(agentTotal - totalAmount) > 0.01) {
          console.log(`[field-sales-sync] Reconciling totals: sale.total_amount=${agentTotal} vs computed=${totalAmount}. Honouring agent total.`);
          // Re-derive subtotal pre-tax from the authoritative total
          const TAX_RATE = 0.14975; // TPS+TVQ combined
          const newBase = Number((agentTotal / (1 + TAX_RATE)).toFixed(2));
          const recomputed = computeTaxes(newBase);
          tpsAmount = recomputed.tps;
          tvqAmount = recomputed.tvq;
          totalAmount = recomputed.total;
          // Adjust subtotal to absorb any discount (keep activation fee unchanged)
          subtotal = Math.max(0, newBase - activationFee - deliveryFee - installationFee);
        }

        // ═══ RESOLVE OR CREATE ACCOUNT (orders.account_id is NOT NULL) ═══
        let accountId: string | null = null;

        // 1) Try to find existing account by client_id
        const { data: existingAccount } = await supabaseAdmin
          .from("accounts")
          .select("id")
          .eq("client_id", clientUserId!)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingAccount) {
          accountId = existingAccount.id;
          console.log(`[field-sales-sync] Found existing account ${accountId} for client ${clientUserId}`);
        } else {
          // 2) Create new account with generated account_number
          const { data: acctNum, error: acctNumErr } = await supabaseAdmin.rpc("generate_account_number");
          if (acctNumErr || !acctNum) {
            throw new Error(`generate_account_number failed: ${acctNumErr?.message}`);
          }

          const { firstName: fn, lastName: ln } = splitName(sale.customer_name);
          const { data: newAccount, error: acctErr } = await supabaseAdmin
            .from("accounts")
            .insert({
              client_id: clientUserId!,
              account_number: String(acctNum),
              account_name: sale.customer_name || `${fn || ""} ${ln || ""}`.trim() || "Client Terrain",
              status: "active",
              billing_address: sale.customer_address || null,
              billing_city: sale.customer_city || null,
              billing_postal_code: sale.customer_postal_code || null,
              billing_province: "QC",
              primary_service_address: sale.customer_address || null,
              primary_service_city: sale.customer_city || null,
              primary_service_postal_code: sale.customer_postal_code || null,
              primary_service_province: "QC",
              billing_cycle_day: new Date().getDate(),
            })
            .select("id, account_number")
            .single();

          if (acctErr || !newAccount) {
            console.error("[field-sales-sync] Account creation error:", acctErr);
            throw new Error(`Account creation failed: ${acctErr?.message}`);
          }

          accountId = newAccount.id;
          console.log(`[field-sales-sync] Created account ${newAccount.account_number} (${accountId}) for client ${clientUserId}`);

          // Sync account_number to profile
          await supabaseAdmin
            .from("profiles")
            .update({ account_number: String(acctNum) })
            .eq("user_id", clientUserId!);
        }

        const agentName = repProfile?.full_name || "Agent terrain";
        const agentNumber = (repProfile as any)?.agent_number || "N/A";
        const agentProEmail = (repProfile as any)?.professional_email || repProfile?.email || "";

        if (!canonicalOrder) {
          // Generate order number from DB sequence — Core is sole source of truth
          const orderNumber = await generateOrderNumberFromDB(supabaseAdmin);
          const serviceTypeLabel = normalizeServiceTypeLabel(services);

          // Create order in main orders table (match actual schema)
          const { data: newOrder, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
              user_id: clientUserId,
              account_id: accountId,
              order_number: orderNumber,
              created_by: 'field_sales',

              // ═══ AGENT IDENTITY — required for commissions + reporting ═══
              source: 'field_sales',
              created_by_agent_id: sale.salesperson_id,
              agent_name: agentName,

              client_email: customerEmail,
              client_phone: sale.customer_phone || null,
              client_first_name: customerFirstName || null,
              client_last_name: customerLastName || null,
              client_dob: sale.customer_date_of_birth || null,

              service_type: serviceTypeLabel,
              category: sale.services?.[0]?.category || 'Field Sales',

              subtotal: subtotal,
              activation_fee: activationFee,
              delivery_fee: deliveryFee,
              installation_fee: installationFee,
              tps_amount: tpsAmount,
              tvq_amount: tvqAmount,
              total_amount: totalAmount,

              status: deriveCanonicalOrderStatus(sale.payment_status, sale.payment_method),
              payment_status: sale.payment_status || 'pending',
              payment_method: normalizeOrdersPaymentMethod(sale.payment_method),
              payment_reference: sale.payment_reference || null,
              amount_paid: sale.payment_status === 'confirmed' ? totalAmount : 0,

              appointment_date: sale.appointment_date || null,
              appointment_notes: sale.appointment_notes || null,

              shipping_address: sale.customer_address || null,
              shipping_city: sale.customer_city || null,
              shipping_postal_code: sale.customer_postal_code || null,

              selected_channels: sale.selected_channels || [],
              equipment_details: wrapLineItemsForOrder(lineItems),

              notes: `Vente terrain — Agent: ${agentName} (ID: ${sale.id})\nClient: ${sale.customer_name || customerEmail}\nTéléphone: ${sale.customer_phone || '—'}\nAdresse: ${sale.customer_address || '—'}, ${sale.customer_city || ''} ${sale.customer_postal_code || ''}`.trim(),
              internal_notes: `[VENTE TERRAIN]\nPar: ${agentName} (${repProfile?.email || '—'})\n${sale.internal_notes || ''}`.trim(),
            })
            .select('id, order_number, status')
            .single();

          if (orderError) {
            console.error(`[field-sales-sync] Error creating order:`, orderError);
            throw orderError;
          }

          canonicalOrder = newOrder;
          console.log(`[field-sales-sync] Created order ${canonicalOrder.order_number} for sale ${sale.id} by agent ${agentName}`);
        } else {
          // Backfill agent identity if order already exists but missing tags
          await supabaseAdmin
            .from('orders')
            .update({
              source: 'field_sales',
              created_by_agent_id: sale.salesperson_id,
              agent_name: agentName,
            })
            .eq('id', canonicalOrder.id);
        }

        const targetOrderStatus = deriveCanonicalOrderStatus(sale.payment_status, sale.payment_method);
        if (!isBillableOrderStatus(canonicalOrder.status)) {
          const { error: promoteOrderError } = await supabaseAdmin
            .from("orders")
            .update({
              status: targetOrderStatus,
              payment_status: sale.payment_status || "pending",
              payment_method: normalizeOrdersPaymentMethod(sale.payment_method),
              payment_reference: sale.payment_reference || null,
              amount_paid: sale.payment_status === "confirmed" ? totalAmount : 0,
            })
            .eq("id", canonicalOrder.id);

          if (promoteOrderError) {
            throw new Error(`Order status promotion failed: ${promoteOrderError.message}`);
          }

          canonicalOrder = { ...canonicalOrder, status: targetOrderStatus };
          console.log(`[field-sales-sync] Promoted order ${canonicalOrder.id} to billable status ${targetOrderStatus}`);
        }

        // ═══ CANONICAL INVOICE + PAYMENT CREATION ═══
        // Field orders must enter the same billing pipeline as website orders
        let invoiceId: string | null = null;
        let paymentId: string | null = null;

        const { data: verifiedOrder, error: verifyOrderBeforeBillingError } = await supabaseAdmin
          .from("orders")
          .select("id, status, source, payment_method")
          .eq("id", canonicalOrder.id)
          .maybeSingle();

        if (verifyOrderBeforeBillingError || !verifiedOrder) {
          throw new Error(`Order verification failed before billing: ${verifyOrderBeforeBillingError?.message || "order not found"}`);
        }

        canonicalOrder = { ...canonicalOrder, status: verifiedOrder.status };

        try {
          // Generate invoice number from DB sequence
          const { data: invoiceNum, error: invNumErr } = await supabaseAdmin.rpc("generate_invoice_number");
          if (invNumErr || !invoiceNum) throw new Error(`generate_invoice_number failed: ${invNumErr?.message}`);

          // Get or create billing customer
          let billingCustomerId: string | null = null;
          const { data: existingBillingCustomer } = await supabaseAdmin
            .from("billing_customers")
            .select("id")
            .ilike("email", customerEmail)
            .maybeSingle();

          if (existingBillingCustomer) {
            billingCustomerId = existingBillingCustomer.id;
            // Link user_id if missing
            if (clientUserId) {
              await supabaseAdmin.from("billing_customers")
                .update({ user_id: clientUserId })
                .eq("id", billingCustomerId)
                .is("user_id", null);
            }
          } else {
            const { data: newBillingCust, error: bcErr } = await supabaseAdmin
              .from("billing_customers")
              .insert({
                user_id: clientUserId,
                first_name: customerFirstName || "Client",
                last_name: customerLastName || "Terrain",
                email: customerEmail,
                phone: sale.customer_phone || "",
                status: "active",
              })
              .select("id")
              .single();
            if (bcErr) throw bcErr;
            billingCustomerId = newBillingCust.id;
          }

          // Determine payment state based on field sale status
          const isConfirmedPayment = sale.payment_status === "confirmed";
          const invoiceStatus = isConfirmedPayment ? "paid" : "pending";

          const now = new Date();
          const cycleStart = now.toISOString().split("T")[0];
          const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().split("T")[0];
          const dueDate = new Date(now.getTime() + 15 * 86400000).toISOString().split("T")[0];

          // Create canonical invoice
          const { data: newInvoice, error: invErr } = await supabaseAdmin
            .from("billing_invoices")
            .insert({
              customer_id: billingCustomerId,
              invoice_number: String(invoiceNum),
              order_id: canonicalOrder.id,
              type: "initial",
              status: invoiceStatus,
              subtotal: subtotal + activationFee,
              tps_amount: tpsAmount,
              tvq_amount: tvqAmount,
              total: totalAmount,
              amount_paid: isConfirmedPayment ? totalAmount : 0,
              balance_due: isConfirmedPayment ? 0 : totalAmount,
              cycle_start_date: cycleStart,
              cycle_end_date: cycleEnd,
              due_date: dueDate,
              paid_at: isConfirmedPayment ? now.toISOString() : null,
              environment: "production",
              notes: `Commande terrain — Agent: ${agentName} (${agentNumber})`,
              billing_snapshot_client: {
                first_name: customerFirstName || null,
                last_name: customerLastName || null,
                email: customerEmail,
                phone: sale.customer_phone || null,
                agent_name: agentName,
                agent_number: agentNumber,
                agent_email: agentProEmail,
                agent_id: sale.salesperson_id,
                source: "field_sales",
              },
            })
            .select("id")
            .single();

          if (invErr) {
            console.error("[field-sales-sync] Invoice creation error:", invErr);
            throw new Error(`Invoice creation failed: ${invErr.message}`);
          } else {
            invoiceId = newInvoice.id;
            console.log(`[field-sales-sync] Created invoice ${invoiceNum} for order ${canonicalOrder.order_number || canonicalOrder.id}`);

            // Create invoice lines
            for (const li of lineItems) {
              const { error: lineErr } = await supabaseAdmin.from("billing_invoice_lines").insert({
                invoice_id: invoiceId,
                description: li.name,
                unit_price: li.unit_price,
                quantity: li.qty,
                line_total: li.unit_price * li.qty,
                line_type: li.category === "fee" ? "fee" : "service",
              });
              if (lineErr) {
                throw new Error(`Invoice line creation failed: ${lineErr.message}`);
              }
            }

            // Discount line (if applied at the door)
            const discountData: any = (sale as any).discount_data;
            if (discountData) {
              const dType = String(discountData.type || "");
              const dAppliesTo = String(discountData.applies_to || "");
              const dAmt = Number(discountData.amount || 0);
              const dDur = Number(discountData.duration_months || 0);
              const dName = String(discountData.name || "Rabais agent");
              const monthlyPrice = Number(discountData.monthly_price || subtotal || 0);

              let desc: string | null = null;
              let unitPrice = 0;

              if (dType === "remove_fee" && dAppliesTo === "installation") {
                desc = "Installation gratuite ✓";
                unitPrice = 0;
              } else if (dType === "remove_fee" && dAppliesTo === "activation") {
                desc = "Activation gratuite ✓";
                unitPrice = 0;
              } else if (dType === "first_month_free") {
                desc = `1er mois offert — ${monthlyPrice.toFixed(2)}$/mois`;
                unitPrice = -monthlyPrice;
              } else if (dType === "one_time" && dAmt > 0) {
                desc = `Promotion unique — ${dAmt.toFixed(2)}$`;
                unitPrice = -dAmt;
              } else if (dAmt > 0) {
                // fixed_monthly / credit — permanent or time-limited
                desc = dDur > 0
                  ? `Rabais ${dName} — ${dAmt.toFixed(2)}$/mois × ${dDur} mois`
                  : `Rabais permanent ${dName} — ${dAmt.toFixed(2)}$/mois`;
                unitPrice = -dAmt;
              }

              if (desc !== null) {
                const { error: discLineErr } = await supabaseAdmin.from("billing_invoice_lines").insert({
                  invoice_id: invoiceId,
                  description: desc,
                  unit_price: unitPrice,
                  quantity: 1,
                  line_total: unitPrice,
                  line_type: "discount",
                });
                if (discLineErr) {
                  console.error("[field-sales-sync] discount line insert failed:", discLineErr);
                }
              }
            }

            const { data: payNum, error: payNumErr } = await supabaseAdmin.rpc("generate_payment_number");
            const paymentNumber = payNumErr || !payNum ? `PAY-FS-${Date.now().toString(36).toUpperCase()}` : String(payNum);

            // Determine payment method for billing_payments enum
            const billingPaymentMethod = sale.payment_method === "paypal" ? "paypal"
              : sale.payment_method === "interac" ? "interac"
              : sale.payment_method === "card" ? "card"
              : "interac"; // default for deferred

            // Create canonical payment record only when payment is confirmed.
            // billing_payments.status enum does not allow "pending".
            if (isConfirmedPayment) {
              const { data: newPayment, error: payErr } = await supabaseAdmin
                .from("billing_payments")
                .insert({
                  invoice_id: invoiceId,
                  customer_id: billingCustomerId,
                  amount: totalAmount,
                  method: billingPaymentMethod,
                  provider: sale.payment_method || "manual",
                  reference: sale.payment_reference || null,
                  payment_number: paymentNumber,
                  status: "confirmed",
                  source: "field_sales",
                })
                .select("id")
                .single();

              if (payErr) {
                console.error("[field-sales-sync] Payment creation error:", payErr);
                throw new Error(`Payment creation failed: ${payErr.message}`);
              } else {
                paymentId = newPayment.id;
                console.log(`[field-sales-sync] Created payment ${paymentNumber} for invoice ${invoiceNum}`);
              }
            }

            // Ensure a canonical contract exists for this canonical order
            const { data: existingContract } = await supabaseAdmin
              .from("contracts")
              .select("id")
              .eq("order_id", canonicalOrder.id)
              .maybeSingle();

            if (!existingContract) {
              const { data: contractNum, error: contractNumErr } = await supabaseAdmin.rpc("generate_contract_number");
              if (contractNumErr || !contractNum) {
                throw new Error(`generate_contract_number failed: ${contractNumErr?.message}`);
              }

              const { error: contractErr } = await supabaseAdmin
                .from("contracts")
                .insert({
                  user_id: clientUserId,
                  owner_user_id: clientUserId,
                  order_id: canonicalOrder.id,
                  contract_name: `Contrat de Service - Commande #${canonicalOrder.order_number || canonicalOrder.id.slice(0, 8)}`,
                  contract_url: "",
                  contract_number: String(contractNum),
                  status: "draft",
                });

              if (contractErr) {
                throw new Error(`Contract creation failed: ${contractErr.message}`);
              }

              // Mirror into client_documents (visible in client portal documents list)
              try {
                await supabaseAdmin.from("client_documents").insert({
                  user_id: clientUserId,
                  uploaded_by: clientUserId,
                  document_type: "service_contract",
                  document_name: `Contrat de service — ${canonicalOrder.order_number || canonicalOrder.id.slice(0, 8)}`,
                  document_url: "",
                });
              } catch (docErr: any) {
                console.error("[field-sales-sync] client_documents mirror failed:", docErr?.message || docErr);
              }

              // Enqueue contract email to client (template resolved by email worker)
              try {
                await supabaseAdmin.from("email_queue").insert({
                  event_key: `contract_generated:${canonicalOrder.id}`,
                  to_email: customerEmail,
                  template_key: "contract_generated",
                  status: "pending",
                  attempts: 0,
                  max_attempts: 5,
                  message_type: "transactional",
                  entity_type: "contract",
                  entity_id: canonicalOrder.id,
                  subject: "Votre contrat de service Nivra",
                  template_vars: {
                    order_number: canonicalOrder.order_number,
                    customer_first_name: customerFirstName,
                    customer_last_name: customerLastName,
                    agent_name: agentName,
                    agent_number: agentNumber,
                    // Discount section — populated only when an agent rabais
                    // was applied at the door (sale.discount_data).
                    discount_data: discountData || null,
                    discounts: discountData ? [discountData] : [],
                  },
                  idempotency_key: `contract_generated:${canonicalOrder.id}`,
                });
              } catch (mailErr: any) {
                console.error("[field-sales-sync] contract_generated enqueue failed:", mailErr?.message || mailErr);
              }
            }
          }
        } catch (billingErr: any) {
          console.error("[field-sales-sync] Billing pipeline error:", billingErr);
          throw new Error(`Billing pipeline failed: ${billingErr?.message || String(billingErr)}`);
        }

        // Update field_sales_orders with converted_order_id and sync status
        const { data: verifiedOrderAfterBilling, error: verifyOrderAfterBillingError } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("id", canonicalOrder.id)
          .maybeSingle();

        if (verifyOrderAfterBillingError || !verifiedOrderAfterBilling) {
          throw new Error(`Order verification failed after billing: ${verifyOrderAfterBillingError?.message || "order not found"}`);
        }

        if (!invoiceId) {
          throw new Error("Billing invoice creation failed: invoice id missing");
        }

        const { error: updateError } = await supabaseAdmin
          .from('field_sales_orders')
          .update({
            converted_order_id: canonicalOrder.id,
            converted_at: new Date().toISOString(),
            sync_status: 'synced',
            synced_at: new Date().toISOString(),
            sync_error: null,
          })
          .eq('id', sale.id);

        if (updateError) {
          console.error(`[field-sales-sync] Error updating sale status:`, updateError);
          throw new Error(`Sync status update failed: ${updateError.message}`);
        }

        // ═══ COMMISSION ENGINE — Base % + tier lookup ═══
        // Commission is created with status 'pending_activation' — only unlocked when order reaches 'activated'
        try {
          // Look up active commission rules (tiered by sales count)
          const { data: commRules } = await supabaseAdmin
            .from("field_sales_commission_rules")
            .select("*")
            .eq("is_active", true)
            .order("min_sales", { ascending: true });

          // Count agent's total completed sales for tier resolution
          const { count: agentSalesCount } = await supabaseAdmin
            .from("field_sales_orders")
            .select("id", { count: "exact", head: true })
            .eq("salesperson_id", sale.salesperson_id)
            .eq("sync_status", "synced");

          const salesCount = agentSalesCount || 0;

          // Find the matching tier rule
          let commissionRate = 0.10; // Default 10%
          let bonusAmount = 0;
          let bonusType: string | null = null;

          if (commRules && commRules.length > 0) {
            // Find the highest tier the agent qualifies for
            for (const rule of commRules) {
              const minOk = rule.min_sales == null || salesCount >= rule.min_sales;
              const maxOk = rule.max_sales == null || salesCount <= rule.max_sales;
              if (minOk && maxOk) {
                if (rule.rule_type === "percentage" && rule.bonus_percentage) {
                  commissionRate = rule.bonus_percentage / 100;
                } else if (rule.rule_type === "flat" && rule.bonus_amount) {
                  commissionRate = 0;
                  bonusAmount = rule.bonus_amount;
                  bonusType = "flat";
                } else if (rule.rule_type === "tiered" && rule.bonus_percentage) {
                  commissionRate = rule.bonus_percentage / 100;
                  bonusAmount = rule.bonus_amount || 0;
                  bonusType = "tiered";
                }
              }
            }
          }

          const baseCommission = monthlyTotal * commissionRate;
          const totalCommission = baseCommission + bonusAmount;

          if (totalCommission > 0) {
            await supabaseAdmin
              .from("sales_commissions")
              .upsert({
                salesperson_id: sale.salesperson_id,
                field_order_id: sale.id,
                  converted_order_id: canonicalOrder.id,
                sale_amount: monthlyTotal,
                commission_rate: commissionRate,
                commission_amount: totalCommission,
                bonus_amount: bonusAmount > 0 ? bonusAmount : null,
                bonus_type: bonusType,
                  status: "pending",
                notes: `Auto: ${(commissionRate * 100).toFixed(0)}% × ${monthlyTotal.toFixed(2)}$ = ${baseCommission.toFixed(2)}$${bonusAmount > 0 ? ` + bonus ${bonusAmount.toFixed(2)}$` : ""} | Tier: ${salesCount} ventes`,
                created_at: new Date().toISOString(),
              }, {
                onConflict: "field_order_id",
                ignoreDuplicates: false,
              });

            console.log(`[field-sales-sync] Commission created: ${totalCommission.toFixed(2)}$ (rate: ${(commissionRate * 100).toFixed(0)}%, bonus: ${bonusAmount}) for agent ${sale.salesperson_id}`);
          }
        } catch (commErr: any) {
          console.error("[field-sales-sync] Commission engine error (non-blocking):", commErr);
        }

        return { 
          success: true, 
          orderId: canonicalOrder.id, 
          order_number: canonicalOrder.order_number || undefined,
          invoice_id: invoiceId ?? undefined,
          payment_id: paymentId ?? undefined,
        };

      } catch (error: any) {
        console.error(`[field-sales-sync] Error syncing sale ${sale.id}:`, error);
        const exactErrorMessage = error?.message || String(error);
        
        // Mark as failed
        await supabaseAdmin
          .from('field_sales_orders')
          .update({ sync_status: 'failed', sync_error: exactErrorMessage })
          .eq('id', sale.id);

        throw error;
      }
    }

    // ACTION: sync_single - Called immediately after field sale creation
    // Also handles convert_single for admin conversion
    const saleIdToSync = sale_id || body.field_order_id;
    if ((action === 'sync_single' || action === 'convert_single') && saleIdToSync) {
      // Get the sale
      const { data: sale, error: fetchError } = await supabaseAdmin
        .from('field_sales_orders')
        .select('*')
        .eq('id', saleIdToSync)
        .single();

      if (fetchError || !sale) {
        console.error('[field-sales-sync] Sale not found:', saleIdToSync, fetchError);
        return new Response(
          JSON.stringify({ success: false, error: 'Vente non trouvée' }),
          { status: 404, headers: buildCorsHeaders(req) }
        );
      }

      // Verify the caller is the salesperson or an admin (skipped for internal service-role calls)
      const callerId = claims.user?.id ?? null;
      const isOwner = !!callerId && sale.salesperson_id === callerId;
      let adminRole: any = null;
      if (!internalCall && callerId) {
        const { data: ar, error: roleError } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', callerId)
          .in('role', ['admin', 'employee'])
          .eq('is_active', true)
          .maybeSingle();
        if (roleError) console.error('[field-sales-sync] Role check error:', roleError);
        adminRole = ar;
      }

      if (!internalCall && !isOwner && !adminRole) {
        console.error('[field-sales-sync] Unauthorized:', callerId);
        return new Response(
          JSON.stringify({ success: false, error: 'Non autorisé' }),
          { status: 403, headers: buildCorsHeaders(req) }
        );
      }

      console.log('[field-sales-sync] Converting sale:', saleIdToSync, 'by user:', callerId ?? '(internal)');
      const result = await syncSaleToOrders(sale);
      
      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 500, headers: buildCorsHeaders(req) }
      );
    }

    // ACTION: force_sync_all - Admin only, sync all pending sales
    if (action === 'force_sync_all') {
      // Require admin
      const { data: adminRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', claims.user.id)
        .eq('role', 'admin')
        .eq('is_active', true)
        .maybeSingle();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ success: false, error: 'Accès administrateur requis' }),
          { status: 403, headers: buildCorsHeaders(req) }
        );
      }

      // Get all pending sales (not yet synced to orders)
      const { data: pendingSales, error: fetchError } = await supabaseAdmin
        .from('field_sales_orders')
        .select('*')
        .or('sync_status.eq.pending,sync_status.eq.failed,sync_status.eq.error,converted_order_id.is.null');

      if (fetchError) {
        console.error('[field-sales-sync] Error fetching pending sales:', fetchError);
        throw fetchError;
      }

      if (!pendingSales || pendingSales.length === 0) {
        return new Response(
          JSON.stringify({ success: true, synced: 0, message: 'Aucune vente en attente' }),
          { headers: buildCorsHeaders(req) }
        );
      }

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const sale of pendingSales) {
        try {
          await syncSaleToOrders(sale);
          synced++;
        } catch (error: any) {
          failed++;
          errors.push(`Sale ${sale.id}: ${error?.message || String(error)}`);
        }
      }

      console.log(`[field-sales-sync] Bulk sync complete: ${synced} synced, ${failed} failed`);

      return new Response(
        JSON.stringify({
          success: true,
          synced,
          failed,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: buildCorsHeaders(req) }
      );
    }

    // ACTION: get_stats - Get sync statistics
    if (action === 'get_stats') {
      const { data: allSales } = await supabaseAdmin
        .from('field_sales_orders')
        .select('sync_status, converted_order_id');

      const pending = allSales?.filter((d: any) => d.sync_status === 'pending' || !d.converted_order_id).length || 0;
      const synced = allSales?.filter((d: any) => d.sync_status === 'synced' && d.converted_order_id).length || 0;
      const failed = allSales?.filter((d: any) => d.sync_status === 'failed' || d.sync_status === 'error').length || 0;

      return new Response(
        JSON.stringify({ 
          success: true, 
          stats: { 
            pending, 
            synced, 
            failed, 
            total: allSales?.length || 0 
          } 
        }),
        { headers: buildCorsHeaders(req) }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Action non reconnue' }),
      { status: 400, headers: buildCorsHeaders(req) }
    );

  } catch (error: any) {
    console.error('[field-sales-sync] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
});
