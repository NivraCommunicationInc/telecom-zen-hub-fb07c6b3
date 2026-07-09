# Module 2 — Accès en ligne

## Périmètre validé (sans email)

**Statut : ✅ VALIDÉ — PÉRIMÈTRE SANS-EMAIL FERMÉ**

Actions validées en E2E sur compte QA `test-c360-planchange-v2@nivra-test.ca` :

| # | Action | Preuves collectées | Résultat |
|---|---|---|---|
| 1 | `set_temporary_password` | `admin_audit_log` (client_account.temp_password_set), `client_activity_logs` (account_access), `client_internal_notes` (system), 0 email_queue | ✅ PASS |
| 2 | `force_logout` | idem + correction du bug `admin.auth.admin.signOut()` remplacé par `listUserSessions` + `deleteSession` | ✅ PASS |
| 3 | `force_confirm_email` | idem | ✅ PASS |
| 8 | `change_email` sans motif → bouton disabled | UI disabled + toast | ✅ PASS |
| 9 | `change_email` avec email invalide + motif | toast « Nouveau courriel invalide. » | ✅ PASS |

**Sécurité validation :**
- Aucun email envoyé (`email_queue = 0`)
- Aucun abonnement modifié
- Aucun compte client réel touché

## Périmètre email (en attente — phase dédiée)

Les workflows suivants restent **ouverts** dans ce module et ne doivent PAS être exécutés sans approbation explicite préalable :

- `send_password_reset`
- `send_invite`
- `resend_welcome`
- `change_email` valide (avec envoi de notification aux adresses impliquées)

## Fichiers modifiés

- `src/shared-ops/components/ClientAccountAccessDialog.tsx`
- `supabase/functions/client-account-admin/index.ts`

## Notes techniques

- Le motif est obligatoire pour `change_email` (min. 3 caractères via `callCoreAction`).
- Les actions destructrices affichent une confirmation native `window.confirm`.
- Les erreurs Edge Function sont mappées en toast français.
- `force_logout` itère sur les sessions actives de `auth.sessions` et les supprime une par une.

## Décision requise

Avant passage au Module 3, choisir la stratégie pour le périmètre email :

1. **Préparer maintenant les corrections statiques** des workflows email (sans les exécuter), afin qu'ils soient prêts pour la phase dédiée.
2. **Garder ouvert sans travail** jusqu'à la phase dédiée ; passer directement au Module 3.
