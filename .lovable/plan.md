# Refonte Workflow Annulation Commande — Nivra Telecom

Objectif : un seul moteur canonique `cancel_order(order_id, reason, actor, source)` appelé par **tous** les portals (Core, Field, Checkout public, Client portal, CRM), avec cascade complète, audit, notifications et synchronisation temps réel.

---

## Phase 1 — Audit lecture seule (livrable écrit, aucune modification)

Je vais produire `AUDIT_Cancellation_Workflow.md` documentant :

1. **Sources de commandes détectées** — pour chacune : composant frontend, Edge Function appelée, tables écrites, statut initial, workflow post-création.
   - Nivra Core → Nouvelle commande manuelle (`FieldNewSale` + `field-sales-sync` / `new-order-actions`)
   - Field Sales / POS
   - Checkout public (`/checkout`)
   - Client Portal (renouvellements, upgrades)
   - CRM (conversion lead → commande)
   - Système (renouvellements auto, provisioning replay)

2. **Cartographie des données liées à une commande** (28 tables identifiées) classées par domaine :
   - Commerce, Client, Billing, Contrats, Installation, Field, Provisioning, Communications, Audit

3. **Inventaire des chemins d'annulation existants** — chaque bouton "Annuler" / RPC / Edge Function qui touche `orders.status`, avec ce qu'ils font (et ne font pas). Preuves : refs `rg` + extraits.

4. **Matrice cascade attendue par cas** (Cas 1–4 du brief) : pour chaque table, action = `delete | cancel | void | archive | keep_audit`.

5. **Problèmes identifiés** — liste priorisée (P0/P1/P2) avec root cause.

---

## Phase 2 — État machine officiel + contrats

Définir dans un doc + migration :

```text
draft → pending_payment → paid → processing → scheduled → active
                          ↓         ↓            ↓         ↓
                       cancelled  cancelled  cancelled  service_cancelled
```

- Statuts terminaux : `cancelled`, `service_cancelled`, `refunded`, `completed`.
- Table `order_cancellation_reasons` (enum: client_changed_mind, payment_issue, address_not_serviceable, agent_error, fraud, duplicate, other).
- Contrat de transition : quelles transitions sont autorisées depuis quel statut.

---

## Phase 3 — Moteur canonique `cancel_order`

**Fonction SQL** `public.cancel_order_v1(p_order_id, p_reason_code, p_reason_note, p_actor_id, p_source, p_idempotency_key)` qui, en une transaction :

1. Verrouille la commande (`FOR UPDATE`), vérifie la transition légale.
2. Snapshot `previous_status` → `order_status_history` + `order_events` (`event_type='order_cancelled'`).
3. Cascade selon statut avant annulation :
   - **Cas 1 (avant paiement)** : void quote, void invoice draft, cancel payment intent, cancel appointment, release technician slot.
   - **Cas 2 (payé non activé)** : cas 1 + cancel subscription future, cancel provisioning_jobs pending, marque `refund_required=true` (le remboursement Square se fait dans l'Edge Function côté serveur).
   - **Cas 3 (installation planifiée)** : cas 2 + libère `technician_slot_bookings`, retire `technician_assignments`, notifie tech via `notification_outbox`.
   - **Cas 4 (service actif)** : ne supprime rien — passe `billing_subscriptions.status='cancelled'` avec `end_date`, `service_instances.status='terminated'`, déclenche facture finale, garde historique.
4. Enqueue notifications (client + tech + interne) via `email_queue` / `notification_outbox`.
5. Écrit `admin_audit_log` avec actor, source, reason, IP, diff.

**Edge Function** `cancel-order` (unique point d'entrée réseau) :
- valide JWT + permission (`has_role`),
- appelle `cancel_order_v1`,
- si `refund_required` → appelle `square-refund` puis met à jour `billing_payments`,
- retourne un rapport structuré (ce qui a été fait par table).

**Idempotence** : clé `cancel_{order_id}_{actor}_{hour}` dans `client_account_action_idempotency`.

---

## Phase 4 — Consolidation frontend

Remplacer **tous** les chemins d'annulation existants (à identifier en Phase 1) par un hook unique `useCancelOrder()` qui invoque `cancel-order`. Portals visés :
- `src/core-app/**` (bouton Annuler dans OrderDetails, OrderProcessing, liste commandes)
- `src/pages/field/**`
- `src/pages/checkout/**` (annulation session)
- `src/pages/client/**`
- CRM

Composant partagé `<CancelOrderDialog />` :
1. Confirmation.
2. Sélection raison (radio) + note optionnelle.
3. **Pré-visualisation cascade** : appel dry-run `cancel-order?dryRun=true` → affiche la liste ("✓ Annuler rendez-vous", "✓ Rembourser 89,99 $", …).
4. Confirmation finale + toast + refresh.

Les anciens boutons/RPC sont supprimés (pas dépréciés — supprimés) pour éviter la dérive.

---

## Phase 5 — Realtime + triggers

- Trigger AFTER UPDATE OF `status` sur `orders` → NOTIFY + insert `order_events`.
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.orders, public.appointments, public.billing_invoices, public.billing_subscriptions;` (si pas déjà en place).
- Client Core/Field/Tech s'abonnent → refresh instant.

---

## Phase 6 — Tests runtime (preuves obligatoires)

Script Playwright + SQL de vérif pour 5 scénarios :

| # | Scénario | Setup | Assertions |
|---|---|---|---|
| 1 | Core manuelle avant paiement | crée commande shell | orders/quote/invoice/appointment tous cancelled, email queued |
| 2 | Field payée non activée | commande payée Square sandbox | + subscription cancelled, refund_required=true, refund exécuté |
| 3 | Checkout public annulé côté client | session expirée | idempotent, pas de double annulation |
| 4 | Installation planifiée | tech assigné | slot libéré, assignment removed, notif tech |
| 5 | Service actif | subscription active | service_cancelled, end_date set, facture finale générée |

Chaque test capture : screenshots + `psql` verifs + logs Edge Function.

---

## Livrables finaux

- `AUDIT_Cancellation_Workflow.md` (Phase 1)
- Migration SQL (`cancel_order_v1`, `order_events`, contraintes, triggers, realtime)
- Edge Function `cancel-order` + suppression des anciens endpoints
- Hook + dialog frontend + suppression des anciens boutons
- Rapport de tests avec preuves (screenshots + extraits SQL)

---

## Question avant démarrage

Ce chantier touche 5 portals + billing + provisioning. Deux options :

**A. Full run enchaîné** — je fais Phase 1 → 6 en séquence, tu revois le rapport final. Risque : gros diff à revoir.

**B. Gate après Phase 1** — je livre l'audit + la matrice cascade, tu valides / ajustes, puis je continue. Recommandé pour un chantier de cette taille.

Dis-moi **A** ou **B**, et si tu veux que je limite la Phase 4 à Core d'abord (rollout progressif) ou tout d'un coup.
