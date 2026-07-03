
# Plan complet — Checkout étape Installation + Nivra Core Rendez-vous

Je te présente les 3 volets ensemble pour que tu valides l'ensemble avant que j'écrive une seule ligne. Rien n'est publié tant que tu ne dis pas GO.

---

## Volet 1 — Option B : découpage Installation ↔ Rendez-vous

### Preuve de l'état actuel

- `src/pages/GuestCheckout.tsx` L84-91 : `CHECKOUT_STEPS` = 6 étapes (Forfait / Adresse / Informations / Options / Paiement / Confirmation).
- L1618-1631 : `InstallationSection` est rendu dans le shell étape 4 avec le questionnaire + calendrier fusionnés.
- `InstallationScheduler.tsx` L66-73 : state interne `cablingAnswers`, `decision`, `availableSlots`, `installationId`, `activeHold`. **Ce state ne doit jamais être démonté** sinon le hold appointment se perd.

### Implémentation

1. **Nouvelles étapes** (`CHECKOUT_STEPS`) :
   ```
   1 Forfait · 2 Adresse · 3 Informations · 4 Installation · 5 Rendez-vous · 6 Paiement · 7 Confirmation
   ```
   Étape 5 (Rendez-vous) est **masquée** dans la barre si `installationChoice === "auto"` (auto-install n'a pas de RDV).

2. **`InstallationSection` reçoit un prop `phase: "choice" | "schedule"`** :
   - `phase="choice"` → tuiles Auto / Technicien + questionnaire câblage + verdict.
   - `phase="schedule"` → calendrier + créneaux + bouton "Confirmer le rendez-vous".

3. **Montage permanent** : `InstallationSection` est rendu **une seule fois** hors de `renderStepShell`, dans un wrapper `<div style={{ display: step === 4 || step === 5 ? 'block' : 'none' }}>`. Le state interne de `InstallationScheduler` (hold, decision, slots) est donc préservé à 100 % entre les deux étapes.

4. **Le shell d'étape 4 et 5** rend un placeholder invisible (juste le titre du shell), et le `<InstallationSection>` permanent flotte dedans grâce au portail visuel. Alternative plus simple : je rends `<InstallationSection phase=…>` directement dans le shell 4 ET le shell 5 avec la **même instance React via un `key` fixe** — non, React remonte quand même. La bonne solution reste le rendu permanent hors shell + display:none.

5. **Gates de validation** :
   - Étape 4 → étape 5 : bloquée tant que `installationChoice` non choisi, et si `technician` tant que `decision` (verdict câblage) non calculée.
   - Étape 5 → étape 6 : bloquée tant que `appointmentConfirmed !== true` (sauf auto-install qui saute étape 5).

---

## Volet 2 — Correction 4A : cards partout + polish calendrier

### Preuve des dropdowns restants

- `CheckoutShippingAndActivation.tsx` L322-334 : `<Select><SelectValue placeholder="Sélectionner" /></Select>` pour **Câble coaxial disponible ?**
- L339-351 : idem pour **Statut du logement**.
- Ce sont bien les dropdowns que tu vois — pas le `CablingQuestionnaire.tsx` (qui utilise déjà des cards RadioGroup L227-244).

### Refonte

1. **`CheckoutShippingAndActivation.tsx`** — remplacer les 2 `<Select>` par des grilles de cards cliquables identiques au `CablingQuestionnaire` :
   - Coax : 3 cards `[Câble ✓ Oui] [✗ Non] [? Je ne sais pas]` avec icônes Lucide, sélection = bordure + fond `#0066CC` + texte blanc.
   - Occupancy : 2 cards `[Home Occupé] [DoorClosed Vacant]`.
   - `accessNotes` reste un `<Textarea>` (c'est du texte libre légitime).

2. **`SmartSlotPicker.tsx`** — polish calendrier :
   - Les créneaux 2×4 grid restent en cards, mais j'ajoute une **pastille "X places restantes"** systématique (pas seulement ≤ 2), en `text-[10px]` gris pour ne pas alarmer.
   - Créneau sélectionné : déjà `bg-[#0066CC] text-white` L211 ✓.
   - Ajouter un mini-header sticky "**Sélectionnez votre plage horaire**" en haut de la card quand aucun créneau sélectionné, pour lever l'ambiguïté.

3. **Verdict en temps réel** (`InstallationDecisionDisplay.tsx` existe déjà et s'affiche après le questionnaire — je le renforce avec un **badge d'impact prix** : `+ 0,00 $` en vert pour auto-install, `+ 25,00 $` en bleu pour technicien).

---

## Volet 3 — Plan 4B : /core/appointments (à valider avant que je code)

### a) Tables existantes

| Table | Rôle | Colonnes clés |
|---|---|---|
| `appointments` | RDV clients (source de vérité, PostgREST) | `id, client_id, technician_id, order_id, scheduled_at, duration_minutes, status, service_type, installation_method, service_address, service_city, service_postal_code, equipment_details jsonb, installation_fee, internal_notes, cancellation_reason, hold_expires_at` |
| `technician_slots` | **Créneaux publiés au checkout** | `id, slot_date, time_slot, capacity, booked, technician_level, region, is_active` |
| `appointment_slot_rules` | Règles récurrentes par weekday | `weekday, start_time, end_time, capacity, is_active, label` |
| `appointment_blocked_dates` | Jours fériés / blocages ponctuels | `blocked_date, reason` |
| `installations` | Historique décisions câblage | (lié au checkout, pas au calendrier admin) |
| `installation_jobs` | Bons de travail terrain | `appointment_id`, `technician_id`, `job_number`, `status` |
| `technicians` | Ressources | (dispo pour assignation) |

### b) D'où SmartSlotPicker tire ses créneaux

`InstallationScheduler.tsx` L113-127 :
```ts
portalClient.from("technician_slots")
  .select("id, slot_date, time_slot, capacity, booked")
  .eq("is_active", true)
  .eq("technician_level", targetDecision.technicianLevel)
  .gte("slot_date", fromDate).lte("slot_date", toDate)
  [.eq("region", "montreal") si zone A/B]
```
→ Donc **la source de vérité que Core doit contrôler = `technician_slots`** (ligne par (date, plage, niveau, région)). Les `appointment_slot_rules` génèrent ces slots via un cron/RPC — à confirmer et documenter dans la page admin.

### c) /core/appointments — architecture proposée

**Route** : `/core/appointments` (Nivra Core, gated par `has_role('admin')`).

**3 onglets** :

1. **Calendrier RDV** (défaut) — vue mois + vue semaine + vue jour, drag & drop pour déplacer, code couleur par statut (hold gris, confirmé bleu, en cours ambre, complété vert, no-show rouge, annulé rayé). Clic sur un RDV → drawer latéral avec :
   - Client (nom, courriel, tél cliquable)
   - Commande liée (badge cliquable → `/core/orders/:id`)
   - Actions : **Déplacer** (repicker de créneau), **Assigner technicien** (dropdown filtré par région + zone), **Marquer complété**, **Marquer no-show** (crée une note client auto + email template bleu officiel), **Annuler** (raison obligatoire, libère le slot).
   - Notes internes (`internal_notes` inline)
   - Historique (via `activity_logs` filtré `entity_type='appointment'`)

2. **Disponibilités** — contrôle ce que le checkout affiche :
   - **Règles récurrentes** (`appointment_slot_rules`) : tableau par weekday, éditable inline (start_time, end_time, capacity, actif). Bouton "Régénérer les 60 prochains jours" → RPC qui pousse dans `technician_slots`.
   - **Créneaux ponctuels** (`technician_slots`) : liste 60 jours, colonnes date / plage / capacité / réservés / actif, avec toggle actif/inactif immédiat (le checkout le voit dans la seconde suivante).
   - **Jours bloqués** (`appointment_blocked_dates`) : datepicker + raison, liste des blocages actifs, suppression 1-clic.
   - Toutes ces mutations passent par une edge function `admin-appointments-mutate` (verify_jwt=false + validation `has_role('admin')` en tête) pour audit + Realtime broadcast.

3. **Techniciens** — vue rapide (nom, zone, RDV du jour, disponibilité). Assignation depuis onglet 1 renvoie ici.

**Règle absolue** : `technician_slots` est **la seule table** lue par `SmartSlotPicker`. Toute modification Core = visible checkout dans les secondes qui suivent (Realtime `postgres_changes` sur `technician_slots`).

**Sécurité** :
- RLS : `technician_slots` lecture publique (déjà en place puisque `portalClient` y accède), écriture réservée à `has_role('admin')`.
- `appointment_slot_rules`, `appointment_blocked_dates` : lecture + écriture admin only.
- `appointments` : déjà 9 policies existantes, on ajoute uniquement une policy admin UPDATE si absente.

**Composants à créer** (structure) :
```
src/core-app/pages/CoreAppointments.tsx           (page + tabs)
src/core-app/components/appointments/
  ├── AppointmentsCalendar.tsx                    (vue calendrier)
  ├── AppointmentDrawer.tsx                       (détail + actions)
  ├── SlotRulesTable.tsx                          (règles récurrentes)
  ├── SlotsList.tsx                               (créneaux ponctuels)
  └── BlockedDatesPanel.tsx                       (jours bloqués)
src/core-app/hooks/useAdminAppointments.ts        (React Query + Realtime)
supabase/functions/admin-appointments-mutate/     (edge function CRUD)
```

**Enregistrement route** : ajout dans `src/core-app/main.tsx` + entrée sidebar Nivra Core.

---

## Ordre d'exécution que je te propose

1. **Tu valides ce plan (les 3 volets).**
2. Je code Volet 1 (split) + Volet 2 (cards + polish) — `npx tsgo --noEmit` après.
3. Tu testes en preview, tu valides visuellement.
4. Je code Volet 3 (`/core/appointments` complet) — `npx tsgo --noEmit` après.
5. Tu valides Volet 3 en preview.
6. **Alors seulement** je publie et je te colle la confirmation `preview_ui--publish`.

Dis-moi : **GO sur les 3 volets**, ou tu veux ajuster un point (routes, onglets, actions, tables) avant.
