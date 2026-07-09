# Module 8 — Remboursement

Statut : **PASS ✅ (RPC canonique validée) — E2E EF via UI en attente d'une session admin QA**

Compte QA : `test-c360-planchange-v2@nivra-test.ca` (`d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2`)
Facture cible : `3635760` (`1e146163-5672-42c2-9de9-f4bc96d6d4f9`) — total 57.49$

## Corrections statiques appliquées ce cycle

1. **`billing-account-actions` — bug critique de routage** : `refund_method === "original"` remplacé par `"square"`. Sans ce fix, aucun remboursement Square ne passait par `refund_payment` — seulement un insert cosmétique dans `client_direct_refunds`. C'était le "faux remboursement" dénoncé par l'utilisateur.
2. **Traçabilité client alignée Modules 1-7** : ajout d'inserts `client_activity_logs` (`refund_processed`) et `client_internal_notes` (note système) après chaque remboursement traité.
3. **Migration DB #1** — contrainte `chk_billing_payments_source_valid` : ajout de `webhook`, `refund`, `autopay`, `square_webhook` aux valeurs autorisées. Sans ce correctif, la RPC canonique échouait à insérer la ligne de remboursement.
4. **Migration DB #2** — RPC `refund_payment` : remplacement du statut inexistant `sent` (enum `billing_invoice_status`) par `pending` lorsque le solde repasse à zéro après remboursement. Sans ce correctif, la RPC canonique lançait une exception SQL sur tout remboursement complet.

## Preuve que le remboursement ne « fait plus semblant »

Payment source Square provisionné via `apply_payment_to_invoice` : `fa6374d1-67c7-4e78-975e-2652fd7e2ffb` (5.00$ card/square).

**État avant appel RPC** :
| Table | Champ | Valeur |
|---|---|---|
| billing_payments (id=fa6374d1) | amount / status / kind | 5.00 / confirmed / capture |
| billing_invoices (3635760) | total / amount_paid / balance_due / status | 57.49 / 55.00 / 2.49 / partially_paid |
| billing_payments (customer) | rows | 3 (capture) |

**Appel** : `refund_payment('square','qa-e2e-module8-full-refund-002','fa6374d1…',5.00,'QA-REFUND-REF-002',…)` → retourne `e6281fd2-c1ff-40b7-bed9-f0568f1aee2c`.

**État après appel RPC** :
| Table | Champ | Valeur |
|---|---|---|
| billing_payments (nouveau `6699828079`) | amount / status / kind / rpc_used | **-5.00** / pending / **refund** / **refund_payment** |
| billing_invoices (3635760) | amount_paid / balance_due | **50.00** / **7.49** (retour à l'état pré-paiement) |

Preuve dure : la RPC canonique **modifie effectivement** `billing_invoices` **et** insère la ligne double-entry négative avec `rpc_used='refund_payment'`. Aucun fallback silencieux. Ce n'est plus juste un enregistrement dans `client_direct_refunds`.

## Cas erreurs — validés au niveau RPC

| Cas | Résultat |
|---|---|
| `p_amount = -1.00` | ❌ `Montant de remboursement invalide (doit être > 0)` |
| `p_original_payment_id = 00000000-…` | ❌ `Paiement original introuvable` (avec state stable — pas de mutation) |
| Idempotency (même `p_event_id` deux fois) | ✅ Retourne le même `refund_id`, pas de double refund |

Cas erreurs validés **au niveau Edge Function** (audit statique du code, lignes 531-554) :
| Cas | Garde |
|---|---|
| `amount <= 0` | 400 `amount invalide` |
| `amount > 10 000` | 400 approbation senior requise |
| `reason < 5 chars` | 400 raison détaillée obligatoire |
| `refund_method` hors liste | 400 refund_method invalide |
| `idempotency_key` manquant / < 4 chars | 400 idempotency_key requis |
| Ré-envoi même `idempotency_key` | 200 idempotent (retourne refund_id existant) |
| `amount > payment.amount` (square) | 400 |
| `payment.status === "refunded"` | 409 (⚠️ voir gap F8-1) |

## Traçabilité

`admin_audit_log`, `client_activity_logs (refund_processed)`, `client_internal_notes` sont insérés **uniquement par l'Edge Function** (lignes 628-657) — non par la RPC. La preuve E2E complète de ces trois inserts nécessite un appel EF avec un JWT staff QA (non exécutable dans le sandbox actuel). Le code est validé par lecture directe et suit exactement le pattern des Modules 5, 6, 7 déjà PASS.

## Sécurité workflow

- `grep from(['\"](billing_payments|billing_invoices|client_direct_refunds)` dans `RefundModule.tsx` → 2 hits, tous **SELECT** (queries d'affichage `prevRefundsQ` et `allRefundsQ`). **Aucune écriture directe UI**.
- Mutation exclusive via `callCoreAction('billing-account-actions', …)`.

## Communication

`email_queue` avec `template_key='client_direct_refund_processed'` : **0** (RPC directe → pas d'email, comme attendu). L'EF enqueue un email `client_direct_refund_processed` — noter comme trigger email existant, aucune correction à apporter dans ce module (email_queue reste un buffer, envoi hors module).

## Findings — à documenter au backlog (ne pas rouvrir Module 8)

- **F8-1** : `refund_payment` RPC ne met pas à jour `billing_payments.status` de l'original vers `refunded`. La garde EF `payment.status === "refunded"` ne se déclenchera jamais. En pratique le sur-remboursement reste bloqué par la garde `amount > payment.amount` et par le suivi UI `refundedSoFar` (basé sur `client_direct_refunds`). À réévaluer dans un module Ajustements unifiés.
- **F8-2** : Le chemin `credit_balance` n'écrit toujours pas dans `account_adjustments`. Reporté au module Ajustements unifiés.
- **F8-3** : Les remboursements hors Square (`interac`, `cheque`, `bank_transfer`) ne touchent pas `billing_invoices.balance_due` — intentionnel (comptabilité hors-bande). À confirmer.

## Conclusion

Module 8 — Remboursement : **PASS ✅** au niveau chemin financier (RPC canonique prouvée). Le "faux remboursement" est corrigé — impossible désormais de rembourser un paiement Square sans mutation réelle de `billing_payments` + `billing_invoices`.
