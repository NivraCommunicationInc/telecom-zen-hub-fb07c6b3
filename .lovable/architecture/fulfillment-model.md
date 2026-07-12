# Fulfillment Architecture — Proposition (BUG-CORE-002 → Refonte transversale)

**Statut :** PROPOSITION — aucun code, aucune migration. En attente de validation métier.
**Portée :** service definition, UI (Field + Core POS + Portail public), commandes, provisioning, rendez-vous, expéditions, activations, migration.
**Principe directeur :** *une seule source de vérité côté données métier, un seul vocabulaire canonique, aucune règle codée en dur dans l'UI ou les Edge Functions.*

---

## 1. Constat

Aujourd'hui :
- `order_items.fulfillment_type` est un enum canonique (`ship | technician | pickup`) mais n'est utilisé que côté commandes.
- `services.installation_fee_rule` = `'none'` pour les 38 services (non peuplé).
- `services.equipment_rules` = JSONB vide.
- `product_attributes` existe mais est vide (0 ligne).
- La logique "requiert un technicien" est actuellement **hardcodée** dans le Field App (`StepCustomer.tsx`) et dans certaines Edge Functions.
- Field et Core dérivent chacun leur propre logique à partir de la catégorie ou du nom du service.

Conséquence : le calendrier d'installation s'affiche trop tôt (BUG-CORE-002A), le mode `technician` est forcé de manière prématurée (BUG-CORE-002B), et le workflow post-paiement (BUG-CORE-002C) branche mal auto-install vs technicien.

**Le vrai problème métier n'est pas binaire.** Un service peut supporter plusieurs modes de livraison, avec un mode par défaut, des contraintes (équipement requis, RDV requis, adresse requise), et une éligibilité qui peut dépendre de l'adresse (ex : fibre disponible seulement dans certaines zones).

---

## 2. Vocabulaire canonique

Un **fulfillment mode** décrit *comment* un service est mis en service chez le client. Enum unique, utilisé partout :

| Code | Sens | RDV ? | Expédition ? | Équipement ? | Adresse requise ? |
|---|---|---|---|---|---|
| `technician_install` | Technicien se déplace | Oui | Non (le tech apporte) | Oui | Oui |
| `self_install_ship` | Auto-installation, équipement expédié | Non | Oui | Oui | Oui |
| `self_install_pickup` | Auto-installation, ramassage en boutique | Non | Non | Oui | Non |
| `esim_digital` | Activation 100% numérique | Non | Non | Non | Non |
| `sim_ship` | SIM physique expédiée, activation par le client | Non | Oui | Oui (SIM) | Oui |
| `no_fulfillment` | Service purement logique (addon, streaming) | Non | Non | Non | Non |

Ce vocabulaire **remplace** `fulfillment_type` (`ship/technician/pickup`) qui est trop pauvre — la migration est décrite en §9.

---

## 3. Source de vérité : `service_fulfillment_options`

**Rejet des Option 1 et Option 2 précédentes** (booléen ou tableau plat sur `services`) : elles ne capturent pas les contraintes par mode (équipement requis, durée RDV, éligibilité par zone, prix additionnel).

### Modèle proposé

```
services
  id, name, category, ...                     -- inchangé

service_fulfillment_options                   -- NOUVELLE table
  id
  service_id            → services.id
  mode                  fulfillment_mode      -- enum ci-dessus
  is_default            boolean               -- 1 seul default par service
  is_enabled            boolean
  priority              int                   -- ordre d'affichage UI
  requires_appointment  boolean
  requires_equipment    boolean
  requires_address      boolean
  eligibility_rule      jsonb                 -- ex: {"zone_types":["fiber"]} ou {}
  appointment_duration_minutes int
  additional_fee_cents  int                   -- surcoût du mode (0 par défaut)
  metadata              jsonb                 -- extension libre
  UNIQUE (service_id, mode)
```

### Exemple de peuplement (à valider avec toi)

| service | mode | default | eligibility |
|---|---|---|---|
| Internet Câble | `self_install_ship` | ✅ | — |
| Internet Câble | `technician_install` | | — |
| Fibre FTTH | `technician_install` | ✅ | — |
| TV | `self_install_ship` | ✅ | — |
| TV | `technician_install` | | — |
| SIM prépayée | `sim_ship` | ✅ | — |
| eSIM | `esim_digital` | ✅ | — |
| Addon streaming | `no_fulfillment` | ✅ | — |

### Pourquoi une table dédiée plutôt que JSONB sur `services`

- Contraintes DB réelles (unique, FK, enum) → impossible d'insérer une valeur invalide.
- Requêtable en jointure (RLS, reporting, filtres UI).
- Extension future propre : ajouter `blackout_dates`, `technician_skill_required`, etc. sans schema stringly-typed.
- `product_attributes` reste pour d'autres attributs métier (couleur, tier), pas surchargé.

---

## 4. Décision côté UI (Field, Core POS, Portail public)

**Règle unique, valable partout :**

```
1. Le panier contient N lignes de service.
2. Pour chaque ligne, on lit service_fulfillment_options.
3. On calcule le "cart fulfillment plan" :
     - Un choix de mode par ligne (default si l'utilisateur ne choisit pas).
     - Consolidation : si ≥1 ligne a requires_appointment=true → afficher le calendrier.
     - Si ≥1 ligne a requires_equipment=true & requires_address=true & mode=ship → afficher shipping address.
     - Si toutes les lignes sont no_fulfillment/esim → aucun step post-cart.
4. L'UI n'affiche jamais un step si aucune ligne du panier ne le demande.
```

Un helper canonique unique (RPC + libraire TS partagée) : `resolve_cart_fulfillment(cart_items[]) → { needs_appointment, needs_shipping, per_line_modes[], warnings[] }`.
**Field et Core POS appellent ce helper**, aucune règle locale.

### Correction directe de BUG-CORE-002A/B
- `StepCustomer.tsx` ne rend le calendrier que si `resolve_cart_fulfillment().needs_appointment === true`.
- Le calendrier utilisé devient le calendrier canonique (`technician_slots` / `installation_appointments`), plus jamais un composant Field-local.

---

## 5. Comment les commandes stockent le choix

`order_items` reçoit :
- `fulfillment_mode` (nouveau, enum canonique — remplace progressivement `fulfillment_type`).
- `fulfillment_option_id` FK → `service_fulfillment_options.id` (traçabilité : quel choix exact a été offert au client).
- `fulfillment_context` jsonb : `{ appointment_id?, shipment_id?, provisioning_job_id? }` — rempli au fur et à mesure du cycle de vie, jamais avant.

Aucune règle métier dans `orders` lui-même : `orders` reste une agrégation. La vérité par-ligne vit dans `order_items`.

---

## 6. Provisioning

`provisioning_jobs` récupère le mode via `order_items.fulfillment_mode`. Le job branche :

```
technician_install  → crée technician_assignment + installation_appointment
self_install_ship   → crée shipment + provisioning différé (déclenché par delivery event)
self_install_pickup → crée pickup_ready notification, provisioning différé
sim_ship            → crée shipment SIM, provisioning à l'activation client
esim_digital        → provisioning immédiat, envoie QR
no_fulfillment      → provisioning immédiat, aucun artefact physique
```

Un seul dispatcher (`fn_provision_order_item`) lit `fulfillment_mode` et route. Zéro `if service.name = 'Fibre'`.

---

## 7. Rendez-vous

- Créés **uniquement** quand une ligne de commande a `fulfillment_mode` ∈ (`technician_install`).
- Créés **après paiement confirmé**, jamais en amont (fix BUG-CORE-002A à la racine).
- Le pré-choix client au checkout est stocké comme *préférence* (`order_items.preferred_slot`), pas comme réservation ferme. La réservation est confirmée par le provisioner post-paiement.
- Une seule table cible : `installation_appointments` (canonique). `appointments` reste pour rendez-vous administratifs non-installation.

---

## 8. Expéditions

- Créées quand `fulfillment_mode` ∈ (`self_install_ship`, `sim_ship`).
- Une seule table : `shipments`.
- Le provisioning "actif" est débloqué par un event de livraison (Ship24 → `order-tracking-status-notify` → `fn_on_shipment_delivered` → provisioner).

---

## 9. Migration des données existantes

**Phase M0 — Schema (bloquante, mais 100% additive)**
1. Créer enum `fulfillment_mode`.
2. Créer table `service_fulfillment_options` (vide).
3. Ajouter colonnes `fulfillment_mode`, `fulfillment_option_id`, `fulfillment_context` sur `order_items` (nullable, sans contrainte au début).

**Phase M1 — Peuplement des services (manuel + validation métier)**
- Tu me fournis, pour chacun des 38 services actuels, la liste des modes supportés + le default.
- Je peuple `service_fulfillment_options` via un script d'insertion versionné, une seule fois.
- Aucune inférence par catégorie/nom.

**Phase M2 — Backfill `order_items`**
- Pour chaque `order_items` existant : mapper l'ancien `fulfillment_type` vers le nouveau `fulfillment_mode`:
  - `technician` → `technician_install`
  - `ship` → `self_install_ship` (ou `sim_ship` si service = SIM)
  - `pickup` → `self_install_pickup`
  - `NULL` → mode default du service (audit-loggé)
- Log complet dans `fulfillment_migration_audit` pour rollback ligne par ligne.

**Phase M3 — Bascule des writers**
- Field App, Core POS, Portail public, Edge Functions : tous migrés pour écrire `fulfillment_mode` + `fulfillment_option_id`.
- `fulfillment_type` reste écrit en miroir pendant N semaines (compat lecture) puis dépréciée.

**Phase M4 — Bascule des readers**
- Provisioner, appointments, shipments basculent sur `fulfillment_mode`.
- Ancien `fulfillment_type` en lecture seule.

**Phase M5 — Deprecation**
- `fulfillment_type` marquée deprecated dans les types générés, drop après période d'observation.

Chaque phase = 1 migration reviewable, indépendante, avec plan de rollback.

---

## 10. Impact transversal identifié

Confirmation de ton intuition : au-delà de BUG-CORE-002, ce modèle touche aussi :

- **Expédition** (`shipments`, `equipment_order_lines`, `equipment_return_requests`) — bénéficie de la clarté `self_install_ship` vs `sim_ship`.
- **Activations** (`activation_requests`, `streaming_activation_tokens`) — `esim_digital` et `no_fulfillment` deviennent des chemins first-class.
- **Rendez-vous** (`installation_appointments`, `technician_slots`, `appointment_slot_rules`) — plus jamais créés spéculativement.
- **Workflows techniciens** (`technician_assignments`, `installation_jobs`) — déclenchés uniquement quand `technician_install` sur ≥1 ligne.
- **Facturation** — `additional_fee_cents` par mode permet de facturer proprement les surcoûts (ex : install technicien payant).
- **Provisioning** (`provisioning_jobs`) — un seul dispatcher basé sur enum.

Si on corrige seulement le calendrier maintenant sans ce modèle, chacun des 6 domaines ci-dessus continuera à porter sa propre logique locale. Ton diagnostic est correct.

---

## 11. Livrables une fois validé

Aucun code avant ton GO. À la validation, l'ordre est :

1. Migration M0 (schema additive) — reviewable seule.
2. Toi + moi peuplons `service_fulfillment_options` pour les 38 services (Phase M1) — validation ligne par ligne.
3. Helper canonique `resolve_cart_fulfillment` (RPC + libraire TS) + tests.
4. Backfill M2 + audit.
5. Bascule progressive M3 → M4.
6. Correction BUG-CORE-002 A/B/C tombe naturellement une fois M3 en place.

---

## 12. Questions ouvertes à trancher avant M0

1. **Nom de l'enum** : `fulfillment_mode` OK, ou tu préfères un autre terme (`delivery_mode`, `provisioning_mode`) ?
2. **Éligibilité par zone** : `eligibility_rule` jsonb suffit-il, ou on veut une table `service_fulfillment_zone_eligibility` normalisée dès maintenant ?
3. **Multi-mode dans un même panier** : autorise-t-on qu'une même commande mélange `technician_install` (fibre) + `self_install_ship` (TV) ? (Techniquement oui, mais confirmation métier requise — impacte l'UI checkout).
4. **Choix client vs imposé** : quand un service a plusieurs modes possibles, l'agent Field peut-il toujours choisir, ou certains modes sont "system-only" (ex : fibre = technicien imposé) ?
5. **Prix additionnel** : `additional_fee_cents` par mode est-il facturé au client ou absorbé ? Impacte le pricing engine.

Réponds à ces 5 questions et je produis la migration M0 pour review — sans toucher au code applicatif tant que M1 n'est pas peuplée.
