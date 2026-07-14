
# Refonte complète — Nivra Tech Portal v2

## 0. Cadre & invariants (à ne PAS toucher)

Tout le travail est **UI/UX uniquement**. On préserve intégralement :

- **Edge Functions** : `queue-tech-status-email`, `send-appointment-reminder`, `email-queue-drain`, `client-account-admin`, `order-tracking-status-notify`, `field-sales-sync`, `new-order-actions`, etc.
- **RPC / Single-Door** : `get_available_installation_slots`, `apply_active_account_promotions_to_invoice`, `orchestrate_order`, `fn_canonicalize_order_client_identity`, `fn_normalize_order_installation_flags`, `fn_upsert_canonical_appointment_from_legacy`, `has_role`, `qa_purge_subscription`, etc.
- **Triggers** : `trg_lock_identity_fields`, `trg_guard_order_lifecycle_no_skip`, canonicalisation d'adresses, sync legacy → `appointments`.
- **Tables canoniques** : `appointments`, `orders`, `billing_subscriptions`, `service_addresses`, `technician_assignments`, `technicians`, `inventory_stock`, `provisioning_jobs`, `support_tickets`, `live_chat_sessions`, `user_roles`, `email_queue`.
- **Hooks métier existants** (réutilisés tels quels) : `useTechAssignments`, `useAvailableAssignments`, `usePunch` / `useOpenPunch`, `useTechMapData`, `useVanStock`, `useTechnicianSectionBadges`, `queueTechEmail`.
- **Design tokens Core** : on aligne le portail sur `src/styles/nivra-design.css` + `design-tokens.css` (mêmes HSL, mêmes radius, mêmes ombres) via `tech-core.css` scoping `[data-portal="tech"]`.

Aucun contournement Single-Door, aucune duplication de calcul (prix, taxes, provisioning, RLS). L'UI appelle uniquement les hooks/Edge Functions existants.

## 1. Inventaire actuel (audit)

**Pages (18)** : TechDashboard, TechAppointments, TechAssignments, TechActive, TechInstallation, TechWorkOrder, TechMap, TechScanner, TechStock, TechClient360, TechChat, TechTickets, TechSchedule, TechMenu, TechTraining, TechPerformance, TechVehicle, TechProfile.

**Composants** : TechAppLayout, TechBottomNav, TechHeader, TechTopBar, TechSidebar (v2, nouveau), TechShellTopBar (v2, nouveau), TechProtectedRoute, TechMiniMap, PhotoCapture, QRScanner, SignaturePad, OfflineIndicator.

**Styles** : `tech-portal.css` (legacy High-Vis Amber, à retirer progressivement), `tech-core.css` (v2, nouveau — tokens HSL, primitives `tc-*`).

**Hooks** : voir §0.

**Tables consommées** : `appointments`, `technician_assignments`, `orders`, `inventory_stock`, `time_entries`, `technicians`, `technician_locations`, `support_tickets`, `live_chat_sessions/messages`, `client_documents`, `billing_subscriptions`, `service_addresses`.

**Problèmes identifiés** :
- Deux systèmes de style cohabitent (violet legacy → amber → v2), incohérence visuelle.
- Menu éclaté sur trop de pages, trop de clics.
- Pas de command palette, pas de drawer contextuel, pas d'AI in-app.
- Dashboard = liste, pas un vrai centre de commande.
- Aucun diagnostic terrain (ping, wifi, signal).
- Client 360 tech absent des workflows d'installation (le tech doit sortir de son flow).
- Notifications éparpillées, pas de centre unifié.

## 2. Architecture UX cible

### 2.1 Shell (nouveau)

```text
+----------------------------------------------------------+
| TechShellTopBar  [Nivra] [⌘K search] [status pill] [🔔] [avatar]
+---------+------------------------------------------------+
|         |                                                |
| Tech    |                                                |
| Sidebar |   Zone de travail (routes)                     |
| (rail   |   + Drawers contextuels                        |
|  256px) |   + Command Palette (⌘K)                       |
|         |   + AI Assistant (⌘I)                          |
|         |                                                |
+---------+------------------------------------------------+
                    [TechBottomNav — mobile uniquement]
```

- **Desktop** : sidebar rail 256px + top bar 56px. Split view drawer à droite pour Client 360 / détails RDV.
- **Tablette** : sidebar collapsible 64px, drawers plein écran.
- **Mobile** : top bar minimale, bottom nav 5 slots (Dash · RDV · Scanner FAB · Carte · Menu). Sidebar en Sheet.

### 2.2 Arborescence de navigation

```text
Ops
  Dashboard              /tech
  Rendez-vous            /tech/appointments
  Dispatch               /tech/assignments
  Horaire & Punch        /tech/schedule
  Carte terrain          /tech/map

Terrain
  Installation active    /tech/active  (redirige vers /tech/installation/:id)
  Bon de travail         /tech/workorder/:id
  Diagnostics            /tech/diagnostics       [NOUVEAU]
  Scanner                /tech/scanner
  Stock véhicule         /tech/stock
  Photos & Preuves       /tech/gallery/:missionId [NOUVEAU]

Clients
  Client 360 (tech)      /tech/client360/:id
  Messages               /tech/chat
  Tickets                /tech/tickets
  Appels                 /tech/calls              [NOUVEAU]

Moi
  Performance            /tech/performance
  Véhicule & EHS         /tech/vehicle
  Formation              /tech/training
  Notifications          /tech/notifications      [NOUVEAU]
  Profil                 /tech/profile
```

### 2.3 Écrans clés — wireframes textuels

**Dashboard (Command Center)** — refait ce tour-ci :
```text
[Bonjour Prénom]   date · heure           [Shift 3h 20m]
+---- Hero mission ----------------------------------+
| PROCHAINE MISSION · 14:30                          |
| Client · Adresse · Service                         |
| [Appeler] [Itinéraire] [Ouvrir la mission →]      |
+----------------------------------------------------+
[KPI RDV] [KPI En route] [KPI Dispatch] [KPI Progression]
+---- Agenda ------------------+  +-- Mini carte ---+
| 09:00 Client A ...           |  |  live map      |
| 14:30 Client B ...           |  +-----------------+
| 16:00 Client C ...           |  +-- Stock --------+
+------------------------------+  +-- AI Assistant -+
[Alerts row: RDV manqués / Dispatch / Stock bas]
[Accès rapide — 6 modules]
```

**Rendez-vous détail (Drawer contextuel)** :
- En-tête client + statut pill + priorité
- Sections : Client · Adresse · Services · Historique · Notes · Équipements requis · Photos
- Actions rapides bottom-sticky : Trajet · Arrivé · Démarrer · Suspendre · Compléter · Absent · Escalader

**Installation active (Split view)** :
```text
| Étapes (rail gauche)  |  Panneau actif (droite)      |
| ✓ Identité            |  Formulaire / checklist      |
| ✓ Adresse             |  + tests diagnostics inline  |
| ● Installation        |  + photos                    |
| ○ Tests               |  + SSID / mot de passe wifi  |
| ○ Signature           |                              |
| ○ Rapport             |  Bottom bar : suivant / pause|
```

**Diagnostics (nouveau)** : onglets Internet / TV / Mobile / Wi-Fi. Chaque onglet = liste de tests (ping, DHCP, DNS, PPPoE, IP, débit ; RSSI, canal, bande…). Résultats stockés dans `internet_diagnostics` (déjà en place).

**Carte** : Mapbox GL, position live tech (`technician_locations`), pins RDV colorés par statut, optimisation d'itinéraire (Directions API), overlay trafic, ETA calculé.

**Client 360 tech (drawer)** : version condensée du Core Client 360, lecture seule + actions autorisées tech (ajouter note, créer ticket, ouvrir chat). Utilise `useClientProfile` / `useSubscriptionDetail` existants.

**Command Palette (⌘K)** : recherche unifiée RDV / clients / tickets / actions ("Punch out", "Ouvrir carte", "Nouveau ticket").

**AI Assistant (⌘I, drawer)** : composant AI Elements + Edge Function `chat` (Lovable AI Gateway, `openai/gpt-5.5`). Contexte = RDV en cours / client sélectionné. Streaming, tool-calls pour lire l'historique.

**Notifications Center** : hub unifié depuis `staff_notifications`, `notification_outbox`, `email_queue` filtrés au user courant + realtime.

### 2.4 Composants réutilisables (nouveaux, dans `src/tech-app/components/`)

- `TechStatusPill` (Available / Route / Pause / Offline)
- `MissionCard`, `MissionRow`, `MissionDetailDrawer`
- `StepRail` (installation)
- `KpiTile`, `AlertBanner`
- `TechCommandPalette` (cmdk)
- `AiAssistantDrawer`
- `NotificationBell` + `NotificationCenter`
- `DiagnosticsPanel` (Internet / TV / Mobile / Wifi tabs)
- `PhotoGallery` (regroupe PhotoCapture existant)
- `SignatureDialog` (wrap SignaturePad existant)
- `ScannerSheet` (wrap QRScanner existant, universel QR/barcode/série/MAC/IMEI)
- `ClientMiniProfile` (drawer client 360 tech)

Toutes ces primitives consomment `tc-*` de `tech-core.css` + shadcn (Sheet, Dialog, Tabs, Command, ScrollArea).

## 3. Design system

- Fichier unique v2 : `src/tech-app/styles/tech-core.css` (déjà créé, HSL, tokens shadcn scoped `[data-portal="tech"]`).
- Suppression progressive de `tech-portal.css` (legacy amber) — retiré uniquement quand toutes les pages migrées.
- Mêmes primitives que Core : `tc-surface`, `tc-kpi`, `tc-pill`, `tc-btn`, `tc-mission-hero`, `tc-row`, `tc-nav-item`, `tc-focus-ring`, `tc-tabular`.
- Animations : `animate-fade-in`, `animate-scale-in`, transitions 150ms ease, ombres 3 niveaux, gradient primaire aligné Core (`#0066CC → #1a8cff`).
- Typo Inter, tabular-nums pour tous chiffres, tracking -0.02em sur titres.

## 4. Composants — conservés / remplacés / supprimés

| Statut | Composants |
|---|---|
| **Conservés** (logique) | PhotoCapture, QRScanner, SignaturePad, OfflineIndicator, TechProtectedRoute, TechMiniMap, tous les `useTech*` hooks |
| **Remplacés / réécrits** | TechAppLayout (shell v2), TechBottomNav (v2 fait), TechSidebar (v2 fait), TechShellTopBar (v2 fait), TechDashboard (v2 fait), TechAppointments, TechAssignments, TechInstallation, TechWorkOrder, TechMap, TechClient360, TechChat, TechTickets, TechStock, TechScanner, TechSchedule, TechPerformance, TechVehicle, TechTraining, TechMenu, TechProfile |
| **Nouveaux** | TechDiagnostics, TechCalls, TechNotifications, TechGallery, TechCommandPalette, AiAssistantDrawer, NotificationCenter, MissionDetailDrawer, ClientMiniProfile, DiagnosticsPanel |
| **Supprimés** (fin de migration) | TechHeader (legacy), TechTopBar (legacy), `tech-portal.css` amber |

## 5. Responsive

- Breakpoints : `<640` mobile (bottom nav + sheets), `640-1024` tablette (sidebar 64px + drawers), `≥1024` desktop (sidebar 256px + split view).
- Touch targets ≥ 44×44px partout, `h-dvh` (pas `h-screen`), safe-area inset (iOS notch).
- Sheet plein écran mobile pour Client 360 / RDV detail / AI drawer.
- Command palette accessible clavier (⌘K) + bouton search top bar mobile.

## 6. Accessibilité

- Contraste ≥ AA sur tokens v2 (déjà vérifié : foreground `210 20% 96%` sur `222 47% 5%` = 15:1).
- `aria-label` sur toutes icon-only buttons.
- Focus rings via `tc-focus-ring` (outline `--ring`).
- Landmarks `<main>` unique dans TechAppLayout.
- Live regions pour toasts / statut punch / notifications.

## 7. Plan de migration en 6 phases

| Phase | Contenu | Statut |
|---|---|---|
| **P0** Design system | `tech-core.css` tokens + primitives | ✅ fait |
| **P1** Shell + Dashboard | TechAppLayout, TechSidebar, TechShellTopBar, TechBottomNav, TechDashboard | ✅ fait |
| **P2** RDV & Installation | TechAppointments, MissionDetailDrawer, TechInstallation, TechWorkOrder, StepRail | à faire |
| **P3** Terrain | TechMap (Mapbox), TechScanner (universel), TechStock, TechDiagnostics, TechGallery | à faire |
| **P4** Client & Comms | TechClient360 (drawer), TechChat, TechTickets, TechCalls, NotificationCenter | à faire |
| **P5** Command Palette + AI | TechCommandPalette (⌘K), AiAssistantDrawer (⌘I) + Edge Function `tech-ai-assistant` | à faire |
| **P6** Cleanup | Migration TechSchedule/Performance/Vehicle/Training/Profile/Menu, suppression `tech-portal.css` legacy, TechHeader/TechTopBar retirés | à faire |

Chaque phase = branche isolée, tests visuels (Playwright), aucun changement DB/Edge Function.

## 8. Risques identifiés

1. **Régression sur workflows critiques** (installation, punch, provisioning). → Mitigation : réutilisation stricte des hooks existants, aucun changement de contrat.
2. **Cohabitation `tech-portal.css` / `tech-core.css`** pendant la migration. → `tech-core.css` chargé après, tokens scoped `[data-portal="tech"]`, jamais globaux.
3. **Mapbox coûts / limites** sur carte live. → Utiliser browser token public existant, refresh position 30s max, clustering pins.
4. **AI Assistant coûts** (Lovable AI). → Rate limit côté Edge Function (5/min/tech), streaming, model `openai/gpt-5.5`.
5. **Notifications realtime volume** → Filtre serveur strict (`user_id = auth.uid()`), pagination.
6. **Mobile perf** avec drawers imbriqués. → `React.lazy` par route, images optimisées, no full-page repaint.

## 9. Ce qui est déjà livré (tour précédent)

- `src/tech-app/styles/tech-core.css`
- `src/tech-app/components/TechSidebar.tsx`
- `src/tech-app/components/TechShellTopBar.tsx`
- `src/tech-app/components/TechBottomNav.tsx` (réécrit v2)
- `src/tech-app/TechAppLayout.tsx` (shell v2 câblé)
- `src/tech-app/pages/TechDashboard.tsx` (Command Center complet)

## 10. Prochaine étape après validation

Démarrer **P2 — RDV & Installation** :
1. `MissionDetailDrawer` (drawer contextuel avec toutes actions).
2. Réécriture `TechAppointments.tsx` (liste + filtres + KPI + drawer).
3. Réécriture `TechInstallation.tsx` avec `StepRail` + validations avant/pendant/après + diagnostics inline + wifi credentials + signature/rapport.
4. `TechWorkOrder.tsx` aligné v2.

---

**Validation demandée** : confirme le plan (ou pointe les zones à ajuster) avant que je poursuive avec P2.
