# Modèle canonique des adresses de service

**Date : 2026-07-04 · Statut : ACTIF · Auteur : R1 unification pass**

## TL;DR

- ✅ **`service_addresses`** = **la seule** table à utiliser pour toute lecture ou écriture d'adresse de service.
- ⛔ **`account_service_locations`** = **DEPRECATED**. INSERTs bloqués par trigger. Retrait planifié **2026-Q4**.
- ⛔ RPC `resolve_or_create_service_location` = **DEPRECATED**. Utiliser `resolve_or_create_service_address`.
- ✅ Aucune limite de nombre d'adresses par compte (le plafond de 2 a été retiré le 2026-07-04).

## Pourquoi cette unification

Deux tables représentant le même concept coexistaient depuis janvier 2026 :

| Table | Créée | Statut historique |
|---|---|---|
| `account_service_locations` | 2026-01-01 | Concept posé J0, jamais complètement câblé, quasi-vide en prod |
| `service_addresses` | 2026-03-05 | Table réellement utilisée par billing/orders/equipment/portail client |

Le portail client lisait `service_addresses`, tandis que les portails Admin/Core/Employé lisaient `account_service_locations`. Résultat : les onglets adresses de service étaient systématiquement vides côté admin. R1 a unifié la lecture et l'écriture sur `service_addresses`.

## Contrat pour tout nouveau développement

### ✅ À FAIRE

**Lire des adresses :**
```ts
const { data } = await supabase
  .from("service_addresses")
  .select("id, account_id, label, address_line, city, province, postal_code, is_active, created_at, created_via")
  .eq("account_id", accountId)
  .eq("is_active", true);
```

**Créer / retrouver une adresse (dédoublonnage automatique) :**
```ts
const { data: addressId } = await supabase.rpc("resolve_or_create_service_address", {
  p_account_id: accountId,
  p_address: "1234 rue X",
  p_city: "Montréal",
  p_province: "QC",
  p_postal: "H2X 1Y3",
  p_created_via: "portal", // ou 'guest_checkout' | 'field' | 'core' | 'pos' | 'employee' | 'admin'
  p_actor_user_id: userId,   // optionnel
  p_order_id: orderId,       // optionnel
  p_employee_id: employeeId, // optionnel
  p_field_agent_id: agentId, // optionnel
  p_label: "Bureau",         // optionnel — auto-nommé sinon
});
```

**Supprimer une adresse :** soft-delete uniquement.
```ts
await supabase.from("service_addresses")
  .update({ is_active: false, deleted_at: new Date().toISOString() })
  .eq("id", addressId);
```

**Consulter l'historique d'une adresse :**
```ts
await supabase.from("service_address_history")
  .select("*")
  .eq("service_address_id", id)
  .order("created_at", { ascending: false });
```

### ⛔ INTERDIT

- `.from("account_service_locations").insert(...)` → **plante immédiatement** (trigger `trg_block_asl_insert`).
- `.from("account_service_locations").select(...)` sans commentaire justifiant la compat legacy → sera rejeté en review.
- `.rpc("resolve_or_create_service_location", ...)` → utiliser `resolve_or_create_service_address`.
- Toute logique frontend qui suppose un maximum de 2 adresses par compte.

## Traçabilité obligatoire

Chaque insertion via la RPC canonique remplit automatiquement :

| Colonne | Rôle |
|---|---|
| `created_by_user_id` | Auteur (auth.users) |
| `created_via` | Portail d'origine (`guest_checkout` / `portal` / `field` / `core` / `pos` / `employee` / `admin`) |
| `created_from_order_id` | Commande d'origine si applicable |
| `created_by_employee_id` | Si créée par un employé |
| `created_by_field_agent_id` | Si créée par un agent terrain |
| `deleted_at` | Marqueur soft-delete |

Un trigger `AFTER INSERT/UPDATE` écrit dans `service_address_history` (audit immuable, lisible admin + owner).

## Table `account_service_locations` — plan de retrait

**Aujourd'hui (2026-07-04) :**
- INSERTs bloqués par trigger
- SELECTs encore possibles pour compat (aucun lecteur actif dans le code)
- FK entrantes préservées : `orders.service_location_id`, `replacement_request_tickets.service_location_id`
- Colonnes `service_location_id` ajoutées le 2026-07-04 sur 8 tables : **nullable, non-lues, non-écrites**

**Étapes de retrait (2026-Q4) :**

1. **Audit final** — `rg "account_service_locations" src/` doit retourner **uniquement** `src/integrations/supabase/types.ts`. Sinon corriger.
2. **Migration FK** — pour chaque row de `orders` et `replacement_request_tickets` avec `service_location_id` non-null : peupler `service_address_id` équivalent par matching `(account_id, address_line, postal_code)`. Supprimer ensuite `service_location_id`.
3. **Drop des colonnes dormantes** — retirer `service_location_id` de `billing_subscriptions`, `billing_invoice_lines`, `equipment_inventory`, `installations`, `appointments`, `service_incidents`, `technician_assignments`, `support_tickets`.
4. **Drop de la RPC deprecated** — `DROP FUNCTION public.resolve_or_create_service_location`.
5. **Drop de la table** — `DROP TABLE public.account_service_locations CASCADE`.
6. **Drop de la table history associée** — `DROP TABLE public.service_location_history` (l'historique lisible restera dans `service_address_history`).

Date cible : **fin Q4 2026**. Toute nouvelle référence à `account_service_locations` **retarde** ce retrait.

## Références

- Migration d'unification : `supabase/migrations/20260704011317_*.sql`
- Trigger de blocage : `public.block_account_service_locations_insert()`
- RPC canonique : `public.resolve_or_create_service_address(...)`
- Table history : `public.service_address_history`

---

## Pass 3A (2026-07-04) — Multi-adresses indépendantes

### Colonnes ajoutées
`service_address_id uuid REFERENCES service_addresses(id) ON DELETE SET NULL` sur :
`subscriptions`, `billing_subscriptions`, `billing_invoice_lines`, `services`,
`service_instances`, `equipment_inventory`, `appointments`,
`installation_appointments`, `installation_jobs`, `technician_assignments`,
`support_tickets`, `service_incidents`. Plus `billing_invoice_lines.prorata_metadata jsonb` (préparation 3C).

Backfill : comptes n'ayant qu'une seule adresse active → colonne remplie automatiquement.
Comptes multi-adresses → laisser NULL et faire résoudre par l'UI (picker).

### Outillage partagé (à utiliser partout)

- Hook : `src/hooks/useAccountAddresses.ts` — liste + realtime + create/softDelete
- Hook : `src/hooks/useAccountServiceTree.ts` — arbre agrégé via RPC
- Composant : `src/components/service-address/ServiceAddressPicker.tsx` — sélection + création inline
- Composant : `src/components/service-address/AddressBlock.tsx` — bloc d'affichage par adresse

**Règles :**
- ⛔ Aucune référence à `addresses[0]`, `primary`, `main`, indices codés dur.
- ✅ Toujours `.map(a => ...)` sur la collection.
- ✅ Toutes les nouvelles écritures qui touchent un service DOIVENT préciser `service_address_id`.

### RPC / vue nouvelles

| Objet | Rôle |
|---|---|
| `get_account_service_tree(_account_id uuid)` | Retourne `{ account_id, addresses: [{ address, subscriptions, equipment, appointments, tickets, incidents }] }`. Sécurité : owner OR admin/employee/moderator. |
| `v_account_address_summary` | Vue read-only : par adresse, compteurs `active_subscriptions`, `equipment_count`, `open_tickets`. `security_invoker=on`. |
| `format_invoice_line_description(_base_description, _service_address_id)` | Helper `[Adresse: line, city] description`. Utilisé par la génération future de lignes de facture. Ne modifie ni les totaux ni le template PDF. |

### Colonne héritée `accounts.primary_service_address`

Colonne dénormalisée conservée uniquement pour **affichage rapide** (headers, listes admin). Ne représente PAS l'adresse « principale » du compte : elle reflète la première adresse enregistrée à la création. Ne jamais s'en servir pour lier un service, une commande ou une facture — utiliser `service_address_id`. Suppression envisagée en même temps que le retrait de `account_service_locations` (2026-Q4).
