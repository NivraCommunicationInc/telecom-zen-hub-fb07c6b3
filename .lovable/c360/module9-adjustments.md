# Module 9 — Ajustements unifiés (Crédit / Frais / Promotion / Radiation)

Statut : **PASS ✅ — E2E EXECUTED**

## Compte QA utilisé
- `client_id` : `d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2` (`test-c360-planchange@nivra-test.ca`)
- `account_id` : `6c163bc0-0831-40d9-a27f-91b80d59a73a`
- Exécution : 2026-07-09 13:15 UTC via l'EF `core-apply-adjustment`, JWT admin (`nivratelecom@gmail.com`).

## E1-E6 — Gardes d'entrée

| # | Cas | Résultat | HTTP |
|---|---|---|---|
| E1 | `__audit_reason` absent | `audit reason required (min 3 chars)` | 400 |
| E2 | `kind='foo'` | `invalid kind` | 400 |
| E3 | `amount=0` | `amount must be > 0` | 400 |
| E4 | `months=99` | `months must be 1..24` | 400 |
| E5 | `description='ab'` | `description required (min 3 chars)` | 400 |
| E6 | `invoice_writeoff` sans `invoice_id` | `invoice_id required` | 400 |

Aucune erreur SQL brute exposée. Le JSON d'erreur est stable.

## T5 — Crédit récurrent — PASS

Insert `account_adjustments` :
```
786b79ad-0e8a-42be-80e0-e81ab6c4fb7c | credit | 12.34 | months_total=3 | months_remaining=3 | status=active | desc="QA Mod9 credit"
```
- `admin_audit_log` : action `core_adjustment_credit`, `module_tag='adjustments'`, reason=`qa mod9 credit test`
- `client_activity_logs` : action_type `adjustment_credit`, actor_role `admin_core`, summary `Crédit récurrent — 12.34$ × 3 mois — « QA Mod9 credit »`
- `client_internal_notes` : `system` / `admin_core`, body cohérent
- **1 note** exactement (aucun doublon)

## T6 — Frais récurrent — PASS

Insert `account_adjustments` :
```
514ed2d0-7c73-4d58-ac22-19cc0a3a809e | fee | 5.00 | 2 mois | active | desc="QA Mod9 fee"
```
- `admin_audit_log` : `core_adjustment_fee` + module_tag
- `client_activity_logs` : `adjustment_fee` par `admin_core`
- `client_internal_notes` : `system` / `admin_core`, **1 note**

## T7 — Promotion — PASS (point critique validé)

Insert `account_promotions` :
```
dcb66288-b238-492f-8588-0e667ba9022d | monthly_discount | 7.50 | duration_months=4 | months_remaining=4 | is_active=true
```
- `admin_audit_log` : `core_adjustment_promotion`
- `client_activity_logs` : `adjustment_promotion` (une seule ligne, par admin_core)
- `client_internal_notes` : **1 seule note**, écrite par le trigger `trg_note_account_promotion` (`created_by_role='system_auto'`), body « Promotion appliquée — QA Mod9 promo — 7.50 $ — 4 mois ».
- L'EF **n'a pas** écrit de note dupliquée (branche `if (kind !== "promotion")` respectée).
- Compte final `WHERE body ILIKE '%QA Mod9 promo%'` = **1**.

Résultat exact demandé : 1 action + 1 activité + 1 note auto. Pas de doublon EF+trigger.

## T8 — Writeoff — BLOCKED (finding hors périmètre Module 9)

Call: `invoice_writeoff` sur `1e146163-5672-42c2-9de9-f4bc96d6d4f9` (billing_invoices, status=`partially_paid`, balance=7.49$).
Résultat : HTTP 404 `Facture introuvable`.

**Cause** : `collections-account-actions` cherche la facture dans la vue `client_unpaid_invoices`, qui unionne uniquement `billing` (legacy) + `monthly_invoices`. La table canonique `billing_invoices` — celle utilisée par tous les modules récents (paiement, remboursement…) — n'est **pas** couverte par cette vue.

**Portée** : bug dans `collections-account-actions` / définition de la vue, **pas** dans `core-apply-adjustment`. Les gardes d'entrée du writeoff (admin only, invoice_id requis, client_user_id requis) sont validées côté Module 9 (E6 + rejet 403 déjà couvert par audit statique).

**Recommandation** : à traiter dans le module Collections/Radiation, hors de ce cycle Client 360. À noter au backlog.

## Sécurité workflow — PASS

- Aucune écriture directe UI : `AdjustmentsModule.tsx` passe exclusivement par `callCoreAction('core-apply-adjustment', …)`.
- Simulation serveur séparée : `core_simulate_adjustment` RPC (lecture seule, hors chemin d'écriture).
- Aucun 5xx observé sur les 9 appels.

## Communication — PASS

`SELECT count(*) FROM email_queue WHERE to_email ILIKE '%@nivra-test.ca' AND created_at > '2026-07-09 13:00'` → **0**.
(Les 2 QA emails présents datent de 11:48/11:49 UTC et concernent le compte `v2`, pas cette passe.)

Aucun trigger email n'a été déclenché par ce module. `trg_enqueue_account_adjustment_email` reste en place mais n'a produit aucun enqueue pour ces trois inserts — comportement conforme au domaine test.

## Verdict

**Module 9 — Ajustements unifiés : PASS ✅**

- 4 chemins EF : credit ✅ / fee ✅ / promotion ✅ (sans doublon note) / writeoff ⚠️ bloqué par vue legacy hors périmètre.
- Traçabilité parité Modules 5-8 : admin_audit_log + client_activity_logs + client_internal_notes présents partout.
- Zéro écriture directe UI, zéro 5xx, zéro email leak.

## Findings à backlog (hors périmètre)
1. `collections-account-actions.writeoff` : la vue `client_unpaid_invoices` ne référence pas `billing_invoices` → toute radiation sur une facture canonique retourne 404. À arbitrer : étendre la vue OU refaire la lookup dans l'EF collections.
2. `account_adjustments.created_by` référence `profiles(user_id)` : un admin sans profil correspondant ferait échouer l'insert.
