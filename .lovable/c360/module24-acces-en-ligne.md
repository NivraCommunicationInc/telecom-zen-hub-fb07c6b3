# Module 24 — Accès en ligne · Rapport final E2E QA

**Statut : ✅ CLOSED**
Date : 2026-07-10
Compte QA : `test-c360-planchange-v2@nivra-test.ca` (client_id `d97815e8…`)
Admin utilisé : `nivratelecom@gmail.com` — Staff non-admin (CROSS_ROLE) : `support@nivra-telecom.ca`

## Résultats

| # | Test | Résultat |
|---|---|---|
| 1 | `send_password_reset` nominal (client existant) | ✅ 200 générique |
| 1 | `send_password_reset` email inconnu → anti-énumération | ✅ 200 générique (fix appliqué) |
| 2 | `send_invite` client existant | ✅ 200 générique (fix pagination `listUsers`) |
| 2 | `send_invite` inconnu → générique | ✅ 200 |
| 3 | `resend_welcome` existant + inconnu | ✅ 200 dans les 2 cas |
| 4 | `force_confirm_email` existant | ✅ 200 |
| 4 | `force_confirm_email` inconnu → générique | ✅ 200 |
| 5 | `set_temporary_password` staff non-admin | ✅ 403 `ADMIN_ONLY` |
| 5 | `set_temporary_password` motif < 5 chars | ✅ 400 `REASON_REQUIRED` |
| 5 | `set_temporary_password` nominal | ✅ 200, `Cache-Control: no-store`, mot de passe absent des `details` |
| 6 | `force_logout` sans motif | ✅ 400 `REASON_REQUIRED` |
| 6 | `force_logout` nominal | ✅ 200, sessions supprimées, audit + activity + note |
| 7 | `disable_portal_access` staff non-admin | ✅ 403 `ADMIN_ONLY` |
| 7 | `disable_portal_access` nominal | ✅ 200, `security_status='suspended'`, sessions révoquées |
| 8 | `enable_portal_access` nominal | ✅ 200, `security_status='active'` |
| 9 | Cible = staff → `CROSS_ROLE_TARGET` | ✅ 403 avec code |
| 9 | Cible = auth user sans compte client (`NOT_A_CLIENT`) | ✅ réponse générique pour action enum-safe |
| 10 | Anti-flood 60s (2× `send_password_reset`) | ✅ 2ᵉ appel 429 `RATE_LIMITED` |
| 11 | `admin_audit_log` — `admin_user_id NULL` | ✅ 0 ligne |
| 11 | `admin_audit_log` — leak mot de passe temporaire | ✅ aucune fuite |
| 11 | `client_activity_logs` présents | ✅ 8 lignes générées |
| 11 | `client_internal_notes` présentes | ✅ 8 lignes générées |
| 11 | `email_queue` (aucun envoi direct) | ✅ 5 messages en file, aucun bypass |

## Correctifs appliqués pendant la passe

**`supabase/functions/client-account-admin/index.ts`**
1. **Résolution de la cible** — remplacé `admin.auth.admin.listUsers()` (max 50 par défaut) par une recherche prioritaire dans `profiles.email` + fallback paginé (20×200). Empêche `send_invite` de retomber sur `createUser` (et son erreur d'unicité qui divulguait l'existence).
2. **`send_password_reset` anti-enum** — court-circuit générique 200 quand `targetId` est absent, sans appeler `generateLink` (qui renvoyait auparavant un 500 « User not found »).

## Cleanup exécuté

- `admin_audit_log`, `client_activity_logs`, `client_internal_notes` pour le compte QA : purgés pour la fenêtre de test.
- `email_queue` pour `%@nivra-test.ca` : purgé (aucun envoi Mailgun réel — messages restés en `queued` sauf le premier reset `sent` neutralisé par la suppression).
- `profiles.security_status` du QA : remis à `active`.
- Fonction `qa-module24-runner` : déployée puis supprimée (fichier retiré du repo, endpoint supprimé côté Supabase).

## Aucune régression sur clients réels

- Tests scopés au tag `qa_test_account`.
- Utilisateur `throwaway` créé pour le test `NOT_A_CLIENT` : supprimé par le runner en fin de passe.

## Fichiers modifiés

- `supabase/functions/client-account-admin/index.ts`
- `.lovable/c360/module24-acces-en-ligne.md` (ce rapport)
