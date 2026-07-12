import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { computeTaxes } from "../_shared/tax-constants.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { writePaymentAutoNote } from "../_shared/paymentAutoNote.ts";
import { ensureFieldCommissionAfterCapture } from "../_shared/ensureFieldCommission.ts";


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

// CORS â€” permissive for internal supabase.functions.invoke() calls.
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

// Generate order number from DB sequence â€” NO local generation
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

  if (v === "interac") return "e_transfer";
  if (v === "deferred") return null;

  return null;
}

function numberFrom(...values: any[]): number {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function computeAgentDiscountLine(discountData: any, monthlyTotal: number, activationFee: number): { desc: string; amount: number } | null {
  if (!discountData) return null;

  const getDiscountLabel = (raw: string): string => {
    const clean = String(raw || "Rabais").trim();
    return /^rabais\b/i.test(clean) ? clean : `Rabais ${clean}`;
  };

  const dType = String(discountData.type || "");
  const dAppliesTo = String(discountData.applies_to || "");
  const dName = String(discountData.name || "Rabais agent");
  const dAmt = numberFrom(discountData.amount, discountData.value);
  const monthlyPrice = numberFrom(discountData.monthly_price, discountData.monthlyPrice, monthlyTotal);

  if (dType === "remove_fee" && dAppliesTo === "installation" && activationFee > 0) {
    return { desc: "Installation gratuite ✓", amount: -activationFee };
  }
  if (dType === "remove_fee" && dAppliesTo === "activation" && activationFee > 0) {
    return { desc: "Activation gratuite ✓", amount: -activationFee };
  }
  if (dType === "first_month_free" && monthlyPrice > 0) {
    return { desc: `1er mois offert — ${monthlyPrice.toFixed(2)}$/mois`, amount: -monthlyPrice };
  }
  if (dAmt > 0) {
    return { desc: getDiscountLabel(dName), amount: -Math.min(dAmt, monthlyTotal || dAmt) };
  }

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

function extractStaffTunnelContext(sale: any): { accountId: string | null; serviceAddressId: string | null } {
  const note = String(sale?.internal_notes || "");
  const accountId = note.match(/account_id=([0-9a-f-]{36})/i)?.[1] || null;
  const serviceAddressId = note.match(/service_address_id=([0-9a-f-]{36})/i)?.[1] || null;
  return { accountId, serviceAddressId };
}

Deno.serve(async (req) => {
  // Handle CORS preflight â€” always return 204 with permissive headers.
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

    // Service-role bypass: allow internal server-to-server calls (payment processors
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
    console.log('[field-sales-sync DIAG]', { isServiceRoleCall, bodyInternal: body.internal, internalCall, tokenLen: token.length, srkLen: serviceRoleKey.length });

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
              // F31-6 — even when the order+invoice already exist, we must still
              // guarantee the field_commissions row is created once Square captured.
              // Handles the resync path from square-charge-invoice / square-webhook.
              const ensured = await ensureFieldCommissionAfterCapture(supabaseAdmin, {
                sale_id: sale.id,
                reason: "field-sales-sync:resync",
              });
              console.log(`[field-sales-sync] F31-6 resync ensureFieldCommission → ${ensured.status}`);
              console.log(`[field-sales-sync] Sale ${sale.id} already fully synced (order + invoice): ${existingOrder.id}`);
              return { success: true, orderId: existingOrder.id, order_number: existingOrder.order_number || undefined };
            }

            console.warn(`[field-sales-sync] Sale ${sale.id} has order ${existingOrder.id} but no invoice yet â€” resuming billing pipeline`);
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

        // Normalize Field quote payloads: older paths stored services as
        // { services, equipment }, which made Core miss/skip pending field sales.
        if (!Array.isArray(sale.services) && sale.services && typeof sale.services === "object") {
          sale.services = [
            ...(((sale.services as any).services as any[]) || []),
            ...(((sale.services as any).equipment as any[]) || []),
          ];
        }

        // â•â•â• SERVER-SIDE VALIDATION â€” Block incomplete submissions â•â•â•
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
        const staffTunnel = extractStaffTunnelContext(sale);
        let staffAccount: any = null;
        let staffServiceAddress: any = null;

        if (staffTunnel.accountId) {
          const { data: accountRow, error: staffAccountError } = await supabaseAdmin
            .from("accounts")
            .select("id, client_id, account_number, status")
            .eq("id", staffTunnel.accountId)
            .maybeSingle();
          if (staffAccountError || !accountRow?.client_id) {
            throw new Error(`Staff tunnel account invalid: ${staffAccountError?.message || "account not found"}`);
          }
          staffAccount = accountRow;
          clientUserId = accountRow.client_id;

          if (staffTunnel.serviceAddressId) {
            const { data: addressRow, error: staffAddressError } = await supabaseAdmin
              .from("service_addresses")
              .select("id, account_id, address_line, city, province, postal_code, deleted_at")
              .eq("id", staffTunnel.serviceAddressId)
              .eq("account_id", staffTunnel.accountId)
              .is("deleted_at", null)
              .maybeSingle();
            if (staffAddressError || !addressRow) {
              throw new Error(`Staff tunnel service address invalid: ${staffAddressError?.message || "address not found on account"}`);
            }
            staffServiceAddress = addressRow;
          }
        }

        if (!clientUserId) {
          const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
            .from("profiles")
            .select("user_id, email")
            .ilike("email", customerEmail)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (existingProfileError) {
            console.warn("[field-sales-sync] profile lookup error:", existingProfileError);
          }

          if (existingProfile?.user_id) {
            clientUserId = existingProfile.user_id;
          }
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
          const { firstName: newFn, lastName: newLn } = splitName(sale.customer_name);
          const profilePayload: Record<string, unknown> = {
            user_id: clientUserId,
            email: customerEmail,
            full_name: sale.customer_name || null,
            first_name: newFn || null,
            last_name: newLn || null,
            phone: sale.customer_phone || null,
            service_address: sale.customer_address || null,
            service_city: sale.customer_city || null,
            service_postal_code: sale.customer_postal_code || null,
          };
          if (sale.customer_date_of_birth) {
            profilePayload.date_of_birth = sale.customer_date_of_birth;
            profilePayload.dob_locked = true;
          }
          const { error: upsertProfileError } = await supabaseAdmin
            .from("profiles")
            .upsert(profilePayload as any, { onConflict: "user_id" });
          if (upsertProfileError) {
            console.warn("[field-sales-sync] profile upsert warning:", upsertProfileError);
          }
        } else {
          // Existing profile: backfill missing fields (never overwrite locked DOB)
          const { firstName: bfFn, lastName: bfLn } = splitName(sale.customer_name);
          const { data: existing } = await supabaseAdmin
            .from("profiles")
            .select("first_name, last_name, date_of_birth, dob_locked, service_address, service_city, service_postal_code, phone, full_name")
            .eq("user_id", clientUserId)
            .maybeSingle();
          const backfill: Record<string, unknown> = {};
          if (!existing?.first_name && bfFn) backfill.first_name = bfFn;
          if (!existing?.last_name && bfLn) backfill.last_name = bfLn;
          if ((!existing?.full_name || existing.full_name === "Client" || existing.full_name.trim() === "") && sale.customer_name) backfill.full_name = sale.customer_name;
          if (!existing?.phone && sale.customer_phone) backfill.phone = sale.customer_phone;
          if (!existing?.service_address && sale.customer_address) backfill.service_address = sale.customer_address;
          if (!existing?.service_city && sale.customer_city) backfill.service_city = sale.customer_city;
          if (!existing?.service_postal_code && sale.customer_postal_code) backfill.service_postal_code = sale.customer_postal_code;
          if (!existing?.date_of_birth && !existing?.dob_locked && sale.customer_date_of_birth) {
            backfill.date_of_birth = sale.customer_date_of_birth;
            backfill.dob_locked = true;
          }
          if (Object.keys(backfill).length > 0) {
            const { error: bfErr } = await supabaseAdmin
              .from("profiles")
              .update(backfill)
              .eq("user_id", clientUserId);
            if (bfErr) console.warn("[field-sales-sync] profile backfill warning:", bfErr);
          }
        }

        // Structured line breakdown — service, equipment, activation, shipping.
        // Each item carries kind='service' | 'equipment' from FieldNewSale.
        const rawItems = Array.isArray(sale.services) ? sale.services : [];
        const services = rawItems; // backward-compat alias for downstream refs
        let quoteSubtotalHint = 0;
        let quoteTotalHint = 0;

        if (sale.source_quote_id) {
          const { data: quoteFinancials } = await supabaseAdmin
            .from("field_quotes")
            .select("subtotal, total")
            .eq("id", sale.source_quote_id)
            .maybeSingle();
          quoteSubtotalHint = numberFrom((quoteFinancials as any)?.subtotal);
          quoteTotalHint = numberFrom((quoteFinancials as any)?.total);
        }

        const isSpecialFeeLine = (x: any) => {
          const kind = String(x?.kind || "").toLowerCase();
          return kind === "fulfillment_fee" || kind === "custom_adjustment";
        };
        const isEquipment = (x: any) =>
          !isSpecialFeeLine(x) && (
          String(x?.kind || "").toLowerCase() === "equipment"
          || String(x?.type || "").toLowerCase() === "equipment"
          || String(x?.category || "").toLowerCase() === "equipment"
          || (Number(x?.price_monthly ?? x?.monthly_price ?? 0) === 0 && Number(x?.price_setup ?? x?.price ?? 0) > 0)
          );

        const serviceItems = rawItems.filter((x: any) => !isEquipment(x) && !isSpecialFeeLine(x));
        const equipmentItems = rawItems.filter((x: any) => isEquipment(x));
        const specialFeeItems = rawItems.filter((x: any) => isSpecialFeeLine(x));

        let monthlyTotal = 0;
        let equipmentTotal = 0;
        const lineItems: any[] = [];
        let quoteAdjustmentProjected = false;

        // 1) Recurring service lines (1 per forfait)
        for (const svc of serviceItems) {
          const qty = Number(svc?.quantity ?? 1) || 1;
          const monthly = Number(svc?.price_monthly ?? svc?.monthly_price ?? svc?.monthlyPrice ?? 0) || 0;
          if (monthly <= 0) continue;
          const rawName = String(svc?.name || svc?.plan_name || svc?.label || "Service");
          monthlyTotal += monthly * qty;
          lineItems.push({
            category: "service",
            type: mapLineItemType(svc?.type || svc?.category),
            name: `${rawName} — 30 jours`,
            qty,
            unit_price: monthly,
            period: "monthly",
            taxable: true,
          });
        }

        // 2) Equipment lines (1 par équipement, prix unique)
        for (const eq of equipmentItems) {
          const qty = Number(eq?.quantity ?? 1) || 1;
          const price = Number(eq?.price_setup ?? eq?.price ?? 0) || 0;
          if (price <= 0) continue;
          const rawName = String(eq?.name || eq?.plan_name || eq?.label || "Équipement");
          equipmentTotal += price * qty;
          lineItems.push({
            category: "equipment",
            type: "equipment",
            name: rawName,
            qty,
            unit_price: price,
            period: "one_time",
            taxable: true,
          });
        }

        // 3) Canonical activation fee — 10$ (1 service) / 45$ (multi)
        const serviceCount = serviceItems.length;
        const activationFee = serviceCount === 0 ? 0 : serviceCount === 1 ? 10 : 45;
        if (activationFee > 0) {
          lineItems.push({
            category: "fee",
            type: "activation",
            name: serviceCount === 1 ? "Frais d'activation (1 service)" : "Frais d'activation (multi-services)",
            qty: 1,
            unit_price: activationFee,
            period: "one_time",
            taxable: true,
          });
        }

        let explicitDeliveryFee = 0;
        let explicitInstallationFee = 0;
        let customAdjustmentTotal = 0;

        for (const item of specialFeeItems) {
          const qty = Number(item?.quantity ?? item?.qty ?? 1) || 1;
          const unit = Number(item?.price_setup ?? item?.price ?? item?.unit_price ?? 0) || 0;
          if (unit === 0) continue;
          const kind = String(item?.kind || "").toLowerCase();
          const type = String(item?.type || "").toLowerCase();

          // ⛔ Refuse toute custom_adjustment négative. Un paiement déjà reçu
          // ou un crédit n'est PAS une ligne de facture négative — il vit
          // dans `billing_payments` (paiement) ou `account_adjustments`
          // (crédit compte). C'est ce qui a produit la ligne fantôme
          // « Paiement ID 7905998 = -126,47 » sur la commande 58953.
          if (kind === "custom_adjustment" && unit < 0) {
            throw new Error(
              `Ligne d'ajustement négative refusée ("${item?.name || "sans nom"}", ${unit}$). ` +
              `Un paiement reçu ou un crédit ne peut pas être une ligne de facture. ` +
              `Utilise "Enregistrer un paiement externe" ou "Appliquer un crédit compte".`
            );
          }

          const category = String(item?.category || "").toLowerCase() === "discount" ? "discount" : "fee";
          const name = String(item?.name || item?.label || (category === "fee" ? "Frais personnalisé" : "Crédit personnalisé"));
          lineItems.push({
            category,
            type: kind === "fulfillment_fee" ? (type || "delivery") : (type || "adjustment"),
            name,
            qty,
            unit_price: unit,
            period: "one_time",
            taxable: true,
          });
          if (kind === "fulfillment_fee") {
            if (type === "installation") explicitInstallationFee += unit * qty;
            else explicitDeliveryFee += unit * qty;
          } else {
            customAdjustmentTotal += unit * qty;
          }
        }

        // 4) Shipping fee — 20$ if auto-installation and no explicit fulfillment line was sent
        const installMode = String((sale as any)?.install_mode || "").toLowerCase();
        const shippingFee = explicitDeliveryFee === 0 && explicitInstallationFee === 0 && installMode === "self" ? 20 : 0;
        if (shippingFee > 0) {
          lineItems.push({
            category: "fee",
            type: "shipping",
            name: "Frais de livraison",
            qty: 1,
            unit_price: shippingFee,
            period: "one_time",
            taxable: true,
          });
        }

        const discountData: any = (sale as any).discount_data;
        const agentDiscountLine = computeAgentDiscountLine(discountData, monthlyTotal, activationFee);

        if (agentDiscountLine) {
          lineItems.push({
            category: "discount",
            type: "discount",
            name: agentDiscountLine.desc,
            qty: 1,
            unit_price: agentDiscountLine.amount,
            period: "one_time",
            taxable: true,
          });
          quoteAdjustmentProjected = true;
        }

        const saleSubtotalHint = quoteSubtotalHint;
        const saleTaxesHint = computeTaxes(saleSubtotalHint);
        const saleTotalHint = quoteTotalHint || numberFrom((sale as any)?.total_amount);
        const hasAuthoritativeSaleSubtotal = saleSubtotalHint > 0 && saleTotalHint > 0 && Math.abs(saleTaxesHint.total - saleTotalHint) <= 0.05;

        if (!quoteAdjustmentProjected && hasAuthoritativeSaleSubtotal && monthlyTotal > 0) {
          const projectedBaseBeforeWelcome = monthlyTotal + equipmentTotal + activationFee + explicitDeliveryFee + explicitInstallationFee + shippingFee + customAdjustmentTotal;
          const welcomeCredit = Number((projectedBaseBeforeWelcome - saleSubtotalHint).toFixed(2));
          if (welcomeCredit > 0 && welcomeCredit <= monthlyTotal + 0.05) {
            lineItems.push({
              category: "discount",
              type: "first_month_free",
              name: `1er mois offert ✓ (automatique) — ${welcomeCredit.toFixed(2)}$/mois`,
              qty: 1,
              unit_price: -welcomeCredit,
              period: "one_time",
              taxable: true,
            });
            quoteAdjustmentProjected = true;
          }
        }

        // Base fees model aligned to orders schema
        let subtotal = monthlyTotal + equipmentTotal;
        const deliveryFee = shippingFee + explicitDeliveryFee;
        const installationFee = explicitInstallationFee;


        // Taxes (Quebec) — canonical tax module.
        // ⛔ La commande est la SEULE source de vérité. Aucune dérivation
        // "à l'envers" depuis un total cible. Aucune ligne fabriquée pour
        // combler un écart. Si le total agent diffère des lignes réelles,
        // la synchro échoue et l'ordre reste bloqué en `sync_error`.
        const projectedDiscountTotal = lineItems
          .filter((li) => li.category === "discount")
          .reduce((sum, li) => sum + (Number(li.unit_price || 0) * (Number(li.qty || 1) || 1)), 0);
        const baseAmount = Number((subtotal + activationFee + deliveryFee + installationFee + customAdjustmentTotal + projectedDiscountTotal).toFixed(2));
        const { tps: tpsAmount, tvq: tvqAmount, total: totalAmount } = computeTaxes(baseAmount);

        const invoiceLineKind = (li: any): string => {
          if (li.category === "discount") return "discount";
          if (li.category === "equipment") return "equipment";
          if (li.category === "service") return "product_recurring";
          if (li.type === "activation") return "activation_fee";
          if (li.type === "shipping" || li.type === "delivery") return "shipping";
          if (li.type === "installation") return "installation_fee";
          return "manual_adjustment";
        };

        const orderItemServiceType = (li: any): string => {
          if (li.category === "equipment") return "equipment";
          if (li.category === "fee" || li.category === "discount") return "fee";
          const mapped = mapLineItemType(li.type || li.category || li.name);
          return ["internet", "tv", "mobile", "streaming", "security"].includes(mapped) ? mapped : "addon";
        };

        const agentTotal = Number(sale.total_amount || 0);
        if (agentTotal > 0 && Math.abs(agentTotal - totalAmount) > 0.05) {
          throw new Error(
            `Incohérence de total : lignes vendues = ${totalAmount.toFixed(2)}$ ` +
            `vs total saisi par l'agent = ${agentTotal.toFixed(2)}$. ` +
            `La facture ne sera pas maquillée. Corrige les lignes vendues avant resynchronisation.`
          );
        }


        // â•â•â• RESOLVE OR CREATE ACCOUNT (orders.account_id is NOT NULL) â•â•â•
        let accountId: string | null = null;

        if (staffAccount?.id) {
          accountId = staffAccount.id;
          console.log(`[field-sales-sync] Staff tunnel forced account ${accountId} for client ${clientUserId}`);
        } else {
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

            // Always keep profile.account_number in sync with the active account
            const { data: acctRow } = await supabaseAdmin
              .from("accounts")
              .select("account_number")
              .eq("id", accountId)
              .maybeSingle();
            if (acctRow?.account_number) {
              await supabaseAdmin
                .from("profiles")
                .update({ account_number: String(acctRow.account_number) })
                .eq("user_id", clientUserId!)
                .neq("account_number", String(acctRow.account_number));
            }
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
        }

        const agentName = repProfile?.full_name || "Agent terrain";
        const agentNumber = (repProfile as any)?.agent_number || "N/A";
        const agentProEmail = (repProfile as any)?.professional_email || repProfile?.email || "";

        if (!canonicalOrder) {
          // Generate order number from DB sequence â€” Core is sole source of truth
          const orderNumber = await generateOrderNumberFromDB(supabaseAdmin);
          const serviceTypeLabel = normalizeServiceTypeLabel(services);

          // BUG-CORE-002C Phase 2 — persist canonical fulfillment intent on orders
          const rawInstallModeForOrder = String((sale as any)?.install_mode || "").toLowerCase().trim();
          let orderFulfillmentType: string | null = null;
          let orderInstallationType: string | null = null;
          if (rawInstallModeForOrder === "technician") {
            orderFulfillmentType = "technician";
            orderInstallationType = "technician";
          } else if (rawInstallModeForOrder === "self") {
            orderFulfillmentType = "self_install";
            orderInstallationType = "auto";
          }

          // Create order in main orders table (match actual schema)
          const { data: newOrder, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
              user_id: clientUserId,
              account_id: accountId,
              service_address_id: staffServiceAddress?.id || null,
              order_number: orderNumber,
              created_by: 'field_sales',

              // â•â•â• AGENT IDENTITY â€” required for commissions + reporting â•â•â•
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

              subtotal: Number((baseAmount - activationFee - deliveryFee - installationFee).toFixed(2)),
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

              fulfillment_type: orderFulfillmentType,
              installation_type: orderInstallationType,



              notes: `Vente terrain â€” Agent: ${agentName} (ID: ${sale.id})\nClient: ${sale.customer_name || customerEmail}\nTéléphone: ${sale.customer_phone || 'â€”'}\nAdresse: ${sale.customer_address || 'â€”'}, ${sale.customer_city || ''} ${sale.customer_postal_code || ''}`.trim(),
              internal_notes: `[VENTE TERRAIN]\nPar: ${agentName} (${repProfile?.email || 'â€”'})\n${sale.internal_notes || ''}`.trim(),
            })
            .select('id, order_number, status')
            .single();

          if (orderError) {
            console.error(`[field-sales-sync] Error creating order:`, orderError);
            throw orderError;
          }

          canonicalOrder = newOrder;
          console.log(`[field-sales-sync] Created order ${canonicalOrder.order_number} for sale ${sale.id} by agent ${agentName}`);

          // ── BUG-CORE-002C Phase 1: reserve `appointments` hold ONLY for technician installs ──
          //   install_mode mapping (BUG-CORE-002C):
          //     "self"       → installation_method = "auto"       → NO appointment (ship only)
          //     "technician" → installation_method = "technician" → hold appointment created
          //   Any other value is rejected (no hold, warning logged).
          try {
            const requiresInstall = Array.isArray(sale.services) && sale.services.some(
              (s: any) => ["internet", "tv"].includes(String(s?.category || "").toLowerCase())
            );
            const rawInstallMode = String((sale as any)?.install_mode || "").toLowerCase().trim();
            let installationMethod: "auto" | "technician" | null = null;
            if (rawInstallMode === "technician") installationMethod = "technician";
            else if (rawInstallMode === "self") installationMethod = "auto";
            else if (rawInstallMode) {
              console.warn(`[field-sales-sync] invalid install_mode='${rawInstallMode}' for sale ${sale.id} — no hold created`);
            }

            const rawDate: string | null = sale.appointment_date || sale.install_date || null;
            const slotDate: string | null = rawDate ? String(rawDate).slice(0, 10) : null;
            const slotWindow: string | null = sale.appointment_notes || null;

            // Hold ONLY if technician install + installable service + valid slot.
            if (
              installationMethod === "technician" &&
              requiresInstall &&
              slotDate &&
              slotWindow &&
              /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(slotWindow)
            ) {
              const startTime = slotWindow.split("-")[0];
              const scheduledAt = new Date(`${slotDate}T${startTime}:00`).toISOString();
              const { data: existingAppt } = await supabaseAdmin
                .from("appointments")
                .select("id")
                .eq("order_id", canonicalOrder.id)
                .maybeSingle();
              if (!existingAppt) {
                const { error: apptErr } = await supabaseAdmin
                  .from("appointments")
                  .insert({
                    order_id: canonicalOrder.id,
                    client_id: clientUserId,
                    service_address_id: staffServiceAddress?.id || null,
                    client_email: customerEmail,
                    client_phone: sale.customer_phone || null,
                    service_address: sale.customer_address || null,
                    service_city: sale.customer_city || null,
                    service_postal_code: sale.customer_postal_code || null,
                    title: `Installation — ${canonicalOrder.order_number}`,
                    scheduled_at: scheduledAt,
                    status: "hold",
                    service_type: serviceTypeLabel,
                    installation_method: installationMethod,
                    created_by: sale.salesperson_id || null,
                    internal_notes: `[BUG-CORE-002C] Hold technicien créé depuis vente terrain • sale=${sale.id} • window=${slotWindow} • install_mode=${rawInstallMode}`,
                  } as any);
                if (apptErr) {
                  console.warn(`[field-sales-sync] appointment hold insert failed (non-blocking):`, apptErr.message);
                } else {
                  console.log(`[field-sales-sync] technician hold created for order ${canonicalOrder.order_number} @ ${scheduledAt}`);
                }
              }
            } else if (installationMethod === "auto") {
              console.log(`[field-sales-sync] auto-install sale ${sale.id} — no appointment hold (ship-only path)`);
            }
          } catch (holdErr) {
            console.warn(`[field-sales-sync] appointment hold exception (non-blocking):`, holdErr);
          }
        } else {
          // Existing/orphan field order: force it back onto the canonical client/account.
          // This prevents future portal-empty cases where Field created a temporary user_id
          // but the real client profile already exists for the same email.
          const { data: repairedOrder, error: repairOrderError } = await supabaseAdmin
            .from('orders')
            .update({
              user_id: clientUserId,
              account_id: accountId,
              service_address_id: staffServiceAddress?.id || null,
              client_email: customerEmail,
              client_phone: sale.customer_phone || null,
              client_first_name: customerFirstName || null,
              client_last_name: customerLastName || null,
              source: 'field_sales',
              created_by_agent_id: sale.salesperson_id,
              agent_name: agentName,
            })
            .eq('id', canonicalOrder.id)
            .select('id, order_number, status')
            .single();

          if (repairOrderError || !repairedOrder) {
            throw new Error(`Order identity repair failed: ${repairOrderError?.message || "order not found"}`);
          }

          canonicalOrder = repairedOrder;
        }

        const { count: existingOrderItemCount, error: orderItemsCountError } = await supabaseAdmin
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .eq("order_id", canonicalOrder.id);

        if (orderItemsCountError) {
          throw new Error(`Order items check failed: ${orderItemsCountError.message}`);
        }

        if ((existingOrderItemCount ?? 0) === 0) {
          const orderItems = lineItems.map((li, index) => ({
            order_id: canonicalOrder.id,
            item_number: index + 1,
            service_type: orderItemServiceType(li),
            plan_code: `${String(li.category || "item").toUpperCase()}-${index + 1}`,
            plan_name: li.name,
            description: li.name,
            unit_price: Number(li.unit_price || 0),
            quantity: Number(li.qty || 1) || 1,
            line_total: Number(li.unit_price || 0) * (Number(li.qty || 1) || 1),
            is_recurring: li.period === "monthly",
            status: "pending",
            fulfillment_type: li.category === "equipment" || li.type === "shipping" || li.type === "delivery" ? "ship" : li.type === "installation" ? "technician" : null,
            metadata: { source: "field_sales_sync", source_ref: li.category === "discount" ? "promotion_applied" : "manual_admin", line_kind: invoiceLineKind(li) },
          }));

          const { error: orderItemsInsertError } = await supabaseAdmin
            .from("order_items")
            .insert(orderItems as any);

          if (orderItemsInsertError) {
            throw new Error(`Order items creation failed: ${orderItemsInsertError.message}`);
          }
        }

        const { data: primaryOrderItem } = await supabaseAdmin
          .from("order_items")
          .select("id")
          .eq("order_id", canonicalOrder.id)
          .eq("is_recurring", true)
          .order("item_number", { ascending: true })
          .limit(1)
          .maybeSingle();

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

        // â•â•â• CANONICAL INVOICE + PAYMENT CREATION â•â•â•
        // Field orders must enter the same billing pipeline as website orders
        let invoiceId: string | null = null;
        let paymentId: string | null = null;
        let billingCustomerId: string | null = null;

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
              subtotal: baseAmount,
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
              notes: `Commande terrain â€” Agent: ${agentName} (${agentNumber})`,
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

            // Create invoice lines in one statement so the deferred invoice/order
            // integrity trigger sees the complete invoice, not a partial first line.
            const invoiceLines = lineItems.map((li) => ({
                invoice_id: invoiceId,
                description: li.name,
                unit_price: li.unit_price,
                quantity: li.qty,
                line_total: li.unit_price * li.qty,
                line_type: li.category === "equipment" ? "equipment" : li.category === "fee" ? "fee" : li.category === "discount" ? "discount" : "service",
                source_ref: li.category === "discount" ? "promotion_applied" : "manual_admin",
                line_kind: invoiceLineKind(li),
                service_address_id: staffServiceAddress?.id || null,
            }));
            const { error: lineErr } = await supabaseAdmin.from("billing_invoice_lines").insert(invoiceLines);
            if (lineErr) {
              throw new Error(`Invoice line creation failed: ${lineErr.message}`);
            }

            // RULE 1 â€” Premier mois gratuit automatique UNIQUEMENT pour les
            // clients qui n'ont jamais reçu le rabais (vérifié via la fonction
            // canonique is_eligible_for_welcome_first_month).
            const agentDiscountIsFirstMonth =
              discountData && String(discountData.type || "") === "first_month_free";

            let welcomeEligible = false;
            if (monthlyTotal > 0 && !agentDiscountIsFirstMonth && !quoteAdjustmentProjected) {
              const { data: eligData, error: eligErr } = await supabaseAdmin.rpc(
                "is_eligible_for_welcome_first_month",
                { p_user_id: clientUserId ?? null, p_email: sale.customer_email ?? null },
              );
              if (eligErr) {
                console.error("[field-sales-sync] welcome eligibility check failed", eligErr);
              } else {
                welcomeEligible = eligData === true;
              }
            }

            if (welcomeEligible) {
              const { error: autoFmErr } = await supabaseAdmin
                .from("billing_invoice_lines")
                .insert({
                  invoice_id: invoiceId,
                  description: `1er mois offert âœ“ (automatique) â€” ${monthlyTotal.toFixed(2)}$/mois`,
                  unit_price: -monthlyTotal,
                  quantity: 1,
                  line_total: -monthlyTotal,
                  line_type: "discount",
                  source_ref: "promotion_applied",
                  line_kind: "discount",
                  service_address_id: staffServiceAddress?.id || null,
                });
              if (autoFmErr) {
                console.error("[field-sales-sync] auto first-month line insert failed:", autoFmErr);
              }
            }

            // Discount line (if applied at the door â€” second/additional discount)
            if (discountData && !quoteAdjustmentProjected) {
              const pendingDiscountLine = computeAgentDiscountLine(discountData, monthlyTotal, activationFee);

              if (pendingDiscountLine) {
                const { error: discLineErr } = await supabaseAdmin.from("billing_invoice_lines").insert({
                  invoice_id: invoiceId,
                  description: pendingDiscountLine.desc,
                  unit_price: pendingDiscountLine.amount,
                  quantity: 1,
                  line_total: pendingDiscountLine.amount,
                  line_type: "discount",
                  source_ref: "promotion_applied",
                  line_kind: "discount",
                  service_address_id: staffServiceAddress?.id || null,
                });
                if (discLineErr) {
                  console.error("[field-sales-sync] discount line insert failed:", discLineErr);
                }
              }
            }

            const { data: payNum, error: payNumErr } = await supabaseAdmin.rpc("generate_payment_number");
            const paymentNumber = payNumErr || !payNum ? `PAY-FS-${Date.now().toString(36).toUpperCase()}` : String(payNum);

            // Determine payment method for billing_payments enum
            const normalizedSalePaymentMethod = String(sale.payment_method || "").toLowerCase();
            const billingPaymentMethod = normalizedSalePaymentMethod === "interac" ? "interac"
              : ["card", "card_manual", "square"].includes(normalizedSalePaymentMethod) ? "card"
              : "interac"; // default for deferred
            const billingPaymentProvider = normalizedSalePaymentMethod === "interac" ? "interac"
              : ["card", "card_manual", "square"].includes(normalizedSalePaymentMethod) ? "square"
              : "manual";

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
                  provider: billingPaymentProvider,
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

                // ── Auto-note: paiement reçu (vente terrain) ──
                await writePaymentAutoNote({
                  supabase: supabaseAdmin,
                  billingCustomerId,
                  clientAuthUserId: clientUserId,
                  amount: totalAmount,
                  method: billingPaymentMethod,
                  provider: billingPaymentProvider,
                  invoiceNumber: invoiceNum,
                  invoiceId,
                  paymentNumber,
                  channel: "Vente terrain (Field)",
                });
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
                  document_name: `Contrat de service â€” ${canonicalOrder.order_number || canonicalOrder.id.slice(0, 8)}`,
                  document_url: "",
                });
              } catch (docErr) {
                console.error("[field-sales-sync] client_documents mirror failed:", docErr?.message || docErr);
              }

              // BUG 4 FIX — Do NOT enqueue a separate "contract_generated" email
              // here. send-order-confirmation below is the single source of the
              // order confirmation email (corporate blue template + attached
              // contract + summary PDFs). Duplicate emails removed.

            }
          }
        } catch (billingErr) {
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

        // â•â•â• ENSURE A RECURRING SUBSCRIPTION EXISTS â•â•â•
        // Field orders must leave the sync with a real billing subscription.
        // If Core already activated the order, the subscription must be active
        // with cycle dates now â€” never a blank/pending orphan.
        try {
          if (monthlyTotal > 0) {
            const { data: existingSubRow } = await supabaseAdmin
              .from("billing_subscriptions")
              .select("id, status, plan_price")
              .eq("order_id", canonicalOrder.id)
              .maybeSingle();

            const today = new Date();
            const todayISO = today.toISOString().split("T")[0];
            const nextRenewal = new Date(today);
            nextRenewal.setMonth(nextRenewal.getMonth() + 1);
            const nextRenewalISO = nextRenewal.toISOString().split("T")[0];
            const primaryRecurring = lineItems.find((li) => li.period === "monthly");
            const orderIsActivated = ["activated", "completed", "delivered"].includes(String(canonicalOrder.status || "").toLowerCase());
            const subscriptionPayload = {
              customer_id: billingCustomerId,
              order_id: canonicalOrder.id,
              source_order_item_id: primaryOrderItem?.id || null,
              service_address_id: staffServiceAddress?.id || null,
              plan_code: primaryRecurring?.type || services?.[0]?.category || "service",
              plan_name: primaryRecurring?.name || services?.[0]?.name || "Service",
              plan_price: primaryRecurring?.unit_price ?? monthlyTotal,
              status: orderIsActivated ? "active" : "pending",
              cycle_start_date: orderIsActivated ? todayISO : null,
              cycle_end_date: orderIsActivated ? nextRenewalISO : null,
              billing_cycle_anchor: orderIsActivated ? today.toISOString() : null,
              next_renewal_at: orderIsActivated ? nextRenewal.toISOString() : null,
              auto_billing_enabled: orderIsActivated,
              environment: "live",
              source_type: "field_sales",
            };

            // Phase 6A — canonical gateway (upsert)
            const { error: upsertErr } = await supabaseAdmin.rpc(
              "rpc_admin_upsert_field_sales_subscription",
              { p_order_id: canonicalOrder.id, p_payload: subscriptionPayload }
            );
            if (upsertErr) {
              console.error(
                `[field-sales-sync] subscription ${existingSubRow ? "repair" : "pre-create"} failed:`,
                upsertErr.message
              );
            } else {
              console.log(
                `[field-sales-sync] Subscription ${existingSubRow ? "repaired" : "created"} for order ${canonicalOrder.order_number}`
              );
            }
          }
        } catch (subErr) {
          console.error("[field-sales-sync] subscription creation error:", subErr?.message || subErr);
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

        // â•â•â• COMMISSION ENGINE â€” Base % + tier lookup â•â•â•
        // Commission is created with status 'pending_activation' â€” only unlocked when order reaches 'activated'
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
                notes: `Auto: ${(commissionRate * 100).toFixed(0)}% Ã— ${monthlyTotal.toFixed(2)}$ = ${baseCommission.toFixed(2)}$${bonusAmount > 0 ? ` + bonus ${bonusAmount.toFixed(2)}$` : ""} | Tier: ${salesCount} ventes`,
                created_at: new Date().toISOString(),
              }, {
                onConflict: "field_order_id",
                ignoreDuplicates: false,
              });

            // F31-6 — field_commissions creation is delegated to the canonical
            // idempotent helper. Safe to call on every path (create, update,
            // resync); no-ops when payment isn't captured or when the row
            // already exists (unique index on order_id + commission_type).
            const ensured = await ensureFieldCommissionAfterCapture(supabaseAdmin, {
              sale_id: sale.id,
              reason: "field-sales-sync:create-path",
            });
            console.log(`[field-sales-sync] F31-6 ensureFieldCommission → ${ensured.status}`);

            console.log(`[field-sales-sync] Commission created: ${totalCommission.toFixed(2)}$ (rate: ${(commissionRate * 100).toFixed(0)}%, bonus: ${bonusAmount}) for agent ${sale.salesperson_id}`);
          }
        } catch (commErr) {
          console.error("[field-sales-sync] Commission engine error (non-blocking):", commErr);
        }

        // Send official order confirmation only after a confirmed payment.
        // Pending QR/direct-link shells must not email the client unless the
        // agent explicitly selected the email payment option.
        if (sale.payment_status === "confirmed") {
          try {
            await supabaseAdmin.functions.invoke("send-order-confirmation", {
              body: { order_id: canonicalOrder.id },
            });
            console.log(`[field-sales-sync] send-order-confirmation invoked for ${canonicalOrder.id}`);
          } catch (emailErr) {
            console.error("[field-sales-sync] send-order-confirmation failed (non-blocking):", emailErr?.message || emailErr);
          }
        }

        // Auto-installation: also send the self-install email with PDF guides
        const installType = String((sale as any)?.installation_type || (sale as any)?.install_type || "").toLowerCase();
        if (installType === "auto" || installType === "self" || installType === "self_install") {
          try {
            await supabaseAdmin.functions.invoke("send-auto-installation-email", {
              body: { order_id: canonicalOrder.id },
            });
          } catch (emailErr) {
            console.error("[field-sales-sync] auto-install email failed (non-blocking):", emailErr?.message || emailErr);
          }
        }



        return { 
          success: true, 
          orderId: canonicalOrder.id, 
          order_number: canonicalOrder.order_number || undefined,
          invoice_id: invoiceId ?? undefined,
          payment_id: paymentId ?? undefined,
        };

      } catch (error) {
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

    if (action === 'materialize_from_quote' && body.quote_id) {
      const { data: quote, error: quoteError } = await supabaseAdmin
        .from('field_quotes')
        .select('*')
        .eq('id', body.quote_id)
        .maybeSingle();
      if (quoteError || !quote) {
        return new Response(JSON.stringify({ success: false, error: 'Soumission Field introuvable' }), { status: 404, headers: buildCorsHeaders(req) });
      }

      const ci: any = quote.client_info || {};
      const staffTunnelTag = ci.existing_account_id
        ? `[STAFF_TUNNEL account_id=${ci.existing_account_id}${ci.existing_service_address_id ? ` service_address_id=${ci.existing_service_address_id}` : ""} ] `
        : "";
      const customerName = `${ci.first_name || ci.firstName || ''} ${ci.last_name || ci.lastName || ''}`.trim() || body.customer_name || 'Client Field';
      const fieldServices = [
        ...((Array.isArray(quote.services) ? quote.services : []) as any[]),
        ...((Array.isArray(quote.equipment) ? quote.equipment : []) as any[]),
        ...(ci.delivery_fee || ci.installation_fee ? [{
          id: `fulfillment-${ci.delivery_mode || ci.install_mode || "manual"}`,
          kind: "fulfillment_fee",
          category: "fee",
          type: Number(ci.installation_fee || 0) > 0 ? "installation" : "delivery",
          name: Number(ci.installation_fee || 0) > 0
            ? "Installation technicien"
            : (ci.delivery_mode === "express" ? "Livraison Express — Uber Direct" : "Auto-installation — livraison standard"),
          quantity: 1,
          price: Number(ci.installation_fee || ci.delivery_fee || 0),
          price_setup: Number(ci.installation_fee || ci.delivery_fee || 0),
          price_monthly: 0,
          monthly_price: 0,
        }] : []),
        ...((ci.custom_adjustments || (quote as any).custom_adjustments || []) as any[]).map((adjustment: any) => {
          const amount = Math.max(0, Number(adjustment?.amount || 0));
          const signedAmount = adjustment?.kind === "fee" ? amount : -amount;
          return {
            id: adjustment?.id || crypto.randomUUID(),
            kind: "custom_adjustment",
            category: adjustment?.kind === "fee" ? "fee" : "discount",
            type: adjustment?.kind || "credit",
            name: adjustment?.label || (adjustment?.kind === "fee" ? "Frais personnalisé" : "Crédit personnalisé"),
            quantity: 1,
            price: signedAmount,
            price_setup: signedAmount,
            price_monthly: 0,
            monthly_price: 0,
          };
        }),
      ];

      const { data: sale, error: saleError } = await supabaseAdmin
        .from('field_sales_orders')
        .insert({
          salesperson_id: body.agent_id || quote.agent_id,
          customer_name: customerName,
          customer_email: ci.email || body.customer_email || null,
          customer_phone: ci.phone || null,
          customer_address: ci.address || null,
          customer_city: ci.city || null,
          customer_postal_code: ci.postal_code || ci.postalCode || null,
          customer_date_of_birth: ci.date_of_birth || ci.dob || null,
          install_date: quote.install_date || ci.install_date || null,
          install_mode: quote.install_mode || ci.install_mode || null,
          services: fieldServices,
          total_amount: Number(body.square_amount || body.amount || quote.total || 0),
          payment_method: body.payment_method || 'card',
          payment_reference: body.payment_reference || body.square_payment_id || null,
          payment_status: 'confirmed',
          sync_status: 'pending',
          discount_data: quote.discount || null,
          source_quote_id: quote.id,
          internal_notes: `${staffTunnelTag}Field quote ${quote.id} matérialisée automatiquement après paiement ${body.payment_method || 'card'}`.trim(),
        })
        .select('*')
        .single();
      if (saleError || !sale) throw saleError ?? new Error('Création vente Field échouée');

      const result = await syncSaleToOrders(sale);
      await supabaseAdmin.from('field_quotes').update({ status: 'converted', converted_order_id: result.orderId ?? null }).eq('id', quote.id);
      await supabaseAdmin.from('field_payment_intents').update({
        converted_field_order_id: sale.id,
        converted_order_id: result.orderId ?? null,
        converted_invoice_id: result.invoice_id ?? null,
      }).eq('quote_id', quote.id).is('converted_order_id', null);
      return new Response(JSON.stringify({ ...result, field_order_id: sale.id, order_id: result.orderId }), { status: result.success ? 200 : 500, headers: buildCorsHeaders(req) });
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
        } catch (error) {
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

  } catch (error) {
    console.error('[field-sales-sync] Error:', error);
    reportEdgeError(error, { function: 'field-sales-sync' }).catch(() => {});
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: buildCorsHeaders(req) }
    );
  }
});
