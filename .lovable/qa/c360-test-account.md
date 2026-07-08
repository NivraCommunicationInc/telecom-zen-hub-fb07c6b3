# QA C360 — Compte de test isolé

Compte permanent utilisé pour valider les modules **Client 360** (Upgrade/Downgrade en premier, puis KYC, Restrictions, Fraude, etc.) sans jamais toucher un vrai client, un vrai paiement, ou un vrai provisioning.

## Identité

| Champ | Valeur |
|---|---|
| Email | `test-c360-planchange@nivra-test.ca` |
| Nom | `QA C360-PlanChange` |
| Domaine test | `@nivra-test.ca` (aucun envoi réel) |
| Tag canonique | `account_tags.tag_key = 'qa_test_account'` |
| Isolation billing | `billing_subscriptions.environment = 'test'` |
| Méthode de paiement | **Aucune** — aucune charge Square possible |

Les UUIDs (`user_id`, `account_id`, `subscription_id`, `service_address_id`) sont retournés par l'edge function `qa-provision-test-account` lors du premier provisionnement. Ils restent stables ensuite.

## Provisionnement

Edge Function : `qa-provision-test-account` (POST, exige un JWT admin/supervisor).

```
curl -X POST \
  -H "Authorization: Bearer <admin_jwt>" \
  https://<project>.supabase.co/functions/v1/qa-provision-test-account
```

Idempotent : ré-invoquer ne recrée rien, retourne les IDs existants.

Ressources créées côté `public.*` :
- `profiles` (client_number `QA-C360-…`)
- `accounts` (account_number `QA-ACC-…`, adresse Laval fictive)
- `service_addresses` (Laval, `is_default=true`)
- `account_tags` (`qa_test_account`, severity `info`)
- `billing_subscriptions` (Internet 500 Mbps, 50$, `environment='test'`, `auto_billing_enabled=false`)
- `equipment_inventory` (router fictif, serial `QA-ROUTER-C360-001`)

Non créés (règle stricte) :
- `provisioning_jobs`, `activation_requests`
- `paypal_*`, `square_payment_attempts`, `card_payment_intents`
- `payments`, `sms_queue`
- Aucune méthode de paiement dans `client_payment_methods`

## Reset entre deux passes

```
psql -f scripts/qa-c360-reset.sql
```

Ce script :
- remet l'abonnement sur Internet 500 (50$) avec cycle courant cohérent avec l'invariant `cycle_end = anchor_day - 1`
- purge `service_change_requests`, `admin_audit_log` (ciblé sub/account), `activity_logs`, `email_queue @nivra-test.ca`, `billing_invoice_lines`, `billing_invoices`
- **ne supprime pas** le compte : IDs stables

## Scénarios Upgrade/Downgrade

Plans disponibles pour la passe :

| Plan | Prix |
|---|---|
| Internet 100 Mbps | 45$ |
| **Internet 500 Mbps** (état de départ) | 50$ |
| Internet Giga | 60$ |

- **Upgrade immediate** : 500 → Giga (`effective='immediate'`, prorata `+10 × jours_restants/30`)
- **Downgrade next_cycle** : Giga → 100 (`effective='next_cycle'`, `service_change_requests` scheduled)

Tables à vérifier après chaque action :
- `billing_subscriptions` (plan_code, plan_price, plan_name, `updated_at`)
- `service_change_requests`
- `billing_invoice_lines` (`prorata_metadata` non nul si prorata)
- `billing_invoices`
- `admin_audit_log` (before/after)
- `activity_logs`
- `email_queue` (template `plan-change-confirmation` en `queued`, jamais envoyé — filtre domaine test)

## Confirmation d'isolation

```sql
-- Aucun test ne pollue la prod
SELECT count(*) FROM billing_subscriptions WHERE environment = 'test';   -- attendu : 1
SELECT count(*) FROM billing_subscriptions WHERE environment = 'live';   -- inchangé
SELECT count(*) FROM account_tags WHERE tag_key = 'qa_test_account';     -- attendu : 1
```
