# BUG-COMMS-001 — Migration `enqueueCommunication` vers signature Module 40

**Statut :** OPEN — inventaire complet, migration à planifier
**Ouvert le :** 2026-07-12
**Lié à :** BUG-CORE-001 (fix ponctuel de `field-payment-link-create` déjà appliqué)

---

## Contexte

Le wrapper canonique edge (`supabase/functions/_shared/enqueueCommunication.ts`)
expose UNE seule signature valide :

```ts
await enqueueCommunication(supabase, {
  channel, templateKey, recipient, idempotencyKey, templateVars, ...
});
```

Le premier argument DOIT être un client service-role. Sans lui, l'appel throw
immédiatement (`Cannot read properties of undefined (reading 'rpc')`), ce qui
casse silencieusement l'email en aval sans que la fonction principale n'échoue
(les appels sont dans des `try/catch` ou `.then(undefined,()=>{})`).

## Inventaire — appels avec signature invalide `enqueueCommunication({...})`

Total : **57 fichiers**, **~85 sites d'appel**.

### Edge Functions concernées

| Fonction | # sites | Impact utilisateur si oubli |
|---|---|---|
| `admin-manage-staff` | 7 | Onboarding staff : email d'invitation / reset non envoyé |
| `billing-lifecycle` | 8 | Renouvellements, avis, résiliations : notifications client absentes |
| `nova-brain` | 3 | Résumés automatisés non transmis |
| `contract-signature-reminders` | 2 | Relances contrat KO |
| `billing-notify-policy-update` | 2 | Notification changement de politique KO |
| `complaint-escalate-crtc` | 2 | Escalade CRTC : email interne + client KO |
| `crm-lead-capture` | 2 | Accusé de réception lead KO |
| `field-sales-complete-onboarding` | 2 | Bienvenue vendeur terrain KO |
| `onboarding-form-submit` | 2 | Confirmation candidat KO |
| `sign-contract-public` | 2 | Confirmation signature contrat KO |
| `support-ai-responder` | 2 | Réponses IA support KO |
| `agent-billing` | 1 | Notif facturation agent KO |
| `agent-review-request` | 1 | Demande d'avis client KO |
| `agent-site-monitor` | 1 | Alerte monitoring KO |
| `agent-supervisor` | 1 | Escalade superviseur KO |
| `admin-audit-session-link` | 1 | Lien audit staff KO |
| `billing-admin-daily-digest` | 1 | Digest admin KO |
| `billing-create-order` | 1 | **CRITIQUE** — confirmation commande |
| `billing-create-subscription` | 1 | **CRITIQUE** — activation abonnement |
| `billing-daily-overdue-reminders` | 1 | Relance en retard KO |
| `billing-data-retention` | 1 | Avis rétention KO |
| `billing-dunning-engine` | 1 | Dunning KO |
| `billing-reconciliation` | 1 | Notif réconciliation KO |
| `cancel-account` | 1 | Confirmation annulation KO |
| `client-account-admin` | 1 | Notif admin sur compte KO |
| `commission-monthly-report` | 1 | Rapport mensuel agent KO |
| `consent-journal-action` | 1 | Confirmation Loi 25 KO |
| `contract-signature-reminders` | (voir plus haut) | |
| `core-issue-compensation` | 1 | Notif compensation KO |
| `core-square-payment-link` | 1 | **CRITIQUE** — lien paiement Core |
| `field-bonus-calculator` | 1 | Notif bonus agent KO |
| `generate-employee-badge` | 1 | Envoi badge KO |
| `interview-send-invitations` | 1 | Invitations entretien KO |
| `interview-submit` | 1 | Accusé entretien KO |
| `inventory-alert` | 1 | Alerte stock KO |
| `notify-maintenance` | 1 | Avis maintenance client KO |
| `nps-survey-batch` | 1 | Sondage NPS KO |
| `pay-commissions-friday` | 1 | Confirmation paiement commission KO |
| `payment-reminder` | 1 | Rappel paiement KO |
| `portal-add-credit` | 1 | Confirmation crédit KO |
| `pos-square-intent` | 1 | **CRITIQUE** — lien paiement POS |
| `qa-module36-runner` | 1 | Test QA (non-prod) |
| `qa-module37-runner` | 1 | Test QA (non-prod) |
| `square-charge-invoice` | 1 | Confirmation paiement Square KO |
| `square-charge-subscription` | 1 | Confirmation autopay KO |
| `square-detach-card` | 1 | Notif carte retirée KO |
| `square-migration-email` | 1 | Migration Square KO |
| `square-save-card` | 1 | Confirmation carte sauvée KO |
| `send-nps-survey` (déjà utilise `admin`) | — | (à revérifier) |
| `send-reassurance-blast` | 1 | Blast rassurance KO |
| `service-freeze-actions` | 1 | Confirmation gel KO |
| `service-move-actions` | 1 | Confirmation déménagement KO |
| `referrals-account-actions` | 1 | Notif parrainage KO |
| `review-email-dispatcher` | 1 | Dispatcher avis KO |
| `staff-complete-onboarding` | 1 | Onboarding staff KO |
| `_shared/reactivationEngine.ts` | 1 | Réactivation abonnement KO |
| `_shared/ticketService.ts` | 1 | Création ticket KO |
| `send-interac-migration-notice` | (déjà nouvelle signature) | (à vérifier) |

### Fichiers propres (référence)

`field-payment-link-create` (corrigé au BUG-CORE-001), `_shared/agentHelpers.ts`,
`_shared/enqueueCommunication.ts` (le wrapper lui-même).

## Impact global

- **Impact fonctionnel :** courriels transactionnels manquants sur ~50
  parcours (onboarding, facturation, activation, résiliation, KYC…).
- **Impact utilisateur :** silencieux — la fonction principale répond `ok`
  mais l'email/SMS n'est jamais mis en file.
- **Impact audit :** aucun échec n'apparaît dans `communication_audit_log`
  car l'appel throw avant l'enqueue.

## Plan de migration proposé (à valider avant exécution)

1. **Phase 1 — Codemod automatisé**
   `enqueueCommunication({ ... })` → `enqueueCommunication(<client>, { ... })`.
   Détection du client : première variable Supabase déclarée dans la même
   fonction (`supabase`, `admin`, `serviceClient`, `sb`).
2. **Phase 2 — Revue humaine ciblée** sur les 8 fonctions marquées
   « CRITIQUE » ci-dessus (paiement / activation / commande).
3. **Phase 3 — Test unitaire** : ajout d'un lint AST qui bloque tout appel
   `enqueueCommunication` avec un seul argument.
4. **Phase 4 — Déploiement en 3 vagues** (billing → agents → autres), avec
   observation du volume `communication_audit_log` avant/après.
5. **Phase 5 — Flip `enforce_single_door=true`** dans
   `communication_gateway_config` une fois les 85 sites migrés.

## Estimation

- Codemod + tests : ~2 h
- Revue critique + QA : ~3 h
- Rollout observé : ~1 j

## Ne pas oublier

- `send-nps-survey` et `send-interac-migration-notice` : à revérifier — le
  grep peut avoir raté des variantes.
- Les tests `qa-module36-runner` et `qa-module37-runner` sont en QA, mais
  doivent être migrés aussi pour garder le régime homogène.
