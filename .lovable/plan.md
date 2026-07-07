# Plan — Square Orphan Reconciliation

## Objectif

Détecter automatiquement tout paiement encaissé côté Square qui n'a **aucune contrepartie** dans Nivra Core (`billing_payments`, `billing_invoices`, `orders`), et lever une alerte opérationnelle `ORPHAN_PAYMENT_DETECTED`.

Couvre deux scénarios :
1. **Custom Amount / Terminal Square** — paiement créé hors du checkout Nivra (cas Mouhssine)
2. **Webhook perdu** — paiement fait via Nivra mais webhook non reçu/traité

Plus contrôle secondaire sur les paiements dont la note Square contient `CMD-*` sans commande Nivra associée.

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│  pg_cron : toutes les 15 min                             │
│    → net.http_post → edge fn square-orphan-reconciliation │
└──────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  edge fn square-orphan-reconciliation                    │
│    1. Fetch Square /v2/payments (begin_time = now-2h)    │
│    2. Pour chaque payment.id Square :                    │
│       - présent dans billing_payments.square_payment_id? │
│       - présent dans square_payment_attempts?            │
│       - référence CMD-* vs orders.order_number?          │
│    3. Si orphelin ⇒ INSERT square_orphan_alerts          │
│    4. Si CMD-* sans order ⇒ tag "cmd_unmatched"          │
│    5. INSERT admin_notification_logs                     │
└──────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Table square_orphan_alerts (nouvelle)                   │
│    → visible dans le Hub Admin (page dédiée)             │
└──────────────────────────────────────────────────────────┘
```

## Tables impactées

### Nouvelle table `public.square_orphan_alerts`

Colonnes métier :
- `square_payment_id` (unique) — identifiant Square
- `square_receipt_url`
- `amount_cents` + `currency`
- `square_created_at` — timestamp Square
- `note` — note libre Square (contient souvent `CMD-*`)
- `buyer_email_address` — email fourni au terminal (peut être NULL)
- `buyer_display_name` — nom fourni au terminal (peut être NULL)
- `detection_reason` — enum : `not_in_billing_payments`, `cmd_reference_no_order`, `webhook_missed`
- `status` — enum : `open`, `investigating`, `resolved`, `ignored`
- `resolution_notes`
- `resolved_by` (uuid → profiles.id)
- `resolved_at`
- `linked_order_id` (uuid, nullable, → orders.id)
- `linked_invoice_id` (uuid, nullable, → billing_invoices.id)
- `linked_payment_id` (uuid, nullable, → billing_payments.id)
- `last_seen_at` — mise à jour à chaque scan tant qu'orpheline
- `raw_square_payload` (jsonb) — snapshot API Square

Contrainte : `UNIQUE (square_payment_id)` — anti-doublon.

### Tables consultées (lecture seule)
- `billing_payments` (colonne `square_payment_id`)
- `square_payment_attempts` (colonne `square_payment_id`)
- `orders` (colonne `order_number` pour match `CMD-*`)
- `billing_invoices` (colonne `invoice_number`)

### Table déjà existante
- `admin_notification_logs` — un log inséré par alerte nouvelle (non doublonné grâce à l'idempotence)

## Sécurité & RLS

Table `square_orphan_alerts` :
- RLS **ON**
- Policy **staff_manage** : `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'employee')` (SELECT/UPDATE)
- Policy **service_role** : accès complet pour l'edge function
- **Aucun accès anon/client** — donnée strictement interne
- Grants : `SELECT, UPDATE` à `authenticated` ; `ALL` à `service_role`

Edge function :
- `verify_jwt = false` (déclenchée par cron)
- Authentification via header `x-cron-secret` (secret `SQUARE_ORPHAN_CRON_SECRET` généré via `generate_secret`)
- Utilise `SQUARE_ACCESS_TOKEN` (déjà présent) pour appeler l'API Square
- Client Supabase avec `SUPABASE_SERVICE_ROLE_KEY` (bypasse RLS uniquement pour cette table)

## Cron

`pg_cron` — job `square-orphan-reconciliation` toutes les **15 minutes** :

```sql
select cron.schedule(
  'square-orphan-reconciliation',
  '*/15 * * * *',
  $$ select net.http_post(
       url  := 'https://<project>.supabase.co/functions/v1/square-orphan-reconciliation',
       headers := jsonb_build_object(
         'Content-Type','application/json',
         'x-cron-secret', current_setting('app.settings.square_orphan_cron_secret', true)
       ),
       body := '{}'::jsonb
     ); $$
);
```

Fenêtre de scan : Square `/v2/payments?begin_time=now-2h` (marge de 2 h pour attraper les retards webhook et couvrir 8 exécutions consécutives).

## Stratégie anti-doublons

Trois niveaux :

1. **DB** : `UNIQUE(square_payment_id)` sur `square_orphan_alerts` — impossible d'insérer deux fois la même alerte.

2. **Upsert intelligent** : la fn utilise `INSERT ... ON CONFLICT (square_payment_id) DO UPDATE SET last_seen_at = now()`. Une alerte déjà ouverte est simplement "rafraîchie", pas dupliquée. Si `status IN ('resolved','ignored')` on ne touche pas.

3. **Notification** : `admin_notification_logs` inséré **uniquement à la création** de l'alerte (via `xmax = 0` dans le RETURNING du upsert), jamais lors du refresh — évite le spam admin.

Bonus : la fn ignore les paiements Square avec `status != 'COMPLETED'` (ex. `APPROVED`, `PENDING`) pour éviter les faux positifs sur transactions en cours de capture.

## Détection `CMD-*` sans commande

Après le check principal, boucle secondaire :
- Pour chaque paiement Square avec `note ILIKE 'CMD-%'` :
  - Extrait le token via regex `CMD-[A-Z0-9]+`
  - Cherche dans `orders.order_number` et `billing_invoices.invoice_number`
  - Si aucune correspondance ⇒ alerte avec `detection_reason = 'cmd_reference_no_order'`
- Utile même si le paiement est déjà dans `billing_payments` mais rattaché à la mauvaise commande.

## Détails techniques

### Fichiers créés
- `supabase/functions/square-orphan-reconciliation/index.ts` — edge function
- Migration : table + RLS + grants + policies
- Insert (via `insert` tool, PAS migration) : `cron.schedule` + config secret

### Secrets à créer
- `SQUARE_ORPHAN_CRON_SECRET` — via `generate_secret` (32 chars, jamais révélé)
- `SQUARE_ACCESS_TOKEN` — déjà existant, réutilisé

### Payload API Square consommé
```
GET /v2/payments?begin_time=<ISO>&sort_order=DESC&limit=100
```
Champs extraits par paiement : `id`, `amount_money.{amount,currency}`, `created_at`, `note`, `receipt_url`, `buyer_email_address`, `status`, `source_type` (CARD / EXTERNAL / CASH).

### UI Admin (hors scope de ce plan — à traiter séparément)
Non inclus ici : page `/hub/admin/square-orphans` pour visualiser + résoudre. Sera un plan distinct après validation du back-end.

### Tests
- Test 1 : rejouer le cas Mouhssine (payment `9oNY`) — doit générer une alerte `not_in_billing_payments`
- Test 2 : ré-exécuter dans 15 min — l'alerte est refreshée, pas dupliquée, aucun `admin_notification_logs` supplémentaire
- Test 3 : injecter un paiement Square avec note `CMD-FAKE99` — doit alerter en `cmd_reference_no_order`
- Test 4 : marquer une alerte `resolved` puis relancer — reste `resolved`, aucun spam

## Livrables

1. Migration DB (table + RLS + grants + policies)
2. Edge function `square-orphan-reconciliation`
3. Secret `SQUARE_ORPHAN_CRON_SECRET` généré
4. Job pg_cron programmé toutes les 15 min
5. Rapport de test avec l'alerte Mouhssine visible dans `square_orphan_alerts`

## Hors scope

- Résolution manuelle des alertes (workflow admin — plan séparé)
- UI Admin dédiée (`/hub/admin/square-orphans`)
- Réconciliation automatique paiement ↔ commande (risque trop élevé — reste manuel)
- Reconciliation des paiements crypto / autres providers (Square uniquement)
