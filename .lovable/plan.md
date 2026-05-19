## Nivra Academy — Système de formation complet

Construction d'un système de formation type "bootcamp" pour Nivra Field (porte-à-porte) et Nivra OneView CS (téléphone), avec administration complète dans Nivra Core, simulation d'appels via IA, et certification bloquante.

---

### 1. Base de données (migration unique)

**Tables**:
- `training_modules` — modules de formation (titre, description, icône, ordre, portail cible: `field`/`oneview`/`both`, statut publié, durée estimée, prérequis)
- `training_lessons` — leçons dans un module (titre, contenu markdown riche, type: `text`/`video`/`image`/`interactive`, ordre, ressources médias, points clés résumés)
- `training_quizzes` — quiz attachés à une leçon ou à un module (titre, score minimum requis, type: `practice`/`module_final`/`certification`)
- `training_quiz_questions` — questions (énoncé, type: `mcq`/`true_false`/`multi_select`/`scenario`, options JSON, bonne réponse, explication, points)
- `training_simulations` — scénarios de simulation IA (titre, type: `phone_call`/`door_pitch`, persona client JSON: ton, humeur, objections types, critères de réussite)
- `training_user_progress` — progression par user/leçon (started_at, completed_at, time_spent)
- `training_quiz_attempts` — tentatives de quiz (score, réponses JSON, passed)
- `training_simulation_sessions` — sessions IA (transcript JSON, score IA, feedback IA)
- `training_certifications` — certifications obtenues (user_id, portal, module_id, score_final, certified_at, expires_at, certificate_number)
- `training_access_gates` — règles de blocage (portal, requires_certification: bool, allow_grace_period_days)

**RLS**:
- Agents (`field_sales`, `employee`) → voient/écrivent leur propre progression seulement
- Modules publiés → lecture pour rôles concernés
- Admin Core → CRUD complet via `has_role('admin')` ou `has_role('supervisor')`

**Fonctions RPC**:
- `training_get_user_dashboard(portal)` — modules + progression + score global pour l'agent connecté
- `training_submit_quiz_attempt(quiz_id, answers)` — calcule score, marque réussite/échec, déclenche certification si applicable
- `training_check_certification_status(user_id, portal)` — utilisé par les portails Field/OneView pour bloquer l'accès
- `training_grant_certification(user_id, portal)` — automatique quand l'examen final est réussi

### 2. Edge functions

- **`training-ai-simulate`** — chat streamé via Lovable AI Gateway (Gemini 2.5 Flash). Le modèle joue un client (fâché, hésitant, pressé, intéressé) selon le scénario. Système prompt construit à partir du persona du scénario + politiques/produits Nivra scannés.
- **`training-ai-evaluate`** — appelée à la fin d'une simulation. Reçoit le transcript, retourne JSON structuré: score 0-100, points forts, points faibles, recommandations, passed/failed.
- **`training-seed-content`** — fonction one-shot (admin only) qui scanne `contractPolicies.ts`, `useCanonicalFees`, `useNivraProducts`, FAQ et popule automatiquement le Module 2 (Produits/Frais/Politiques). Mix factuel + placeholders `[À COMPLÉTER]` pour scripts de vente.

### 3. Structure de fichiers

```text
src/shared-training/
├── hooks/
│   ├── useTrainingDashboard.ts       — modules + progression
│   ├── useTrainingLesson.ts          — leçon + navigation
│   ├── useTrainingQuiz.ts            — quiz state + submit
│   ├── useTrainingSimulation.ts      — chat IA streamé
│   └── useTrainingCertification.ts   — statut + gate
├── components/
│   ├── AcademyHeader.tsx             — logo Academy + breadcrumb + progress global
│   ├── ModuleCard.tsx                — carte module (icône, durée, % complété, badge verrouillé)
│   ├── LessonReader.tsx              — markdown + images + vidéo + résumés clés (style présentation)
│   ├── LessonNavigation.tsx          — précédent/suivant + table des matières
│   ├── QuizPlayer.tsx                — questions une par une, feedback immédiat avec explications
│   ├── QuizResultScreen.tsx          — score, breakdown, retry
│   ├── SimulationChat.tsx            — interface chat avec persona client IA
│   ├── SimulationFeedback.tsx        — rapport IA après simulation
│   ├── CertificationCard.tsx         — certificat visuel + numéro + bouton télécharger
│   ├── CertificationGate.tsx         — écran de blocage si non certifié
│   └── ProgressRing.tsx              — composant visuel progression
├── lib/
│   ├── trainingTypes.ts
│   ├── moduleIcons.ts                — mapping icônes Lucide par module
│   └── certificateRenderer.ts        — génération HTML certificat
└── content/
    └── seedModules.ts                — définitions des 6 modules de base
```

### 4. Pages portails

**Field** (`/field/academy`):
- `FieldAcademy.tsx` — dashboard 6 modules adaptés terrain (porte-à-porte focus, langage corporel, etc.)
- `FieldAcademyLesson.tsx` — lecteur leçon
- `FieldAcademyQuiz.tsx`
- `FieldAcademySimulation.tsx` — simulation porte (client ouvre porte, hésite, etc.)
- `FieldAcademyCertificate.tsx`
- Sidebar: remplacer "Formation" basique par "Nivra Academy" avec icône GraduationCap

**OneView CS** (`/employee/academy`):
- `EmployeeAcademy.tsx` — dashboard 6 modules adaptés téléphone (ton voix, structure appel, etc.)
- Mêmes sous-pages avec contenu adapté téléphone
- Simulation: appel téléphonique (pas porte)
- Sidebar: idem

**Core** (`/core/academy`):
- `CoreAcademy.tsx` — vue admin: tous les agents, scores, certifications, alertes (agents non certifiés)
- `CoreAcademyModules.tsx` — CRUD modules/leçons/quiz/questions/simulations
- `CoreAcademyAgent.tsx` — détail par agent: progression, tentatives, simulations passées, transcript IA
- `CoreAcademyAnalytics.tsx` — KPIs: % certifiés, score moyen, modules les plus échoués
- Bouton "Seed contenu initial" qui appelle `training-seed-content`
- Sidebar Core: nouvelle entrée "Nivra Academy"

### 5. Gate de certification (bloquant strict)

Dans `FieldProtectedRoute.tsx` et `EmployeeProtectedRoute.tsx`:
- Après auth, appel `training_check_certification_status(user_id, 'field'|'oneview')`
- Si non certifié et pas en grace period → redirige vers `/field/academy` ou `/employee/academy` avec banner "Vous devez compléter la formation pour accéder au portail"
- Override possible par Core (toggle dans fiche agent)
- Routes Academy elles-mêmes accessibles même non certifié (sinon impossible de se former)

### 6. Contenu initial des 6 modules

Le seeder crée automatiquement:
1. **Introduction Nivra** — histoire, mission, valeurs, modèle, évolution (texte + placeholders pour vidéos)
2. **Connaissance des services** — auto-rempli depuis `contractPolicies` + `useCanonicalFees` + `useNivraProducts`. Quiz auto-généré sur prix, vitesses, équipements.
3. **Vente porte-à-porte** (Field uniquement) — approche, intro, découverte, présentation, objections (scripts en placeholders éditables)
4. **Vente téléphone** (OneView uniquement) — structure appel, qualification, closing (scripts placeholders)
5. **Systèmes & outils** — tutoriels CRM, signature électronique, création commande. Contenu différent Field vs OneView (Field utilise `field-create-sale`, OneView utilise outils internes).
6. **Professionnalisme & discipline** — règles, interdictions, gestion conflits (commun)

Examen final par portail = 20 questions tirées des modules 2-6, score min 80%.

### 7. Sidebars

- `FieldUI.tsx` — entry "Nivra Academy" avec `GraduationCap`
- `EmployeeAppLayout.tsx` — idem
- `CoreAppLayout.tsx` — entry "Nivra Academy" dans section admin

### 8. Vérification finale

- TypeScript: pas d'erreurs
- RLS testée: agent ne voit que sa progression, admin voit tout
- Edge functions déployées et testées
- Realtime activé sur `training_user_progress` et `training_certifications` (pour le dashboard Core en temps réel)
- Gate bloquant testé en bypassant manuellement (toggle Core)
- Anciennes pages formation basiques → redirigent vers `/portal/academy`

---

### Détails techniques clés

- **Lovable AI**: `google/gemini-2.5-flash` pour simulation (rapide, conversationnel), `google/gemini-2.5-pro` pour évaluation finale (raisonnement)
- **Markdown lessons**: `react-markdown` + `remark-gfm` (déjà disponible probablement, sinon install)
- **Génération certificat**: HTML stylé + `html2canvas` pour PNG ou impression PDF navigateur
- **Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE training_certifications, training_user_progress;`
- **No fictional data**: tous les prix viennent de `operational_fees` et `nivraApi`, jamais hardcodés. Scripts de vente = `[À COMPLÉTER PAR ADMIN]`.

### Hors scope (ce loop)

- Vidéos réelles (slots vides, admin peut uploader URL YouTube/Vimeo)
- Génération PDF certificat côté serveur (impression navigateur suffit pour V1)
- Gamification poussée (badges multiples, leaderboard formation) — score simple seulement
- Multi-langue formation (FR seulement V1)
