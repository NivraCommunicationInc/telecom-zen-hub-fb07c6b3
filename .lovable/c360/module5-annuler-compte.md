# Module 5 — Annuler le compte

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Corrections statiques déposées

### Edge Function `account-ops-actions`
Ajout de l'action `cancel_account` :
- Validation staff (`checkStaffAuth`) + role autorisé.
- `account_id` et `client_user_id` requis.
- **Motif obligatoire** (400 si vide).
- Fetch du compte, blocage si déjà `cancelled` (409 « Ce compte est déjà résilié »).
- Update `accounts` : `status='cancelled'`, `cancelled_at=now()`, `cancellation_reason=<motif>`, `updated_at`.
- Résiliation des `billing_subscriptions` avec status ∈ (`active`,`past_due`,`trialing`) → `cancelled` + `cancelled_at`. Retourne le count.
- **Audit** `admin_audit_log` (`account_ops.cancel_account`, details = motif + previous_status + cancelled_subscriptions).
- **Activity log** `client_activity_logs` (`action_type='account_cancel'`, résumé FR).
- **Note interne** `client_internal_notes` (`note_type='system'`, corps FR nommant l'admin).
- Aucun email envoyé.

### UI `CancelAccountDialog` (`Account360RowDialogs.tsx`)
- Suppression des writes directs sur `accounts` / `billing_subscriptions`.
- Passe désormais par `supabase.functions.invoke("account-ops-actions", { action: "cancel_account" })`.
- Prop `clientId` (obligatoire) + `accountStatus` ajoutés.
- Motif requis côté UI ; bouton désactivé tant que motif + « ANNULER » incomplets.
- Détection « déjà résilié » → bannière ambrée + bouton désactivé.
- Reset des champs à la fermeture.
- Toast succès inclut le nombre de services résiliés.

### `Account360QuickActions.tsx`
- Passe `clientId` et `accountStatus` au dialog.

## Périmètre E2E à valider (compte QA uniquement)

1. **Erreurs UI/EF**
   - Motif vide → bouton désactivé, tentative directe EF → 400 FR.
   - Confirmation ≠ "ANNULER" → bouton désactivé.
2. **Annulation nominale**
   - Compte actif QA → annulation avec motif.
   - `accounts.status='cancelled'`, `cancelled_at` set, `cancellation_reason` = motif.
   - `billing_subscriptions` actifs → `cancelled` + `cancelled_at`.
   - `admin_audit_log`, `client_activity_logs`, `client_internal_notes` présents.
3. **Double annulation**
   - Rejouer → 409 « Ce compte est déjà résilié ».
4. **Sécurité**
   - EF est le seul chemin (aucun `.from("accounts").update` client-side).
   - Aucun email généré (`email_queue` inchangé sur le périmètre).
5. **UI Playwright** — même limitation potentielle 2FA que Module 4.

## Rappels
- Aucun compte réel ne doit être touché.
- Aucun email envoyé sans approbation.
- Aucun abonnement annulé hors compte QA.
