# Gestion Points & Références dans Nivra Core

## 1. Backend — RPCs sécurisées (migration)

Toutes les actions passent par des RPC `SECURITY DEFINER` qui exigent `has_role(auth.uid(),'admin')`, journalisent dans `activity_logs` + `admin_audit_log`, et enregistrent une transaction traçable.

### Points de fidélité
- `admin_loyalty_adjust(account_id, delta_points, reason, expires_at?)` — crédit/débit manuel (`type='adjusted'`, raison obligatoire, snapshot avant/après)
- `admin_loyalty_approve_pending(transaction_id, decision, reason)` — approuve/rejette une écriture `pending` (nouveau champ `status`)
- `admin_loyalty_transfer(from_account, to_account, points, reason)` — débit source + crédit destination, lien croisé via `reference_id`
- `admin_loyalty_extend_expiration(transaction_id, new_expires_at, reason)`
- `admin_loyalty_convert_to_credit(account_id, points, credit_amount, reason)` — débite points + crée `account_adjustments` type `credit`

### Références
- `admin_referral_approve(referral_id, reason)` / `admin_referral_reject(referral_id, reason)` — met à jour `status`/`reward_status`, `fraud_checked_by`, `qualified_at`/`disqualified_at`
- `admin_referral_reassign(referral_id, new_referrer_user_id, reason)` — change le parrain (log ancien+nouveau)
- `admin_referral_manual_reward(referred_user_id, referrer_user_id, kind, amount_or_points, reason)` — crée une entrée manuelle
- `admin_referral_clawback(referral_id, reason)` — annule une récompense payée, débite points/crédit si applicable

Ajouts DB minimaux :
- `loyalty_transactions.status` (`pending|approved|rejected|posted`, défaut `posted`)
- `loyalty_transactions.reviewed_by`, `reviewed_at`, `admin_reason`
- `client_referrals.reassigned_from`, `reassigned_at`, `reassigned_by`
- Triggers projection portail déjà en place — rien à changer.

## 2. Realtime portail client

Migration :
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.loyalty_points,
  public.loyalty_transactions,
  public.loyalty_redemptions,
  public.client_referrals,
  public.client_referral_events;
```

Portail (`src/pages/client/ClientReferrals.tsx` + hook loyalty existant) : ajouter un `useEffect` qui `supabase.channel(...)` sur ces tables filtré par `account_id`/`referrer_user_id` et invalide les queries React Query concernées, avec cleanup `removeChannel`.

## 3. Core admin — nouvelles pages

- `src/core-app/pages/CoreLoyaltyManagement.tsx` — liste comptes avec solde, filtre tier/pending, actions par ligne (ajuster, transférer, convertir, prolonger, approuver/rejeter pending). Historique complet des transactions avec badges statut + auteur.
- `src/core-app/pages/CoreReferralsManagement.tsx` — liste `client_referrals` avec filtres (status, reward_status, fraud_flag), actions (approuver, rejeter, réattribuer, clawback, récompense manuelle). Panneau détail avec timeline `client_referral_events`.
- Intégration dans `CoreClientProfile.tsx` (onglet 360) : sections **Points** et **Références** avec les mêmes actions scoped au client courant, plus la timeline live.

Composants réutilisables :
- `LoyaltyAdjustDialog` (delta ± / raison / expiration)
- `LoyaltyTransferDialog` (recherche compte cible par courriel/téléphone/#)
- `LoyaltyConvertDialog` (points ↔ crédit facture, aperçu du taux)
- `ReferralActionDialog` (approve/reject/reassign/clawback avec raison obligatoire)
- `ManualReferralRewardDialog`

Toutes utilisent `zod` pour valider (raison min 5 char, montants > 0, etc.) et appellent les RPC via `supabase.rpc(...)`.

## 4. Audit & notifications

- Chaque RPC écrit `activity_logs` (client-visible dans son historique) **et** `admin_audit_log` (interne).
- Notification client automatique via `notification_outbox` sur : approbation points, rejet, transfert reçu, référence approuvée/rejetée/clawback.
- Toast Core sur succès/erreur, avec message serveur.

## 5. Permissions

- RPC gated `has_role(auth.uid(),'admin')` — refuse tout autre rôle avec `RAISE EXCEPTION`.
- Boutons UI cachés si `useIsCoreAdmin()` renvoie faux (déjà en place).
- Pas de nouvelle policy RLS nécessaire : les tables acceptent déjà les admins en écriture.

## Détails techniques

- Concurrency : `SELECT ... FOR UPDATE` sur `loyalty_points` pendant delta/transfert pour éviter les race conditions.
- Convert-to-credit : taux configurable via `core_settings` clé `loyalty_points_to_dollar_rate` (défaut 100 pts = 1 $).
- Sync live : React Query `invalidateQueries` sur événement realtime — pas de polling.
- Pas de suppression physique de transactions — un rejet crée un contre-écriture pour garder la piste d'audit intacte.
- Tests smoke : rejouer les 9 RPC via `supabase--test_edge_functions` sur un compte staging avant merge.

## Fichiers touchés

- `supabase/migrations/*_loyalty_referrals_admin.sql` (RPCs + colonnes + realtime)
- `src/core-app/pages/CoreLoyaltyManagement.tsx` (nouveau)
- `src/core-app/pages/CoreReferralsManagement.tsx` (nouveau)
- `src/core-app/components/loyalty/*` (5 dialogs)
- `src/core-app/components/referrals/*` (2 dialogs)
- `src/core-app/pages/CoreClientProfile.tsx` (ajout sections + realtime)
- `src/pages/client/ClientReferrals.tsx` + hook loyalty client (channels realtime)
- Route + nav Core (2 entrées menu)
