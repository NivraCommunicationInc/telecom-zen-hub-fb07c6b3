# Plan — Portail /tech reconstruit, tranche verticale INTERVENTION

## Règle de livraison
Une tranche verticale à la fois, fonctionnelle de bout en bout. Zéro placeholder. `/tech` bascule dès la première livraison sur le nouveau portail. L'ancien code `src/tech-app/` est déprécié (dossier renommé `_deprecated_tech_app/`, retiré du router). Aucun écran de l'ancien portail ne reste accessible.

## Périmètre de CE tour — Intervention + shell minimal

Ne pas confondre "shell minimal" avec "placeholders". Le shell (topbar + rail + dock) est nécessaire pour ouvrir l'application. Les autres domaines (Journée, Terrain, Clients, Inventaire, Comms, Ressources, Perf, Paramètres) restent explicitement marqués **"En cours de construction — livraison dans les prochaines tranches"** avec date d'engagement. Pas de faux dashboards.

### Livraison fonctionnelle 100% — Intervention

Workflow guidé plein écran, 12 étapes verrouillées séquentiellement. Persisté en base. Reprise si fermeture app.

```
1. Arrivée (geofence + photo façade)
   ↓ écrit intervention_events(step='arrival', gps, photo_url)
2. Checklist dynamique (branchée sur type : Internet / TV / Mobile / SAV)
   ↓ chaque item coché = row intervention_checklist_items
3. Scan équipement (S/N + MAC en saisie manuelle + scan barcode via BarcodeDetector web API)
   ↓ intervention_equipment(serial, mac, kind)
4. Tests Internet (ping, download, upload via speedtest embarqué)
   ↓ intervention_tests(kind='internet', payload jsonb)
5. Tests Wi-Fi (canaux, RSSI si dispo, sinon saisie manuelle)
6. Tests TV (signal, canaux reçus)
7. Activation (RPC fn_activate_service_for_intervention → écrit services + subscription)
8. Configuration Wi-Fi (SSID + password → intervention_wifi_config)
9. Validation client (case à cocher + nom)
10. Photos avant/après (upload storage intervention-media)
11. Signature électronique (canvas → base64 → storage)
12. Clôture (RPC fn_close_intervention → status=completed, déclenche PDF + email tech_completed)
```

Chaque étape :
- **verrouille visuellement** les suivantes (opacity + pointer-events)
- **verrouille les précédentes** une fois validées (édition impossible)
- écrit son état en DB immédiatement (pas de "brouillon local")
- affiche progression x/12 en persistant
- reprend au bon step après refresh (lecture DB au mount)

## Livrables techniques exacts

### Base de données (1 migration)
Tables nouvelles (public + GRANT + RLS + policies) :
- `intervention_sessions` — session unique par assignment (id, technician_id, assignment_id, order_id, service_kind, current_step, status, started_at, completed_at)
- `intervention_events` — journal append-only de chaque étape (session_id, step, payload jsonb, gps_lat, gps_lng, actor)
- `intervention_checklist_items` — items dynamiques (session_id, code, label, required, checked, checked_at)
- `intervention_equipment` — S/N + MAC scannés (session_id, kind, serial, mac, verified)
- `intervention_tests` — résultats tests (session_id, kind, payload jsonb, passed)
- `intervention_wifi_config` — SSID + password chiffrés (session_id, ssid, password_encrypted, band)
- `intervention_media` — pointeurs storage (session_id, kind: facade/before/after/signature, path)

RPC nouvelles :
- `fn_start_intervention(assignment_id uuid)` → crée session, valide geofence
- `fn_advance_step(session_id uuid, from_step text, to_step text, payload jsonb)` → transition atomique verrouillée
- `fn_activate_service_for_intervention(session_id uuid)` → active service canonique
- `fn_close_intervention(session_id uuid)` → clôt + déclenche email + PDF

Bucket storage : `intervention-media` (privé, RLS par technician_id).

### Edge Functions
- `intervention-generate-pdf` — génère rapport signé + upload storage
- Réutilise `queue_tech_status_email` existant pour `tech_completed`

### Frontend `src/tech/` (nouveau namespace, pas field-platform)
- `TechShell.tsx` — topbar + rail desktop + dock mobile, réel, distinctif
- `useInterventionSession.ts` — hook central : lecture DB, transitions, realtime
- `pages/InterventionRunner.tsx` — orchestrateur plein écran
- `intervention/steps/` — 12 composants d'étape, un par fichier
- `intervention/StepRail.tsx` — progression verticale gauche
- `intervention/BarcodeScanner.tsx` — scanner caméra via `BarcodeDetector` API (fallback saisie)
- `intervention/SignaturePad.tsx` — canvas signature
- `intervention/SpeedTest.tsx` — mesure débit navigateur réelle
- Autres domaines : composant unique `DomainInConstruction.tsx` honnête (pas de faux KPI)

### Router
- `/tech/*` remonté sur `TechShell` (nouveau)
- `/tech` → redirect vers dernière intervention active OU liste courte du jour
- `/tech/intervention/:sessionId` → runner plein écran
- Ancien `src/tech-app/` retiré du router (fichiers renommés en `_deprecated_`)

## Preuves fournies à la fin
1. Liste exacte : fichiers créés / renommés / supprimés
2. Migration SQL complète collée
3. RPC signatures + body
4. Capture d'écran de chaque étape 1→12 via Playwright headless
5. Test end-to-end : démarrage → chaque étape → clôture → vérification DB (session status=completed, PDF présent, email en queue)
6. Ce qui **ne** marche pas encore et sera livré au prochain tour (nommé explicitement)

## Ce qui **N'EST PAS** dans ce tour (et sera livré ensuite, dans cet ordre)
- Tour 2 : Client 360 unifié (une page scrollable réelle, actions inline)
- Tour 3 : Mission Control + Ma journée (timeline + drag&drop + optimisation trajet)
- Tour 4 : Terrain (carte Mapbox live multi-techs)
- Tour 5 : Inventaire (scan + mouvements + RMA)
- Tour 6 : Communication unifiée (inbox dispatch/NOC/chat/SMS)
- Tour 7 : Ressources (procédures + offline)
- Tour 8 : Performance + Paramètres
- Tour 9 : Command Palette globale, Assistant IA contextuel, Offline queue transverse

Le shell affichera clairement l'état de chaque domaine ("En cours" / "Planifié tour N") pour que tu voies la progression réelle et ne confondes pas avec des placeholders décoratifs.

## Confirmation demandée
- Le renommage de `src/tech-app/` en `_deprecated_tech_app/` te convient ? (garde le code au cas où)
- Le workflow 12 étapes ci-dessus correspond à ce que tu veux, ou tu veux ajouter/retirer/réordonner des étapes avant que je commence ?
