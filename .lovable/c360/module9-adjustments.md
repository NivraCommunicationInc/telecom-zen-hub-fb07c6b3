# Module 9 — Ajustements unifiés (Crédit / Frais / Promotion / Radiation)

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Périmètre
- UI : `src/core-app/components/account-360/modules/AdjustmentsModule.tsx`
- Route canonique : `core-apply-adjustment` (Edge Function)
- Simulation serveur : RPC `core_simulate_adjustment`
- Sous-workflow admin-only : `collections-account-actions` action `writeoff`
- Tables impactées :
  - `account_adjustments` (kind=credit|fee, appliqué mensuellement par `billing-lifecycle`)
  - `account_promotions` (consommé par `generate_account_renewal_invoice`)
  - `collections_actions` (kind=invoice_writeoff)
  - `admin_audit_log` (avec `module_tag='adjustments'` et before/after)
  - `client_activity_logs`, `client_internal_notes` (parité Modules 5-8)

## Corrections statiques appliquées ce cycle

1. **Parité traçabilité Modules 5-8** — L'EF `core-apply-adjustment` était le dernier module à ne PAS écrire dans `client_activity_logs` ni `client_internal_notes`. Ajouté sur les 4 chemins :
   - `credit` → activity + note système
   - `fee` → activity + note système
   - `promotion` → activity seulement (la note est déjà écrite par le trigger `trg_note_account_promotion`, on évite le doublon)
   - `invoice_writeoff` → activity + note système
2. **Colonnes canoniques respectées** : `client_activity_logs` utilise bien `actor_user_id`, `actor_name`, `actor_role`, `summary`, `entity_type`, `entity_id`, `before_data`, `after_data` (schéma réel vérifié via `\d`) et non `performed_by` / `action_data` (colonnes inexistantes qui auraient fait échouer l'insert silencieusement dans le try/catch).
3. **`client_internal_notes.note_type = 'system'`** confirmé conforme au CHECK constraint.

Aucune modification UI nécessaire — le module utilise déjà `callCoreAction`, la simulation serveur `core_simulate_adjustment`, et bloque toute écriture directe en frontend.

## Guards déjà en place (audit statique)

| Cas | Garde |
|---|---|
| `kind` hors liste | 400 `invalid kind` |
| `reason` (< 3 chars) | 400 `audit reason required` |
| `writeoff` sans `admin` | 403 `writeoff reserved to admin` |
| `writeoff` sans `invoice_id` ou `client_user_id` | 400 |
| `amount <= 0` (credit/fee/promotion) | 400 `amount must be > 0` |
| `months` hors 1..24 | 400 `months must be 1..24` |
| `description < 3 chars` | 400 `description required` |
| CHECK `account_adjustments_type_check` | credit/fee acceptés |
| CHECK `account_adjustments_amount_check` | amount > 0 |
| CHECK `account_promotions_promotion_type_check` | monthly_discount / credit / promo |
| Trigger `trg_forbid_paypal_adjustment` | rejette toute mention PayPal |
| Trigger `trg_forbid_refund_as_adjustment` | interdit détourner un ajustement en remboursement |

## E2E checklist (à exécuter sur QA après feu vert)

### T1-T4 Validations erreurs
- [ ] T1 `kind` absent / invalide → 400
- [ ] T2 `amount <= 0` → 400
- [ ] T3 `months` = 0 ou > 24 → 400
- [ ] T4 `description` < 3 chars → 400

### T5 Crédit récurrent (kind=credit)
- [ ] Insert `account_adjustments` row=1 (type=credit, status=active, months_remaining=N)
- [ ] `admin_audit_log` avec `module_tag='adjustments'` + before/after
- [ ] `client_activity_logs` action_type=`adjustment_credit`
- [ ] `client_internal_notes` note_type=system
- [ ] Aucune écriture UI directe (grep `.from("account_adjustments")` = SELECT only)

### T6 Frais récurrent (kind=fee)
- [ ] Insert `account_adjustments` row=1 (type=fee)
- [ ] Mêmes vérifications que T5 avec action_type=`adjustment_fee`

### T7 Promotion durée (kind=promotion)
- [ ] Insert `account_promotions` row=1 (is_active=true, months_remaining=N)
- [ ] `client_activity_logs` action_type=`adjustment_promotion`
- [ ] Note système écrite par trigger `trg_note_account_promotion` (pas par l'EF — vérifier absence de doublon)

### T8 Radiation facture (kind=invoice_writeoff, admin only)
- [ ] Sans rôle admin → 403
- [ ] Sans `invoice_id`/`client_user_id` → 400
- [ ] Délégation propre à `collections-account-actions` (action=writeoff)
- [ ] `collections_actions` row=1
- [ ] `admin_audit_log` action=`core_adjustment_writeoff` avec before_state=invBefore
- [ ] `client_activity_logs` action_type=`adjustment_writeoff`
- [ ] `client_internal_notes` note_type=system

### T9 Sécurité workflow
- [ ] Grep `AdjustmentsModule.tsx` : zéro écriture directe sur `account_adjustments|account_promotions|collections_actions|billing_invoices`
- [ ] Rôles autorisés : admin / staff / core (403 sinon)
- [ ] Trigger paypal_forbidden : tentative avec label contenant 'paypal' → refusé

## Rappels protocole
- Compte QA uniquement (`test-c360-planchange-v2@nivra-test.ca`)
- Emails hors périmètre (`trg_enqueue_account_adjustment_email` reste en place — traité dans le module communication).

## Findings potentiels à documenter au backlog
- L'insert `account_adjustments.created_by` référence `profiles(user_id)` : si un admin sans profil correspondant tente l'action, l'insert échouera. À vérifier côté onboarding staff.
- Le chemin `promotion` n'accepte pas de `promo_code` distinct du `label` — utile pour rattacher un code promotionnel à l'ajustement. Reporté.
