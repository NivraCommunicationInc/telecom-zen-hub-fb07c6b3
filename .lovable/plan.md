## Scope

These 6 fixes touch the entire Field→Core pipeline. Splitting into safe, reviewable chunks.

## Confirmed blocker (from prior audit)
- 7 `field_payment_intents` rows are stuck `pending`, none captured.
- `field-payment-initiate` writes `custom_id = "fpi:<intent_id>"` to PayPal.
- `paypal-capture-order` does NOT look at `custom_id` for the `fpi:` prefix → never bridges to `field-sales-sync` → no `orders` row → Core sees nothing.
- No `field_submissions` table exists.
- No `/payer/:intentId` public page exists.

## Phase A — Pipeline (FIX 1) ⭐ unblocks everything

**Edit `supabase/functions/paypal-capture-order/index.ts`** (no rewrite, additive block right after capture validates ~line 197):
1. Detect `custom_id` matching `^fpi:` → extract `intent_id`.
2. If matched, branch into a Field-sale handler:
   - Load `field_payment_intents` + linked `field_quotes`.
   - Build a `field_sales_orders` row from quote (`services`, `client_info`, `total`, `salesperson_id=agent_id`, `payment_method='paypal'`, `payment_status='confirmed'`, `payment_reference=captureId`).
   - `fetch` `field-sales-sync` with `{action:'sync_single', sale_id}` using service-role auth.
   - On success: update `field_payment_intents` → `status='completed'`, `converted_field_order_id`, `converted_order_id`, `paid_at=now()`.
   - Insert `field_commissions` row `status='pending'` (amount = quote.total × commission rule, or simple placeholder if rule lookup fails — match existing trigger behavior).
   - Return early (skip the regular `billing_invoices` branch which would orphan-alert).
3. If no `fpi:` prefix, original flow unchanged.

**Frontend (`FieldNewSale.tsx`)** — no change needed; the existing realtime poll on `field_payment_intents.status` already drives the UI. (Protected: do not touch StepPaymentPaypal timer.)

## Phase B — Public payment page (FIX 2)

**New file `src/pages/PayerCommande.tsx`**:
- Loads `field_payment_intents` + nested `field_quotes` by `:intentId` (anon-readable; need RLS policy).
- Renders Nivra-branded summary: client, services, equipment, discount, subtotal/TPS/TVQ/total.
- Buttons:
  - "Payer avec PayPal" → `window.location = intent.paypal_approval_url`.
  - "Recevoir un nouveau lien" → invoke a new `field-payment-resend` edge function (or reuse email_queue insert with anon RLS — safer to add edge function).
- States: `completed` → success card; `cancelled`/expired → contact card.

**Migration**: RLS policy on `field_payment_intents` + `field_quotes` allowing `SELECT` by `id` for anon (or via SECURITY DEFINER RPC `get_field_payment_intent_public(p_id)`). Prefer RPC to avoid broad RLS.

**Route**: add `<Route path="/payer/:intentId" element={<PayerCommande />} />` to `AppRoutes.tsx` outside of any auth guard.

**FieldNewSale.tsx**: change `payment_url` in email payloads from `approvalUrl` to `https://nivra-telecom.ca/payer/${data.intent_id}` (2 places: initial send + resend callback).

## Phase C — Core orders UI (FIX 3)

**Edit `src/core-app/hooks/useAdminOrders.ts`**:
- Extend `select` with `source, created_by_agent_id`.
- After fetching profiles, also fetch `profiles` for `created_by_agent_id` set; expose `agent_full_name`, `source` on `AdminOrder`.

**Edit `src/core-app/pages/OrdersPage.tsx`**:
- Add purple badge "Field Sales — Porte-à-porte" when `o.source === 'field_sales'`.
- Show "Agent: {agent_full_name}" line under client name.
- Add filter chip "Field Sales" that sets a new `sourceFilter`.
- Add `usePortalRealtime(['orders','field_payment_intents'], [['admin-orders-v2', envFilter]])`.

## Phase D — Reminder template + cron (FIX 5)

- Verify `field_payment_reminder` template exists in `customQueueTemplates.ts` (it does, line 1684) — confirm it uses `shell()` Violet Bold and add the `payment_url` pointing to `/payer/{intentId}`. If template body uses raw approval URL, update it to use `payment_url` var.
- Update `payment-reminder/index.ts` so `payment_url` = `https://nivra-telecom.ca/payer/${intent.id}` (not raw PayPal URL).
- Verify cron via `supabase--insert` if missing: `SELECT cron.schedule('daily-payment-reminder','0 10 * * *', ...)`.

## Phase E — Submission convert (FIX 4) — DEFERRED

`field_submissions` table does not exist. Creating it duplicates `field_payment_intents` + `field_quotes`. Recommend re-using `field_quotes` with `status='pending_client'` + extending `expires_at` to 7 days, instead of new table. This requires confirming with you before adding the table or repurposing existing data. **Will skip in this round** unless you confirm.

## Phase F — 2FA bug (FIX 6) — DEFERRED

Need to first read `CoreLoginPage.tsx` MFA flow to identify the actual bug (challenge reuse vs. clock skew vs. wrong factor). Should be its own diagnostic round with logs, not blind code changes.

## What I will execute now

Phases **A, B, C, D** in this loop. Phase E and F flagged as deferred with explicit reasons above.

## Files touched
- `supabase/functions/paypal-capture-order/index.ts` (additive block)
- `supabase/functions/payment-reminder/index.ts` (payment_url change)
- `supabase/functions/_shared/customQueueTemplates.ts` (payment_url var only — protected from structural change)
- New: `supabase/functions/field-payment-public/index.ts` (RPC-style read + resend)
- New migration: SECURITY DEFINER `get_field_payment_intent_public`
- `src/pages/PayerCommande.tsx` (new)
- `src/components/AppRoutes.tsx` (add public route)
- `src/field-app/pages/FieldNewSale.tsx` (payment_url string only — does NOT touch StepPaymentPaypal)
- `src/core-app/hooks/useAdminOrders.ts` (add source + agent join)
- `src/core-app/pages/OrdersPage.tsx` (badge + filter + realtime)

## Protected — will not touch
- `StepPaymentPaypal.tsx` timer/countdown
- `FieldObjectives.tsx`, `RhObjectives.tsx`
- `customQueueTemplates.ts` Violet Bold shell logic / commission trigger
- Helmet imports / CancellationDialog

Proceed with Phases A-D? Confirm and I'll execute, or tell me to also include E/F.