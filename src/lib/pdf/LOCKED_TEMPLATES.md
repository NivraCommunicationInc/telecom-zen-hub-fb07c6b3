# NIVRA PDF TEMPLATES — LOCKED PRODUCTION STANDARD

**Lock Date:** 2026-03-20  
**Approved By:** Nivra Management  
**Status:** PERMANENTLY LOCKED — DO NOT MODIFY WITHOUT EXPLICIT APPROVAL

---

## Locked Templates (V4.0)

| Document | File | Header Color |
|---|---|---|
| Invoice (Facture) | `invoiceTemplateV3.ts` | Blue `[30, 64, 120]` |
| Receipt (Reçu) | `receiptTemplate.ts` | Green `[34, 120, 60]` |
| Order Summary (Sommaire) | `orderSummaryTemplate.ts` | Blue `[30, 64, 120]` |
| Contract (Contrat) | `contractTemplateV3.ts` | Navy `[15, 23, 42]` |

## Rules

1. **NO layout changes** without explicit written approval.
2. **NO typography changes** — Helvetica, sizes, weights are locked.
3. **NO color changes** — header colors, text colors, status badges are locked.
4. **NO section reordering** — the visual structure is canonical.
5. **NO fallback math** — if data is missing, display "—" or fail closed. Never invent numbers.
6. **NO legacy templates** — all old generators are deleted. These 4 are the only active generators.
7. **ALL data must come from canonical backend** — `pricing_snapshot`, `billing_invoices`, `billing_invoice_lines`, `billing_payments`. No frontend recalculation.

## Fail-Closed Policy

If a required field is missing or null:
- Display "—" for text fields
- Display "$0.00" only if the value is genuinely zero
- Do NOT estimate, derive, or recompute financial values
- Do NOT change layout to hide missing data

## Change Control

Any modification to these files requires:
1. Explicit user approval in chat
2. Before/after proof of visual output
3. Verification that no other surface is affected
