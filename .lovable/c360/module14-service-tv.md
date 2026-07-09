# Module 14 — Service TV

Statut: **CLOSED — PASS ✅**

## Portée
Edge Function: `tv-account-actions`
Actions couvertes: `change_plan`, `add_themed_pack`, `remove_themed_pack`, `purchase_vod`, `terminal_action`, `set_parental`, `set_channels`.

Tables domaine: `tv_plan_changes`, `tv_addon_subscriptions`, `tv_vod_purchases`, `tv_terminal_actions`, `tv_parental_controls`, `channel_selections`.

## Corrections statiques
- **F14-1 (Audit Schema)** — `admin_audit_log` corrigé de `admin_id`/`metadata` → `admin_user_id`/`admin_email`/`details`. Élimine les audits orphelins silencieux.
- **Parité traçabilité** — `client_activity_logs` (action_type domaine + after_data) + `client_internal_notes` (`note_type='system'`) sur les 7 actions.
- **Caller identity** — lookup `profiles` pour `admin_email`, `actor_name`, `created_by_name`.

## Correction découverte pendant E2E
- **F14-2 (Parental upsert)** — `set_parental` échouait en 500 (`there is no unique or exclusion constraint matching the ON CONFLICT specification`) car la table `tv_parental_controls` n'a qu'un `UNIQUE(user_id)`. Le code ciblait `user_id,account_id` dès qu'un account_id était fourni. Corrigé: `onConflict` toujours sur `user_id`. Multi-account = backlog (nécessite migration schéma).

## E2E — Résultats

**Snapshot avant** : plans=0, addons=0, vod=0, terminal=0, parental=0, channels=0, audit_tv=0, activity(delta)=0, notes(delta)=0, email_queue(QA)=0.

**Snapshot après (avant cleanup)** : plans=1, addons=2 (1 active + 1 cancelled), vod=1, terminal=1, parental=1, channels=1, audit_tv=**9**, **orphans=0**, activity(delta)=9, notes(delta)=9, email_queue(QA)=9.

| # | Action | Résultat |
|---|--------|----------|
| 1 | `change_plan` (Essentiel → Premium, upgrade) | ✅ 200 |
| 2 | `add_themed_pack` (Sports+, Cinéma+) | ✅ 200 x2 |
| 3 | `remove_themed_pack` (Cinéma+) | ✅ 200 → status=cancelled |
| 4 | `purchase_vod` (movie, 6.99 CAD, on_invoice) | ✅ 200 |
| 5 | `terminal_action` (reboot, SN QA-TERM-M14-001) | ✅ 200 |
| 6 | `set_parental` (enable PG-13 + PIN + blocked) | ✅ 200 (après F14-2) |
| 6b | `set_parental` update (R, PIN inchangé, unblock) | ✅ 200 upsert idempotent |
| 7 | `set_channels` (2 chaînes) | ✅ 200 |

**Cas erreurs testés (tous 4xx conformes)** :
- action inconnue → 400 `Action inconnue`
- `change_plan` sans `new_plan_name` → 400
- `change_plan` prix négatif → 400
- `add_themed_pack` sans code/name → 400
- `remove_themed_pack` id inconnu → 404
- `remove_themed_pack` déjà annulé → 409
- `purchase_vod` sans titre → 400
- `purchase_vod` amount ≤ 0 → 400
- `terminal_action` type invalide → 400
- `set_parental` PIN non numérique → 400
- `set_channels` liste vide → 400
- `set_channels` IDs inconnus → 400

**Traçabilité** :
- 9 `admin_audit_log` avec `admin_user_id` toujours renseigné, `details` complet, **0 orphelin**.
- 7 `action`s distinctes (`tv.change_plan`, `tv.add_themed_pack`, `tv.remove_themed_pack`, `tv.purchase_vod`, `tv.terminal_action`, `tv.set_parental`, `tv.set_channels`).
- 9 `client_activity_logs` (staff acteur nommé).
- 9 `client_internal_notes` (`note_type=system`, corps horodaté avec motif).

**Sécurité** : uniquement via EF (`checkStaffAuth`), aucun 5xx après F14-2, aucune écriture directe UI, aucun provisioning réel (aucune commande OSS/terminal — écriture DB uniquement dans `tv_*`).

**Communication** : `email_queue` — 9 entrées templates `client_tv_*` créées par les `enqueueEmail` de l'EF (comportement attendu du module). **Purgées au cleanup QA**. Trigger observation : aucun trigger tiers sur les tables TV n'a été modifié dans ce module.

## Cleanup QA
Migration exécutée : purge `email_queue @nivra-test.ca`, `tv_*` du compte QA, `admin_audit_log tv.*` ciblé. Le compte QA reste stable (IDs conservés).

## Backlog (hors module)
- Migration schéma `tv_parental_controls` → `UNIQUE(user_id, account_id)` pour scoping multi-comptes.
- Provisioning réel terminal / OSS.
- Alignement `subscriptions` vs `billing_subscriptions` sur `change_plan`.
- Contrôle doublon `idempotency_key` (metadata seulement aujourd'hui).

## Déploiements
- `tv-account-actions` déployée deux fois (statiques + F14-2).

Statut final : **Module 14 — CLOSED, PASS ✅**.
