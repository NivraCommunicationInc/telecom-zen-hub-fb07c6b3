/**
 * ensureFieldCommissionAfterCapture — Canonical idempotent handler for
 * creating a `field_commissions` row ONCE the payment has been captured
 * (payment_status = 'confirmed').
 *
 * Called from:
 *  - field-sales-sync (post initial-create + on resync `sync_single`)
 *  - square-charge-invoice (right after Square capture succeeds)
 *  - square-webhook (payment.updated → COMPLETED, safety net)
 *
 * Idempotency:
 *  - Enforced at DB level by the unique partial index
 *    `field_commissions_order_type_uidx` on (order_id, commission_type)
 *    WHERE order_id IS NOT NULL.
 *  - We also SELECT first to avoid the round-trip when the row already
 *    exists, and to know whether we actually created it (for the audit).
 *
 * Trace: any post-capture creation writes an `activity_logs` row of type
 * `field_commission_created_post_capture` so QA can prove the commission
 * appeared AFTER Square captured (F31-6).
 */
// deno-lint-ignore-file no-explicit-any

const COMMISSION_TYPE = "field_sale";

export interface EnsureFieldCommissionInput {
  sale_id: string;
  reason?: string;
  square_payment_id?: string | null;
}

export interface EnsureFieldCommissionResult {
  ok: boolean;
  status:
    | "created"
    | "already_exists"
    | "skipped_not_confirmed"
    | "skipped_no_order"
    | "skipped_no_commission_row"
    | "error";
  commission_id?: string;
  order_id?: string;
  amount?: number;
  detail?: string;
}

export async function ensureFieldCommissionAfterCapture(
  supabaseAdmin: any,
  input: EnsureFieldCommissionInput,
): Promise<EnsureFieldCommissionResult> {
  try {
    const { data: sale, error: saleErr } = await supabaseAdmin
      .from("field_sales_orders")
      .select("id, salesperson_id, payment_status, converted_order_id")
      .eq("id", input.sale_id)
      .maybeSingle();

    if (saleErr || !sale) {
      return { ok: false, status: "error", detail: saleErr?.message || "sale_not_found" };
    }

    if (sale.payment_status !== "confirmed") {
      return { ok: true, status: "skipped_not_confirmed" };
    }

    // Resolve canonical order id
    let orderId: string | null = sale.converted_order_id ?? null;
    if (!orderId) {
      const { data: ord } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("field_sales_order_id", sale.id)
        .maybeSingle();
      orderId = ord?.id ?? null;
    }
    if (!orderId) {
      return { ok: true, status: "skipped_no_order" };
    }

    // Idempotency short-circuit
    const { data: existing } = await supabaseAdmin
      .from("field_commissions")
      .select("id, amount")
      .eq("order_id", orderId)
      .eq("commission_type", COMMISSION_TYPE)
      .maybeSingle();
    if (existing) {
      return { ok: true, status: "already_exists", commission_id: existing.id, order_id: orderId, amount: Number(existing.amount) };
    }

    // Reuse the sales_commissions row already computed by field-sales-sync
    // (it holds the tier/bonus-adjusted total for this sale).
    const { data: salesComm } = await supabaseAdmin
      .from("sales_commissions")
      .select("commission_amount, salesperson_id")
      .eq("field_order_id", sale.id)
      .maybeSingle();

    const amount = Number(salesComm?.commission_amount ?? 0);
    const agentId = salesComm?.salesperson_id ?? sale.salesperson_id;
    if (!agentId || amount <= 0) {
      return { ok: true, status: "skipped_no_commission_row" };
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("field_commissions")
      .insert({
        agent_id: agentId,
        amount,
        status: "pending",
        commission_type: COMMISSION_TYPE,
        earned_at: new Date().toISOString(),
        order_id: orderId,
        notes: `post-capture (${input.reason ?? "auto"})${input.square_payment_id ? ` sq=${input.square_payment_id}` : ""}`,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      // Unique-violation → another concurrent handler created it: treat as success.
      if (String(insErr.code) === "23505" || /duplicate key/i.test(insErr.message ?? "")) {
        return { ok: true, status: "already_exists", order_id: orderId };
      }
      return { ok: false, status: "error", detail: insErr.message };
    }

    // Audit trace — proves the row was created AFTER capture (F31-6).
    try {
      await supabaseAdmin.from("activity_logs").insert({
        user_id: agentId,
        action: "field_commission_created_post_capture",
        entity_type: "field_commission",
        entity_id: inserted?.id ?? orderId,
        actor_role: "system",
        actor_name: "ensureFieldCommissionAfterCapture",
        details: {
          sale_id: sale.id,
          order_id: orderId,
          amount,
          reason: input.reason ?? null,
          square_payment_id: input.square_payment_id ?? null,
        },
      });
    } catch (_) { /* non-blocking */ }

    return { ok: true, status: "created", commission_id: inserted?.id, order_id: orderId, amount };
  } catch (e: any) {
    return { ok: false, status: "error", detail: e?.message ?? String(e) };
  }
}
