# Checklist Pré-Lancement CRM — Nivra Telecom
> À compléter ENTIÈREMENT avant tout appel CRM vers 2000+ contacts.
> Dernière mise à jour : 2026-06-15

---

## RÉSUMÉ RAPIDE — Seuils de GO / NO-GO

| Zone | Bloquant si… |
|------|--------------|
| Site public | Page blanche, erreur 500, formulaire cassé |
| Checkout | Commande ne se crée pas, email de confirmation absent |
| Paiements | PayPal ou carte refusé sur transaction test |
| Portail client | Connexion impossible, facture introuvable |
| Emails | Delivrabilité < 95 %, DMARC fail, bounce sur domaine |
| NOVA | Crash sur 3 questions types, handoff non déclenché |
| Billing | Renouvellement non généré, dunning bloqué |
| Sécurité | HTTPS absent, token exposé, rate-limit inactif |
| CRM | Séquence ne démarre pas, opt-out non respecté |

---

## 1. SITE PUBLIC

### 1.1 Pages et navigation

☐ Ouvrir `https://nivra-telecom.ca` (ou URL prod) en fenêtre privée → Aucune erreur JS console, page chargée < 3 s

☐ Naviguer vers `/plans` ou page des forfaits → Tous les forfaits affichés avec prix, bouton CTA fonctionnel

☐ Naviguer vers `/contact` → Formulaire visible, champs nom/email/message présents

☐ Soumettre le formulaire de contact avec données valides → Message "envoyé" affiché, email reçu à `support@nivra-telecom.ca` via `submit-contact-form`

☐ Tester formulaire contact avec email invalide → Message d'erreur inline, aucun envoi

☐ Vérifier lien `/portal/login` dans le menu ou footer → Redirige vers page login portail client, pas de 404

☐ Tester 404 sur URL inexistante `/xyz-inexistant` → Page 404 Nivra affichée (pas d'écran blanc React)

☐ Vérifier que le site charge en HTTPS → Cadenas présent, aucune ressource HTTP mixte en console

☐ Tester sur mobile (375 px) → Layout responsive, aucun débordement horizontal, CTA accessible

☐ Vérifier le mode maintenance OFF → Si `maintenance_mode = true` dans Supabase, le site doit afficher une page maintenance propre; sinon vérifier que le mode est bien à `false`

### 1.2 SEO et performance

☐ Ouvrir DevTools → Network → vérifier que `robots.txt` retourne 200 avec `Allow: /`

☐ Vérifier balises `<title>` et `<meta description>` sur la page d'accueil → Titre contient "Nivra", description ≤ 160 caractères

☐ Vérifier Sentry initialisé → Console DevTools : aucune erreur `[sentry] init failed`; DSN présent dans `VITE_SENTRY_DSN`

---

## 2. CHECKOUT ET COMMANDES

### 2.1 Flux de commande complet

☐ Démarrer un checkout depuis la page des forfaits → Page checkout chargée, forfait sélectionné visible avec prix correct

☐ Remplir le formulaire client (nom, prénom, adresse, téléphone, email) → Tous les champs acceptent les données, aucune erreur prématurée

☐ Entrer une adresse de service valide → Champ adresse accepte et conserve la valeur

☐ Valider le formulaire avec un champ obligatoire vide → Erreur inline sur le champ manquant, soumission bloquée

☐ Aller jusqu'à l'étape paiement → Page paiement visible, options PayPal et carte présentes

☐ Compléter une commande test avec PayPal Sandbox → `order_status = confirmed`, ligne dans `orders`, email confirmation envoyé

☐ Vérifier la création de commande en Nivra Core (`/core/orders`) → Commande apparaît avec bon statut, produit, client, montant

☐ Vérifier que la commande a un `order_number` unique → Format attendu (ex: `NVR-XXXXXX`), pas de doublon

☐ Vérifier email de confirmation de commande reçu → Sujet contient numéro de commande, prix correct, nom du client

☐ Tester annulation de checkout à mi-chemin → Aucune commande fantôme créée dans `orders`

### 2.2 Contrat au checkout

☐ Vérifier que le contrat est présenté avant la signature → Clauses visibles, bouton "J'accepte" inactif jusqu'à scroll/lecture

☐ Signer le contrat (click-to-sign) via `/sign-contract-public` → `contract_signatures` créé, `pdf_sha256` non-null (LCCJTI), email confirmation client envoyé

☐ Vérifier que la signature est enregistrée avec IP et user-agent → Champ `signer_ip` non-null dans `contract_signatures`

☐ Tester tentative double-signature avec même token → Réponse `TOKEN_ALREADY_USED` ou `400`, pas de doublon

---

## 3. PAIEMENTS — PAYPAL ET CARTE

### 3.1 PayPal

☐ Initier un paiement PayPal via `paypal-create-order` → Fenêtre PayPal Sandbox s'ouvre, montant et description corrects

☐ Compléter le paiement PayPal Sandbox → `paypal-capture-order` retourne `200`, `billing_payments` créé avec `status = completed`

☐ Vérifier que `billing_subscriptions` passe à `active` après paiement → Statut mis à jour, date prochaine facturation correcte

☐ Simuler un échec PayPal (annuler dans la fenêtre) → Retour propre sur le checkout, message d'erreur "paiement annulé", aucune commande créée

☐ Tester webhook PayPal `PAYMENT.CAPTURE.COMPLETED` → `paypal-webhook` répond `200`, log de réception présent

☐ Tester webhook PayPal `PAYMENT.CAPTURE.DENIED` → Webhook répond `200`, statut paiement mis à `failed`

☐ Tester webhook avec payload invalide → Webhook répond `400` ou `401` (pas `200` silencieux)

☐ Vérifier signature HMAC webhook PayPal → Header `PAYPAL-TRANSMISSION-SIG` validé; rejet si absent ou invalide

☐ Tester remboursement via `paypal-refund` → Remboursement créé dans PayPal, `billing_payments.status = refunded`, email client envoyé

☐ Vérifier que le montant de remboursement ne peut pas dépasser le montant original → Test avec `amount > payment.amount` → erreur `400`

### 3.2 Paiement par carte (portail client)

☐ Dans `/portal/billing`, onglet "Payer par carte" → Champs card_number, expiry, CVV visibles

☐ Entrer des données de carte valides (test) et soumettre → `portal-card-payment` appelé, réponse `200`, paiement enregistré

☐ Entrer une carte invalide (numéro trop court) → Erreur inline "numéro invalide", aucun appel backend

☐ Vérifier qu'aucun numéro de carte ne transite en clair dans les logs → Chercher dans Supabase logs ou console : aucune trace de PAN complet

☐ Tester carte expirée → Message d'erreur explicite, paiement refusé

### 3.3 Paiements différés / autopay

☐ Vérifier que `billing-autopay-invitations` est actif (pg_cron) → Invitation envoyée aux clients éligibles sans autopay

☐ Tester `autopay-health-check` → Retourne `200` avec statut des clients autopay

☐ Simuler un renouvellement autopay → `billing-paypal-retry-failed` ne crée pas de doublon si paiement déjà réussi

---

## 4. PORTAIL CLIENT

### 4.1 Authentification

☐ Aller sur `/portal/login` → Page de connexion visible, champs email et mot de passe

☐ Se connecter avec compte client valide → Redirection vers `/portal/dashboard`, nom du client affiché

☐ Tenter connexion avec mauvais mot de passe → Message "identifiants incorrects", aucune fuite d'info (email non confirmé)

☐ Vérifier rate-limit login → Après 5 tentatives échouées en < 10 min, compte bloqué ou CAPTCHA

☐ Vérifier que `track-login-attempt` enregistre les tentatives → Ligne dans `login_attempts` avec IP, résultat, timestamp

☐ Tester "Mot de passe oublié" → Email de reset reçu dans < 2 min, lien valide

☐ Tester lien de reset expiré (> 24 h) → Message "lien expiré", pas d'accès

☐ Tester connexion après mot de passe changé avec ancien mot de passe → Accès refusé

☐ Vérifier que le token JWT est invalidé à la déconnexion → Déconnexion → retour à `/portal/login`, token expiré

### 4.2 Dashboard et navigation

☐ Dashboard `/portal/dashboard` → Abonnement actuel visible, prochain renouvellement affiché

☐ Naviguer vers `/portal/billing` → Factures listées, bouton payer visible

☐ Naviguer vers `/portal/usage` → Historique consommation 6 mois (graphiques recharts Internet/Appels/SMS)

☐ Naviguer vers `/portal/documents` → Documents client visibles (contrats, factures PDF)

☐ Tester accès sans authentification à `/portal/dashboard` → Redirection automatique vers `/portal/login`

☐ Tester `ClientSecurityCheck` → Un compte suspendu voit `/portal/suspended`, pas le dashboard

### 4.3 Fonctions portail

☐ Télécharger une facture PDF → Fichier PDF généré et téléchargé correctement, montant et données client présents

☐ Payer une facture impayée via le portail → Paiement enregistré, statut facture passe à `paid`

☐ Changer son forfait via `client-plan-change` → Demande enregistrée, email de confirmation envoyé

☐ Contacter le support depuis le portail → Ticket créé dans `support_tickets`, email de confirmation envoyé

☐ Vérifier vérification identité `/portal/identity` → Upload de pièce d'identité possible, statut KYC mis à jour

---

## 5. NIVRA CORE (BACK-OFFICE)

### 5.1 Accès et navigation

☐ Se connecter à Nivra Core → Authentification admin/staff fonctionnelle, tableau de bord chargé

☐ Naviguer vers `/core/clients` → Liste clients chargée, recherche fonctionnelle

☐ Ouvrir un profil client `/core/clients/:id` → Toutes les sections visibles (abonnements, factures, tickets, contrats, activité)

☐ Naviguer vers `/core/orders` → Liste commandes avec statuts, filtres fonctionnels

☐ Naviguer vers `/core/billing` → Tableau de bord billing, MRR visible

☐ Naviguer vers `/core/mrr-dashboard` → Graphiques MRR mensuel (recharts), churn %, nouveaux abonnements, KPI cards chargés

☐ Naviguer vers `/core/crm` → Interface CRM visible, contacts listés

☐ Naviguer vers `/core/support` → Tickets listés, filtres par statut fonctionnels

☐ Naviguer vers `/core/nova` (NovaBrainPage) → Console NOVA accessible, statut agents visible

☐ Naviguer vers `/core/security-guardian` → Événements de sécurité chargés, aucune erreur

### 5.2 Gestion des données

☐ Créer un client via `admin-create-user` → Client créé dans `profiles`, email de bienvenue envoyé

☐ Importer clients CSV via `core-csv-import-clients` → Import sans erreur, doublons détectés et signalés

☐ Créer une commande manuelle depuis le POS (`/core/pos`) → Commande créée, facture générée

☐ Générer un devis (`/core/quotes`) → PDF devis généré avec prix et conditions

☐ Créer une promotion (`/core/promotions`) → Promo créée, code valide lors du checkout

☐ Vérifier les logs d'activité (`/core/audit-log`) → Chaque action admin enregistrée avec acteur, entité, horodatage

---

## 6. EMAILS ET SMS

### 6.1 Infrastructure email

☐ Envoyer un email test via Resend → Email reçu dans < 2 min, pas dans spam

☐ Vérifier SPF domain → `dig TXT nivra-telecom.ca` → entrée SPF présente avec `include:resend.com` ou équivalent

☐ Vérifier DKIM → Header `DKIM-Signature` présent dans les emails reçus, signature valide

☐ Vérifier DMARC → `dig TXT _dmarc.nivra-telecom.ca` → politique présente (`p=quarantine` ou `p=reject`)

☐ Tester lien de désinscription email → Lien présent dans footer, clic → `email-unsubscribe` appelé, préférence mise à jour, confirmation affichée

☐ Vérifier que les emails désinscrit ne reçoivent pas d'emails marketing → Après opt-out, `communication_preferences.email_marketing = false`, exclusion de la séquence CRM

☐ Vérifier `email_queue` drain → Emails en statut `queued` → `processing` → `sent` en < 5 min (pg_cron actif)

☐ Tester email bounce → Email vers adresse invalide → bounce enregistré, statut `failed` dans `email_queue`

☐ Vérifier `admin-email-queue-status` → Retourne stats de la queue (pending, sent, failed)

### 6.2 Templates email

☐ Email confirmation de commande → Sujet, nom client, numéro commande, montant, CTA portail présents

☐ Email de bienvenue → Liens connexion portail fonctionnels, identifiants corrects

☐ Email de facture → Montant, date échéance, lien paiement présents

☐ Email dunning J+3 (rappel doux) → Envoyé 3 jours après facture impayée, ton courtois

☐ Email dunning J+7 (urgent) → Envoyé 7 jours après, mention de suspension imminente

☐ Email dunning J+14 (suspension) → Envoyé 14 jours après, abonnement suspendu simultanément

☐ Email reset mot de passe → Lien valide 24 h, expiration correcte

☐ Email signature contrat → PDF de confirmation, numéro commande, date signature

☐ Email rapport hebdomadaire (`weekly-sales-report`) → Reçu chaque lundi, chiffres cohérents avec Nivra Core

### 6.3 SMS

☐ Envoyer SMS test via `send-marketing-sms` → SMS reçu en < 60 s sur numéro test

☐ Vérifier que le SMS contient un opt-out (STOP) → Mention "Répondre ARRÊT pour se désabonner" ou équivalent

☐ Tester opt-out SMS → Après STOP, `sms_account_actions` met `sms_marketing = false`

☐ Vérifier que `sms-queue-drain` est actif → Messages `sms_queue` traités régulièrement

☐ Tester SMS de statut de commande via `order-status-sms` → SMS reçu après changement de statut commande

☐ Tester SMS de notification de portage via `send-porting-notification` → SMS reçu, contenu correct

---

## 7. AGENTS IA ET NOVA

### 7.1 NOVA Brain

☐ Ouvrir le chatbot NOVA sur le portail ou site public → Widget chargé, message de bienvenue affiché en < 3 s

☐ Poser une question simple sur les forfaits → NOVA répond avec infos correctes, ton professionnel

☐ Poser une question hors-sujet (météo, politique) → NOVA redirige poliment vers les services Nivra

☐ Simuler 3 tentatives infructueuses de résolution → NOVA utilise `transfer_to_human_agent` proactivement, ticket créé dans `support_tickets`, email envoyé à `support@nivra-telecom.ca`

☐ Demander de l'aide pour payer une facture → NOVA fournit lien portail client ou explique les étapes

☐ Tester streaming de réponse → Réponse apparaît token par token, pas de timeout après 30 s

☐ Vérifier mémoire NOVA (`nova-memory-update`) → Une info donnée par le client est retenue dans la session

☐ Tester `nova-llm-openai-compat` endpoint → Répond en < 10 s, format OpenAI compatible

### 7.2 Agents CRM

☐ Déclencher `agent-crm-sequence` sur 1 contact test → Séquence démarrée, étape 1 exécutée (email/SMS selon config), log créé

☐ Vérifier `agent-crm-email-blast` avec liste de 5 contacts test → 5 emails envoyés, aucun doublon, aucun contact désinscrit contacté

☐ Tester `crm-send-callback-reminders` → Rappels envoyés aux clients avec callback planifié, heure correcte

☐ Tester `crm-send-followup-email` → Email de suivi envoyé, template correct

☐ Vérifier `crm-score-leads` → Scores mis à jour dans `crm_leads`, critères de scoring visibles

☐ Vérifier `agent-followup` → Suivis assignés aux bons agents, délais respectés

☐ Tester `agent-sales-assignment` → Lead assigné à l'agent selon règles de territoire/charge

### 7.3 Autres agents

☐ Tester `agent-checkup` (vérification santé agents) → Rapport de santé retourné, agents actifs listés

☐ Tester `agent-directories` → Accès aux répertoires, données retournées correctement

☐ Tester `agent-social` → Pas d'erreur d'authentification API sociale

☐ Tester `core-ai-converse` → Conversation IA Core fonctionnelle, réponse en < 15 s

☐ Tester `chatbot-jonathan` → Chatbot staff répond aux questions internes

☐ Tester `training-ai-simulate` → Simulation de formation IA sans erreur

☐ Vérifier `CoreAgentMonitorPage` → Tous les agents visibles, statuts temps réel

---

## 8. BILLING ET FACTURATION

### 8.1 Génération de factures

☐ Déclencher `generate-monthly-invoices` manuellement sur compte test → Facture créée dans `billing_invoices` avec montant correct

☐ Vérifier `billing-generate-renewals` → Renouvellement créé pour abonnement actif, off-by-one promo corrigé (`currentCycle <= duration_months`)

☐ Vérifier `billing-subscription-cycle` → Cycle avancé correctement, `next_billing_date` mis à jour

☐ Tester `generate-monthly-invoices` en période de promotion → Montant réduit correct, nombre de cycles restants décrémenté

☐ Vérifier `billing-reconciliation` → Rapport de réconciliation sans divergences

### 8.2 Dunning et recouvrement

☐ Vérifier que `billing-dunning-engine` est actif (pg_cron `0 9 * * *`) → Job visible dans `cron.job` Supabase

☐ Simuler facture impayée de J+3 → Email de rappel envoyé via Resend

☐ Simuler facture impayée de J+7 → Email urgent envoyé, log dans `dunning_logs`

☐ Simuler facture impayée de J+14 → Email final envoyé, abonnement suspendu (`status = suspended`)

☐ Vérifier `billing-check-overdue` et `check-overdue-invoices` → Liste des factures en retard correcte, aucun faux positif

☐ Naviguer vers `/core/recouvrement` → Liste des comptes en retard, actions disponibles

### 8.3 Commissions

☐ Vérifier `pay-commissions-friday` → DST Amérique/Toronto calculé dynamiquement (`getTorontoOffsetHours()`), exécution le vendredi

☐ Annuler un abonnement test → `cancel-account` clawback `sales_commissions` ET `field_commissions` en `clawback_pending`

☐ Vérifier `field-bonus-calculator` → Calcul des bonus terrain correct selon la grille

☐ Naviguer vers `/core/commissions` → Liste des commissions filtrables, statuts corrects

☐ Tester retrait commission (`CoreCommissionWithdrawalsPage`) → Demande créée, validation requise

### 8.4 Factures et paiements

☐ Naviguer vers `/core/invoices` → Toutes les factures listées, filtres par statut/date fonctionnels

☐ Ouvrir une facture contestée (`/core/contested-invoices`) → Détail visible, actions de résolution disponibles

☐ Tester `billing-confirm-payment` → Paiement manuel confirmé, `billing_payments.status = completed`

☐ Vérifier `billing-paypal-retry-failed` → Retry uniquement sur paiements `failed`, pas de double débit

---

## 9. PROVISIONING

### 9.1 Activation de service

☐ Créer une commande et valider → Statut passe à `pending_activation`

☐ Aller dans `/core/activations` → Commande visible dans la liste d'activation

☐ Déclencher l'activation → Statut passe à `active`, email `send-mobile-status-email` envoyé

☐ Vérifier `send-installation-status-email` → Email d'installation envoyé avec date et technicien

☐ Vérifier `order-status-notifications` → Notification envoyée à chaque changement de statut

☐ Tester `client-plan-change` → Changement de forfait enregistré, prorata calculé si applicable

### 9.2 Porting

☐ Créer une demande de portage → Enregistrée dans la table appropriée

☐ Vérifier `send-porting-notification` → SMS/email envoyé au client lors du portage

☐ Simuler un portage terminé → Statut mis à jour, confirmation envoyée

### 9.3 Techniciens

☐ Tester `technician-auth` → Technicien peut se connecter avec ses identifiants

☐ Tester `technician-update-status` → Mise à jour du statut d'installation fonctionnelle

☐ Naviguer vers `/core/technician-map` → Carte des techniciens chargée, positions visibles

☐ Vérifier `CoreInstallationsPage` → Installations listées par statut et date

☐ Tester `sla-monitor` → Alertes SLA générées pour interventions hors délai

☐ Vérifier `order-stall-monitor` → Commandes bloquées détectées et alertées

---

## 10. SÉCURITÉ

### 10.1 Authentification et accès

☐ Vérifier HTTPS sur toutes les routes (site, portail, core, hub) → Cadenas HTTPS, aucune ressource non-sécurisée

☐ Tester qu'une route core est inaccessible sans authentification → `401` ou redirection login

☐ Tester qu'un client ne peut pas accéder aux données d'un autre client → Requête avec `user_id` différent → `403` ou données vides

☐ Vérifier Row-Level Security (RLS) Supabase → Politiques actives sur `billing_invoices`, `billing_subscriptions`, `profiles`, `support_tickets`

☐ Vérifier que la service role key n'est pas exposée en frontend → Grep dans `src/` : aucune occurrence de `service_role`

☐ Tester MFA Hub (`/hub`) → Authentification à deux facteurs obligatoire, contournement impossible

☐ Vérifier `verify-lockdown-password` → Mot de passe de verrouillage requis pour actions sensibles

### 10.2 Rate limiting et anti-abus

☐ Envoyer 10 requêtes rapides au formulaire de contact → Rate-limit déclenché après seuil, réponse `429`

☐ Tester Cloudflare Turnstile sur le checkout → Challenge CAPTCHA présent, soumission refusée sans token valide

☐ Vérifier `track-login-attempt` → Après 5 échecs, `login_blocked = true` ou délai imposé, email d'alerte à `support@nivra-telecom.ca`

☐ Tester `fraud-risk-actions` → Score de risque calculé, actions automatiques déclenchées si seuil dépassé

☐ Vérifier `security-account-actions` → Blocage/déblocage de compte fonctionnel

### 10.3 Données et conformité

☐ Vérifier que les logs d'audit couvrent toutes les actions sensibles → Admin qui modifie un abonnement → ligne dans `activity_logs`

☐ Vérifier `KYC` (Know Your Customer) → Vérification identité requise avant activation pour certains plans

☐ Vérifier `admin-audit-session-link` → Lien de session d'audit généré et valide

☐ Vérifier que les `VITE_*` env vars ne contiennent pas de secrets sensibles → Aucune service role key ni clé privée dans le bundle frontend

☐ Vérifier Sentry actif → `isSentryEnabled()` = true en production, erreurs capturées

☐ Tester `generate-verification-qr` → QR de vérification généré, valide

---

## 11. CRM ET AGENTS TERRAIN

### 11.1 CRM interne

☐ Naviguer vers `/core/crm` → Contacts listés, filtres actifs (statut, tag, agent assigné)

☐ Rechercher un contact par nom/email/téléphone → Résultats pertinents en < 1 s

☐ Ouvrir un profil CRM → Historique complet : appels, emails, commandes, notes

☐ Ajouter un tag à un contact via `account-tags-actions` → Tag sauvegardé, visible immédiatement

☐ Créer un suivi (`account-followups-actions`) → Suivi planifié, alerte assignée au bon agent

☐ Marquer un suivi comme complété → Statut mis à jour, log d'activité créé

☐ Lancer une séquence CRM sur 5 contacts test → `agent-crm-sequence` déclenché, étapes visibles dans le profil

☐ Vérifier les préférences de communication → Contacts avec `email_marketing = false` exclus des blasts

☐ Vérifier `crm-score-leads` → Score mis à jour après activité (commande, connexion portail, etc.)

### 11.2 Agents terrain (field sales)

☐ Onboarder un agent terrain → `field-sales-complete-onboarding` → compte créé, accès app terrain

☐ Vérifier `CoreAgentDiscounts` → Remises agents configurables par niveau/région

☐ Vérifier `CoreFieldSubmissionsPage` → Soumissions terrain visibles, validées ou rejetées

☐ Vérifier `CoreGrilleCanaux` → Grille des canaux de vente à jour

☐ Créer une commission terrain → `field_commissions` créé avec `status = pending`

☐ Approuver une commission → Statut passe à `approved`, inclus dans prochain paiement vendredi

☐ Tester clawback automatique → Annulation abonnement → `field_commissions.status = clawback_pending`

☐ Vérifier `agent-sales-assignment` → Assignation automatique selon territoire

☐ Vérifier badge employé → `generate-employee-badge` → PDF badge généré avec photo et infos

### 11.3 Partenaires et influenceurs

☐ Tester `validate-partner-invite` → Lien d'invitation partenaire valide, accès accordé

☐ Naviguer vers `/influencer/dashboard` → Dashboard influenceur chargé, stats visibles

☐ Vérifier code de référence → Code unique par influenceur, appliqué au checkout

☐ Tester commission référence → Commande avec code → `referral_commissions` créé

☐ Tester cashout influenceur → Demande créée, validation admin requise

---

## 12. SUPPORT TICKETS

### 12.1 Création et gestion

☐ Créer un ticket depuis le portail client → Ticket dans `support_tickets`, email de confirmation client, email à `support@nivra-telecom.ca`

☐ Vérifier `send-ticket-notification` → Email envoyé à l'assigné lors de création/mise à jour

☐ Assigner un ticket à un agent dans Nivra Core → Ticket mis à jour avec `assigned_to`, log d'activité

☐ Changer le statut d'un ticket (open → in_progress → resolved) → Statut mis à jour, client notifié à chaque étape

☐ Fermer un ticket → Statut `closed`, email de clôture envoyé au client

☐ Réouvrir un ticket fermé → Ticket passe à `open`, agent notifié

☐ Vérifier `SLA monitor` → Alertes générées pour tickets non traités dans le délai SLA

☐ Naviguer vers `/core/support` (vue admin) → Tous les tickets visibles, filtres fonctionnels

☐ Naviguer vers `/core/internal-tickets` → Tickets internes staff/admin séparés des tickets client

### 12.2 NOVA handoff

☐ Simuler escalade NOVA → Après 3 échecs, ticket créé automatiquement avec contexte conversation

☐ Vérifier que le ticket NOVA contient le résumé de la conversation → Champ `description` contient l'historique

☐ Vérifier l'email de notification au support → `support@nivra-telecom.ca` reçoit l'alerte avec lien Core

---

## 13. PDF ET CONTRATS

### 13.1 Génération PDF

☐ Générer une facture PDF → PDF téléchargeable, montant correct, logo Nivra présent, encodage UTF-8 correct (é, è, à, etc.)

☐ Générer un devis PDF → Conditions, prix, durée présents

☐ Générer un contrat PDF → Clauses complètes, champs client remplis

☐ Générer un badge employé (`generate-employee-badge`) → PDF généré, nom/photo/poste corrects

☐ Tester `audit-generate-pdfs` → Rapport d'audit généré en PDF

☐ Vérifier que les caractères accentués sont corrects dans tous les PDFs → Aucun `Ã©`, `Ã `, `Ã¨` → encodage UTF-8 propre (fix appliqué)

### 13.2 Contrats et signatures

☐ Générer un lien de signature via `sign-contract-public` → URL unique avec token valide (≥ 16 chars)

☐ Signer en cliquant "J'accepte" → `contract_signatures` créé, `pdf_sha256` non-null, IP enregistrée

☐ Tester token expiré → Réponse `TOKEN_EXPIRED` ou `400`, accès refusé

☐ Tester double-clic sur "J'accepte" → Idempotent, pas de doublon dans `contract_signatures`

☐ Vérifier que le hash SHA-256 couvre le contenu complet → Hash calculé sur `contractData` (clauses, prix, services), pas juste le token

☐ Naviguer vers `/core/contracts` → Contrats signés listés, téléchargement possible

☐ Vérifier les templates PDF (`CorePDFTemplatesPage`) → Templates éditables, prévisualisation fonctionnelle

---

## 14. WEBHOOKS

### 14.1 PayPal Webhooks

☐ Configurer webhook PayPal Sandbox vers URL prod/staging `paypal-webhook` → Enregistrement confirmé dans dashboard PayPal

☐ Envoyer `PAYMENT.CAPTURE.COMPLETED` via simulateur PayPal → Réponse `200`, paiement confirmé dans Supabase

☐ Envoyer `PAYMENT.CAPTURE.DENIED` → Réponse `200`, statut `failed` enregistré

☐ Envoyer `BILLING.SUBSCRIPTION.CANCELLED` → Abonnement mis à `cancelled`

☐ Tester payload malformé → Réponse `400` (pas `200` silencieux — fix appliqué)

☐ Tester replay d'un même événement (idempotence) → Pas de doublon dans `billing_payments`

☐ Vérifier signature HMAC → Requête sans header signature → `401`

### 14.2 Autres webhooks

☐ Vérifier `validate-verification-token` → Token de vérification validé, accès accordé une seule fois

☐ Tester `email-unsubscribe` webhook → Préférences mises à jour, réponse `200`

☐ Vérifier `order-status-notifications` → Notification déclenchée à chaque transition de statut commande

☐ Tester `send-service-status-email` → Email de statut de service envoyé correctement

☐ Vérifier `nivra-health-check` → Endpoint de santé retourne `200` avec statuts des services

☐ Vérifier `health-check` et `health` endpoints → Réponse `200 OK` avec uptime

☐ Vérifier `billing-health` et `kyc-health` → `200` avec statuts respectifs

---

## 15. INFRASTRUCTURE ET MONITORING

### 15.1 Tâches planifiées (pg_cron)

☐ Vérifier que tous les jobs cron sont actifs dans Supabase → `SELECT * FROM cron.job;` → jobs listés, `active = true`

| Job | Horaire attendu |
|-----|----------------|
| `billing-dunning-engine` | `0 9 * * *` |
| `generate-monthly-invoices` | 1er du mois |
| `billing-check-overdue` | quotidien |
| `sms-queue-drain` | toutes les 5 min |
| `weekly-sales-report` | lundi 8h |
| `crm-score-leads` | quotidien |
| `sla-monitor` | toutes les heures |

☐ Vérifier `nivra-health-check` → Tous les services `healthy`

☐ Vérifier `autopay-health-check` → Rapport autopay sans anomalies

### 15.2 Monitoring

☐ Sentry actif en production → Erreur test capturée sur dashboard Sentry

☐ Vérifier `CoreSystemHealthPage` → Tous les indicateurs verts

☐ Vérifier `CoreLiveActivityPage` → Flux d'activité temps réel visible

☐ Vérifier `CoreSystemAuditPage` → Audit récent sans erreurs critiques

☐ Tester `speedtest-server` → Endpoint retourne résultats de vitesse

---

## 16. AVANT LE LANCEMENT CRM (CHECKLIST FINALE)

### Opt-out et conformité CASL/CRTC

☐ Tous les contacts à appeler ont consenti (opt-in documenté ou relation commerciale existante)

☐ Liste CRM filtrée pour exclure les `do_not_contact = true`

☐ Liste filtrée pour exclure `email_marketing = false` pour les blasts email

☐ Liste filtrée pour exclure `sms_marketing = false` pour les SMS

☐ Mention de désinscription présente dans tous les messages (STOP SMS, lien email)

☐ Plage horaire des appels respectée (9h–21h heure locale, CRTC)

### Volume et performance

☐ Tester le blast sur 50 contacts → Aucun timeout, tous les emails/SMS délivrés

☐ Vérifier la capacité de la queue email (Resend) → Limite mensuelle vérifiée, quota suffisant pour 2000+ contacts

☐ Vérifier la capacité SMS → Quota SMS suffisant pour le volume

☐ Vérifier que `agent-crm-sequence` supporte 2000 contacts sans dépasser les timeouts Supabase Edge (< 60 s par batch)

☐ Tester en batch de 100 → Pas d'erreur `503` ou `524` (timeout Cloudflare)

### Données CRM

☐ Liste de contacts exportée et validée → Aucun email invalide (regex), aucun doublon

☐ Numéros de téléphone formatés en E.164 (`+1XXXXXXXXXX`)

☐ Noms et données personnalisées vérifiés (pas de `[PRÉNOM]` non remplacé dans les templates)

☐ Score de leads à jour (`crm-score-leads` exécuté aujourd'hui)

☐ Agents assignés à tous les leads prioritaires

### Go/No-Go final

☐ Tous les items bloquants ci-dessus sont cochés ✅

☐ Fenêtre de maintenance confirmée avec l'équipe technique

☐ Responsable de support disponible pendant le lancement (tickets entrants)

☐ Dashboard Core ouvert sur `CoreLiveActivityPage` pendant le lancement

☐ Sentry ouvert en parallèle pour monitoring erreurs temps réel

---

*Généré automatiquement — basé sur l'architecture réelle de Nivra Telecom (Supabase/Deno/React/PayPal/Resend)*
*Toute modification du système doit entraîner une mise à jour de ce document.*
