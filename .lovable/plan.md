
# Module 54 — Phase B : Plan de canonicalisation `billing_subscriptions`

Aucune modification exécutée. Plan lecture-seule pour validation.

## 1. Migration de `subscription_number`

### Utilisations réelles détectées

Scan `rg subscription_number`:

| Fichier | Lecture | Écriture | Impact |
|---|---|---|---|
| `src/integrations/supabase/types.ts` | Type auto-généré | — | Régénéré après migration |
| `fn_automate_order_confirmed` (DB trigger sur `orders`) | — | INSERT dans `subscriptions` | Doit être adapté |

**Verdict** : `subscription_number` est **quasi-inutilisé** — pas d'UI, pas de PDF, pas d'API cliente, pas de recherche. Seul le trigger `fn_automate_order_confirmed` le peuple. Aucune dépendance externe → **migration triviale**.

### Stratégie

1. Ajouter `subscription_number text` sur `billing_subscriptions` (nullable, unique partiel `WHERE subscription_number IS NOT NULL`).
2. Backfill : `UPDATE billing_subscriptions bs SET subscription_number = s.subscription_number FROM subscriptions s WHERE s.order_id = bs.order_id AND bs.subscription_number IS NULL` (17 lignes max).
3. Séquence : réutiliser le générateur existant du trigger (probablement `NIV-YYYY-######`).
4. Index : `CREATE UNIQUE INDEX idx_bs_subscription_number ON billing_subscriptions(subscription_number) WHERE subscription_number IS NOT NULL`.
5. Rollback : `ALTER TABLE billing_subscriptions DROP COLUMN subscription_number` — non destructif.

## 2. Dual writes recensés (précis)

### 2a. Edge Functions écrivant `subscriptions`

| EF | Ligne | Opération | Raison | Suppression proposée |
|---|---|---|---|---|
| `internet-account-actions` | 445 | `UPDATE plan_name, monthly_price, amount` (commentaire `F28-17 — sync subscriptions AND billing_subscriptions`) | Mirror legacy lors changement plan | Supprimer bloc entier |
| `tv-account-actions` | 477 | Idem | Mirror legacy | Supprimer bloc entier |
| `mobile-account-actions` | 218 | SELECT seulement (validation ownership) | Lecture defensive | Basculer sur `billing_subscriptions` |
| `client-plan-change` | 142 | UPDATE mirror (`// Legacy subscriptions table mirror (non-canonical, informational)`) | Miroir explicite | Supprimer bloc |
| `qa-module30-runner` | 117, 165 | INSERT/DELETE (tests) | Setup QA | Adapter test vers `billing_subscriptions` |
| `qa-module31-runner` | 188 | DELETE (cleanup QA) | Cleanup | Adapter test |

### 2b. SQL Triggers/Functions écrivant `subscriptions`

| Fonction | Rôle |
|---|---|
| `fn_automate_order_confirmed` | Trigger sur `orders` — INSERT dans `subscriptions` (peuple `subscription_number`). **Nécessite refactor** : écrire dans `billing_subscriptions` uniquement (l'INSERT `billing_subscriptions` existe déjà en parallèle via `billing-create-order` EF ; l'INSERT trigger est **redondant** dans la pratique). |
| `subscription_bill_cycle_trigger` | BEFORE UPDATE sur `subscriptions` (dérivé). Devient obsolète. |

### 2c. Frontend écritures directes

Aucune. Seul `src/lib/serviceInstancesCreation.ts` écrit `service_instances` (à revoir Phase D).

### Ordre d'exécution actuel

```
Order confirmed
  ├─ Trigger fn_automate_order_confirmed → INSERT subscriptions (avec subscription_number)
  └─ EF billing-create-order → INSERT billing_subscriptions
      └─ Trigger ensure_service_instance_from_subscription → INSERT service_instances
```

**Risque actuel** : les deux INSERT sont indépendants — si le trigger DB échoue et l'EF réussit (ou vice-versa), divergence.

## 3. Écriture canonique cible (post-migration)

Toutes les opérations écrivent **uniquement** dans `billing_subscriptions` via EF canonique :

| Opération | EF canonique | Audit | Timeline | Idempotency |
|---|---|---|---|---|
| Création | `billing-create-order` / `billing-create-subscription` | `admin_audit_log` | `writeAccountJournal` | `orders.idempotency_key` |
| Activation | `checkout-canonical-sync` | `billing_provenance` | ✓ | `checkout_sessions` |
| Suspension | `billing-lifecycle` / `account-ops-actions` | `admin_audit_log` | ✓ | `client_account_action_idempotency` |
| Reprise | `_shared/reactivationEngine` | ✓ | ✓ | ✓ |
| Upgrade/Downgrade/Changement plan | `client-plan-change` / `core-apply-plan-change` | ✓ | ✓ | `client_account_action_idempotency` |
| Annulation | `cancel-account` / `client-account-actions` | ✓ | ✓ | ✓ |
| Résiliation (fin cycle) | `billing-lifecycle` | ✓ | ✓ | ✓ |
| Renouvellement | `billing-generate-renewals` / `billing-subscription-cycle` | `billing_automation_runs` | ✓ | `billing_provenance` |
| TV/Internet/Mobile plan changes | `tv-/internet-/mobile-account-actions` | ✓ | ✓ | Existante |

## 4. Projection `service_instances`

### Trigger actuel : `ensure_service_instance_from_subscription`

- **Données copiées** : `user_id`, `account_id`, `order_id`, `service_type`, `plan_name`, `status`, `monthly_price`, `start_date`, `service_address_id`, `metadata->>'subscription_id'`.
- **Fréquence** : synchrone, sur INSERT/UPDATE de `billing_subscriptions` quand `status='active'`.
- **Garantie** : idempotent via check `NOT EXISTS ... si.metadata->>'subscription_id' = NEW.id`.
- **Risques** : (a) déclenché uniquement si `status='active'` — les passages `suspended/cancelled` ne mettent pas à jour la projection ; (b) `equipment_details` et `status_reason/status_changed_at/status_changed_by` sont **exclusifs** à `service_instances` — pas écrits par le trigger.

### Recommandations

- **Étendre le trigger** pour couvrir tous les status (suspended, cancelled, paused) — nécessaire pour Provisioning.
- **Conserver `equipment_details`, `status_reason`, `status_changed_at`, `status_changed_by`, `metadata`** dans `service_instances` : ce sont des colonnes opérationnelles distinctes de la facturation. Ne PAS déplacer.
- Alternative long terme : remplacer par `MATERIALIZED VIEW v_service_instances` — écarté car les colonnes opérationnelles nécessitent écriture indépendante.

**Verdict** : `service_instances` reste projection dérivée + colonnes opérationnelles propres. Trigger à durcir.

## 5. Impact Frontend (liste exhaustive)

### Fichiers à modifier

| Fichier | Type | Action |
|---|---|---|
| `src/core-app/pages/DashboardPage.tsx` | Lecture `subscriptions` | Remplacer par `billing_subscriptions` |

### Fichiers déjà canoniques (aucun changement)

Les 55 fichiers listés en Phase A qui lisent `billing_subscriptions` restent inchangés.

### Fichiers `service_instances` (aucun changement)

`src/lib/serviceInstancesCreation.ts`, `StaffClientServicesSection.tsx`, `StaffClientEquipmentSection.tsx`, `AccountServicesTab.tsx`, `ServiceActionsMenu.tsx` : conservés — utilisent la projection opérationnelle.

## 6. Impact Backend

| Composant | Impact | Difficulté | Risque |
|---|---|---|---|
| `internet-account-actions` (l.440-460) | Supprimer bloc UPDATE `subscriptions` | Faible | Faible |
| `tv-account-actions` (l.473-490) | Supprimer bloc UPDATE `subscriptions` | Faible | Faible |
| `mobile-account-actions` (l.215-225) | Migrer SELECT vers `billing_subscriptions` (join `billing_customers` pour `user_id`) | Moyenne | Moyen (validation ownership) |
| `client-plan-change` (l.140-155) | Supprimer bloc mirror | Faible | Faible |
| `billing-subscription-cycle` | Adapter lectures dérivées | Moyenne | Moyen |
| `tech-map-data` | Migrer lecture | Faible | Faible |
| `support-ai-responder` | Migrer lecture | Faible | Faible |
| `qa-module26/28/30/31-runner` | Adapter setup tests | Faible | Faible |
| Trigger DB `fn_automate_order_confirmed` | Retirer branche INSERT `subscriptions` (redondante avec EF `billing-create-order`) | **Élevée** — trigger critique | **Élevé** — vérifier zéro régression order-confirmed → subscription |
| Trigger `ensure_service_instance_from_subscription` | Étendre pour tous les statuts | Moyenne | Moyen |
| `subscription_bill_cycle_trigger` | Supprimer (devient inutile) | Faible | Faible |

## 7. Impact Billing

- **Renouvellements** : `billing-generate-renewals` lit/écrit `billing_subscriptions` uniquement → OK.
- **Prorata** : calculs déjà basés sur `billing_subscriptions.plan_price` (mémoire `prorata-immediat-3c`) → OK.
- **Changements de plan** : sécurisés via `frozen_*` sur `billing_subscriptions` → OK.
- **Annulations** : `cancel-account` écrit `billing_subscriptions.status='cancelled'` → OK.
- **Reprises** : `_shared/reactivationEngine` → OK.
- **Invoices** : `billing_invoices.subscription_id` référence `billing_subscriptions.id` (déjà) → OK.
- **Paiements** : `billing_payments` → invoice → billing_subscription → OK.

**Exception unique** : `fn_automate_order_confirmed` insère aujourd'hui dans `subscriptions` avant l'EF ; à valider que sa désactivation ne casse aucun consommateur legacy (recherche `subscriptions` lue par autre chose que `DashboardPage` a donné 0).

## 8. Compatibilité historique — Option retenue : **A puis C**

**Option A immédiate — Lecture seule** :
- `REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated, service_role` (garder SELECT).
- Ajouter trigger BEFORE INSERT/UPDATE/DELETE `RAISE EXCEPTION 'subscriptions is deprecated — use billing_subscriptions'`.
- Conservation 90 jours pour audit/reconciliation.

**Option C différée — Suppression après quarantaine (T+90j)** :
- Après 90 jours de zéro écriture et zéro lecture applicative (monitoring `pg_stat_user_tables`), `DROP TABLE public.subscriptions CASCADE`.

**Justification** : les 17 lignes actuelles peuvent servir de référence audit historique. Aucun coût de conservation. La suppression irréversible attend la preuve terrain d'absence d'usage.

## 9. Plan d'implémentation — Sous-phases

### B.1 — Extension schéma (migration 1)
- Ajouter `subscription_number` sur `billing_subscriptions`.
- Backfill depuis `subscriptions` via `order_id`.
- Index unique partiel.
- Tests : vérifier 17 lignes backfillées + unicité.
- Rollback : DROP COLUMN.

### B.2 — Trigger `fn_automate_order_confirmed` (migration 2)
- Retirer la branche INSERT `subscriptions` du trigger.
- Ajouter écriture de `subscription_number` dans le flux `billing-create-order` EF.
- Tests : `crm-create-sale/regression_3ab`, `billing-create-order/regression_58953`.
- Rollback : restaurer version antérieure du trigger.

### B.3 — Nettoyage dual writes EF (7 fichiers)
- `internet-account-actions`, `tv-account-actions`, `mobile-account-actions`, `client-plan-change` : retirer blocs mirror.
- QA runners : migrer setup.
- Tests : `qa-module26/28/30/31-runner` doivent PASS.
- Rollback : git revert par fichier.

### B.4 — Migration lecture (2 fichiers + 2 EF)
- `DashboardPage.tsx`, `tech-map-data`, `support-ai-responder`, `billing-subscription-cycle`.
- Tests : smoke tests Core + Portal.
- Rollback : git revert.

### B.5 — Durcissement projection `service_instances` (migration 3)
- Étendre trigger à tous les statuts.
- Tests : QA module 31 étendu.
- Rollback : restaurer version antérieure.

### B.6 — Freeze `subscriptions` (migration 4)
- Trigger 410 sur écritures.
- Revoke privileges.
- Tests : tenter INSERT depuis service_role échoue avec message clair.
- Rollback : DROP TRIGGER + GRANT.

### B.7 — Régénération types + CI guard
- Régénérer `src/integrations/supabase/types.ts`.
- Ajouter guard CI : `rg "from\(['\"]subscriptions['\"]\)" src/ supabase/functions/` doit être vide (hors QA archivés).

### B.8 — Quarantaine 90 jours + monitoring
- Alerte si écriture tentée sur `subscriptions`.
- Métrique `pg_stat_user_tables.n_tup_ins/upd/del = 0`.

### B.9 — Suppression finale (migration 5, T+90j)
- `DROP TABLE public.subscriptions CASCADE`.
- Rollback : restore depuis backup (irréversible en pratique).

## 10. Critères de réussite

- Zéro écriture sur `subscriptions` (SQL/EF/frontend) — scan CI vert.
- `subscription_number` présent, unique, backfillé sur `billing_subscriptions`.
- `service_instances` reste projection + colonnes opérationnelles ; trigger étendu à tous statuts.
- Tests `qa-module26/28/30/31/33/47`, `regression_58953`, `regression_3ab`, `billing-hardening.spec`, `portal-change-plan.spec` : tous PASS.
- Aucune régression Core (Subscriptions/Billing/Provisioning/PlanChanges/Cancellations/MRR).
- Aucune régression Portal (`ClientServices`, `ClientMyServices`, `ClientBillingHub`).
- Aucune régression Employee (`EmployeeAccounts`, `EmployeeAccountDetail`, `EmployeeDashboard`).
- Aucune régression Billing (renewals, prorata, invoices, payments).
- Provisioning : `service_status`, `provisioning_jobs`, `customer_portal_projection_*` cohérents avec `billing_subscriptions`.

## Risques transverses & Rollback

| Risque | Mitigation | Rollback |
|---|---|---|
| Trigger `fn_automate_order_confirmed` casse la création d'abonnement | Feature flag DB variable + double-write temporaire pendant B.2 | Restaurer version antérieure du trigger |
| Backfill `subscription_number` collision | Index partiel + validation pré-migration | DROP INDEX + fix data |
| Lecture legacy oubliée | Grep exhaustif + monitor `pg_stat` sur `subscriptions` | Restaurer GRANT lecture (déjà en place) |
| Frontend cache types obsolètes | Régénération types + rebuild forcé | Revert types.ts |

## Livrable

Plan complet. **Aucun code produit. Aucune modification effectuée. Module 54 reste OUVERT — en attente validation Phase B pour démarrer Phase C (implémentation).**
