## Contexte

Tu demandes 4 gros chantiers différents à appliquer partout où une commande est créée (Nivra Core, Field, OneView, portail client). Avant de coder, je veux valider le plan complet parce que ça touche : le tunnel de commande, la facturation multi-adresses, le calendrier d'installation, et la persistance du panier.

---

## Chantier 1 — Tunnel de commande unifié (Core / Field / OneView / Client)

Créer un **flux de commande commun** utilisé par tous les portails, avec ces étapes obligatoires :

1. **Sélection forfait** (Internet / TV / Mobile)
2. **Équipements auto-sélectionnés** selon règles ci-dessous
3. **Questionnaire câble coaxial** (Oui/Non, prise fonctionnelle, nombre de prises)
4. **Choix installation** : Technicien OU Auto-installation
5. **Choix date** — connecté au vrai calendrier `appointment_slot_rules` + `appointment_slot_overrides` + `appointment_blocked_dates`
6. **Adresse de service** (nouvelle OU adresse existante du compte si ≤ 2)
7. **Récapitulatif + paiement**

### Règles équipement auto-sélectionné (non négociables)

| Forfait choisi        | Équipement forcé                                 | Min | Max |
|-----------------------|--------------------------------------------------|-----|-----|
| Internet              | 1× Borne WiFi (60 $)                             | 1   | 1   |
| TV                    | 1× Borne WiFi (60 $) + 1× Terminal TV (50 $)     | 1   | 4 terminaux |
| Mobile                | 1× SIM (30 $)                                    | 1   | 1   |

- Impossible de décocher les équipements obligatoires.
- Terminal TV : bouton +/− limité entre 1 et 4.

### Règle auto-installation → expédition automatique

Si le client choisit **Auto-installation** :
- La commande passe automatiquement en workflow `shipping_required`
- Les **frais d'expédition** sont ajoutés à la facture (montant à confirmer avec toi, valeur par défaut : à définir)
- Aucune date de rendez-vous demandée, mais on demande une adresse d'expédition
- Le statut Core devient `awaiting_shipment` au lieu de `awaiting_installation`

### Questionnaire coaxial

Affiché uniquement pour Internet et TV. Champs :
- Avez-vous une prise coaxiale ? (Oui/Non)
- Fonctionne-t-elle ? (Oui / Ne sais pas)
- Nombre de prises actives dans le logement (1-8)

Réponses stockées dans `orders.coaxial_survey` (jsonb) et remontées au technicien.

---

## Chantier 2 — Persistance du panier (fix "refresh remet à 0")

Aujourd'hui, un refresh vide tout. Correctif :

- Sauvegarder l'état du tunnel dans `checkout_sessions` (table qui existe déjà) toutes les fois qu'une étape est validée
- **Côté Field/Core** : `field_quotes` déjà persisté → charger le brouillon au reload via `quote_id` en URL
- **Côté client public** : sauvegarder sous une clé `checkout_draft` dans `localStorage` + rangée `checkout_sessions` liée à l'email si fourni
- Reprise automatique : au mount de la page, si un draft existe (< 24 h), demander "Reprendre votre commande en cours ?" avec option "Recommencer"

---

## Chantier 3 — Multi-adresses de service (max 2 par compte)

### Règle métier

- Un compte = **maximum 2 adresses de service**
- Chaque adresse peut avoir ses propres services (Internet, TV, Mobile), forfaits, promos indépendants
- **1 seule facture par compte**, peu importe le nombre d'adresses
- Cycle de facturation du compte ne change JAMAIS quand on ajoute une 2ᵉ adresse
- La nouvelle adresse est **facturée au prorata** jusqu'au prochain cycle

### Nouveau parcours "Activer un service à une autre adresse"

Ajouté dans :
- Portail client (`/portal/services` → bouton "Ajouter un service à une nouvelle adresse")
- Portail Nivra Secure Hub / Core (fiche client → onglet Services → bouton "Ajouter adresse")
- Field app (fiche client existante)

Écran :
1. Choisir "Nouvelle adresse" ou une des 2 adresses existantes
2. Vérifier serviciabilité
3. Passer par le tunnel Chantier 1 (mêmes règles équipement, coaxial, installation)
4. Confirmation avec pro-rata affiché

### Facturation

- Table `service_addresses` : marquer laquelle est primary/secondary
- Table `billing_subscriptions` : rattacher chaque abonnement à un `service_address_id`
- Rendu facture : **section par adresse** avec sous-total, puis total global
- Nouvelle fonction `compute_prorata(start_date, cycle_day, monthly_price)` qui retourne le montant à facturer sur la facture en cours

### Exemple prorata (que tu as donné)

Compte cycle = 10 du mois. Client active le 1er du mois :
- Facturer 9 jours au prorata (1 → 10)
- Formule : `monthly_price × (days_before_cycle / 30)`
- Prochain cycle (le 10) : facturation normale du mois complet

---

## Chantier 4 — Calendrier d'installation unifié

Aujourd'hui, le calendrier RDV du site marketing n'est pas branché au tunnel commande. Correctif :

- Nouvelle RPC `get_available_installation_slots(from_date, to_date, service_type)` qui lit :
  - `appointment_slot_rules` (horaires récurrents)
  - `appointment_slot_overrides` (exceptions)
  - `appointment_blocked_dates` (jours bloqués)
  - `installation_appointments` (déjà réservés) pour capacité
- Composant `<InstallSlotPicker />` réutilisé dans **tous les tunnels** (Core, Field, OneView, Client)
- À la sélection, on pré-réserve le slot dans `installation_appointments` avec statut `pending`
- Si la commande est abandonnée, un job nettoie les `pending > 30 min`

---

## Ordre d'exécution proposé

1. **Chantier 4** — Calendrier RPC + composant partagé
2. **Chantier 1** — Tunnel unifié (règles équipement + coaxial + auto-install + expédition)
3. **Chantier 2** — Persistance panier
4. **Chantier 3** — Multi-adresses + prorata + facture unique

---

## Questions à valider AVANT que je commence

1. **Frais d'expédition auto-install** : quel montant ? (ex. 15 $ ? 25 $ ?)
2. **Formule prorata** : sur base 30 jours fixes, ou sur nombre réel de jours du mois en cours ?
3. **Reprise panier** : durée de vie du brouillon (24 h ? 7 jours ?)
4. **2ᵉ adresse** : cycle facturation **reste identique** = confirmé. Mais le premier mois prorata apparaît sur la **prochaine facture** (pas une facture séparée), correct ?

Réponds à ces 4 points et je commence dans l'ordre. Ne pas commencer avant validation — c'est un chantier qui touche 4 portails, je ne veux pas refaire.
