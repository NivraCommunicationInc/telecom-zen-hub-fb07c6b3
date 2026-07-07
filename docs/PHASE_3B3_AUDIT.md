# Phase 3.B.3 — Frontend PayPal Cleanup Report

**Date:** 2026-07-07  
**Objective:** Remove every user-facing path that would attempt a PayPal payment and receive an HTTP 410 from a decommissioned Edge Function.  
**Rule enforced:** No end-user or operator flow may invoke a `paypal-*` Edge Function. Historical PayPal data (payment records, provider labels, PDF strings) is preserved for read-only reporting and PDFs.

---

## Result

- Active `invoke("paypal-*")` sites in `src/`: **0**
- Active `invoke("billing-create-order-with-paypal-subscription")` sites: **0**
- Active `invoke("billing-paypal-*")` sites: **0**
- Typecheck: `tsgo --noEmit` green.

```
$ rg -n 'invoke\("paypal-|invoke\("billing-create-order-with-paypal|invoke\("billing-paypal' src/
(no matches)
```

---

## Files deleted

| File | Reason |
|---|---|
| `src/pages/PayPalSubscriptionReturn.tsx` | PayPal approval return handler — no longer reachable |
| `src/pages/client/ClientBalancePaymentSuccess.tsx` | PayPal balance-pay capture handler — no longer reachable |
| `src/components/client/PayPalAutoPayErrorDialog.tsx` | Orphan dialog — no callers |

## Routes removed (`src/components/AppRoutes.tsx`)

| Route | Was resolving to |
|---|---|
| `/commander/paypal-retour` | `PayPalSubscriptionReturn` |
| `/checkout/paypal-success` | `PayPalSubscriptionReturn` |
| `/portal/subscription-success` | `PayPalSubscriptionReturn` |
| `/portal/balance-payment-success` | `ClientBalancePaymentSuccess` |

Lazy imports for the two deleted pages were also removed.

## Files neutralized (call to `paypal-*` replaced with safe path)

| File | Change |
|---|---|
| `src/pages/client/PaymentReturn.tsx` | Rewritten as a legacy notice — no `paypal-capture-order` call. Directs user to `/portal/billing`. |
| `src/hooks/useClientAutoPayEnrollment.ts` | `enrollInPayPal` now returns `false` with `code: "PAYPAL_DECOMMISSIONED"`. No Edge Function call. |
| `src/pages/GuestCheckout.tsx` | Removed the `billing-create-order-with-paypal-subscription` branch (`enableAutoBilling && paymentMethod==="paypal"`). Public checkout continues to work through `SquarePaymentForm` (already the actual card processor). |
| `src/core-app/components/account-actions/InvoiceActions.tsx` | Historic PayPal payment refunds no longer call `paypal-refund`; they record a manual negative `billing_payment` and instruct the operator to issue the refund in the PayPal dashboard. |
| `src/core-app/pages/CoreCancellationsPage.tsx` | `paypal-cancel-subscription` + `paypal-refund` calls removed. Legacy PayPal accounts must be cancelled/refunded manually in the PayPal dashboard; audit log emitted. |
| `src/core-app/pages/CorePlanChangesPage.tsx` | `paypal-charge-subscription` call removed. PayPal-autopay upgrades now emit a high-severity `billing_system_alert` so an operator can charge the delta via Square. |
| `src/core-app/pages/CorePhoneOrdersPage.tsx` | Automatic `paypal-refund` on order block removed; refund lookup only logs a warning if the historical payment was PayPal. |

## Configuration flipped

| File | Before | After |
|---|---|---|
| `src/config/paymentMaintenance.ts` | `PAYPAL_PRIMARY = true` | `ACTIVE_PAYMENT_PROVIDER = "square"`, `PAYPAL_PRIMARY = false` |

## Preserved intentionally (historical / read-only)

122 files still contain the substring `paypal`. All remaining matches fall into these categories:

1. **Read-only reporting / display** — payment history tables, filters, badges, provider labels (`ClientPaymentsHistory`, `PaymentTable`, `AccountBillingTab`, admin invoice/payment lists, transaction traceability).
2. **PDF/legal templates** — receipts, refund notices, contract templates, T&Cs, legal pages (`RefundPolicy`, `ModalitesPaiement`, `ConditionsDeService`, `InfluencerTerms`, `PolitiqueConfidentialite`, `Parrainage`, marketing SEO pages). These render text that describes historical PayPal transactions or refund policy — not code paths.
3. **Field-sale identifiers** — `StepPaymentPaypal.tsx` and `FieldSalePayment.paypalApprovalUrl` are legacy names for what is now 100% Square logic (`square_inline` / `square_onsite` / `square_email` methods). No PayPal invocation. Renaming defers to Phase 3.C.
4. **Legacy state / storage keys** in `GuestCheckout.tsx` (`paypalCaptureId`, `nivra_paypal_flow_active`, `nivra-paypal-pending-order`): kept as internal names since the field is populated by the Square capture flow. Renaming defers to Phase 3.C.
5. **Test files** — `paypal-error-serialization.test.ts`, `system-lock-invariants.test.ts`, `billing-financial-invariants.test.ts`, `checkout-legal-checklist.test.ts` cover the legacy contract and invariants — kept.
6. **Comments / JSDoc** describing historical behaviour.

## Validation

```bash
# Zero active payment code paths call PayPal
rg -n 'invoke\("paypal-|invoke\("billing-create-order-with-paypal|invoke\("billing-paypal' src/
# → (no matches)

# TypeScript clean
bunx tsgo --noEmit
# → (exit 0, no output)
```

## Follow-up (Phase 3.C — non-blocking for the payment invariant)

- Rename `StepPaymentPaypal.tsx` → `StepPaymentSquare.tsx` and `paypalApprovalUrl` → `squareApprovalUrl` in `fieldSaleTypes.ts`.
- Rename `GuestCheckout` internal state (`paypalCaptureId` → `squarePaymentId`, storage key `nivra-paypal-pending-order` → `nivra-checkout-pending-order`).
- Purge legacy PayPal comments/JSDoc that no longer describe live behaviour.
- Delete the deprecated PayPal Edge Function stubs after a 90-day observation window.

The chain **Square → RPC canonique → billing_payments → billing_invoices** is now the only executable payment path in the frontend.
