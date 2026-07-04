
# Refonte "Adresses & Services" — Core + Portail Client

Ta demande en clair:
1. **Ne PAS combiner** la liste d'adresses et le sélecteur/actions dans un seul bloc. Ils doivent être séparés visuellement et fonctionnellement.
2. Le workspace actuel (cartes cliquables + gros bouton "Ajouter", 4 métriques, boutons flottants) fait **amateur**. Refaire au niveau des autres sections du 360.
3. Les actions "par adresse" (commander, RDV, ticket, équipement, changer plan, suspendre, retirer, notes…) doivent apparaître **comme les sections Équipements/Factures** — barre d'actions cohérente en haut, listes dessous.
4. Même niveau de finition côté **Portail Client**: gestion d'adresses digne d'un opérateur télécom, pas un formulaire nu.

## Ce que je propose (Core — Nivra 360)

### A. Structurer "Adresses & Services" comme les autres sections
Format identique à *Équipements*: **titre + barre d'actions unifiée + tabs internes**.

```text
Adresses & Services (3)                 [+ Nouvelle adresse]  [Transférer service]  [Fusionner]
────────────────────────────────────────────────────────────────
[ 2352 Rue Monet, Laval          ▸ 1 svc · 3 équip · actif ]  ← sélectionnée
[ 118 Boul. Saint-Martin, Laval  ▸ 0 svc · secondaire      ]
[ + Ajouter une adresse ]
────────────────────────────────────────────────────────────────
DOSSIER: 2352 Rue Monet, Laval  ·  Compte #200756
[Actions]  Commander ici │ Ajouter service │ RDV │ Ticket │ Équipement │ Notes │ Transférer │ Retirer

┌─ Services actifs (1) ─────────────┐  ┌─ Équipement (3) ──────────────┐
│  Internet 100 Mbps  · 50$/mo · ▸  │  │  Terminal TV  S/N 3389…  · ▸  │
└───────────────────────────────────┘  └───────────────────────────────┘
┌─ RDV / Tech (0) ──────┐  ┌─ Support (1) ─────────┐  ┌─ Incidents (0) ─┐
```

### B. Séparer le sélecteur d'adresse du dossier
- **Colonne gauche** (dans la section) = liste des adresses (cartes compactes, une ligne, badge "principale"/"secondaire", cliquable).
- **Colonne droite** = dossier de l'adresse sélectionnée avec **la même barre d'actions que la section Équipements** (boutons plats en haut, pas de gros CTA colorés qui flottent).
- Le bouton "Ajouter adresse" est **au-dessus de la liste**, discret, pas mélangé avec les actions du service.

### C. Réutiliser le langage visuel des autres sections
- Même typo, même densité, mêmes `Panel`/`PanelHeader`/`MiniTable` que `Account360Helpers.tsx`.
- Retirer les gros badges colorés, cartes arrondies XL, ombres, etc. → on garde le style dashboard opérationnel dark green.
- Chaque bloc (services, équip., RDV, tickets, incidents) devient un **Panel** cliquable menant à la section principale filtrée par `service_address_id`.

### D. Actions réelles (pas juste des liens)
Chaque bouton de la barre d'actions déclenche l'action correspondante **au bon endroit du 360**:
- *Commander ici* → POS Core préfiltré par adresse
- *Ajouter service* → même chose
- *RDV* → dialog RDV avec adresse pré-sélectionnée
- *Ticket* → dialog `QuickTicketDialog` avec adresse
- *Équipement* → dialog assignation
- *Notes* → note interne rattachée à l'adresse
- *Transférer service vers autre adresse* → nouveau dialog (déplace `service_address_id` sur souscription/équipement)
- *Retirer adresse* → soft delete si aucun service actif, sinon bloqué avec message

## Portail Client (`/portal/service-addresses` + Dashboard)

### E. Même architecture, ton client
- Page "Mes adresses" séparée en deux blocs:
  1. **Mes adresses** (liste + bouton "Ajouter une adresse")
  2. **Dossier de l'adresse sélectionnée** (Services, Équipement, RDV, Support) avec actions client: *Commander un service ici*, *Prendre RDV*, *Ouvrir un ticket*, *Voir factures*.
- Sur le Dashboard, la carte "Adresse" liste toutes les adresses sous forme condensée avec lien "Gérer" → ouvre l'adresse dans le dossier.

## Détails techniques

- Nouveau composant `AccountAddressesSection.tsx` dans `src/core-app/components/account-360/` qui suit strictement le style des autres sections (Panel/PanelHeader). Remplace l'import de `AccountAddressesTab` dans `CoreAccountDetail.tsx`.
- Retirer la logique `isAddressesSection` du grid (la section redevient normale à 3 colonnes → le panneau droit `Account360RightPanel` reste visible partout, comme tu le voulais indirectement en disant "les 2 menus doivent être séparés" — le résumé compte à droite ne bouge plus).
- Nouveau composant `ClientAddressWorkspace.tsx` pour le portail (style clair, boutons primaires ronds cohérents avec le reste du portail client).
- Barre d'actions par adresse implémentée via dialogs déjà existants (`QuickTicketDialog`, POS route, etc.) — pas de nouvelle logique métier.
- Aucun changement DB requis: `service_addresses` + `service_address_id` sur tables enfants sont déjà en place.

## Ce que je NE fais pas dans cette passe
- Pas de refonte des sections Équipements/Factures elles-mêmes.
- Pas de changement au moteur de facturation ni au RPC `resolve_or_create_service_address`.
- Pas de nouveaux dialogs métier autres que "Transférer service" (à confirmer si tu le veux ou non).

## Question avant de coder
Confirme-moi 2 points rapides:
1. Le bouton **"Transférer un service vers une autre adresse"** — tu le veux dès cette passe, ou on le garde pour plus tard?
2. Dans le Portail Client, tu veux que **l'ajout d'adresse** reste libre (comme aujourd'hui) ou passe par une **validation Core** (l'agent doit approuver la nouvelle adresse avant qu'elle soit utilisable pour commander)?
