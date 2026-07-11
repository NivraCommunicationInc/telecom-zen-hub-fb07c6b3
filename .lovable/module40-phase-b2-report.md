# Module 40 — Phase B.2 — Rapport de migration Edge Functions

- Fichiers scannés: **89**
- Sites migrés automatiquement: **81**
- Sites non migrés (intervention manuelle requise): **38**
- Fichiers touchés par le codemod: **58**
  - dont fichiers 100% migrés: **57**
  - dont fichiers partiellement migrés: **1**
- Fichiers non modifiés (100% des sites laissés au manuel): **25**

## Sécurité de la migration

- Mapping explicite verrouillé pour: subject, body_html, body_text, cc, bcc, reply_to, attachments, priority, scheduled_for, entity_type, entity_id, correlation_id, actor_user_id, actor_role, category.
- `idempotency_key` prioritaire, `event_key` en fallback (jamais les deux → conflit).
- `metadata` fusionné **clé-par-clé** dans `templateVars` uniquement si littéral et sans collision (sinon site refusé).
- `language` fusionné dans `templateVars` uniquement si absent (sinon no-op, jamais de doublon).
- Aucune clé dupliquée générée dans `templateVars`.
- Sites destructurant `{ error }` / `{ data, error }` enveloppés dans un adapteur try/catch pour préserver les branches d'erreur existantes.
- Sites ambigus → **laissés non migrés** (aucun fallback compilable-mais-incorrect).
- `tsgo --noEmit` : ✅ vert.

## Détail — sites nécessitant une intervention manuelle

### `unsafe:missing_idempotency_key` — 36 site(s) sur 24 fichier(s)

Cause: aucun `idempotency_key` ni `event_key` fourni. Le RPC canonique impose un idempotencyKey ≥ 8 caractères. Il faut choisir/introduire une clé de déduplication métier stable avant migration.

- `supabase/functions/account-ops-actions/index.ts` — 1 site(s)
- `supabase/functions/agent-analytics/index.ts` — 1 site(s)
- `supabase/functions/agent-billing/index.ts` — 5 site(s)
- `supabase/functions/agent-crm-optimizer/index.ts` — 1 site(s)
- `supabase/functions/agent-recruitment/index.ts` — 4 site(s)
- `supabase/functions/agent-retention/index.ts` — 2 site(s)
- `supabase/functions/agent-sales-assignment/index.ts` — 1 site(s)
- `supabase/functions/agent-sales/index.ts` — 1 site(s)
- `supabase/functions/agent-support/index.ts` — 2 site(s)
- `supabase/functions/agent-sync/index.ts` — 1 site(s)
- `supabase/functions/auto-create-client-account/index.ts` — 1 site(s)
- `supabase/functions/billing-account-actions/index.ts` — 1 site(s)
- `supabase/functions/client-plan-change/index.ts` — 3 site(s)
- `supabase/functions/collections-account-actions/index.ts` — 1 site(s)
- `supabase/functions/core-apply-plan-change/index.ts` — 2 site(s)
- `supabase/functions/disputes-account-actions/index.ts` — 1 site(s)
- `supabase/functions/equipment-account-actions/index.ts` — 1 site(s)
- `supabase/functions/internet-account-actions/index.ts` — 1 site(s)
- `supabase/functions/kyc-account-actions/index.ts` — 1 site(s)
- `supabase/functions/mobile-account-actions/index.ts` — 1 site(s)
- `supabase/functions/nova-email-handler/index.ts` — 1 site(s)
- `supabase/functions/nova-watchdog/index.ts` — 1 site(s)
- `supabase/functions/send-nps-survey/index.ts` — 1 site(s)
- `supabase/functions/tv-account-actions/index.ts` — 1 site(s)

### `unsafe:ambiguous_template_vars_merge:language` — 1 site(s) sur 1 fichier(s)

Cause: `template_vars` est une variable (non-littéral) et une clé (`language`) doit y être fusionnée. Merge impossible sans risque d'écrasement silencieux.

- `supabase/functions/_shared/ResendProxy.ts` — 1 site(s)

### `unsafe:unknown_key:to` — 1 site(s) sur 1 fichier(s)

Cause: colonne inconnue dans l'insert (probablement code legacy avec noms de colonnes erronés). À corriger manuellement.

- `supabase/functions/sla-monitor/index.ts` — 1 site(s)


## Fichiers 100% migrés (aucune intervention manuelle)

- supabase/functions/_shared/reactivationEngine.ts
- supabase/functions/_shared/ticketService.ts
- supabase/functions/account-document-manage/index.ts
- supabase/functions/admin-audit-session-link/index.ts
- supabase/functions/admin-manage-staff/index.ts
- supabase/functions/agent-site-monitor/index.ts
- supabase/functions/agent-supervisor/index.ts
- supabase/functions/billing-admin-daily-digest/index.ts
- supabase/functions/billing-create-order/index.ts
- supabase/functions/billing-create-subscription/index.ts
- supabase/functions/billing-daily-overdue-reminders/index.ts
- supabase/functions/billing-data-retention/index.ts
- supabase/functions/billing-dunning-engine/index.ts
- supabase/functions/billing-lifecycle/index.ts
- supabase/functions/billing-notify-policy-update/index.ts
- supabase/functions/billing-reconciliation/index.ts
- supabase/functions/cancel-account/index.ts
- supabase/functions/client-account-admin/index.ts
- supabase/functions/commission-monthly-report/index.ts
- supabase/functions/complaint-escalate-crtc/index.ts
- supabase/functions/consent-journal-action/index.ts
- supabase/functions/contract-signature-reminders/index.ts
- supabase/functions/core-issue-compensation/index.ts
- supabase/functions/core-square-payment-link/index.ts
- supabase/functions/crm-lead-capture/index.ts
- supabase/functions/field-bonus-calculator/index.ts
- supabase/functions/field-payment-link-create/index.ts
- supabase/functions/field-sales-complete-onboarding/index.ts
- supabase/functions/generate-employee-badge/index.ts
- supabase/functions/interview-send-invitations/index.ts
- supabase/functions/interview-submit/index.ts
- supabase/functions/inventory-alert/index.ts
- supabase/functions/notify-maintenance/index.ts
- supabase/functions/nova-brain/index.ts
- supabase/functions/nps-survey-batch/index.ts
- supabase/functions/onboarding-form-submit/index.ts
- supabase/functions/ops-watchdog/index.ts
- supabase/functions/pay-commissions-friday/index.ts
- supabase/functions/payment-reminder/index.ts
- supabase/functions/portal-add-credit/index.ts
- supabase/functions/pos-square-intent/index.ts
- supabase/functions/qa-module36-runner/index.ts
- supabase/functions/qa-module37-runner/index.ts
- supabase/functions/referrals-account-actions/index.ts
- supabase/functions/review-email-dispatcher/index.ts
- supabase/functions/send-reassurance-blast/index.ts
- supabase/functions/service-freeze-actions/index.ts
- supabase/functions/service-move-actions/index.ts
- supabase/functions/sign-contract-public/index.ts
- supabase/functions/square-charge-invoice/index.ts
- supabase/functions/square-charge-subscription/index.ts
- supabase/functions/square-detach-card/index.ts
- supabase/functions/square-migration-email/index.ts
- supabase/functions/square-save-card/index.ts
- supabase/functions/staff-complete-onboarding/index.ts
- supabase/functions/supervisor-escalation-action/index.ts
- supabase/functions/support-ai-responder/index.ts

## Fichiers partiellement migrés (revue recommandée)

- `supabase/functions/agent-billing/index.ts` — 1 migrés, 5 manuels
