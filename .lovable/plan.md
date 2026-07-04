## Passe 3A + 3C — Multi-adresses complet + Prorata immédiat

Template PDF `invoiceTemplateV3.ts` **NON touché** cette passe (verrou respecté).

---

### 0. Fondations DB (migration unique)

**`account_service_locations` — enrichissement en entité complète**

Ajout des colonnes de traçabilité + métadonnées :
- `created_by_user_id uuid` (auth.users) — qui a ajouté
- `created_via text` — `guest_checkout | portal | field | core | pos | employee`
- `created_from_order_id uuid` (orders)
- `created_by_employee_id uuid` (employees)
- `created_by_field_agent_id uuid` (profiles)
- `deleted_at timestamptz` (soft-delete, jamais de purge)
- `notes text`, `contact_name text`, `contact_phone text`
- Index composite `(account_id, is_active)` + unique partiel `(account_id, service_address, service_postal_code) WHERE deleted_at IS NULL`

**Cohérence `service_location_id` partout**
- `billing_subscriptions` : déjà `service_address_id` + `address_id` → on ajoute `service_location_id uuid REFERENCES account_service_locations` (nullable pour rétrocompat, mais NOT NULL enforced côté code sur nouvelles créations)
- `billing_invoice_lines` : ajout `service_location_id uuid` + index
- `equipment_inventory` : déjà `address_id` — on ajoute `service_location_id` + backfill
- `installations` : ajout `service_location_id`
- `appointments` : ajout `service_location_id`
- `support_tickets` : ajout `service_location_id` (optionnel — un ticket peut être compte-level)
- `service_incidents` : ajout `service_location_id`
- `technician_assignments` : ajout `service_location_id`

**Backfill (idempotent, dans la même migration)**
1. Pour chaque `accounts` sans `account_service_locations` mais avec adresse : créer 1 location "Adresse principale" à partir de `accounts.service_address/city/postal_code`.
2. Backfill `orders.service_location_id` par match adresse normalisée.
3. Backfill descendant : `billing_subscriptions`, `installations`, `appointments`, `equipment_inventory`, `service_incidents` héritent du `service_location_id` de leur `order_id` parent.
4. Log dans `security_audit_log` du nombre de rows backfillées par table.

**Nouvelle table `service_location_history`** (audit immuable)
- `id, service_location_id, event_type, actor_user_id, actor_role, portal_source, order_id, metadata jsonb, created_at`
- Trigger `AFTER INSERT/UPDATE/DELETE` sur `account_service_locations` → enregistre l'événement.
- RLS : lecture par admin + owner du compte, écriture service_role uniquement.

**RPC `resolve_or_create_service_location(account_id, address, city, province, postal, created_via, actor_id, order_id)`**
- SECURITY DEFINER. Match par postal_code + street normalisée. Retourne UUID. Utilisé partout côté serveur pour éviter les doublons.

---

### 3A — Multi-adresses UI (4 tunnels + portail)

**Composant partagé `<ServiceLocationPicker>`**
- Props : `accountId`, `value`, `onChange`, `mode: 'existing-or-new' | 'new-only'`
- Affiche : liste des adresses actives + bouton "Ajouter une nouvelle adresse de service"
- Formulaire adresse identique partout (validation postal QC, `address-qualify` edge function).

**Intégration dans les 4 tunnels + 1 nouveau :**
1. `GuestCheckout` — après création compte, résout la première location (created_via=`guest_checkout`).
2. `UnifiedPOSPage` (Core POS) — sélecteur obligatoire si compte existant multi-adresses, sinon création (created_via=`pos`).
3. `FieldNewSale` (Field) — StepCustomer étendu avec sélecteur/création (created_via=`field`).
4. `EmployeePOS` — sélecteur/création (created_via=`employee`).
5. **Nouveau `/portal/nouvelle-adresse`** — tunnel dédié client authentifié pour ajouter une adresse + commander un nouveau service dessus (created_via=`portal`).

**Portail client `/portal` — restructuration lecture**
- Nouveau hook `useAccountServiceLocations(accountId)` retourne : `[{ location, subscriptions[], equipment[], invoices[], tickets[], appointments[] }]`.
- Composant `<AccountLocationsView>` : accordéon par adresse, avec sous-sections **Services / Équipements / Factures / Support**.
- Fallback compte mono-adresse : accordéon replié auto = comportement identique visuel actuel (aucune régression UX).

**Aucune limite codée à N=2** — tout est `.map()` sur array.

---

### 3C — Prorata immédiat (activation d'un service sur 2ᵉ+ adresse)

**Edge function `billing-create-prorata-invoice`** (nouvelle)
- Input : `{ order_id, subscription_id, activation_date, cycle_anchor_date }`
- Utilise `_shared/prorationMath.ts` (existant, 30j) : `montant = (prix_mensuel / 30) × jours_restants`
- Crée `billing_invoices` avec `type='prorata_activation'`, `notes` = FR/EN mention explicite "Facturation au prorata — Activation du <date> jusqu'à la fin du cycle <date_fin>. Le prochain cycle complet démarrera le <cycle_anchor>."
- Crée `billing_invoice_lines` avec `line_type='prorata_service'`, `description` préfixée `"[Adresse: <label>] <service_name> — Prorata <n> jours"`, `service_location_id` renseigné.
- Application TPS 5% + TVQ 9.975% via `compute_invoice_breakdown` (existant, inchangé).
- Aligne `billing_subscriptions.cycle_start_date` sur `cycle_anchor_date` (cycle principal du compte) → prochaine facture = 1 seule pour toutes les adresses.

**Email prorata** — template bleu corporate existant (`baseStyles.ts`, `renderQueueTemplate`), sujet : "Facture de prorata — Activation nouvelle adresse". Aucun nouveau design.

**Trigger** : appelée par
- `billing-confirm-payment` quand `order.type='additional_location'`
- Webhook PayPal on `PAYMENT.SALE.COMPLETED` pour orders `additional_location`

**Prochain cycle** : `billing-subscription-cycle` (existant) génère naturellement 1 facture par `customer_id` regroupant toutes les `billing_subscriptions` du compte → les 2 adresses apparaissent en lignes préfixées `[Adresse: X]`. Template PDF inchangé, lisibilité assurée par le préfixe.

---

### Tests avant publication (rapport fourni)

Script Playwright + assertions psql couvrant :
1. Compte mono-adresse existant : portail affiche sans accordéon (aucune régression).
2. Création compte via `GuestCheckout` → 1 location créée, `created_via='guest_checkout'`.
3. Ajout 2ᵉ adresse via `/portal/nouvelle-adresse` → location #2 créée, history log présent.
4. Nouveau service sur adresse #2 → order + subscription + invoice_line ont `service_location_id` #2.
5. Facture prorata générée avec bon montant (13/30 × prix par ex.), notes explicites, préfixe adresse dans les lignes.
6. Rollover cycle : 1 seule facture mensuelle regroupant les 2 adresses.
7. Portail client, portail Core (admin > client), Employee, Field : chaque adresse affiche ses propres services/équipements/factures/tickets.
8. Compte à 3 adresses (test synthétique) : aucune limite atteinte.

Rapport livré en markdown : `docs/PASS_3A_3C_TEST_REPORT.md`.

---

### Ordre d'exécution

1. Migration DB (schéma + backfill + trigger history + RPC).
2. Types regénérés → composants partagés (`ServiceLocationPicker`, `useAccountServiceLocations`).
3. Intégration 4 tunnels + création `/portal/nouvelle-adresse`.
4. Refonte lecture portail client (accordéon par adresse).
5. Edge function prorata + hooks paiement/webhook + email.
6. Tests Playwright + assertions DB → rapport.
7. Publish.

**Estimation** : 1 grosse migration + ~15 fichiers frontend + 1 edge function + 1 script de test. Aucun toucher au template PDF, aucun toucher aux invariants financiers `compute_invoice_breakdown`.

Confirme et j'enchaîne.