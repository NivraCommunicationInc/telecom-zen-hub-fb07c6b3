# Lot A · Facturation — progression

| # | Module | État | Livrable |
|---|---|---|---|
| 1 | Enregistrer paiement | ✅ dev terminé | `RecordPaymentModule.tsx` + `core_simulate_record_payment` + `core-record-payment` |
| 2 | Remboursement | ✅ dev terminé | `RefundModule.tsx` → `billing-account-actions.create_direct_refund` → RPC `refund_payment` |
| 3 | Ajustements unifiés (Crédit / Promo / Frais / Write-off) | ⏳ prochain | fusion → `account-ops-actions` + `account_adjustments` |
| 4 | Plan de paiement | ⏳ | nouvelle RPC `core_create_payment_plan` |
| 5 | AutoPay + Méthode de paiement | ✅ dev terminé | `AutopayModule.tsx` + `core-apply-autopay-action` → réutilise `square-detach-card`, `square-save-card`, `square-autopay-retry` |
| 6 | Cas recouvrement + Litige | ✅ dev terminé | `CollectionsDisputeModule.tsx` → wrap sur `collections-account-actions` + `disputes-account-actions` |

Validation E2E : en attente d'une session admin/QA (globale sur Lot A).
