# Plan d'exécution — Lot de corrections & nouvelles fonctionnalités

Demande très large. Je propose de la découper en **9 chantiers** indépendants. Confirme l'ordre (ou dis "tout") et je commence. Chaque chantier est livrable seul.

---

## 1. Nivra Core — Traitement de commande (équipement + date + anti-fraude)
- **Équipement pré-rempli** : à l'étape "Équipement" du workspace, lire `order_items` et générer automatiquement N cartes (1 borne, 2 terminaux TV, etc.) prêtes à recevoir serial/MAC. Plus de bouton "+ ajouter".
- **Date de commande** affichée dans le header du workspace + colonne dans la liste.
- **Rendez-vous technicien synchronisé** : à la confirmation, créer/MAJ `technician_assignments` avec la date + plage horaire choisies au checkout. Si modifié dans Core → propagé au portail technicien (realtime).
- **Anti-fraude** : nouveau module `fraud_check` qui calcule un score (0–100) à la création d'une commande :
  - Vérifie cohérence nom/DOB/adresse vs `profiles`, `orders` historiques, `account_fraud_incidents`
  - Détecte: même adresse + nom différent, email jetable, téléphone réutilisé, mismatch nom CB
  - Hook prêt pour brancher futur credit check / KYC ID (interface `fraud_provider`)
  - Badge visible dans le workspace : Vert <30, Jaune 30–70, Rouge >70 + raisons listées
- Tables: réutilise `account_fraud_incidents` + nouvelle `order_fraud_assessments`

## 2. Installation TV+Internet → 1 seul RDV
Quand une commande contient un forfait TV bundle internet, ne créer **qu'un seul** `installation_job` / `technician_assignment` partagé. Corriger split actuel.

## 3. Chaînes TV — règles strictes + packs aléatoires + email + ticket
- Respect du forfait : base + X chaînes standard (limite dure dans `TVChannelSelectionBase`)
- Chaînes premium = surcharge automatique ajoutée à la facture mensuelle
- Boutons "Pack rapide" : Sport, Francophone, Mix Sport+Séries, Famille (auto-sélection)
- Email post-sélection avec lien `?token=…` qui ouvre directement la page de modification dans le portail
- Création auto d'un `internal_ticket` (catégorie "channel_selection") visible dans Core

## 4. PDF Contract + Modalités fusionnés (nouveau template telecom premium)
- Nouveau template **PDF unifié v4** "Contrat & Modalités" — un seul document
- Réutilise palette du site (#7c3aed accent, navy/dark) — style telecom moderne
- Reçus & factures harmonisés au même style
- Skill PDF: QA visuel page par page avant livraison
- Texte mis à jour selon dernières conditions

## 5. Portail client — Paiements (bug adresse + détails commande)
- Quand client connecté avec adresse au profil : pré-remplir + ne pas redemander pour add-credit / pay-invoice / paiement libre
- Bouton "Détails" commande : actuellement redirige vers `/`, corriger vers `/portal/orders/:id`

## 6. Portail client — Tickets, Changement de forfait, Remplacement, Annulation
- **Création ticket** : peupler le select "Sujet" (facturation, chaînes, support général, technique, équipement, autre)
- **Changement forfait** : afficher forfait actuel + alternatives compatibles (cacher Internet si bundle TV+Internet déjà actif). Soumission → notif Core qui orchestre le changement + prorata via règles existantes
- **Remplacement d'équipement** : lister équipements actifs par service, bouton "Demander remplacement" → ticket Core
- **Annulation/Pause** : lister services actifs, sélection + raison → demande dans Core avec notif

## 7. Changement d'email (client + Core)
- Portail client : nouveau flow avec OTP de confirmation sur l'ancien ET le nouveau
- Core : possibilité de changer l'email d'un client (avec audit + notif au client)

## 8. PayPal pré-autorisé — fix PAYPAL_CREATE_FAILED
- Debug edge function `paypal-create-billing-agreement` (probable: plan_id manquant ou montant 0)
- Logs + retry + message d'erreur lisible

## 9. Programme fidélité refonte + Carte de fidélité
- **Barème durci** : 1 pt = 1$ dépensé (au lieu du généreux actuel), récompenses à 2000 pts = 25$, 5000 pts = 75$, 10000 pts = 200$
- **Carte de fidélité** : numéro auto-généré (format NIV-XXXX-XXXX-XXXX), statut Bronze/Argent/Or/Platine selon points cumulés
- Design carte premium (gradient violet, hologramme CSS, QR code)
- Gestion Core : voir/ajuster points, suspendre carte, historique

---

## Ordre d'exécution recommandé
1. **Quick wins** (#5 détails commande + adresse, #6 select tickets, #8 PayPal) — 1 tour
2. **Chantier Core** (#1 équipement+date+fraude, #2 RDV unifié) — 1 tour
3. **Chaînes TV** (#3) — 1 tour
4. **PDF unifié** (#4) — 1 tour avec QA skill
5. **Portail flows lourds** (#6 changement forfait, remplacement, annulation, #7 email) — 1 tour
6. **Fidélité + carte** (#9) — 1 tour

## Confirmation
Dis-moi:
- **"go tout"** → j'attaque dans l'ordre ci-dessus
- **"go #X #Y"** → je fais seulement ces chantiers
- **modifs** → ajuste et je remets le plan à jour