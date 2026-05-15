## Findings (raw audit)

**1. Card payment in `FieldNewSale.tsx`** — `handleCardSubmit` (line 336) only calls edge `field-card-intent` which inserts `card_payment_intents` + `field_payment_intents` (status=`pending`). **No row in `orders`, no `field_commissions`, no email sent.** That's why Core sees nothing and the agent's commission never appears.

**2. Stuck data** — 5 intents for `oldo.lavaud3112@icloud.com` all `status=pending`, `converted_order_id=NULL`. Latest real order in `orders` is 2026‑04‑17 (no Field orders at all).

**3. PayerCommande.tsx** — already loads `services / equipment / discount / total` from `field_payment_intents` + `field_quotes` via public RPC. **No fix needed** for FIX 2.

**4. OrdersPage** — `useAdminOrders` fetches all orders w/o status filter; UI has a `__source_field_sales` filter, status options are `pending/processing/.../cancelled` but **`pending_payment` is missing from the dropdown**. Once orders exist with that status, they appear in "all" but cannot be filtered by it.

**5. Email** — `email_queue.template_key='order_confirmation'` does **not exist** anywhere (no row in `email_templates`, no handler in queue processor). Sending it would silently fail until I either (a) add a row to `email_templates` with the HTML, or (b) reuse the existing `payment_link_employee` template with a different subject/badge.

**6. `orders` NOT NULL columns** — `user_id`, `account_id`, `service_type`, `client_request_id` are all NOT NULL. A card_manual order has no client account yet → I must either create a placeholder profile/account OR call `field-sales-sync` edge function (which already handles account creation for paid Field orders). The current `field-sales-sync` only fires on PayPal capture; reusing it for "pending_payment" needs a new code path.

**7. Install appointment** — `installation_appointments` table does not exist.

---

## Plan (6 changes, in order)

### A. Migration 1 — `installation_appointments` table
- Create table with columns from spec (`order_id FK orders`, `appointment_date`, `appointment_window` enum, `technician_id FK profiles.user_id`, `installation_fee numeric`, `fee_type` enum, `fee_notes`, `status` enum, `notes`, `created_by`, `created_at`).
- RLS: SELECT for any authenticated staff (`has_role` admin/employee/field_sales/technician); INSERT for admin + field_sales + employee; UPDATE for admin + assigned technician.
- Index on `order_id`, `technician_id`, `appointment_date`.

### B. Migration 2 — Backfill 11 stuck `field_payment_intents` → `orders`
- Inserting into `orders` requires `user_id`, `account_id`, `service_type` (NOT NULL). For backfill I'll create stub `profiles` + `accounts` rows from `field_quotes.customer_email/name`, OR — safer — add a new optional column `orders.guest_intent_id uuid` and allow nullable user_id/account_id only for `payment_method='card_manual' AND status='pending_payment'` via a CHECK + dropping the NOT NULL with a partial guard.
- **This is destructive** to the schema invariant `assertCanonicalAccountInvariant`. **I need confirmation** before relaxing those NOT NULLs.
- Alternative: leave intents as-is and surface them in Core via a new "Pending card payments" panel that joins `field_payment_intents` instead of `orders`. **Strongly recommended** — preserves canonical invariant.

### C. `FieldNewSale.tsx` — make `handleCardSubmit` create real artifacts
- After `field-card-intent` returns successfully:
  - Insert `field_commissions` row: `agent_id=user.id`, `order_id=null` (set later by capture), `amount=computed`, `status='pending'`, `commission_type='forfait'`, `description='Card pending capture — intent <id>'`.
  - Enqueue email with `template_key='payment_link_employee'` reused but with subject "Confirmation de commande — Nivra Telecom" and a `payment_status: "En attente de traitement (carte)"` row in template_vars (no new template needed, no silent failure).
  - Switch to local `submittedState = { kind: 'card', intentId, amount, commissionAmount }` and render a **success screen** with: order number `SUB-XXXX`, status, "Nouvelle vente" button (`localStorage.removeItem(DRAFT_KEY)` + `setDraft(EMPTY_DRAFT)` + `setCompletedSteps([])`), and (if Migration A approved) the install appointment form posting to `installation_appointments`.
- **No order row** is created from the client. Instead the existing edge function `field-payment-capture` (or equivalent admin action) is responsible for promoting the intent to a real `orders` row when the card is actually charged. This keeps the canonical invariant intact.

### D. `OrdersPage.tsx` — add `pending_payment` to status filter dropdown (1 line)

### E. New "Pending card payments" panel in Core (optional, recommended)
- Uses `field_payment_intents` joined with `field_quotes` + `profiles(agent)` to surface card_manual intents that have not yet been promoted to orders.
- Lives in `OrdersPage.tsx` as a collapsible section at top, or a new tab. Allows Admin to "Process card" → triggers the existing capture flow.

### F. Reset/"Nouvelle vente" — already wired in success screen from C.

---

## Decisions I need from you

1. **For Fix 4 (backfill)**: relax `orders.user_id/account_id` NOT NULL (risky, breaks invariants), OR surface intents via a new Core panel without ever creating `orders` rows for unpaid cards (recommended)?
2. **For Fix 1 step 5 (email)**: reuse `payment_link_employee` template with adjusted vars (works today), OR insert a brand-new `order_confirmation` template into `email_templates` + add a handler in the queue processor (needs more files, more risk)?
3. **For Fix 1 steps 1–3 (insert order + invoke field-sales-sync at card-save time)**: this contradicts the existing payment-first invariant ("FIX 1: NO order created until webhook confirms" — comment at line 218 of `FieldNewSale.tsx`). Override that invariant or keep it?

Once you answer these three, I execute the migrations + edits and paste raw proof.