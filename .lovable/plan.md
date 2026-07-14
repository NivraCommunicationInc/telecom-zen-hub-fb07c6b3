# Tour 2 — Mission Control + Ma journée

Livraison 100% fonctionnelle, aucune donnée fictive, tout branché sur les tables réelles.

## Portée

Deux pages jumelles dans `/tech` :

- **`/tech/mission-control`** — vue temps réel de la journée du technicien connecté
- **`/tech/ma-journee`** — planification interactive (drag & drop, réordonner, optimiser)

## Sources de données (existantes, rien à inventer)

- `technician_assignments` + `appointments` → rendez-vous du jour
- `technician_locations` → position GPS live
- `intervention_sessions` → statut réel de chaque intervention
- `equipment_inventory` / `inventory_assignments` → stock camion
- `service_incidents` + `system_status` → urgences / NOC
- `orders` + `service_addresses` → contexte client par RDV

Météo & trafic via connecteur Google Maps déjà en place (Weather API + Routes API).

## Composants livrés

### Mission Control (`/tech/mission-control`)
1. **Bandeau statut live** — position GPS, batterie, connexion, prochain RDV avec compte à rebours
2. **Timeline verticale du jour** — chaque RDV = carte (heure, client, adresse, service, statut intervention, ETA, distance)
3. **Widget météo** — conditions actuelles + heure de chaque RDV (Weather API)
4. **Widget trafic** — retard estimé vers prochain RDV (Routes API)
5. **Widget NOC** — `service_incidents` actifs dans les zones du tech
6. **Widget stock camion** — items critiques faibles (<3)
7. **Widget urgences** — RDV `priority=urgent` non commencés
8. **Realtime** — canal Supabase sur `technician_assignments`, `intervention_sessions`, `service_incidents`

### Ma journée (`/tech/ma-journee`)
1. **Liste ordonnée** des RDV du jour (dnd-kit)
2. **Drag & drop** pour réordonner → persiste dans `technician_assignments.sequence_order`
3. **Bouton "Optimiser la tournée"** → RPC `fn_optimize_route(tech_id, date)` qui appelle Routes API `computeRouteMatrix` et écrit l'ordre optimal
4. **Mini-carte Mapbox** synchronisée avec l'ordre courant (polyline + numéros)
5. **Bouton "Démarrer intervention"** sur chaque carte → crée session + redirige vers runner
6. **Compteurs** : distance totale, temps total, économies vs ordre initial

## Base de données

Migration légère :

```sql
-- Colonne d'ordre planifié (si absente)
ALTER TABLE technician_assignments
  ADD COLUMN IF NOT EXISTS sequence_order int,
  ADD COLUMN IF NOT EXISTS route_optimized_at timestamptz;

-- RPC d'optimisation
CREATE OR REPLACE FUNCTION public.fn_optimize_route(_tech_id uuid, _date date)
RETURNS jsonb  -- { ordered_ids[], total_km, total_min, saved_min }
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;

-- RPC de réordonnancement manuel
CREATE OR REPLACE FUNCTION public.fn_reorder_assignments(_tech_id uuid, _ordered_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public;
```

Grants + RLS : lecture/écriture uniquement pour le tech propriétaire (`auth.uid() = technician_id`) + service_role.

## Edge Functions

- **`tech-route-optimize`** — reçoit `{tech_id, date}`, appelle Google Routes `computeRouteMatrix`, résout TSP glouton (≤ 15 points), écrit `sequence_order`, retourne le résumé
- **`tech-weather-batch`** — reçoit `[{lat, lng, time}]`, appelle Weather API par lot, retourne conditions par point

## Frontend

Nouveaux fichiers sous `src/tech/` :

```text
pages/MissionControl.tsx          # widget grid + timeline
pages/MaJournee.tsx               # dnd list + mini-map
components/mission/
  StatusBar.tsx                   # position/battery/next-eta
  TimelineList.tsx
  AppointmentCard.tsx
  WidgetWeather.tsx
  WidgetTraffic.tsx
  WidgetNOC.tsx
  WidgetTruckStock.tsx
  WidgetUrgent.tsx
components/planning/
  SortableAppointment.tsx         # @dnd-kit item
  RouteMiniMap.tsx                # Mapbox GL + polyline
  RouteSummary.tsx
hooks/
  useMyDayAssignments.ts          # realtime feed
  useTechnicianLocation.ts        # geolocation watcher + upsert technician_locations
  useServiceIncidents.ts
  useTruckStock.ts
```

Design system existant (`tech.css`) réutilisé — même identité anthracite/ambre que Tour 1.

## Routing

Mise à jour de `TechRail`/`TechDock` : les entrées "Mission Control" et "Ma journée" deviennent actives (plus de placeholder). Les 8 autres domaines restent en "En construction" avec calendrier honnête.

## Preuves de livraison

À la fin, je fournis :
1. Migration exécutée + `\d technician_assignments` avant/après
2. Edge Functions déployées + `curl` de démo
3. Typecheck `tsgo` = 0 erreur
4. Capture Playwright de `/tech/mission-control` et `/tech/ma-journee` en session authentifiée
5. Démo drag & drop → vérif SQL que `sequence_order` a bien changé
6. Démo "Optimiser" → vérif `route_optimized_at` + Routes API log

## Ce qui N'EST PAS dans ce tour

- Client 360 unifié → Tour 3
- Terrain (carte live cross-techs) → Tour 4
- Intervention, Inventaire, Communication, Ressources, Performance, Paramètres → tours suivants

Ordre de livraison strict : un domaine à la fois, 100% avant de passer au suivant.
