
# Refonte Portail Technicien Nivra

Cible: 3-10 techs sur téléphone/tablette. Palette locked: fond `#0f0f1a`, surfaces `#1a1a2e`, primary `#7c3aed`, glow `#a78bfa`. Typo: Outfit + Figtree. Layout: bento-grid.

## Phase 1 — Fondation visuelle + Dashboard (livrable immédiat)

**Design system tech**
- Créer `src/tech-app/styles/tech-portal.css` avec tokens dédiés (dérivés Nivra Purple Bold)
- Installer `@fontsource/outfit` + `@fontsource/figtree`, configurer Tailwind
- Layout global `TechAppLayout`: header sticky (avatar + statut live pulsant), bottom nav flottante 5 tabs avec Scanner central surélevé

**Refonte `TechDashboard`** (bento-grid)
- Card XL "Prochain job": client, adresse, ETA, type de service, distance, bouton "Démarrer"
- Grille 2×2: mini-map GPS · KPIs jour (jobs faits/total, commission $) · Punch in/out timer · Stock van (alerte si bas)
- Feed notifications dispatch avec dot pulsant

**Navigation refaite**
- Bottom nav: Jobs · Carte · Scanner (centre) · Stock · Profil
- Composants `TechCard`, `TechStat`, `TechBadge`, `LiveDot` réutilisables

## Phase 2 — Synchro temps réel (Realtime)

**Realtime Supabase**
- Activer publication sur `technician_assignments`, `installation_jobs`, `field_sales_orders`, `staff_notifications`
- Hook `useTechRealtime` avec un seul channel par tech, cleanup unmount
- Toast + son + vibration quand nouvelle assignation ou changement statut
- Invalidation React Query automatique

**Notifications push**
- Utiliser `push_subscriptions` (déjà en place) pour envois background dispatch → tech
- Sons contextuels: nouveau job / annulation / urgence

## Phase 3 — Workflow d'installation guidé

**Refonte `TechInstallation` en machine à états**
- 6 étapes verrouillées séquentiellement:
  1. Arrivée sur site (check-in GPS obligatoire)
  2. Photos avant (min 2)
  3. Installation équipement (checklist par service: modem/terminal TV/SIM)
  4. Tests (speedtest obligatoire pour Internet, canaux TV, signal mobile)
  5. Photos après + signature client
  6. Récap + soumission
- Barre de progression persistante
- Sauvegarde brouillon locale + `installation_jobs.state` server-side
- Photos vers `service-photos` bucket avec compression client

**Scanner équipement amélioré**
- Scan code-barres/QR (déjà présent) → auto-remplir modem MAC/serial
- Validation contre `equipment_inventory`
- Assignation instantanée à `installations`

## Phase 4 — Hors-ligne + Outils terrain

**Mode hors-ligne**
- Cache local IndexedDB (dexie): jobs du jour, catalogue équipement, checklist
- Queue d'actions (check-in, photos, notes) → replay au retour du réseau
- Indicateur "hors ligne" visible dans le header
- Service worker via `vite-plugin-pwa` (mode PWA installable seulement en prod, guards Lovable OK)

**Outils terrain**
- Optimisation d'itinéraire: appel Mapbox Directions avec liste des jobs du jour → ordre optimal
- Timer job automatique (start au check-in, stop au submit) → alimente `time_entries`
- Géolocalisation live optionnelle (opt-in) → `technician_locations`

## Section technique

**Tables déjà en place utilisées:**
`technician_assignments`, `installation_jobs`, `installation_job_logs`, `installation_steps_template`, `installations`, `equipment_inventory`, `inventory_assignments`, `technician_locations`, `time_entries`, `staff_notifications`, `push_subscriptions`, `speedtest_results`

**Nouvelles migrations minimales:**
- Ajouter `installation_jobs.workflow_state` (jsonb) pour brouillon
- Enable realtime sur 4 tables citées
- Storage bucket `installation-photos` (privé, RLS par tech assigné)

**Aucune donnée fictive** — placeholders `[À COMPLÉTER]` si prix/plans manquants (respect memory).

## Ordre de livraison recommandé

1. **Phase 1 seule d'abord** (2-3 heures de travail) — tu vois immédiatement le nouveau look, on itère
2. Puis phases 2/3/4 une à la fois selon retour terrain

## Question avant de démarrer

Je démarre par **Phase 1 uniquement** (fondation visuelle + Dashboard refait), ou tu veux que j'attaque plusieurs phases en parallèle?
