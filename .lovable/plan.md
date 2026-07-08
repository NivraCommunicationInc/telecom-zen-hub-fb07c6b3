## Cadre

Reçu 5/5. Ce que tu demandes n'est PAS un chantier d'un seul run — c'est une refonte du centre névralgique du CRM. Si je te promets "tout livré d'un coup", je vais retomber exactement dans le pattern que tu me reproches : dialogues à moitié vides annoncés comme finis.

Je te propose donc un plan par **lots livrables**, chacun :
- réellement fonctionnel de bout en bout (UI → RPC/Edge → DB → audit → realtime)
- testé via Playwright dans le preview avec captures d'écran
- avec rapport de preuves avant de passer au lot suivant

Rien ne casse l'existant. « Voir comme client » **n'est pas touché**. Toutes les fenêtres actuellement fonctionnelles restent en place.

---

## Principes non négociables (appliqués à chaque module)

1. **Une seule source de vérité** : lecture via `useCanonicalClientData` / RPC canoniques existantes. Aucune nouvelle logique de prix/taxe côté frontend.
2. **Chaque écriture** passe par une Edge Function `verify_jwt=true` + `has_role(auth.uid(), 'core_staff'|'admin')` + insert dans `admin_audit_log` (before/after/reason).
3. **Emails** : uniquement via `send-transactional-email` avec templates officiels du registry (`_shared/transactional-email-templates/`). Aucun nouveau design d'email. Nouveaux templates seulement s'ils manquent, en reprenant exactement le layout corporate #0066CC.
4. **Realtime** : `postgres_changes` sur les tables mutées + `queryClient.invalidateQueries` sur les clés canoniques (`CLIENT_REALTIME_QUERY_KEYS` + `OPERATIONAL_REALTIME_QUERY_KEYS`) → portail client, Core, Employee, Field voient le changement immédiatement.
5. **Chaque module** contient : État actuel · Historique · Journal d'audit · Actions · Aperçu d'impact avant confirmation.
6. **Zero placeholder**. Si une donnée n'existe pas dans le schéma, je te le dis, on décide (créer table/colonne, ou marquer "hors périmètre"), on ne peint pas un faux champ.

---

## Découpage en lots

### Lot 0 — Fondation partagée (préalable à tout le reste)

- Composant `<ClientModuleShell>` réutilisé par tous les modules : header (titre, badges), 4 onglets standard (**État · Historique · Audit · Actions**), zone d'aperçu d'impact, footer confirmation.
- Hook `useModuleAudit(clientId, module)` → lit `admin_audit_log` + `activity_logs` filtrés.
- Hook `useModuleRealtime(tables[])` → abonnement postgres_changes générique.
- Helper `callCoreAction(edgeFn, payload, { reason })` : ajoute JWT, reason obligatoire, invalide les caches canoniques, toast succès/erreur avec détail lu via `FunctionsHttpError.context.text()`.
- Registry central `src/core-app/components/account-360/modules/index.ts` : mapping action → module component. Chaque bouton du 360 pointe vers un module concret; si absent → bouton désactivé avec tag "à implémenter" (jamais un dialog vide).

### Lot 1 — Compte
Modules : Modifier profil, Accès en ligne, VIP/Churn, Pause temporaire, Annulation.
Données : `profiles`, `accounts`, `account_tags`, `authorized_users`, `client_login_pins`, `impersonation_sessions`, `auth_login_attempts`, `security_action_logs`, `account_risk_scores`.
Sim d'impact avant annulation : prorata restant, équipement à retourner, contrats actifs, revenus perdus (LTV).
Email : `account-status-change` (existant).

### Lot 2 — Facturation
Modules : Paiement, Facture, Crédit/Promo, Crédit/Frais, Remboursement, Write-off, Plan de paiement, Force AutoPay, Méthodes, Recouvrement, Litiges.
Backend : Edge functions existantes `square-charge-invoice`, `square-refund-payment`, `square-autopay-retry` (à créer si absente), RPC canoniques `fn_apply_credit`, `fn_apply_promotion`, `fn_write_off`.
Tables : `billing_invoices`, `billing_payments`, `client_payment_plans`, `account_adjustments`, `account_promotions`, `payment_disputes`, `collections_actions`, `client_payment_methods`, `paypal_autopay_attempts` (lecture seule — bloqué).
Preview d'impact : nouveau solde, nouvelle échéance AutoPay, taxes recalculées via RPC canonique.

### Lot 3 — Services
Mini-portail par service : Internet, TV, Mobile.
Données : `services`, `service_instances`, `internet_diagnostics`, `internet_modem_actions`, `internet_wifi_settings`, `internet_static_ip_assignments`, `internet_plan_changes`, `tv_channels`, `tv_packs`, `tv_plan_changes`, `tv_terminal_actions`, `mobile_addons`, `mobile_topups`, `sim_actions`, `equipment_inventory`, `service_change_requests`, `service_addresses`.
Actions : reboot, diagnostic, upgrade/downgrade (via RPC existants), déménagement, swap équipement.

### Lot 4 — Commandes & Fidélité & Parrainage
Nouvelle commande : wrapper autour du checkout interne existant (pas de duplication).
Récompenses : réutilise `CoreLoyaltyPage` + `AdminReferralAdvancedDialog` déjà en place → intégrés en modules 360.
Parrainage : progression 3 factures, statut fraude, versement Interac.
Compensation : `promotions` avec catégorie `compensation_voucher`.

### Lot 5 — Communication
Centrale unifiée : historique emails (`email_send_log`), SMS (`sms_queue`), appels (`telephony_logs`, `crm_call_logs`), tickets (`support_tickets`, `internal_tickets`), notes (`client_internal_notes`, `client_admin_notes`).
Composeur : sélection template officiel (registry), aperçu rendu, planification.

### Lot 6 — Conformité & Sécurité
Modules : KYC (`kyc_requests`, `kyc_verifications`, `identity_verification_sessions`), Documents (`client_documents`, `client_auto_documents`, `identity_documents`), Consentements (`checkout_consent_records`, `client_email_preferences`), Loi 25 (`privacy_requests`, `data_retention_log`), Fraude (`account_fraud_incidents`, `security_incidents`), Sessions (`customer_access_sessions`, `staff_impersonation_sessions`).

### Lot 7 — Intelligence Client (nouvelle section)
Nouveau composant `ClientIntelligencePanel` :
- Résumé IA via Lovable AI Gateway (modèle par défaut) sur snapshot canonique.
- Santé compte, LTV, revenus, profitabilité (calcul depuis `billing_payments` + `billing_invoices` + `equipment_inventory`).
- Timeline unifiée via `useCustomerTimeline` (déjà existant).
- Recommandations upsell basées sur services actifs.
- Score churn depuis `account_risk_scores`.

---

## Livrables par lot

Pour chaque lot, je fournirai :
1. Liste exacte des fichiers créés/modifiés.
2. Liste exacte des Edge Functions déployées.
3. Liste exacte des RPC/tables touchées.
4. Migrations éventuelles (avec GRANT + RLS).
5. Captures Playwright : ouverture de chaque module, exécution d'une action réelle, vérification DB (`supabase--read_query`) que la ligne existe, vérification du log d'audit, vérification realtime dans un autre onglet.
6. Rapport final consolidé à la fin du lot 7.

---

## Ce que j'ai besoin de toi maintenant

Avant que je commence à écrire du code, deux confirmations rapides — sinon je repars dans le mur :

1. **Ok pour livrer par lots** (Lot 0 → 1 → 2 …) avec preuves entre chaque, plutôt qu'un mega-commit fourre-tout ?
2. **Priorité de départ** : je propose Lot 0 + Lot 1 (Compte) + Lot 2 (Facturation) d'abord, car c'est ce que tu utilises le plus pour Mouhssine et les cas actuels. On garde Services/Comm/Conformité/Intelligence pour la suite. OK ou tu veux un autre ordre ?

Dès que tu confirmes, j'attaque le Lot 0 + Lot 1 immédiatement, sans re-poser de question, et je reviens avec fichiers + captures + requêtes DB de preuve.
