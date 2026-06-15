# Audit Frontend → API → Base de données
## 5 bugs observés — preuves de code bout en bout
*Généré le 2026-06-15 — Aucune correction. Aucune écriture. Audit uniquement.*

---

## BUG 1 — Impossible de voir les comptes clients dans Nivra Core

### Chaîne complète

```
AdminClients.tsx
  → useQuery (adminClient)
    → unified_clients (VIEW)
      ↳ profiles (table)
      ↳ billing_customers (table)
      ↳ accounts (sous-requête)
  → useQuery (adminClient)
    → orders (filtré par user_id / client_email)
  → useQuery (adminClient)
    → billing_payments (via billing_customers)
  → useQuery (adminClient)
    → billing_invoices (via billing_customers)
  → useQuery (adminClient)
    → support_tickets (filtré par user_id / client_email)
  → useQuery (adminClient)
    → billing_subscriptions (via billing_customers)
  → <ClientInternalNotes clientId={...} />
    → supabase.from("client_internal_notes")  ← CRASH
```

### Preuves de code

**`src/pages/admin/AdminClients.tsx` — lignes 148-189 :**
```javascript
const { data: clients } = useQuery({
  queryKey: ["admin-clients"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("unified_clients")           // VIEW = profiles UNION billing_customers
      .select("*")
      .order("created_at", { ascending: false });
    // ...
  }
});
```

**`src/pages/admin/AdminClients.tsx` — lignes 263-276 (support tickets) :**
```javascript
const { data: clientTickets } = useQuery({
  queryKey: ["client-tickets", selectedClient?.user_id],
  queryFn: async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .or(`user_id.eq.${selectedClient.user_id},client_email.eq.${selectedClient.email}`)
      .order("created_at", { ascending: false });
  }
});
```

**`src/components/admin/ClientInternalNotes.tsx` — ligne 59 :**
```javascript
const { data, error } = await supabase
  .from("client_internal_notes")   // ← TABLE N'EXISTE PAS dans le nouveau projet
  .select("*")
  .eq("client_id", clientId)
  .order("created_at", { ascending: false });
```

**`supabase/migrations/20260523000808_unified_clients_add_account_id.sql` — définition de la VIEW :**
```sql
CREATE VIEW public.unified_clients WITH (security_invoker = true) AS
SELECT p.id, p.user_id, p.email, p.full_name, ...
FROM profiles p
UNION
SELECT bc.id, bc.user_id, bc.email, ...
FROM billing_customers bc
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE lower(trim(p.email)) = lower(trim(bc.email)));
```

### Tables et comptes actuels

| Table | Lignes actuelles | Lignes CSV (avant) | Delta |
|-------|------------------|--------------------|-------|
| `profiles` | ✅ présente (importée) | ~14 000+ | faible perte |
| `billing_customers` | ✅ présente (importée) | ~14 000+ | faible perte |
| `accounts` | ✅ présente (importée) | ~14 000+ | faible perte |
| `support_tickets` | **104 lignes** | **14 264 lignes** | −99.3% |
| `billing_subscriptions` | présente | présente | partiel |
| `client_internal_notes` | **TABLE ABSENTE** | 353 lignes | −100% |

### Verdict

| Composant | CAUSE |
|-----------|-------|
| Liste des clients | ✅ Fonctionne (profiles + billing_customers présents) |
| Notes internes (`ClientInternalNotes`) | ❌ **BUG DE CODE** — `relation "client_internal_notes" does not exist` — SQL error PostgreSQL immédiat |
| Historique tickets dans fiche client | ❌ **DONNÉES MANQUANTES** — 104 lignes vs 14 264 |
| Détail abonnements | ❌ **DONNÉES MANQUANTES** — `billing_subscription_services` = 0 lignes |

**CAUSE GLOBALE = BUG DE CODE + DONNÉES MANQUANTES**

---

## BUG 2 — Impossible de voir les services actifs

### Chaîne complète

**Portal client (useCanonicalClientData) :**
```
src/hooks/useCanonicalClientData.ts (ligne 191)
  → portalClient.rpc("get_customer_portal_snapshot", { _user_id })
    → [si stale] refresh_customer_portal_snapshot_internal(_user_id)
      → get_client_history_snapshot(_user_id)
        → billing_subscriptions (v_subscriptions)
          ↳ billing_subscription_services bss WHERE bss.subscription_id = src.id
          ↳ service_addresses sa WHERE sa.id = src.address_id
```

**Admin (AdminClients.tsx) :**
```
src/pages/admin/AdminClients.tsx (lignes 278-298)
  → supabase.from("billing_subscriptions")
    → filtre par billing_customers.customer_id
      ↳ [implicitement] billing_subscription_services pour les services rattachés
```

### Preuves de code

**`supabase/migrations/20260527020926_79359ac3.sql` — ligne 169 :**
```sql
SELECT coalesce(jsonb_agg(
  to_jsonb(src) || jsonb_build_object(
    'billing_subscription_services', coalesce((
      SELECT jsonb_agg(to_jsonb(bss) ORDER BY bss.created_at ASC NULLS LAST)
      FROM public.billing_subscription_services bss
      WHERE bss.subscription_id = src.id     -- ← 0 lignes dans cette table
    ), '[]'::jsonb),
    'service_addresses', coalesce((
      SELECT to_jsonb(sa) FROM public.service_addresses sa
      WHERE sa.id = src.address_id LIMIT 1
    ), ...)
  ) ORDER BY src.created_at DESC NULLS LAST
), '[]'::jsonb)
INTO v_subscriptions
FROM (SELECT DISTINCT ON (s.id) s.* FROM public.billing_subscriptions s ...) src;
```

**`src/hooks/useCanonicalClientData.ts` — mapping du snapshot :**
```javascript
subscriptions: snapshot.subscriptions ?? [],
// billing_subscription_services est imbriqué dans chaque subscription
// → si billing_subscription_services = [], le service apparaît "vide"
```

### Tables et comptes actuels

| Table | Lignes actuelles | Lignes CSV (avant) | Delta |
|-------|------------------|--------------------|-------|
| `billing_subscriptions` | présente | présente | à vérifier |
| `billing_subscription_services` | **0 lignes** | présente | **−100%** |
| `service_addresses` | **0 lignes** | présente | −100% |
| `service_instances` | présente | présente | partiel |

### Verdict

**CAUSE = DONNÉES MANQUANTES**

- `billing_subscription_services` = **0 lignes** dans le nouveau projet. Chaque abonnement retourne `billing_subscription_services: []` → aucun service visible, aucune ligne de service.
- `service_addresses` = 0 lignes → fallback sur `accounts.primary_service_address` (fonctionne si account existe, mais sans détail par service).
- Les abonnements eux-mêmes (`billing_subscriptions`) sont présents mais leurs services rattachés sont tous absents.

---

## BUG 3 — Menus du portail client vides

### Chaîne complète

```
Toutes les pages portail client (Hub, Dashboard, etc.)
  → useCanonicalClientData() [src/hooks/useCanonicalClientData.ts ligne 191]
    → portalClient.rpc("get_customer_portal_snapshot", { _user_id })
      [migration 20260527025402_eb43ba25.sql]
      → [si stale] refresh_customer_portal_snapshot_internal(_user_id)
        → get_client_history_snapshot(_user_id)      [ligne 1 de migration 20260527020926]
          → profiles, accounts, billing_customers, orders, billing_subscriptions
             billing_subscription_services (0 lignes), support_tickets (104 lignes)
             loyalty_points (0 lignes), loyalty_transactions (0 lignes)
             appointments, contracts, service_instances, equipment_inventory
        → customer_portal_enrich_snapshot(_user_id, v_snapshot)
          → ticketReplies, webFormMessages, orderItems, loyaltyRewards
             activationRequests, accountServiceLocations, fieldQuotes, fieldPaymentIntents
      → cache dans customer_portal_snapshots
```

### Preuves de code

**`src/hooks/useCanonicalClientData.ts` — ligne 191 :**
```javascript
const { data, error } = await portalClient.rpc("get_customer_portal_snapshot", {
  _user_id: userId
});
```

**Mapping complet (même fichier) :**
```javascript
return {
  profile:              snapshot.profile,
  account:              snapshot.account,
  orders:               snapshot.orders ?? [],
  subscriptions:        snapshot.subscriptions ?? [],    // billing_subscription_services = []
  supportTickets:       snapshot.supportTickets ?? [],   // 104 lignes vs 14 264
  loyaltyPoints:        snapshot.loyaltyPoints ?? [],    // 0 lignes
  loyaltyRewards:       snapshot.loyaltyRewards ?? [],
  loyaltyTransactions:  snapshot.loyaltyTransactions ?? [], // 0 lignes
  ticketReplies:        snapshot.ticketReplies ?? [],    // ~237 vs 33 873
  appointments:         snapshot.appointments ?? [],
  invoices:             snapshot.invoices ?? [],
  payments:             snapshot.payments ?? [],
  // ...
};
```

**`supabase/migrations/20260527025402_eb43ba25.sql` — logique de cache :**
```sql
SELECT * INTO v_cached FROM public.customer_portal_snapshots WHERE user_id = _user_id;
v_is_stale := NOT FOUND OR v_cached.last_refreshed_at < now() - interval '15 seconds';
IF v_is_stale THEN
  v_snapshot := public.refresh_customer_portal_snapshot_internal(_user_id, 'read_hydration_repair', NULL);
  RETURN public.customer_portal_enrich_snapshot(_user_id, v_snapshot);
END IF;
```

### Tables et comptes actuels

| Clé du snapshot | Table SQL | Lignes actuelles | Lignes CSV | Impact menu |
|----------------|-----------|-----------------|------------|-------------|
| `subscriptions` | `billing_subscriptions` + `billing_subscription_services` | 0 services | présent | Menu "Mes services" = vide |
| `supportTickets` | `support_tickets` | 104 | 14 264 | Menu "Support" = quasi vide |
| `loyaltyPoints` | `loyalty_points` | 0 | présent | Menu "Fidélité" = vide |
| `loyaltyTransactions` | `loyalty_transactions` | 0 | présent | Historique fidélité = vide |
| `ticketReplies` | `ticket_replies` | ~237 | 33 873 | Réponses tickets = quasi vides |
| `appointments` | `appointments` | présent | présent | OK si RDV présents |
| `invoices` | `billing_invoices` | présent | présent | OK |
| `orders` | `orders` | présent | présent | OK |

### Verdict

**CAUSE = DONNÉES MANQUANTES (principalement)**

Les menus s'affichent mais retournent des tableaux vides `[]` parce que les tables sources sont vides ou quasi-vides dans le nouveau projet. Il n'y a pas de bug de code dans la logique de routing ou d'affichage — les menus sont conditionnellement rendus sur les données du snapshot, et ces données sont absentes.

---

## BUG 4 — Sections du portail qui ne chargent rien

### Sous-bug 4A : Formation / Académie

**Chaîne complète :**
```
src/components/hub/sections/HubTraining.tsx
  → <AcademyPortal portal={portal} />
    → src/shared-training/AcademyPortal.tsx (lignes 86-130)
      → supabase.from("training_modules")
          .select("*").eq("is_active", true).in("portal", [portal, "both"])
          .order("order_index")
        → 10 lignes actuelles (vs 1 104 dans CSV)
      → supabase.from("training_progress")
          .select("*").eq("agent_id", userId)
      → supabase.from("training_certifications")
          .select("*").eq("agent_id", userId).eq("is_active", true)
      → supabase.rpc("fn_certification_status", { _user_id, _portal })
```

**Preuves de code — `src/shared-training/AcademyPortal.tsx` lignes 86-92 :**
```javascript
const { data: modules } = await supabase
  .from("training_modules")
  .select("*")
  .eq("is_active", true)
  .in("portal", [portal, "both"])
  .order("order_index");
// → retourne max 10 modules (tous les modules de la plateforme)
// → les leçons (training_lessons) ne sont même pas chargées ici directement
//    → elles doivent être chargées dans un composant enfant via module.id
//    → training_lessons: 10 lignes actuelles vs 1 756 dans CSV
```

| Table | Lignes actuelles | Lignes CSV | Impact |
|-------|-----------------|------------|--------|
| `training_modules` | **10 lignes** | **1 104 lignes** | 99.1% des modules manquants |
| `training_lessons` | **10 lignes** | **1 756 lignes** | 99.4% des leçons manquantes |
| `training_progress` | présente | présente | OK |
| `training_certifications` | présente | présente | OK |

**CAUSE = DONNÉES MANQUANTES**

### Sous-bug 4B : Fidélité (ClientLoyalty)

**Chaîne complète :**
```
src/pages/client/ClientLoyalty.tsx (lignes 59-62)
  → canonicalData.loyaltyPoints           ← loyalty_points: 0 lignes
  → canonicalData.loyaltyRewards          ← loyalty_rewards: à vérifier
  → canonicalData.loyaltyTransactions     ← loyalty_transactions: 0 lignes
```

**Preuves de code :**
```javascript
// ClientLoyalty.tsx ne fait PAS de requête directe
// Elle lit depuis canonicalData (useCanonicalClientData)
const { data: canonicalData } = useCanonicalClientData(userId);
const loyaltyBalance = canonicalData?.loyaltyPoints?.[0]?.points_balance ?? 0;
const transactions   = canonicalData?.loyaltyTransactions ?? [];
const rewards        = canonicalData?.loyaltyRewards ?? [];
```

**Requêtes SQL dans `get_client_history_snapshot` (lignes 184-185) :**
```sql
SELECT coalesce(jsonb_agg(to_jsonb(lp) ORDER BY lp.updated_at DESC NULLS LAST), '[]'::jsonb)
INTO v_loyalty_points
FROM public.loyalty_points lp
WHERE lp.client_id = ANY(v_related_user_ids)
   OR (array_length(v_account_ids, 1) > 0 AND lp.account_id = ANY(v_account_ids));
-- → loyalty_points = 0 lignes → v_loyalty_points = []

SELECT coalesce(jsonb_agg(to_jsonb(lt) ORDER BY lt.created_at DESC NULLS LAST), '[]'::jsonb)
INTO v_loyalty_transactions
FROM public.loyalty_transactions lt
WHERE array_length(v_account_ids, 1) > 0 AND lt.account_id = ANY(v_account_ids);
-- → loyalty_transactions = 0 lignes → v_loyalty_transactions = []
```

**CAUSE = DONNÉES MANQUANTES**

### Sous-bug 4C : Snapshot portal non hydraté (sections qui "tournent")

Si un client n'a jamais eu de snapshot généré dans le nouveau projet, `customer_portal_snapshots` retourne NOT FOUND, ce qui déclenche `refresh_customer_portal_snapshot_internal`. Si cette fonction échoue (ex: `client_internal_notes` dans un trigger ou une dépendance), le snapshot reste vide.

`customer_portal_projection_logs` = **0 lignes** dans le nouveau projet (vs 661 218 dans CSV) → aucun snapshot n'a jamais été projeté en cache dans ce projet.

**CAUSE = DONNÉES MANQUANTES + potentiel BUG DE CODE** (si triggers de refresh échouent à cause de tables manquantes)

---

## BUG 5 — Support / Tickets incomplets

### Chaîne complète

**Portal client (via snapshot) :**
```
src/hooks/useCanonicalClientData.ts
  → portalClient.rpc("get_customer_portal_snapshot")
    → get_client_history_snapshot (ligne 177):
        SELECT ... FROM support_tickets st
        WHERE st.user_id = ANY(v_related_user_ids)
           OR st.owner_user_id = ANY(v_related_user_ids)
           OR st.account_id = ANY(v_account_ids)
           OR st.related_order_id = ANY(v_order_ids)
           OR lower(st.client_email) = ANY(v_emails)
    → customer_portal_enrich_snapshot:
        SELECT ... FROM ticket_replies tr
        WHERE tr.ticket_id = ANY(v_ticket_ids)
```

**Admin (Nivra Core) :**
```
src/pages/admin/AdminClients.tsx (lignes 263-276)
  → adminClient.from("support_tickets")
      .or("user_id.eq.X,client_email.eq.Y")
      .order("created_at", { ascending: false })
```

**Notes internes (admin) :**
```
src/components/admin/ClientInternalNotes.tsx (ligne 59)
  → supabase.from("client_internal_notes")   ← TABLE ABSENTE → CRASH SQL
      .select("*").eq("client_id", clientId)
```

### Preuves de code

**`supabase/migrations/20260527020926_79359ac3.sql` — ligne 177 :**
```sql
SELECT coalesce(jsonb_agg(to_jsonb(src) ORDER BY src.created_at DESC NULLS LAST), '[]'::jsonb)
INTO v_support_tickets
FROM (
  SELECT DISTINCT ON (st.id) st.*
  FROM public.support_tickets st
  WHERE st.user_id = ANY(v_related_user_ids)
     OR st.owner_user_id = ANY(v_related_user_ids)
     OR st.created_by_user_id = ANY(v_related_user_ids)
     OR (array_length(v_account_ids, 1) > 0 AND st.account_id = ANY(v_account_ids))
     OR (array_length(v_order_ids, 1) > 0 AND st.related_order_id = ANY(v_order_ids))
     OR (array_length(v_emails, 1) > 0 AND lower(btrim(st.client_email)) = ANY(v_emails))
  ORDER BY st.id, st.created_at DESC NULLS LAST
) src;
-- → La logique SQL est CORRECTE
-- → Mais support_tickets ne contient que 104 lignes (vs 14 264 dans CSV)
```

**`src/components/admin/ClientInternalNotes.tsx` — ligne 59-65 :**
```javascript
const { data, error } = await supabase
  .from("client_internal_notes")
  .select("*")
  .eq("client_id", clientId)
  .order("created_at", { ascending: false });
// PostgreSQL error: relation "public.client_internal_notes" does not exist
// → error n'est pas null → la section plante ou affiche une erreur silencieuse
```

**`src/components/admin/ClientInternalNotes.tsx` — ligne 85 (INSERT) :**
```javascript
const { error } = await supabase
  .from("client_internal_notes")
  .insert({ client_id: clientId, content: newNote, ... });
// → Même erreur SQL → impossible d'ajouter une note
```

### Tables et comptes actuels

| Table | Lignes actuelles | Lignes CSV | % récupéré |
|-------|-----------------|------------|------------|
| `support_tickets` | **104** | **14 264** | **0.7%** |
| `ticket_replies` | **~237** | **33 873** | **~0.7%** |
| `client_internal_notes` | **N/A — TABLE ABSENTE** | 353 | **0%** |

### Verdict

| Composant | CAUSE |
|-----------|-------|
| Liste des tickets (portal) | ❌ **DONNÉES MANQUANTES** — 104 lignes / 14 264 |
| Réponses aux tickets | ❌ **DONNÉES MANQUANTES** — ~237 lignes / 33 873 |
| Notes internes admin | ❌ **BUG DE CODE** — table `client_internal_notes` absente → crash SQL |
| Ajout de note impossible | ❌ **BUG DE CODE** — même table absente → INSERT échoue |

**CAUSE GLOBALE = BUG DE CODE + DONNÉES MANQUANTES**

---

## Résumé exécutif

| Bug | Page / Fichier React | Hook / API | RPC / Table SQL | Lignes actuelles | CAUSE |
|-----|---------------------|-----------|-----------------|-----------------|-------|
| 1. Comptes clients | `AdminClients.tsx` | `useQuery(adminClient)` | `unified_clients` VIEW | ✅ profiles présents | **BUG CODE** (client_internal_notes absente) + **DONNÉES** (tickets, services) |
| 2. Services actifs | `AdminClients.tsx` + portal | `useCanonicalClientData` | `billing_subscription_services` | **0 lignes** | **DONNÉES MANQUANTES** |
| 3. Menus portal vides | Hub + Dashboard portal | `useCanonicalClientData` | `get_customer_portal_snapshot` RPC | snapshot vide car tables sources vides | **DONNÉES MANQUANTES** |
| 4. Sections portal vides | `HubTraining.tsx` + `ClientLoyalty.tsx` | `AcademyPortal` + `useCanonicalClientData` | `training_modules` (10/1104), `loyalty_points` (0) | quasi-zéro | **DONNÉES MANQUANTES** |
| 5. Support incomplet | `AdminClients.tsx` + portal | `useQuery` + `useCanonicalClientData` | `support_tickets` (104/14264), `client_internal_notes` (absente) | 0.7% + absent | **BUG CODE** (notes absentes) + **DONNÉES** (tickets) |

### Bugs de code purs (indépendants des données)

| Fichier | Ligne | Problème | Erreur SQL |
|---------|-------|----------|-----------|
| `ClientInternalNotes.tsx` | 59 | SELECT sur `client_internal_notes` | `relation "client_internal_notes" does not exist` |
| `ClientInternalNotes.tsx` | 85 | INSERT sur `client_internal_notes` | même erreur |

### Tables à restaurer en priorité pour débloquer les 5 bugs

| Priorité | Table | Lignes dans CSV | Impact si restaurée |
|----------|-------|----------------|---------------------|
| P1 | `client_internal_notes` | 353 | Arrêt du crash dans ClientInternalNotes (bug de code) |
| P1 | `billing_subscription_services` | présent | Bug 2 résolu — services actifs visibles |
| P1 | `support_tickets` | 14 264 | Bug 5 partiellement résolu |
| P1 | `ticket_replies` | 33 873 | Bug 5 partiellement résolu |
| P2 | `training_modules` | 1 104 | Bug 4A résolu — formation visible |
| P2 | `training_lessons` | 1 756 | Bug 4A résolu — leçons visibles |
| P2 | `loyalty_points` | présent | Bug 4B résolu — solde fidélité visible |
| P2 | `loyalty_transactions` | présent | Bug 4B résolu — historique visible |
| P3 | `service_addresses` | présent | Adresses de service dans les abonnements |
