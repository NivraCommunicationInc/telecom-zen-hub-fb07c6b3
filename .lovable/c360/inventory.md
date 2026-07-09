# Client 360 — Inventaire technique (Phase 0.1)

Légende état :
- ✅ **conforme** : correspond déjà au standard Upgrade/Downgrade (contexte + workflow + audit + realtime + UI shell).
- 🟡 **partiel** : dialog fonctionnel + Edge Function canonique mais UI hors shell et/ou pas d'audit/contexte complet.
- 🟠 **stub** : dialog qui écrit en base ou envoie une notif sans passer par un workflow canonique complet.
- 🔴 **non connecté** : bouton qui redirige/navigue sans centre de contrôle réel.
- ⛔ **hors scope** : à ne pas retoucher.

Source vérifiée : `Account360QuickActions.tsx`, `Account360NewActionDialogs.tsx`, dossier `shared-ops/components/*Dialog.tsx`, `modules/*Module.tsx`. Edge Functions extraites via `functions.invoke(...)`.

## Compte

| Bouton | Fichier UI | Edge Function canonique | État | Gap principal |
|---|---|---|---|---|
| Voir comme client | `useImpersonation` | `impersonation-*` (existant) | ⛔ | — |
| Modifier le profil | `Account360ProfileEditDialog` | `client-account-admin` | ✅ | validé E2E — voir `module1-modifier-profil.md` |
| Accès en ligne | `ClientAccountAccessDialog` | `client-account-admin` | ✅ | validé E2E sans-email — voir `module2-access-en-ligne.md` |
| VIP / Churn risk | `VipChurnToggleDialog` | *(aucune — écrit direct sur `accounts`/`account_tags`)* | 🟠 | pas de workflow canonique |
| Pause temporaire | `PauseAccountDialog` | `account-ops-actions` (`pause_account`/`unpause_account`) | ✅ | validé E2E backend — voir `module4-pause-temporaire.md`. ⚠️ UI Playwright non exécutée (blocage 2FA), workflow UI validé par inspection statique + confirmation qu'aucune écriture directe DB ne subsiste. |
| Annuler le compte | `CancelAccountDialog` | `account-ops-actions` (`cancel_account`) | ✅ | validé E2E backend — voir `module5-annuler-compte.md`. Side-effect trigger email `trg_review_request` accepté (backlog). |
| Réactiver | `ReactivateAccountDialog` | `account-ops-actions` (`reactivate_account`) | ✅ | validé E2E backend — voir `module6-reactiver.md`. Findings backlog : F6-1 subscription cancelled→pending (comportement billing/provisioning), F6-2 review_request_activation (module communication). Tests non exécutés (suspended, statut invalide, cascade partielle) : couverture code par inspection, hors périmètre. |

## Facturation

| Bouton | Fichier UI | Edge Function canonique | État | Gap |
|---|---|---|---|---|
| Enregistrer paiement | `RecordPaymentModule` | `core-record-payment` (→ `apply_payment_to_invoice`/`apply_credit_to_invoice`) | 🟡 | corrections statiques déposées — voir `module7-enregistrer-paiement.md`. Statut : OPEN — STATIC FIXES DONE — E2E PENDING |
| Ouvrir facture | navigate → `invoices` | — | 🔴 | idem |
| Crédit / Promotion | `AddCreditWithDurationDialog` | `account-ops-actions` (à vérifier) | 🟡 | pas dans shell |
| Crédit / Frais facture | `AccountAdjustmentDialog` | idem | 🟡 | idem |
| Remboursement rapide | `QuickRefundDialog` | `square-refund-payment` ✅ | 🟡 | manque contexte paiements + audit |
| Write-off / Ajustement | `AccountWriteOffDialog` | *(aucune)* | 🟠 | pas de workflow canonique |
| Plan de paiement | `PaymentPlanDialog` | *(aucune — écrit `client_payment_plans`)* | 🟠 | pas de RPC canonique |
| Force AutoPay | `AutopayRetryDialog` | *(aucune — écrit `paypal_autopay_attempts`)* | 🟠 | pas via `square-autopay-attempt` |
| Méthode de paiement | `BillingServiceActionsDialog` | `billing-account-actions` | 🟡 | — |
| Gestion facturation | idem | idem | 🟡 | — |
| Cas recouvrement | `CollectionsDialog` | `collections-account-actions` | 🟡 | — |
| Litige facturation | `BillingDisputesDialog` | `disputes-account-actions` | 🟡 | — |

## Services & équipements

| Bouton | Fichier UI | Edge Function canonique | État | Gap |
|---|---|---|---|---|
| Service Internet | `InternetServiceActionsDialog` | `internet-account-actions` | 🟡 | pas dans shell |
| Service TV | `TVServiceActionsDialog` | `tv-account-actions` | 🟡 | idem |
| Ligne mobile | `MobileServiceActionsDialog` | `mobile-account-actions` | 🟡 | idem |
| Reboot équipement | `RemoteRebootDialog` | *(aucune)* | 🟠 | doit router via `internet-account-actions` ou `equipment-account-actions` |
| Diagnostic ligne | `LineDiagnosticDialog` | *(aucune)* | 🟠 | idem |
| Upgrade/Downgrade | `PlanChangeModule` + `core-apply-plan-change` | ✅ | ✅ | référence |
| Geler cycle / essai | `FreezeCycleTrialDialog` | *(aucune)* | 🟠 | pas de workflow billing officiel |
| Transfert déménagement | `ServiceMoveDialog` | *(aucune — table `service_addresses`)* | 🟠 | pas via workflow adresses canonique |
| Gestion équipement | `EquipmentServiceActionsDialog` | `equipment-account-actions` | 🟡 | — |

## Commandes & fidélité

| Bouton | UI | EF | État | Gap |
|---|---|---|---|---|
| Nouvelle commande | navigate → `orders` | *(workflow commande existant)* | 🔴 | pas d'orchestration 360 (deep-link + pré-remplissage) |
| Récompenses | navigate → `loyalty` | RPC admin `admin_loyalty_*` | 🟡 | déjà fait partiellement, à mettre en shell |
| Parrainages | `ClientReferralsDialog` | `referrals-account-actions` | 🟡 | idem |
| Bon de compensation | `CompensationVoucherDialog` | *(aucune)* | 🟠 | pas de workflow voucher canonique |

## Communication

| Bouton | UI | EF | État | Gap |
|---|---|---|---|---|
| Ticket support | `QuickTicketDialog` | `account-ops-actions` | 🟡 | — |
| Escalade superviseur | `SupervisorEscalationDialog` | `core-client-notify` | 🟠 | pas d'entrée dans `support_tickets`/escalation |
| Envoyer un message | `AccountCommunicationDialog` | `communication-account-actions` | 🟡 | — |
| Envoyer un SMS | `AccountSmsDialog` | `sms-account-actions` | 🟡 | — |
| Envoyer rappel | (à identifier) | — | 🔴 | pas de dialog dédié trouvé |
| Appels & téléphonie | `AccountCallsDialog` | `calls-account-actions` | 🟡 | — |
| Planifier RDV | `ScheduleAppointmentDialog` | `account-ops-actions` | 🟡 | — |
| NPS / Satisfaction | `NpsSatisfactionDialog` | *(aucune)* | 🟠 | pas de canal officiel NPS |
| Note interne | `InternalNoteDialog` | `account-ops-actions` | 🟡 | — |
| Préférences comm. | `AccountPreferencesDialog` | `communication-preferences-actions` | 🟡 | — |

## Conformité & sécurité

| Bouton | UI | EF | État | Gap |
|---|---|---|---|---|
| Vérification KYC | `KycModule` | `kyc-account-actions` | ✅ | référence |
| Réinitialiser NIP | `ResetClientPinDialog` | `client-account-admin` | 🟡 | pas dans shell |
| Restrictions | `AccountRestrictionsDialog` | `account-ops-actions` | 🟡 | — |
| Verrouiller compte fraude | `FraudLockDialog` | *(aucune — écrit `accounts`)* | 🟠 | doit passer par `fraud-risk-actions` |
| Étiquettes & alertes | `AccountTagsDialog` | `account-tags-actions` | 🟡 | — |
| Tâches & suivis | `AccountFollowupsDialog` | `account-followups-actions` | 🟡 | — |
| Documents | `AccountDocumentsDialog` | `account-documents-list` / `-manage` | 🟡 | — |
| Historique & activité | `AccountActivityTimelineDialog` | lecture pure | 🟡 | — |
| Journal consentements | `ConsentJournalDialog` | *(aucune)* | 🟠 | pas de canal officiel |
| Sécurité & sessions | `AccountSecurityDialog` | `security-account-actions` | 🟡 | — |
| Demandes Loi 25 | `AccountPrivacyRequestsDialog` | `privacy-requests-actions` | 🟡 | — |
| Risque & fraude | `AccountFraudRiskDialog` | `fraud-risk-actions` | 🟡 | — |

## Fondations partagées à réutiliser

- **Shell** : `src/core-app/components/account-360/modules/ClientModuleShell.tsx` (contient déjà : max-w-6xl, tabs État/Historique/Audit/Actions, impact, impactedTables, plannedEmails, requireReason, footer sticky).
- **Hooks** : `useModuleAudit`, `useModuleRealtime`, `callCoreAction` (audit `admin_audit_log`).
- **Table d'audit** : `admin_audit_log` (colonnes `action_type`, `before_state`, `after_state`, `actor_id`, `target_client_id`, `module_tag`).
- **Notifications** : `send-transactional-email` + registry templates ; canal opérationnel `core-client-notify` pour emails custom déjà validés.

## Constat global

- **26/44** modules ont déjà une Edge Function canonique — le principal manque est **le shell**, **le contexte**, **l'audit** et **les simulations**. Ces modules passent en priorité "wrap" (peu coûteux, gros gain).
- **12/44** modules écrivent directement en base ou n'ont pas de workflow canonique — ils exigent soit une nouvelle RPC/EF légère, soit un routage vers une EF sœur existante (ex. `fraud-risk-actions`).
- **4/44** modules sont de simples navigations — à convertir en modules 360 orchestrant le workflow cible.
- **3/44** sont déjà conformes (`Voir comme client`, `Upgrade/Downgrade`, `KYC`).

## Proposition d'ordre pour Lot A (Facturation)

Ordre optimisé par valeur agent × risque × dépendances :

1. **Enregistrer paiement** (🔴 → ✅) — bloque le plus d'opérations quotidiennes.
2. **Remboursement rapide** (🟡 → ✅) — déjà connecté à `square-refund-payment`, il ne manque que le wrap shell + contexte paiements + audit.
3. **Ajustements unifiés (Crédit / Promo / Frais / Write-off)** (🟠🟡 → ✅) — fusion en un centre "Ajustements" adossé à `account-ops-actions` + `account_adjustments` + `ledger_entries`.
4. **Plan de paiement** (🟠 → ✅) — nouvelle RPC `core_create_payment_plan` avec simulation d'échéancier + audit.
5. **AutoPay / Méthode de paiement** (🟠🟡 → ✅) — fusion, routage vers `square-autopay-attempt` + `billing-account-actions`.
6. **Cas recouvrement + Litige** (🟡 → ✅) — wrap shell sur EF existantes.

Chaque module = un livrable + preuve technique + attente feu vert avant le suivant.
