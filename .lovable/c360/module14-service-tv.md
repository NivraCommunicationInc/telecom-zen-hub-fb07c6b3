# Module 14 — Service TV

Statut: **OPEN — STATIC FIXES DONE — E2E PENDING**

## Portée
Edge Function: `tv-account-actions`
Actions couvertes:
- `change_plan`
- `add_themed_pack`
- `remove_themed_pack`
- `purchase_vod`
- `terminal_action` (reboot / identify / factory_reset / firmware_push / deactivate / reactivate)
- `set_parental`
- `set_channels`

Tables domaine: `tv_plan_changes`, `tv_addon_subscriptions`, `tv_vod_purchases`, `tv_terminal_actions`, `tv_parental_controls`, `channel_selections`.

## Corrections statiques appliquées

- **F14-1 (Audit Schema)** — `admin_audit_log` recevait `admin_id` + `metadata` (colonnes inexistantes). Corrigé vers `admin_user_id` + `admin_email` + `details`, alignant sur le standard vérifié aux modules 11-13. Sans ce fix, chaque action générait un audit orphelin (admin_user_id NULL) via best-effort catch → silence.
- **Parité traçabilité** — ajout systématique de `client_activity_logs` (action_type domaine + summary + after_data) et `client_internal_notes` (`note_type='system'`, body horodatée avec motif) pour les 7 actions.
- **Caller identity** — lookup `profiles` du staff pour renseigner `admin_email`, `actor_name`, `created_by_name`.
- **Email queue** — inchangé (templates `client_tv_plan_change`, `client_tv_pack_change`, `client_tv_vod_purchase`, `client_tv_terminal_action`, `client_tv_parental_controls`, `client_tv_channels_updated`). Aucun changement de comportement d'envoi. Toute observation d'entrée `email_queue` est attendue et sera purgée au cleanup QA.

## Reste hors module (backlog, ne pas traiter ici)
- Réel provisioning terminal / OSS.
- Alignement `subscriptions` vs `billing_subscriptions` sur `change_plan`.
- Contrôle de doublon idempotency_key (metadata seulement aujourd'hui).

## Déploiement
`tv-account-actions` déployée après corrections.

## Prochaine étape
E2E sur QA (`test-c360-planchange@nivra-test.ca`) — attente du feu vert.
