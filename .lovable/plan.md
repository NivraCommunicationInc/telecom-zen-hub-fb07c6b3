# Refonte Produit — Nivra Field Service Platform

Objectif: **remplacer** le portail technicien actuel par une nouvelle plateforme terrain construite depuis zéro. On garde uniquement la logique métier (RPC, tables, Edge Functions). Tout le shell, la navigation, les workflows et les écrans sont nouveaux et vivent dans un **nouveau namespace** `src/field-platform/` — les anciens fichiers `src/tech-app/*` seront supprimés à la fin.

---

## Principes directeurs (non-négociables)

1. **Aucune page reprise** de l'ancien portail. Chaque écran est reconçu autour d'une tâche terrain, pas d'un CRUD.
2. **Navigation par domaine métier** (10 domaines ci-dessous), pas par entité DB.
3. **Action-first**: chaque écran commence par les actions du technicien à cet instant, pas par une liste.
4. **Zero context switch**: recherche universelle (⌘K), drawers contextuels, actions rapides globales, aucun aller-retour vers un menu.
5. **Offline-ready**: file d'attente locale (IndexedDB) + sync, obligatoire dès la V1 sur intervention/inventaire/photos.
6. **Assistant IA contextuel** présent partout (diagnostic, procédure, note client, résumé RDV).

---

## Nouvelle architecture applicative

```text
src/field-platform/
├── app/
│   ├── FieldShell.tsx           # coque unique (topbar globale + rail domaine + zone contextuelle)
│   ├── FieldRouter.tsx          # routes /field/*
│   ├── CommandPalette.tsx       # ⌘K universel (clients, RDV, équipement, actions, docs)
│   ├── QuickActionsDock.tsx     # actions globales flottantes (scanner, appel dispatch, SOS, photo)
│   ├── NotificationCenter.tsx
│   └── AIAssistantPanel.tsx     # copilote contextuel (drawer droit)
├── domains/
│   ├── home/                    # 🏠 Mission Control
│   ├── day/                     # 📅 Ma journée
│   ├── field/                   # 🗺 Terrain (map, GPS, ETA, zones)
│   ├── customers/               # 👤 Client 360
│   ├── intervention/            # 🧰 Intervention guidée (checklist + diag + signature)
│   ├── inventory/               # 📦 Camion & stock
│   ├── comms/                   # 💬 Communication (dispatch, NOC, appels, messages)
│   ├── resources/               # 🎓 Procédures, formations, docs
│   ├── performance/             # 📈 KPI & commissions
│   └── settings/                # ⚙ Profil, véhicule, offline
├── workflows/                   # machines à états métier (intervention, retour, échange…)
├── services/                    # accès RPC/Edge (réutilise la logique existante)
├── offline/                     # IndexedDB queue + sync
├── ai/                          # prompts + tools de l'assistant
└── design/
    └── field.css                # nouveau design system (tokens HSL dédiés)
```

Route racine: **`/field`** (nouvelle). L'ancienne `/tech` redirige vers `/field` pendant la transition, puis est supprimée en P6.

---

## Nouvelle navigation (rien de commun avec l'ancienne)

Rail latéral desktop / dock adaptatif mobile, **10 domaines** exactement:

Accueil · Ma journée · Terrain · Clients · Intervention · Inventaire · Communication · Ressources · Performance · Paramètres

Global (toujours accessible, hors rail):
- **⌘K** recherche universelle (clients, RDV, S/N, MAC, adresse, procédure, action)
- **Scanner universel** (bouton flottant caméra: S/N, MAC, code-barre, QR client)
- **Assistant IA** (drawer droit)
- **Notifications** (centre unifié: dispatch, NOC, client, système)
- **Statut technicien** (Disponible / En route / Sur site / Pause / Fin de journée) — pilote la carte dispatch et les emails automatiques

---

## Détail des 10 domaines (ce qui change vs. ancien)

### 🏠 Accueil — Mission Control
Pas un dashboard de cartes. Une **timeline verticale de la journée** avec: prochain RDV en gros, ETA live, urgences NOC, alertes stock camion, KPI du jour, actions requises (signatures manquantes, RMA à clore). Bouton unique "Démarrer ma journée" qui déclenche checklist camion + géoloc + statut dispatch.

### 📅 Ma journée
Timeline + carte + optimisation trajet auto (RPC nouveau `fn_optimize_route`). Drag pour réordonner, recalcul ETA en direct, envoi automatique email "en route" au client suivant. Vue semaine repliée.

### 🗺 Terrain
Carte plein écran Mapbox: RDV, techniciens actifs, zones de couverture, trafic, NOC incidents. Navigation turn-by-turn embarquée. ETA partagé au client via lien signé.

### 👤 Clients
Recherche instantanée (nom, tél, adresse, compte, S/N). Client 360 = un seul écran scrollable: identité, services actifs, équipement déployé, factures, RMA, notes techniques, photos historiques, contrats signés, timeline complète. Actions inline (appeler, SMS, créer ticket, ouvrir intervention).

### 🧰 Intervention (le cœur)
Écran guidé pas-à-pas, une seule action à la fois:
1. Arrivée (geofence + photo façade)
2. Checklist contextuelle (générée depuis le type: Internet / TV / Mobile / SAV)
3. Scan équipement installé (S/N + MAC obligatoires)
4. Diagnostics intégrés (ping/débit Internet, canaux Wi-Fi, signal TV, activation SIM)
5. Configuration Wi-Fi (SSID + mot de passe) — envoyée au client par email + PDF
6. Tests validés par le client (checklist visible côté client via lien)
7. Signature électronique + photos avant/après
8. Rapport auto généré (PDF) + email statut `tech_completed`

Chaque étape verrouille la précédente. Reprise offline.

### 📦 Inventaire
Vue "mon camion" (stock physique en poche). Scan pour sortir/rentrer. Alertes seuil bas. Demande de réappro en 1 tap. Retour/bris/échange = workflows séparés, pas des filtres.

### 💬 Communication
Un seul inbox: dispatch, NOC, chat client (live chat site inclus), SMS, appels. Historique d'appels avec enregistrement (si consenti). Bouton "Escalade NOC" contextuel à une intervention.

### 🎓 Ressources
Procédures interactives (steps + vidéos), FAQ recherchable, fiches équipement (Borne Wi-Fi, Terminal TV, POD). Consultable offline.

### 📈 Performance
Objectifs jour/semaine/mois, commissions temps réel, temps moyen par type, NPS clients, classement équipe.

### ⚙ Paramètres
Profil, véhicule (plaque, capacité stock), préférences notifications, gestion offline (taille cache, sync manuelle), déconnexion.

---

## Nouvelles capacités transverses (obligatoires V1)

- Recherche universelle ⌘K (indexée: clients, RDV, équipement, procédures, actions)
- Scanner universel caméra (S/N, MAC, QR, code-barre) accessible partout
- Signature électronique avancée (pression, horodatage, geoloc, hash)
- Diagnostics Internet / Wi-Fi / TV / Mobile (RPC + tests réels côté device quand possible)
- GPS live technicien (déjà en DB, on branche le broadcast + la carte dispatch)
- Optimisation trajet auto
- Assistant IA contextuel (résumé client, suggestion diagnostic, rédaction note, réponse email)
- File offline + sync visible (badge "3 actions en attente")
- Centre de notifications unifié
- Statuts dispatch pilotant les emails automatiques (déjà en place, on rebranche)

---

## Réutilisation de la logique métier (ce qu'on garde)

Tout le backend reste. On réutilise **sans réécrire**:
- RPC: `get_available_installation_slots`, `queue_tech_status_email`, `fn_normalize_order_installation_flags`, `has_role`, etc.
- Tables: `appointments`, `technician_assignments`, `equipment_inventory`, `installations`, `work_orders`, `technician_locations`, `live_chat_sessions`, `email_queue`, etc.
- Edge Functions: `send-appointment-reminder`, `email-queue-drain`, `client-account-admin`, etc.

Nouveaux ajouts backend limités et justifiés:
- RPC `fn_optimize_route(technician_id, date)` (P3)
- RPC `fn_field_universal_search(query)` (P2)
- Table `field_offline_queue` (client-side IndexedDB en fait — pas de DB serveur)
- Table `field_checklists_template` + `field_checklist_runs` (P4)

---

## Plan d'exécution (6 phases, validées une à une)

**P1 — Fondations (aucun écran fonctionnel encore)**
- `src/field-platform/` créé, design system `field.css` (tokens HSL neufs, aucun `tc-*` réutilisé)
- FieldShell + FieldRouter + rail 10 domaines + dock mobile + route `/field`
- CommandPalette ⌘K squelette, NotificationCenter squelette, AIAssistantPanel squelette
- Suppression progressive interdite: on laisse `src/tech-app` intact, `/tech` continue de marcher

**P2 — Accueil + Ma journée + Clients**
- Mission Control réel (timeline, "Démarrer ma journée")
- Ma journée (timeline + optimisation trajet)
- Client 360 unifié + recherche universelle branchée

**P3 — Terrain + Intervention**
- Carte plein écran + GPS live + ETA partagé
- Workflow Intervention guidé complet (checklist → diag → Wi-Fi → signature → rapport)

**P4 — Inventaire + Communication**
- Camion + scanner universel + retours/bris/échanges
- Inbox unifié dispatch/NOC/chat/SMS/appels

**P5 — Ressources + Performance + Paramètres + Offline + IA**
- Procédures interactives, KPI, offline queue, assistant IA branché sur Lovable AI Gateway

**P6 — Bascule & suppression**
- `/tech/*` redirige vers `/field/*`
- Suppression de `src/tech-app/` en entier
- Nettoyage routes, tests de non-régression sur la logique métier

---

## Ce que je ne ferai PAS

- Aucun re-skin de `TechDashboard`, `TechAppointments`, `TechInstallation`, `TechStock`, `TechScanner`, `TechMenu`, `TechBottomNav`, `TechShellTopBar`, `TechAppLayout`. Ces fichiers seront **supprimés** en P6, pas modifiés.
- Aucun ajout de classe `tc-*` supplémentaire. Nouveau design system isolé.
- Aucune "carte KPI" décorative sans action derrière.

---

## Livrable de cette étape

Ce plan. **Je n'écris pas de code tant que tu ne l'as pas validé.** Dis-moi:
1. OK sur les 10 domaines et leurs frontières, ou tu veux ajuster ?
2. OK sur le namespace `/field` + suppression de `/tech` en P6 ?
3. OK pour démarrer par P1 (fondations sans écran fonctionnel) dès validation ?
