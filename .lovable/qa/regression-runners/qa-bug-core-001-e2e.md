# QA Regression Runner — `qa-bug-core-001-e2e`

**Status:** Promoted from one-shot proof to permanent regression suite (post BUG-CORE-001 CLOSED).
**Location:** `supabase/functions/qa-bug-core-001-e2e/index.ts`
**Owner:** Nivra Core — Billing / Field Ops
**Related ticket:** BUG-CORE-001 (CLOSED)

---

## 1. Purpose

Prove end-to-end, without a real Square capture, that the Field → Core
materialization chain still works:

field_quote → payment_link (`shell_deferred:true` accepted) → email queued →
shell materialization (via retry cron OR inline auto-heal) → canonical
`apply_payment_to_invoice` RPC → order/invoice/intent flip → downstream
verification.

Any regression in the following files must re-run this runner:

- `supabase/functions/field-payment-link-create/index.ts`
- `supabase/functions/field-order-engine/index.ts`
- `supabase/functions/square-charge-invoice/index.ts` (SUCCESS branch shape)
- RPC `public.apply_payment_to_invoice`
- `field_order_sync_events` retry logic + pg_cron job
  `field-order-retry-shell-materialization`
- `fn_flag_incomplete_order` trigger

## 2. How to run

**Endpoint:** `POST https://<project>.functions.supabase.co/qa-bug-core-001-e2e`
**Auth:** Service-role key (Bearer). No user auth is used.
**Body:** `{}` — or `{ "agent_id": "<uuid>" }` to override the seeded QA agent.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/functions/v1/qa-bug-core-001-e2e" \
  -d '{}'
```

Typical run time: **~10–15 seconds**.

## 3. Prerequisites

Required env (already set on Cloud, listed for local/CI parity):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Required data seeds (checked before running — do not delete):

| Seed | UUID | Meaning |
|---|---|---|
| `SEED_AGENT_ID` | `cc9e952a-62d6-4b0c-bded-91f4b2d9ea8f` | Admin Nivra (field agent identity) |
| `SEED_SERVICE_ID` | `bf8fad95-9034-4e09-867a-bd9068ba727e` | Internet Giga plan |
| `SEED_EQUIPMENT_ID` | `cc911a88-a391-4f94-b6f4-9d312a4f9e18` | Borne WiFi Nivra |

Required infrastructure:

- Edge Functions `field-payment-link-create`, `field-order-engine`,
  `field-sales-sync` deployed.
- RPC `apply_payment_to_invoice` present with the canonical signature
  (`p_invoice_id`, `p_amount`, `p_provider`, `p_provider_payment_id`,
  `p_customer_id`, `p_source`, `p_method`).
- pg_cron job `field-order-retry-shell-materialization` enabled *(the
  runner also triggers retry inline via `retry_deferred_shell_materializations`,
  so the cron is not strictly required for the runner but must remain enabled
  for production).*

## 4. Cleanup / isolation

The runner is **isolation-by-construction** — every run creates its own
fixture keyed by timestamp:

- Client email: `qa-bug-core-001-<epoch_ms>@nivra-qa.local`
- All downstream rows (quote, intent, FSO, order, invoice, payment,
  subscription, email_queue) inherit that email as their traceable QA marker.
- Fixture is fully sandboxed — no shared row is mutated.

**Purge script (optional, run monthly):**

```sql
-- Reclaim QA fixtures older than 30 days
delete from public.email_queue        where lower(to_email) like 'qa-bug-core-001-%@nivra-qa.local' and created_at < now() - interval '30 days';
delete from public.billing_payments   where lower(reference) like 'qa-bug-core-001-%' and created_at < now() - interval '30 days';
delete from public.billing_invoices   where account_id in (select id from public.accounts where lower(email) like 'qa-bug-core-001-%@nivra-qa.local') and created_at < now() - interval '30 days';
delete from public.orders             where lower(client_email) like 'qa-bug-core-001-%@nivra-qa.local' and created_at < now() - interval '30 days';
delete from public.field_sales_orders where lower(client_email) like 'qa-bug-core-001-%@nivra-qa.local' and created_at < now() - interval '30 days';
delete from public.field_payment_intents where lower(client_email) like 'qa-bug-core-001-%@nivra-qa.local' and created_at < now() - interval '30 days';
delete from public.field_quotes       where lower(client_email) like 'qa-bug-core-001-%@nivra-qa.local' and created_at < now() - interval '30 days';
delete from public.accounts           where lower(email) like 'qa-bug-core-001-%@nivra-qa.local' and created_at < now() - interval '30 days';
```

No mutation of real client data is possible — the domain `@nivra-qa.local`
is reserved for QA and never used by real customers.

## 5. PASS / FAIL contract

The response body always returns HTTP 200 with a JSON report. **Automation
must key on `report.ok` — nothing else.**

```jsonc
{
  "correlation_id": "…",
  "bug": "BUG-CORE-001",
  "started_at": "…",
  "finished_at": "…",
  "ok": true,                       // ← PASS/FAIL flag
  "ids": {
    "order_number": "…",
    "invoice_number": "…",
    "payment_number": "…",
    "account_id": "…",
    "subscription_ids": [ "…" ],
    "subscription_numbers": [ "…" ]
  },
  "steps": [ /* per-step trace with ok/false */ ]
}
```

`report.ok` is `true` iff **all three invariants** hold in `verify_downstream`:

| Invariant | Meaning |
|---|---|
| `order_validated` | `orders.status='validated'` AND `payment_status='paid'` |
| `invoice_paid` | `billing_invoices.status='paid'` AND `balance_due=0` |
| `payment_completed` | `billing_payments.status ∈ {completed,succeeded,paid,confirmed}` |

Subscription creation is reported under `informational` only — it depends
on KYC + contract signing and is **out of scope** for this runner. Do not
gate PASS/FAIL on it.

**Fatal errors** (uncaught exceptions) return HTTP 500 with
`report.fatal` set. CI must treat any non-2xx OR `ok !== true` as FAIL.

## 6. CI integration (recommended)

Add to release gate — fail the pipeline if `.ok !== true`:

```bash
resp=$(curl -sS -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/functions/v1/qa-bug-core-001-e2e" -d '{}')
echo "$resp" | jq .
echo "$resp" | jq -e '.ok == true' > /dev/null || { echo "❌ BUG-CORE-001 regression"; exit 1; }
echo "✅ BUG-CORE-001 regression passed"
```

Recommended cadence: on every deploy of the modules listed in §1, plus
nightly.

## 7. What NOT to change

- **Do not** replace the auto-heal alignment step with a hardcoded total —
  it exists specifically to reproduce the historical BUG-CORE-001 mismatch
  ($80.48 vs $172.46) and prove the retry path.
- **Do not** bypass the `apply_payment_to_invoice` RPC — the runner mirrors
  `square-charge-invoice` byte-for-byte on purpose.
- **Do not** promote `informational.subscription_created` into the invariant
  set — that belongs to a separate BUG-CORE-001-BIS scope (KYC + contract).
