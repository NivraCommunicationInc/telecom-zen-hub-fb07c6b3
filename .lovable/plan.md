# Pass 3A — Multi-adresses (aucune limite, tout dynamique)

Objectif : rendre chaque adresse de service une entité indépendante portant ses propres services, équipements, rendez-vous, incidents et tickets. Aucune limite codée, aucune notion "principale/secondaire" hard-codée dans le code applicatif, un composant unique réutilisé partout.

Le template PDF de facture ne bouge pas dans cette passe (3C traitera le prorata).

---

## 1. Migration DB — indépendance par adresse

Ajout d'une colonne `service_address_id uuid references public.service_addresses(id)` (nullable, indexée) sur les tables qui n'en ont pas encore, pour qu'un compte multi-adresses puisse porter des lignes distinctes :

- `subscriptions`
- `billing_subscriptions`
- `billing_invoice_lines`
- `services`
- `service_instances`
- `equipment_inventory`
- `appointments`
- `installation_appointments`
- `installation_jobs`
- `technician_assignments`
- `support_tickets`
- `service_incidents`

Backfill : pour chaque compte n'ayant qu'une seule adresse active dans `service_addresses`, remplir automatiquement `service_address_id` sur les lignes existantes. Les comptes multi-adresses restent `NULL` (résolus par l'UI/back office). Aucun index unique restrictif ajouté.

Nouvelle RPC lecture agrégée : `get_account_service_tree(_account_id uuid)` renvoyant un JSON `{ account, addresses: [{ address, internet[], tv[], phone[], equipment[], appointments[], tickets[], incidents[] }] }`. Une seule requête par portail → zéro logique de regroupement côté front.

Vue helper `v_account_address_summary` (security_invoker=on) : par adresse, compteurs de services actifs par catégorie. Utilisée par le picker.

## 2. Composant réutilisable `<ServiceAddressPicker />`

Emplacement : `src/components/service-address/ServiceAddressPicker.tsx`

Props :
```
accountId: string
value?: string
onChange(id: string): void
onCreateNew?(draft): Promise<string>   // appelle RPC resolve_or_create_service_address
allowCreate?: boolean                  // défaut true
filter?: (a) => boolean                // optionnel
mode?: "select" | "cards"              // affichage
disabledIds?: string[]
```

Comportement :
- Fetch via `useAccountAddresses(accountId)` (nouveau hook partagé)
- Toujours une liste dynamique — aucune référence à `[0]` / `[1]` / `primary`
- Bouton "Ajouter une nouvelle adresse" ouvre un formulaire inline validé, persiste via `resolve_or_create_service_address`
- Compatible mobile (touch 44px), i18n via `t()`, tokens design system

Utilisé par : Guest Checkout, Portail Client, Core, Employee, Field, futurs projets.

## 3. Hook partagé `useAccountAddresses`

`src/hooks/useAccountAddresses.ts` — React Query, temps réel sur `service_addresses` filtré par `account_id`, expose `{ addresses, isLoading, refetch, create, softDelete }`. Utilisé partout où on liste des adresses. Élimine ~6 fetch dupliqués actuels.

## 4. Portail Client — vue par adresse

`src/pages/client/ClientMyServices.tsx` refactorisé :

```
Compte
  ▶ <AddressBlock address={a}>
       <ServiceSection kind="internet" items={...} />
       <ServiceSection kind="tv" items={...} />
       <ServiceSection kind="phone" items={...} />
       <EquipmentSection items={...} />
    </AddressBlock>
  ▶ <AddressBlock address={b}>...</AddressBlock>
```

Chaque bloc rendu par `map()` sur `addresses`, aucun index codé, aucun accès `addresses[0]`. Les actions (ajouter/modifier/résilier) ciblent explicitement l'`address.id` du bloc.

Composants extraits réutilisables :
- `AddressBlock.tsx`
- `ServiceSection.tsx`
- `EquipmentSection.tsx`

Ces mêmes composants sont importés dans Core, Employee et Field pour éliminer les 3 implémentations parallèles actuelles.

## 5. Factorisation

Fichiers qui dupliquent la logique "lister adresses + services par adresse" :
- `AdminAccounts.tsx`, `AccountAddressesTab.tsx`, `AccountEquipmentTab.tsx`, `EmployeeAccountDetail.tsx`, `EmployeeClientDetail.tsx`, `ClientProfile.tsx`, `ClientMyServices.tsx`, `CheckoutAddressStep.tsx`

Tous passent à `useAccountAddresses` + `<ServiceAddressPicker />` + `<AddressBlock />`. Suppression du code dupliqué.

## 6. Facturation — traçabilité (sans toucher au PDF)

- `billing_invoice_lines.service_address_id` (nouveau, nullable). Backfill via `subscription.service_address_id → invoice_line`.
- Fonction `format_invoice_line_description(_line_id)` : préfixe automatiquement la description existante avec `[Adresse: <line_1>, <city>]` **au moment de la génération de nouvelles lignes uniquement**. Le PDF continue de lire la colonne `description` inchangée dans sa structure — seul le contenu texte devient identifiant par adresse.
- Aucune modification de `compute_invoice_breakdown`, aucune modification des totaux ou taxes, aucune modification du template PDF.

## 7. Prorata — préparation seulement (implémentation en 3C)

Ajout du champ `billing_invoice_lines.prorata_metadata jsonb` (nullable) pour que 3C puisse stocker `{ days_billed, days_in_cycle, base_amount, address_id }` sans nouvelle migration.

## 8. Tests

- Unit : `ServiceAddressPicker` (0, 1, 5, 10 adresses ; création inline ; sélection contrôlée)
- Unit : `useAccountAddresses` (subscription realtime, refetch)
- Integration Playwright :
  1. Compte 1 adresse — portail client rendu sans régression
  2. Ajout 2ᵉ adresse via portail — apparaît dans les 4 portails
  3. Création service Internet sur adresse B — n'affecte pas adresse A
  4. Vue arborescente compte→adresse→services correcte
  5. Compte 5 adresses simulé — pas de troncature, scroll OK
  6. Captures desktop (1280) + mobile (390)
- Régression : lancer la suite billing/order/checkout existante

## 9. Rapport de fin de passe

Livré en fin de 3A :
- Liste fichiers modifiés / créés
- Nouveaux composants et hook
- Migration + RPC + vue
- Résultats des tests + captures
- Confirmation « aucune régression détectée »

---

## Technique — récap

**Nouvelles migrations** : 1 migration unique ajoutant colonnes `service_address_id` + `prorata_metadata`, backfill, RPC `get_account_service_tree`, vue `v_account_address_summary`, fonction `format_invoice_line_description`.

**Nouveaux fichiers** :
- `src/hooks/useAccountAddresses.ts`
- `src/components/service-address/ServiceAddressPicker.tsx`
- `src/components/service-address/AddressBlock.tsx`
- `src/components/service-address/ServiceSection.tsx`
- `src/components/service-address/EquipmentSection.tsx`
- `src/components/service-address/AddressCreateForm.tsx`
- Tests associés

**Fichiers modifiés** : les 8 fichiers listés en §5 + `ClientMyServices.tsx`.

**Non touché** : template PDF, `compute_invoice_breakdown`, moteur de taxes, logique de paiement, edge functions de facturation.

Dis "go" et j'exécute la migration puis le code dans la foulée.