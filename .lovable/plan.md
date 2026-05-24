# Plan — Options compte client télécom complètes

Vu l'ampleur (40+ fonctionnalités), je propose une livraison **par phases atomiques**. Chaque phase est complète, testée et déployée avant la suivante — zéro régression, zéro bug.

## Architecture commune (livrée Phase 0)

- **1 Edge Function unique** : `client-account-actions` (gère TOUTES les actions client : TV, Internet, Mobile, facturation, profil)
- **1 dialog unifié** : `ClientServiceActionsDialog` réutilisé Core + OneView
- **Toutes actions** → journal `admin_audit_log` + courriel client via template officiel
- **Permissions** : `has_role` (admin direct / employee escalade pour les changes financiers)
- **i18n** : `t()` partout
- **Mémoire** : nouvelle entrée `mem://features/client-account-telecom-actions`

## Phases (ordre de livraison)

### Phase 1 — Mobile (impact #1)
- Recharge prépayée (top-up) avec paiement
- Changer forfait mobile
- Ajouter/retirer options (data add-on, international, longue distance)
- Activer/échanger/suspendre SIM (perte/vol)
- Port-in / Port-out (workflow)
- Détail consommation (minutes, SMS, data)
- Activer eSIM
- Blocage international / hors-Canada
- Courriels : confirmation recharge, changement forfait, suspension SIM

### Phase 2 — TV
- Changer forfait TV (basique → premium)
- Ajouter/retirer chaînes à la carte
- Ajouter forfait thématique (Sports, Cinéma, International)
- Location VOD (crédit/remboursement)
- Gérer terminaux TV (ajouter/retirer/échanger/redémarrer)
- Contrôle parental
- Courriels : confirmation changement chaînes/forfait

### Phase 3 — Internet
- Changer forfait Internet (vitesse)
- Redémarrer modem à distance (stub API CPE)
- Diagnostic ligne (test signal, latence, débit)
- Gérer WiFi (SSID, mot de passe, 2.4/5 GHz)
- Historique consommation data
- Activer/désactiver IP statique

### Phase 4 — Facturation
- Gérer méthodes de paiement (carte par défaut)
- Activer/désactiver paiement automatique
- Plan de paiement échelonné (entente)
- Changer date de facturation
- Facture papier vs électronique
- Remboursement direct
- Renvoyer facture par courriel (action 1-clic)

### Phase 5 — Profil / Compte
- Changer adresse de service (déménagement avec workflow)
- Changer adresse de facturation
- Gérer contacts autorisés
- Langue de communication (FR/EN)
- Préférences notifications
- Transfert de propriété (changement titulaire)
- Activer 2FA / MFA client
- Sessions actives + révoquer

### Phase 6 — Commercial / Rétention
- Catalogue offres de rétention
- Renouveler engagement
- Programme de référence (générer code, voir filleuls)
- Offre win-back (réactivation)

### Phase 7 — Support / Technique
- Bon de travail technicien (truck roll)
- Historique interventions
- Demander rappel (callback)
- Envoyer SMS au client

### Phase 8 — Vue / Diagnostic
- Timeline complet changements
- NPS récent
- Churn score
- LTV / ARPU affiché

## Détails techniques

- **DB** : nouvelles tables `client_service_changes`, `mobile_topups`, `tv_channel_changes`, `payment_methods`, `payment_plans`, `address_changes`, `account_transfers`, `retention_offers`, `referral_codes`, `callbacks`, `sms_log` — toutes avec RLS strictes
- **Backend** : 1 Edge Function avec dispatch par `action_type` + validation Zod par action
- **Frontend** : remplacement de `Account360QuickActions` + `QuickActions` (employee) par un menu groupé par catégorie (TV / Internet / Mobile / Facturation / Profil / Commercial / Support)
- **Courriels** : nouveaux templates dans `customQueueTemplates.ts` (1 par type d'action notifiable)
- **Audit** : chaque action loggée + IP + raison obligatoire pour les actions sensibles
- **Tests** : test edge function après chaque phase + vérif lints/build

## Validation à chaque phase

1. Migration DB (RLS + triggers)
2. Edge Function (déployée + testée)
3. UI (dialog + actions branchées)
4. Courriels (template officiel — `© ${new Date().getFullYear()}`)
5. Audit log vérifié
6. Build clean, console clean, network 200

## Question critique avant de partir

**Voulez-vous que je :**
- **A)** Livre les 8 phases d'affilée dans cette même session (très long, ~8 messages, je vais pousser au max)
- **B)** Commence par la Phase 1 (Mobile) seule, et vous validez avant de passer aux suivantes
- **C)** Je priorise différemment (dites-moi l'ordre)

Vu votre exigence "tout fonctionne sans bug", **je recommande B** — je livre Phase 1 complète et bulletproof, vous testez, puis on enchaîne. Chaque phase = ~6-10 fichiers nouveaux/modifiés + migration + déploiement edge function.
