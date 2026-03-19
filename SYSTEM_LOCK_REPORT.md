# NIVRA SYSTEM LOCK REPORT

**Date:** 2026-03-19  
**Status:** ✅ ALL SYSTEMS LOCKED  
**Authority:** Production-Critical — No modifications without explicit approval

---

## 🔒 LOCKED SYSTEMS

| # | System | Lock Level | Enforced By |
|---|--------|-----------|-------------|
| 1 | Checkout Pricing & Promo | Code + DB + Test | `compute_checkout_pricing` RPC, `system-lock-invariants.test.ts` |
| 2 | PayPal Payment Flow | Code + DB + Test | Webhook signature verification, `invoice_id` requirement, tests |
| 3 | Invoice/Payment Canonical Mapping | Code + DB + Test | `pricing_snapshot` priority, `apply_payment_to_invoice` RPC, triggers |
| 4 | Client Portal Financial Displays | Code + Test | `pricing_snapshot ?? total_amount` fallback chain, tests |
| 5 | Nivra Core Financial Displays | Code + Test | `pricing_snapshot` in all Core panels, tests |
| 6 | Order Confirmation Page | Code + Test | `pricing_snapshot.grand_total` as SOLE authority, tests |
| 7 | Financial Email Templates | Code + Test | `resolveCanonicalFinancialVars`, `canonicalAmountPaidToday`, tests |
| 8 | Consent / Legal Evidence | Code + DB + Test | `checkout_consent_records` blocking insert, tests |
| 9 | Order/Payment Lifecycle Separation | Code + DB + Test | `trg_guard_order_lifecycle_no_skip` trigger, tests |

---

## 🧪 REGRESSION TEST SUITES

### `src/__tests__/system-lock-invariants.test.ts` (NEW — Master Lock)
- **30+ tests** covering all 9 locked systems
- Cross-cutting forbidden pattern detection
- Fails build if any locked invariant is violated

### `src/__tests__/billing-financial-invariants.test.ts` (Existing)
- **17 tests** — pricing_snapshot priority, email financial mapping
- PayPal amount alignment, canonical enrichment enforcement

### `src/__tests__/canonical-data-integrity.test.ts` (Existing)
- Account number canonical read path enforcement
- Blocks `profile.account_number` and `id.slice()` fallbacks

---

## 🛡️ DATABASE TRIGGERS (Active Guards)

| Trigger | Table | Purpose |
|---------|-------|---------|
| `trg_guard_order_lifecycle_no_skip` | `orders` | Blocks direct intake→completion status jumps |
| `trg_guard_billable_order_state_invoices` | `billing_invoices` | Blocks invoices for unconfirmed orders |
| `trg_guard_billable_order_state_payments` | `billing_payments` | Blocks payments for unconfirmed orders |
| `trg_00_block_orphan_invoice` | `billing_invoices` | Blocks invoices without valid customer/order link |
| `trg_sync_billing_invoice_balance` | `billing_invoices` | Auto-recalculates balance_due |
| `trg_sync_invoice_on_payment` | `billing_payments` | Syncs invoice amount_paid on payment insert |
| `trg_lock_account_number` | `accounts` | Prevents modification of immutable account_number |
| `trg_lock_identity_fields` | `profiles` | Prevents unauthorized identity field changes |
| `trg_lock_invoice_account_snapshot` | `billing_invoices` | Prevents modification of billing snapshots |
| `trg_sync_profile_account_number` | `accounts` | Syncs account_number to profiles on change |
| `trg_04_attach_subscription_to_paid_invoice` | `billing_invoices` | Links paid invoices to active subscriptions |
| `trg_05_invoice_math_from_subtotal` | `billing_invoices` | Enforces tax/total math consistency |

---

## 🚫 FORBIDDEN CHANGES (Require Explicit Approval)

Any future modification touching the following areas **MUST**:
1. Explicitly state what is changing
2. Prove what is NOT changing (run full test suite)
3. Be rejected if it impacts any locked flow

### Forbidden Patterns
| Pattern | Reason |
|---------|--------|
| Local tax calculation in transactional paths | Violates server-side pricing authority |
| `profile.account_number` reads | Non-canonical; must use `canonicalAccountResolver` |
| `id.slice()` for invoice/payment numbers | Financial identifiers must come from DB sequences |
| `order.total_amount` without `pricing_snapshot` guard | May contain gross pre-discount amounts |
| `total_amount: monthly_total_tax_in` in emails | Maps recurring estimate instead of actual paid amount |
| Order status → completed/activated from payment hooks | Violates lifecycle separation |
| `fallbackStructure` in document builder | Documents must use `compute_invoice_breakdown` RPC |
| Direct Supabase inserts bypassing `apply_payment_to_invoice` | Breaks transactional integrity |
| Removing or weakening tests in lock files | Security incident |

---

## 📋 CHANGE CONTROL PROTOCOL

For ANY modification touching billing, payments, orders, credits, invoices, portal financials, or emails:

```
1. BEFORE: State exactly what will change
2. BEFORE: Identify which locked systems are adjacent
3. DURING: Run full test suite (system-lock + billing-financial + canonical-data)
4. AFTER: Prove all 3 test suites pass (30+ system lock, 17 billing, 4 canonical)
5. AFTER: Confirm no DB trigger was disabled or modified
```

**If any test fails, the change is REJECTED.**

---

## ✅ VERIFICATION

Run the full lock verification:
```bash
npx vitest run src/__tests__/system-lock-invariants.test.ts
npx vitest run src/__tests__/billing-financial-invariants.test.ts
npx vitest run src/__tests__/canonical-data-integrity.test.ts
```

All three must pass with zero failures for any deployment to proceed.
