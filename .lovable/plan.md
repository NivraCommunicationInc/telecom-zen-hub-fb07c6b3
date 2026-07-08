## Objectif

Dans le **Nivra Core → Compte client 360**, faire deux choses en même temps :
1. **Réorganiser** les 41 boutons à plat en 6 groupes lisibles + déplacer les **Notes internes** dans un **drawer latéral** (avec filtre "cacher les notes système" et regroupement des doublons).
2. **Ajouter les 10 options manquantes**, réellement fonctionnelles, avec audit, RLS, sync temps réel Supabase, et courriels via le **template officiel du site** (`send-transactional-email`).

Aucun bouton ne sera juste "un texte". Chaque action ouvre un dialog fonctionnel → écrit en DB → journalise dans `activity_logs` / `admin_audit_log` → notifie le client au besoin par courriel branded → se reflète **en temps réel** dans le 360 et le portail client.

---

## Réorganisation UI (Account360)

Fichier principal : `src/core-app/components/account-360/Account360QuickActions.tsx`

Nouveaux groupes (accordions repliables, ouverts par défaut) :

```text
1. Compte         — Voir client, Modifier profil, Accès en ligne, Impersonation, Pause/Annuler, VIP/Churn
2. Facturation    — Enregistrer paiement, Crédit/Frais, Promotions, Remboursement rapide,
                    Ajustement/Write-off, Plan de paiement, Force AutoPay retry, Facture, Reçu
3. Services       — Gestion Internet/TV/Mobile, Reboot équipement, Diagnostic ligne,
                    Upgrade/Downgrade, Transfert de service (déménagement), Équipement
4. Commandes      — Nouvelle commande, Nouvelle soumission, Voir soumissions, Ouvrir commande
5. Communication  — Ticket, Note interne, SMS, Courriel, Rappel, Escalation superviseur,
                    Bon de compensation
6. Conformité     — KYC, NIP, Restrictions, Documents, Contrats
```

Notes internes :
- Retirées du panneau droit collant.
- Nouveau **drawer** ouvert via bouton "Notes (N)" en haut à droite du 360.
- Filtre par défaut : masquer `note_type IN ('system','auto')`.
- Regroupement : si ≥3 notes système identiques dans 24h → une seule ligne "NIP émis (×4) — 2026-07-08".
- Composant : `src/core-app/components/notes/ClientNotesDrawer.tsx` (utilise le `ClientNotesPanel` existant en interne).

---

## 10 options manquantes — livraison complète

Chacune = dialog + edge function (si envoi/paiement/webhook) + RLS + audit + email officiel + realtime.

### Financier
1. **Remboursement rapide** — Dialog `QuickRefundDialog` → edge fn `square-refund-payment` (existe déjà, on wire l'UI) → email template `payment-refunded` → refresh 360.
2. **Ajustement / Write-off** — Dialog `AccountWriteOffDialog` → insert `account_adjustments` (type `write_off`) + `activity_logs` → email `account-adjustment-notice`.
3. **Plan de paiement** — Dialog `PaymentPlanDialog` → insert `client_payment_plans` (existe) + génère échéances → email `payment-plan-created`.
4. **Force AutoPay retry** — Bouton → edge fn `square-autopay-retry` (nouveau) qui recharge la carte enregistrée pour la facture impayée → email `autopay-retry-result`.

### Services
5. **Reboot équipement à distance** — Dialog `RemoteRebootDialog` → insert `internet_modem_actions` (action=`reboot`) → email `equipment-reboot-scheduled`.
6. **Diagnostic ligne** — Dialog `LineDiagnosticDialog` → insert `internet_diagnostics` avec résultat (débit/ping simulé initial + hook réel plus tard) → affiche résultat en direct.
7. **Upgrade / Downgrade rapide** — Dialog `QuickPlanChangeDialog` → utilise RPC existants `internet_plan_changes` / `tv_plan_changes` → email `plan-change-confirmed`.
8. **Transfert de service (déménagement)** — Dialog `ServiceMoveDialog` → insert `service_change_requests` (type=`move`) avec nouvelle adresse via `service_addresses` → email `service-move-scheduled`.

### Relation client
9. **Escalade superviseur** — Dialog `SupervisorEscalationDialog` → insert `internal_tickets` (priority=`urgent`, category=`escalation`) + notif `staff_notifications` aux superviseurs → email interne + accusé au client.
10. **Bon de compensation standardisé** — Dialog `CompensationVoucherDialog` avec presets ($10 / $25 / $50 / mois gratuit) → insert `promotions` + `promotion_redemptions` liés au compte → email `compensation-voucher-issued` avec code.

**Bonus (demandé plus haut) :** marquage **VIP / Churn Risk** — toggle dans le groupe Compte → écrit dans `account_tags` (tag `vip` ou `churn_risk`) → badge visible dans le panneau droit.

---

## Templates courriels officiels

Tous nouveaux templates sont créés dans `supabase/functions/_shared/transactional-email-templates/` en suivant **strictement** le template corporate bleu #0066CC existant (header/footer/signature `support@nivra-telecom.ca`) :

- `account-adjustment-notice.tsx`
- `payment-plan-created.tsx`
- `autopay-retry-result.tsx`
- `equipment-reboot-scheduled.tsx`
- `plan-change-confirmed.tsx`
- `service-move-scheduled.tsx`
- `compensation-voucher-issued.tsx`

Enregistrés dans `registry.ts`. Envoi via `send-transactional-email` avec `idempotencyKey`.

---

## Synchronisation temps réel

- Chaque dialog fait un `queryClient.invalidateQueries` sur les clés canoniques (`useCanonicalClientData`, `shared-client-profile`, `client-360-*`).
- Abonnement Supabase Realtime déjà en place sur `customer_portal_snapshots` — les nouvelles tables mutées (`account_adjustments`, `client_payment_plans`, `internet_modem_actions`, etc.) déclenchent les triggers existants qui rafraîchissent le snapshot → **portail client voit les changements en direct**.
- Ajout de Realtime `postgres_changes` sur `activity_logs` filtré par `client_id` dans le 360 Core pour un badge live "Nouvelle activité".

---

## Sécurité / RLS / Audit

- Aucune nouvelle table sauf `compensation_vouchers` si besoin (sinon on réutilise `promotions`). Si créée : `GRANT` + RLS `has_role('admin'|'core_staff')`.
- Chaque action serveur passe par une edge function `verify_jwt=true` qui appelle `has_role(auth.uid(), 'core_staff' OR 'admin')`.
- Chaque écriture insère une ligne dans `admin_audit_log` : `actor_id`, `action`, `target_client_id`, `before`, `after`, `reason` (obligatoire pour write-off, refund > 50$, compensation > 25$, escalation, transfert).

---

## Détails techniques (résumé fichiers)

```text
src/core-app/components/account-360/
  Account360QuickActions.tsx         # refonte groupes accordion
  Account360RightPanel.tsx           # retirer Notes
  dialogs/QuickRefundDialog.tsx
  dialogs/AccountWriteOffDialog.tsx
  dialogs/PaymentPlanDialog.tsx
  dialogs/AutopayRetryDialog.tsx
  dialogs/RemoteRebootDialog.tsx
  dialogs/LineDiagnosticDialog.tsx
  dialogs/QuickPlanChangeDialog.tsx
  dialogs/ServiceMoveDialog.tsx
  dialogs/SupervisorEscalationDialog.tsx
  dialogs/CompensationVoucherDialog.tsx
  dialogs/VipChurnToggleDialog.tsx

src/core-app/components/notes/
  ClientNotesDrawer.tsx              # nouveau drawer + filtre + dédup

supabase/functions/
  square-autopay-retry/index.ts      # nouvelle
  core-write-off/index.ts            # nouvelle (audit obligatoire)
  core-compensation-voucher/index.ts # nouvelle

supabase/functions/_shared/transactional-email-templates/
  (7 nouveaux templates + registry.ts mis à jour)
```

Migration DB : uniquement ajout de colonnes utiles (`account_tags.tag` étendu à `vip|churn_risk` — enum ou libre selon existant), plus les GRANT/RLS si nouvelle table.

---

## Ordre d'exécution

1. Migration DB (audit, tags VIP/Churn, éventuelle table `compensation_vouchers`).
2. Templates courriels + `registry.ts` + deploy `send-transactional-email`.
3. Edge functions nouvelles + deploy.
4. Dialogs + refonte `Account360QuickActions` + Notes drawer.
5. Vérification : `tsgo`, ouverture d'un compte test dans le preview via Playwright, screenshots des 6 groupes et de chaque dialog fonctionnel, vérif temps réel entre Core et portail client.

---

## Ce que je ne fais PAS (pour rester dans ton scope)

- Aucun changement au checkout public, au parrainage, aux loyalty rules, à Square Charge Invoice (déjà traité).
- Aucun renommage d'options existantes qui fonctionnent déjà.
- Aucune suppression de bouton — tout est conservé, juste regroupé.

Confirme et je livre le tout d'un bloc.
