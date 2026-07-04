
## Objectif

Aujourd'hui les liens Square/PayPal générés depuis **Nivra Field**, **Nivra Core** ou **OneView CS** ne créent qu'une "intention de paiement" (`field_payment_intents`). Aucune commande n'existe tant que le client n'a pas payé → le processing dans Core est vide.

**But** : la commande apparaît immédiatement dans Core avec les 10 étapes du workflow (comme celles du site public), en `payment_status = pending`. Le staff peut préparer KYC/équipement/technicien en parallèle. Le paiement Square/PayPal confirmé fait un simple `UPDATE payment_status = paid` sur la commande existante — zéro doublon.

## Ce qui change

### 1. Nouvelle action dans `field-order-engine`
`action=materialize_pending_from_quote` — clone de la logique existante `materialize_from_quote`, mais :
- crée `field_sales_orders` avec `payment_status='pending'` (au lieu de `confirmed`)
- appelle `field-sales-sync` qui, grâce à la logique existante, crée `orders` avec `status='pending_payment'` + `payment_status='pending'`
- lie immédiatement `field_payment_intents.converted_order_id = <new order.id>`

### 2. Câblage à la création des liens de paiement

- **`field-payment-link-create`** (Field → Square) : après création de l'intent, appelle `materialize_pending_from_quote`
- **`field-payment-initiate`** (Field → PayPal) : idem
- **`core-square-payment-link`** : *aucun changement* — cette fonction reçoit déjà un `invoice_id`, donc la commande existe déjà côté Core
- **`pos-square-intent`** : *hors périmètre* — c'est un lien de paiement ad-hoc sans structure de commande (montant + description libre). À traiter séparément si besoin.

### 3. Convertisseurs de paiement (évite le doublon)

- **`paypal-capture-order`** : quand le webhook confirme un intent, vérifier `intent.converted_order_id`. Si présent → `UPDATE orders SET payment_status='paid', status='validated'` + créer `billing_payment` lié. Si null → ancien chemin (materialize à la volée, pour rétrocompatibilité).
- **`field-order-engine.finalize_paid_intent`** : même logique — check `converted_order_id`, UPDATE si présent.

## Ce que ça donne côté utilisateur

**Avant :**
- Agent Field finalise vente → lien envoyé → Core voit un mini bloc « en attente de paiement, 2 options »
- Impossible de préparer quoi que ce soit

**Après :**
- Agent Field finalise vente → **commande créée immédiatement** dans Core → 10 étapes visibles → KYC, équipement, technicien peuvent être préparés
- Bandeau clair : `⚠️ Paiement en attente — le client n'a pas encore payé`
- Actions disponibles : contacter client, renvoyer lien, marquer paiement manuel, etc.
- Quand client paie → statut passe à `payé` automatiquement, activation possible

## Ce que je ne touche PAS

- Le checkout public (`checkout-canonical-sync`) — déjà correct
- La structure des `field_payment_intents`
- La logique de commission (elle se déclenche déjà sur `payment_status='confirmed'` — impact zéro tant que la commande est pending)
- Les emails (le lien de paiement continue de partir comme avant)
- L'intent FIELD-562FF562 existant — je ne rétroactive pas les intents en attente pour minimiser le risque. Nouveaux tests = nouvelles commandes visibles.

## Détails techniques

**Fichiers modifiés :**
- `supabase/functions/field-order-engine/index.ts` — ajout action `materialize_pending_from_quote`
- `supabase/functions/field-payment-link-create/index.ts` — appel post-insert intent
- `supabase/functions/field-payment-initiate/index.ts` — appel post-insert intent
- `supabase/functions/paypal-capture-order/index.ts` — UPDATE si `converted_order_id` existe
- Éventuel mini-ajustement dans `field-order-engine.finalize_paid_intent` pour la même bifurcation

**Aucune migration SQL requise** — le schéma existant supporte tout.

**Gestion d'erreur** : si `materialize_pending_from_quote` échoue après création de l'intent, on log mais on ne bloque pas la génération du lien (le paiement reste fonctionnel, et un cron ou le webhook capturera le cas). L'intent reste utilisable.
