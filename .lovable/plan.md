## CRM Outbound Call Center — Nivra

Système complet de cold calling pour les 659 prospects, accessible depuis 3 portails avec verrouillage temps réel, vente intégrée et leaderboard.

---

### 1. Renommage Employee → OneView CS

- Renommer toutes les références UI "Employee/Employé" → "Nivra OneView CS"
- Conserver les routes `/employee/*` et les noms de fichiers (pour éviter régression massive)
- Mettre à jour : sidebar, layout header, page titles, breadcrumbs, sélecteur de portail dans Hub Secure, boutons "Changer de portail"

### 2. Base de données (migration)

**Étendre `crm_contacts`** :
- `date_of_birth` (date)
- `desired_install_date` (date)
- `service_address`, `service_city`, `service_postal_code` (text)
- `locked_by` (uuid → auth.users), `locked_at` (timestamptz), `locked_until` (timestamptz)
- `assigned_to` (uuid, nullable — rotation)
- `next_callback_at` (timestamptz)
- Index sur `locked_until`, `next_callback_at`, `call_status`

**Nouvelle table `crm_call_logs`** :
- `id`, `contact_id` (fk crm_contacts), `agent_id`, `agent_name`
- `started_at`, `ended_at`, `duration_seconds`
- `outcome` enum : `sold | voicemail | callback | not_interested | wrong_number | no_answer`
- `notes` (text), `callback_at` (timestamptz nullable)
- RLS : agents (field_sales, employee, sales) voient leurs propres logs ; admin voit tout

**Nouvelle table `crm_agent_stats`** (vue matérialisée ou table calculée) :
- Calculs : appels du jour, conversions, ventes, montant total
- Ou simplement vue SQL `crm_leaderboard_v` agrégeant `crm_call_logs`

**Fonctions RPC** :
- `crm_lock_contact(contact_id)` → vérifie pas déjà locké, lock 30 min, retourne succès/erreur
- `crm_unlock_contact(contact_id)` → unlock manuel
- `crm_auto_unlock_expired()` → cron job toutes les 5 min
- `crm_log_call(contact_id, outcome, notes, callback_at)` → insère log + met à jour `crm_contacts.call_status`, `last_called_at`, `call_attempts`, `next_callback_at` ; auto-archive si attempts >= 3 ; unlock

**Cron jobs** :
- Auto-unlock toutes les 5 min (locks expirés)
- Reset des "no_answer" en file après 2h
- Activation realtime : `ALTER PUBLICATION supabase_realtime ADD TABLE crm_call_logs;`

### 3. Composants partagés CRM

Dossier `src/shared-crm/` (utilisable par Core, OneView CS, Field) :
- `useCrmContacts.ts` — hook liste + realtime + filtres
- `useCrmLock.ts` — hook lock/unlock + heartbeat
- `useCrmLeaderboard.ts` — hook stats temps réel
- `CrmContactList.tsx` — tableau filtrable/triable + badge "🔴 En appel par X"
- `CrmContactDetail.tsx` — fiche complète + historique appels
- `CrmCallPanel.tsx` — panneau d'appel actif (timer, notes, boutons outcome)
- `CrmOutcomeDialog.tsx` — sélection résultat post-appel
- `CrmLeaderboard.tsx` — top agents jour/semaine/mois
- `CrmSaleForm.tsx` — formulaire de vente (réutilise flow Field : forfaits, équipement, PayPal)

Règle métier dans `useCrmLock` : block call si hors 9h-20h heure Québec.

### 4. Portails

**Nivra Field** (`/field/crm`) :
- Remplacer la page actuelle `FieldCrm.tsx` par version complète utilisant `shared-crm`
- Sidebar : entrée "CRM Prospects" déjà existante ✅

**Nivra OneView CS** (`/employee/crm`) :
- Nouvelle page `EmployeeCrm.tsx`
- Ajouter entrée "CRM Prospects" dans `EmployeeSidebar.tsx`
- Route dans `AppRoutes.tsx`

**Nivra Core** (`/core/crm`) :
- Nouvelle page `CoreCrm.tsx` — vue admin : tous contacts, filtres avancés, assignation manuelle, export CSV, stats globales par agent
- Ajouter entrée "CRM Center" dans `CoreAppLayout.tsx` sidebar (section Sales/Outbound)
- Route dans `AppRoutes.tsx`

### 5. Vente intégrée

- Bouton "🟢 Vendu" → ouvre `CrmSaleForm` en dialog/page
- Pré-rempli avec données contact (nom, tél, email, adresse, DOB)
- Étapes : forfait → équipement → date install (2-3j après) → plage horaire → récap → PayPal
- Sur succès :
  - Créer commande via RPC existant (réutilise `field-create-sale` edge function)
  - Marquer `crm_contacts.call_status = 'sold'`, lier `converted_order_id`
  - Insérer commission pour l'agent (30% forfait, 5% équipement) — même logique que Field
  - Email notification à Core via `send-transactional-email`

### 6. Commissions OneView CS

- Mettre à jour la fonction/table commissions pour inclure les agents `employee` au même taux que `field_sales`
- Vérifier `commission_rules` ou logique dans edge function de création de vente

### 7. Vérifications finales

- `npx tsc --noEmit` → EXIT=0
- Vérifier realtime sur `crm_contacts` et `crm_call_logs`
- Tester lock/unlock multi-onglets

---

### Détails techniques

```text
shared-crm/
├── hooks/
│   ├── useCrmContacts.ts      (list + realtime + filters)
│   ├── useCrmContact.ts       (single contact + call history)
│   ├── useCrmLock.ts          (lock/unlock + 30min heartbeat)
│   ├── useCrmLeaderboard.ts   (agent stats realtime)
│   └── useCrmBusinessHours.ts (9h-20h QC check)
├── components/
│   ├── CrmContactTable.tsx
│   ├── CrmContactDrawer.tsx
│   ├── CrmCallPanel.tsx       (active call UI + timer)
│   ├── CrmOutcomeButtons.tsx
│   ├── CrmCallHistory.tsx
│   ├── CrmLeaderboard.tsx
│   └── sale/
│       ├── CrmSaleDialog.tsx
│       └── CrmSaleSteps.tsx   (reuses Field steps)
└── lib/
    ├── crmTypes.ts
    └── crmOutcomes.ts
```

Edge function ré-utilisée : `field-create-sale` (ou créer `crm-create-sale` similaire).

### Hors scope (ne sera PAS fait dans ce loop)

- Intégration téléphonie réelle (Twilio/OpenPhone dial) — on garde les `tel:` deep links existants
- Système de points/badges gamification avancée — leaderboard simple seulement
- Rotation automatique d'assignation — manuelle depuis Core
