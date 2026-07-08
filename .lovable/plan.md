
# Client 360 — Standard "Centre de Contrôle" appliqué à tous les modules

Compris. Upgrade/Downgrade devient le **modèle de référence obligatoire**. Aucun module n'est considéré terminé sans les 10 critères ci-dessous. Voici la feuille de route, ordonnée par risque métier et fréquence d'utilisation par les agents.

## Definition of Done (obligatoire pour chaque module)

Un module Client 360 est livré uniquement quand il présente :

1. **Contexte client complet** en tête (compte, statut, services actifs, dettes, alertes)
2. **Onglet État** — situation actuelle réelle (lue des tables canoniques)
3. **Onglet Historique** — historique métier propre au module
4. **Onglet Audit** — `admin_audit_log` filtré (`module_tag`), avec acteur, motif, before/after
5. **Onglet Actions** — formulaires branchés sur workflows canoniques existants
6. **Simulation avant confirmation** — impact chiffré (prix, prorata, tables touchées, emails prévus)
7. **Motif obligatoire** journalisé, exécution via `callCoreAction` → RPC/Edge Function existante
8. **Synchronisation temps réel** — `useModuleRealtime` sur les tables touchées, portail client rafraîchi
9. **Emails via templates officiels Nivra** (bleu corporatif, jamais de template ad-hoc)
10. **Preuve documentée** — tables/RPC/Edge Functions/triggers listés dans le PR + audit visible

Interdictions absolues : nouveau workflow parallèle, formulaire "simplifié" qui contourne les règles existantes, note interne à la place d'une vraie action, calcul de prix en frontend.

## Ordre d'exécution (par lot, un module = un lot fermé)

Chaque lot suit : audit du workflow existant → refonte UI en `ClientModuleShell` → branchement RPC/Edge → simulation → audit → realtime → validation QA sur `test-c360-planchange@nivra-test.ca` → capture Playwright → fermeture.

### Lot 2 — Sécurité & Conformité (priorité haute, risque légal)
- **KYC** — orchestrer `identity_verification_sessions` + `kyc_requests` + `kyc_requested_documents`. Réutiliser le flux d'upload existant (pas de nouveau formulaire). Afficher statut, documents, historique, événements. Actions : demander pièce, relancer, approuver, rejeter.
- **Verrouillage fraude** — vrai verrou : `accounts.status` + `account_fraud_incidents` + révocation sessions + blocage services + email + audit + durée. Sync Core/portail client/accès services.
- **Restrictions** — appliquer réellement via `account_tags` + triggers services concernés (suspension facturation, blocage support, blocage checkout). Simulation d'impact avant activation.
- **Risque & Fraude** — score `account_risk_scores`, alertes, événements, workflow de résolution avec assignation.
- **Sessions & Sécurité** — sessions actives, révocation, reset MFA, historique connexion via `auth_login_attempts`, `admin_audit_sessions`.

### Lot 3 — Facturation & Paiements (priorité haute, impact financier)
- **Facturation** — vue consolidée `billing_invoices` + lignes, actions : régénérer facture, ajuster ligne, annuler, rembourser. Simulation impact solde.
- **Paiements** — `billing_payments` + `card_payment_intents`. Actions : rembourser (via Square), enregistrer paiement manuel, contester. Refuser toute action PayPal.
- **Plans de paiement** — `client_payment_plans` orchestré, échéancier réel avec simulation.
- **Ajustements** — `account_adjustments` (crédit/débit) avec motif obligatoire et impact solde simulé.
- **Autopay** — `client_autopay_settings` + `paypal_autopay_attempts` (lecture historique seulement), gestion Square uniquement.

### Lot 4 — Services & Équipements
- **Services actifs** — vue `billing_subscriptions` par adresse, actions : suspendre, réactiver, transférer adresse.
- **Équipements** — `equipment_inventory` par abonnement, actions : commander remplacement (`replacement_orders`), demander retour (`equipment_return_requests`), reboot, marquer défectueux.
- **Commandes** — `orders` + `order_status_history`, actions : réactiver, annuler, modifier statut via workflow canonique.
- **Rendez-vous** — `appointments` + `technician_assignments`, replanifier, annuler, réassigner.

### Lot 5 — Relation Client
- **Fidélité** — orchestrer le système `loyalty_points/transactions/redemptions` déjà en place (déjà partiellement fait, à mettre au standard shell).
- **Parrainages** — `client_referrals` + `referral_attributions`, actions admin complètes.
- **Communications** — `telephony_logs` + `email_queue` + `sms_queue`, timeline unifiée, envoi manuel via templates.
- **Documents** — `client_documents` + `client_auto_documents` + `document_requests`, actions demander/générer/envoyer.
- **Notes internes** — `client_internal_notes` (existant, à mettre au standard drawer).

### Lot 6 — Vue transverse
- **Timeline complet** — utiliser `v_customer_timeline` (déjà en place) comme onglet global du 360, filtres par type d'événement.
- **Historique agents** — actions effectuées par agents sur ce compte, `admin_audit_log` non filtré par module.

## Fondations à durcir avant Lot 2

Petites améliorations à `ClientModuleShell` / hooks partagés, faites une seule fois :

- Ajouter un slot **"Contexte client"** persistant en haut du shell (bandeau : nom, #compte, statut, MRR, dette, alertes actives) — évite de répéter dans chaque module.
- Ajouter un slot **"Impact simulé — tables touchées"** structuré (liste des tables + nombre de rows + emails prévus) séparé de `impact` chiffré.
- Standardiser `callCoreAction` pour toujours écrire `admin_audit_log` avec `module_tag`, `before_state`, `after_state`, `reason`.
- Hook `useModuleRealtime` : accepter un tableau de tables et rafraîchir automatiquement le shell.

## Livraison

- Un lot à la fois. Chaque lot ouvert = feu vert explicite de ta part.
- À la fin de chaque module : capture Playwright sur le compte QA + résumé (tables, RPC, Edge Functions, triggers, emails, audit) collé dans le fil.
- Aucun module ne passe en "fait" sans cette preuve.

## Détails techniques (référence)

- Shell : `src/core-app/components/account-360/modules/ClientModuleShell.tsx`
- Wrapper d'action auditée : `src/core-app/lib/callCoreAction.ts`
- Hook audit : `src/core-app/hooks/useModuleAudit.ts`
- Hook realtime : `src/core-app/hooks/useModuleRealtime.ts`
- Timeline unifié : vue SQL `public.v_customer_timeline`
- Environnement QA : compte `test-c360-planchange@nivra-test.ca`, script reset `scripts/qa-c360-reset.sql`, provisioning `supabase/functions/qa-provision-test-account`.

---

**Prochaine action proposée** : durcir les fondations du shell (bandeau contexte + slot "tables touchées" + `callCoreAction` standardisé) puis attaquer **Lot 2 – KYC** comme second module de référence après Upgrade/Downgrade.

Donne-moi le go et je démarre par les fondations + KYC.
