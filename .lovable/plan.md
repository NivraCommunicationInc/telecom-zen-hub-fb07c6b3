
# Refonte complète du Portail Technicien Nivra

Objectif : reconstruire uniquement la **couche UX** du portail technicien avec le niveau de qualité de Nivra Core (Linear / Stripe / Apple), sans toucher à la logique métier, aux Edge Functions, aux RPC, aux triggers, ni aux Single-Door.

---

## 1. Inventaire de l'existant (à conserver)

**Layout / Shell**
- `TechAppLayout.tsx`, `TechBottomNav.tsx`, `TechHeader.tsx`, `TechTopBar.tsx`, `TechProtectedRoute.tsx`, `OfflineIndicator.tsx`
- Style : `styles/tech-portal.css` (High-Vis Amber) → **remplacé**

**Pages actuelles (18)**
Dashboard, Appointments, Assignments, Active, Installation, Map, Menu, Client360, Chat, Tickets, Scanner, Stock, WorkOrder, Schedule, Performance, Vehicle, Training, Profile

**Hooks & data layer (conservés tels quels)**
- `useAvailableAssignments`, `useTechAssignments`, `useTechMapData`, `useVanStock`, `usePunch`, `queueTechEmail`
- Hooks partagés : `useAppointmentDetail`, `useClientProfile`, `useOrderDetail`, etc.

**Composants terrain (conservés)**
- `PhotoCapture`, `QRScanner`, `SignaturePad`, `TechMiniMap`

**Edge Functions / RPC utilisées (intouchables)**
- `queue_tech_status_email`, `get_available_installation_slots`, `fn_upsert_canonical_appointment_from_legacy`, `send-appointment-reminder`, `client-account-actions`, `email-queue-drain`, provisioning, communications gateway, etc.

**Tables lues (intouchables)**
- `appointments`, `technician_assignments`, `technician_locations`, `inventory_stock`, `equipment_inventory`, `installation_jobs`, `installations`, `work_orders`, `internal_tickets`, `live_chat_*`, `accounts`, `profiles`, `service_addresses`, `orders`, `billing_*`.

---

## 2. Nouveau Design System (aligné Nivra Core)

Créer `src/tech-app/styles/tech-core.css` avec des tokens **sémantiques** mappés sur les tokens Core (`--background`, `--foreground`, `--primary`, `--card`, `--muted`, `--accent`, `--ring`, radii, ombres). Aucune couleur hardcodée dans les composants.

- **Palette** : neutre foncé (slate-950/900) + surfaces slate-900/800, accent `--primary` (bleu corporate #0066CC), succès émeraude, danger rouge, warning ambre.
- **Typographie** : Inter / SF-like ; titres semi-bold, aucune italique majuscule, tracking neutre.
- **Radius** : `--radius: 12px` (cartes 16px, boutons 10px).
- **Ombres** : élévation douce (0 1px 2px, 0 8px 24px) façon Linear.
- **Animations** : `fade-in`, `scale-in`, `slide-in-right` (Tailwind existants), 150–200 ms ease-out.
- **Composants shadcn** : Card, Sheet (drawers), Dialog, Command (palette), Tabs, ScrollArea, Badge, Tooltip, DropdownMenu, Toast, Skeleton — mêmes variantes que Core.

---

## 3. Nouvelle architecture UX

### 3.1 Shell
```text
┌────────────────────────────────────────────────────────┐
│ TopBar : logo · statut (Dispo/Route/Pause/Offline) ·   │
│          command palette (⌘K) · notifications · avatar │
├──────────┬─────────────────────────────────────────────┤
│ Sidebar  │  Workspace                                  │
│ compacte │  (page active + drawers + split-view)       │
│ (icônes) │                                             │
│ desktop  │                                             │
└──────────┴─────────────────────────────────────────────┘
    Mobile : sidebar → BottomNav 5 onglets + FAB scanner
```

### 3.2 Arborescence menu (sidebar)
1. **Dashboard** (`/tech`)
2. **Journée** (`/tech/today`) — timeline RDV du jour
3. **Rendez-vous** (`/tech/appointments`) — liste + filtres
4. **Carte** (`/tech/map`)
5. **Installation active** (`/tech/installation/:id`)
6. **Clients** (`/tech/clients` → `client360/:id`)
7. **Diagnostics** (`/tech/diagnostics`) — **NOUVEAU**
8. **Inventaire** (`/tech/stock`)
9. **Scanner** (FAB global)
10. **Tickets** (`/tech/tickets`)
11. **Messages** (`/tech/chat`)
12. **Performance** (`/tech/performance`)
13. **Véhicule** (`/tech/vehicle`)
14. **Formation** (`/tech/training`)
15. **Assistant IA** (drawer global ⌘I) — **NOUVEAU**
16. **Profil** (`/tech/profile`)

### 3.3 BottomNav mobile
`Dashboard · Journée · Scanner (FAB) · Carte · Plus` (feuille modale → tous les modules).

---

## 4. Wireframes textuels

### Dashboard
```text
[Header] Bonjour Marc · Mardi 14 juillet · 08:42 · [Statut ▾ Disponible]
[Hero mission suivante]  ────────────────────────
  Prochaine intervention · dans 23 min · 4.2 km
  Oldo Lavaud — Installation Internet + TV
  1234 rue X, Montréal
  [Itinéraire] [Appeler] [En route]

[KPI row 4 cartes]
  RDV aujourd'hui 6 · Complétés 2 · Distance 42 km · Ponctualité 96%

[Grid 2 col]
  ┌ Timeline journée ──────┐  ┌ Alertes & messages ─┐
  │ 09:30 Client A ✓        │  │ 3 msg dispatch      │
  │ 11:00 Client B en cours │  │ 1 ticket urgent     │
  │ 13:30 Client C          │  │ Stock POD < 2       │
  └────────────────────────┘  └──────────────────────┘

  ┌ Mini-carte ────────────┐  ┌ Objectifs & perf ────┐
  │ (route optimisée)      │  │ 18/25 installs mois  │
  └────────────────────────┘  └──────────────────────┘

[Météo · trafic · résumé jour]
```

### Rendez-vous (liste + drawer)
```text
Filtres: [Aujourd'hui][Semaine][Statut][Priorité]  🔍 recherche
┌ Card RDV ───────────────────────────────────┐
│ 11:00 · Installation Internet · Priorité ●  │
│ Oldo L. · 1234 rue X · 4.2 km · 45 min      │
│ [Détails] [Route] [Appeler] [Démarrer]      │
└─────────────────────────────────────────────┘
Clic → Sheet latéral (Drawer) : client, services, équipement, historique, notes, actions.
```

### Installation active (split-view)
```text
┌ Étapes rail (gauche) ──┬ Contenu étape (droite) ─────┐
│ ● Avant                │ Validation identité         │
│ ○ Pendant              │ Checklist matériel          │
│ ○ Tests                │ [Scanner] [Photos] [Notes]  │
│ ○ Signature            │                              │
│ ○ Rapport              │                              │
└────────────────────────┴──────────────────────────────┘
Barre inférieure sticky : [Pause] [Escalader] [Suivant →]
```

### Client 360 (drawer plein-écran)
Onglets : Vue d'ensemble · Services · Équipement · Historique · Paiements · Documents · Notes.

### Diagnostics (nouveau)
Grille outils : Internet (ping, DNS, PPPoE, vitesse) · Wi-Fi (RSSI, canal) · TV · Mobile · SIM. Résultats en cartes avec état ✓/✗.

### Carte
Mapbox pleine hauteur, panneau flottant : liste RDV, ETA temps réel, bouton "Optimiser tournée".

### Assistant IA (drawer ⌘I)
Champ prompt, contexte client auto-injecté, réponses markdown, actions rapides ("Procédure ONT", "Pourquoi suspendu?").

---

## 5. Composants réutilisables (nouveaux, dans `src/tech-app/components/ui/`)

- `TechShell` (sidebar + topbar + workspace)
- `TechSidebar`, `TechTopBar` (refait), `TechCommandPalette`
- `StatusPill` (Dispo/Route/Pause/Offline)
- `KpiCard`, `MissionHeroCard`, `AppointmentCard`, `TimelineItem`
- `ClientDrawer`, `AppointmentDrawer`, `InstallationStepRail`
- `DiagnosticCard`, `InventoryRow`, `TicketRow`
- `AiAssistantDrawer`
- `EmptyState`, `LoadingSkeletons`, `ErrorState`

Tous consomment les **mêmes hooks existants** — aucun changement de data layer.

---

## 6. Conservé / Remplacé / Supprimé

**Conservés (data + composants terrain)**
- Tous les hooks `lib/*`, `PhotoCapture`, `QRScanner`, `SignaturePad`, `TechMiniMap`, `OfflineIndicator`, `TechProtectedRoute`.

**Remplacés (UI)**
- `TechAppLayout`, `TechHeader`, `TechTopBar`, `TechBottomNav`, `styles/tech-portal.css`
- Toutes les pages sous `pages/` — réécrites en consommant les hooks existants.

**Supprimés**
- `TechMenu.tsx` (remplacé par sidebar + command palette)
- `TechActive.tsx` (fusionné dans Dashboard "mission suivante")

**Nouveaux**
- `TechToday.tsx`, `TechDiagnostics.tsx`, `TechClients.tsx` (liste), `AiAssistantDrawer.tsx`, `TechCommandPalette.tsx`.

---

## 7. Responsive

- **Mobile (prioritaire)** : BottomNav 5 tabs, FAB scanner, drawers plein-écran, listes denses.
- **Tablette** : sidebar rétractable en icônes, split-view sur Installation et Carte.
- **Desktop** : sidebar complète, command palette, drawers à droite (Sheet), multi-panneaux.

Breakpoints Tailwind standards (`sm/md/lg/xl`).

---

## 8. Accessibilité

- Contraste AA sur toutes les surfaces (vérifié via tokens sémantiques).
- Cibles tactiles ≥ 44 px.
- Focus visibles (`--ring`), navigation clavier complète, `aria-label` sur toutes les icônes-actions.
- États : loading (Skeleton), empty (illustration + CTA), error (retry).
- Support offline conservé via `OfflineIndicator`.

---

## 9. Stratégie de migration (par phases)

**Phase 0 — Design system** *(1 étape)*
Créer `tech-core.css` + tokens + primitives (`TechShell`, `Sidebar`, `TopBar`, `CommandPalette`, `StatusPill`, `KpiCard`, drawers).

**Phase 1 — Shell + Dashboard** *(nouveau look actif immédiatement)*
Remplacer `TechAppLayout`, monter la nouvelle sidebar/topbar, refaire `TechDashboard`. Le reste des pages hérite du nouveau shell mais garde temporairement leur contenu.

**Phase 2 — Rendez-vous + Installation active + Client 360**
Refonte des 3 écrans les plus utilisés en drawers/split-view.

**Phase 3 — Carte + Diagnostics + Scanner + Inventaire**
Refonte terrain, ajout module Diagnostics.

**Phase 4 — Tickets + Chat + Notifications + Assistant IA**
Centre de communication + drawer IA (utilise Edge Function AI déjà en place, aucune nouvelle logique).

**Phase 5 — Performance + Véhicule + Formation + Profil**
Écrans secondaires.

**Phase 6 — Nettoyage**
Supprimer `tech-portal.css`, `TechMenu`, `TechActive`, anciens composants amber.

Chaque phase est indépendante : le portail reste utilisable entre les phases.

---

## 10. Risques identifiés

| Risque | Mitigation |
|---|---|
| Régression sur hooks partagés | Aucune modif des hooks/lib, uniquement consommation |
| Rupture de la nav mobile pendant migration | Nouveau shell livré en Phase 1, tous les liens redirigés |
| Divergence tokens Core / Tech | Importer les mêmes variables sémantiques depuis `src/index.css` |
| Command palette + raccourcis clavier sur mobile | Feature-flag desktop-only |
| Assistant IA — coût / latence | Rate-limit côté UI, streaming, réutilisation Edge Function AI existante |
| Cartographie Mapbox | Réutilisation du token public déjà configuré |
| Emails techniciens (queue) | Aucune modif — UI déclenche les mêmes RPC/EF |

---

## 11. Contraintes strictes (rappel)

- ❌ Aucune modif de logique métier, RPC, triggers, Edge Functions, invariants, Single-Door.
- ❌ Aucun calcul de prix / taxes côté frontend.
- ✅ Uniquement UI + composition + consommation des hooks/API existants.
- ✅ Tokens sémantiques uniquement, aucune couleur hardcodée.
- ✅ Même famille visuelle que Nivra Core.

---

**Validation demandée avant Phase 0.** Réponds :
- **GO** → je démarre Phase 0 (design system + shell).
- **Ajustements** → indique les sections à revoir (menu, wireframes, ordre des phases, modules à ajouter/retirer).
