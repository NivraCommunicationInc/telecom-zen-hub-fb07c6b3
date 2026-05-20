# Plan — Écosystème Recrutement Nivra unifié

## Objectif
Construire un flux complet, sans bug, reliant :
1. **Espace candidat public** (`/carrieres`) — voir postes, créer compte candidat, postuler, suivre candidatures, passer entrevues IA
2. **Pipeline RH Core** (`/core/hr/applications`) — gérer candidatures, déclencher entrevues IA, embaucher
3. **Conversion candidat → employé** — un clic transforme un dossier candidat accepté en employé actif + invitation au portail Employé

---

## 1. Base de données (migrations)

### Nouvelles tables
- `candidate_profiles` — profil public candidat (lié à `auth.users`)
  - champs: full_name, phone, location, headline, bio, resume_url, linkedin_url, portfolio_url, years_experience, availability_date, salary_expectation
- `candidate_applications_view` — vue qui joint `job_applications` + `candidate_profiles` + `job_postings` + `ai_interviews`

### Modifications
- `job_postings` : s'assurer des colonnes `status` (draft/published/closed), `is_public`, `slug`, `published_at`, `salary_range_min/max`, `employment_type`, `location`, `department`, `description_md`, `requirements_md`, `benefits_md`
- `job_applications` : ajouter `candidate_profile_id` (FK), `source` (public/manual/referral), `current_stage` (applied/screening/interview/offer/hired/rejected), `ai_interview_id` (FK nullable), `converted_to_employee_id` (FK nullable)
- `ai_interviews` (si manquante) : application_id, status, scheduled_at, completed_at, transcript, score, recommendation

### RLS
- Candidat voit uniquement ses propres `candidate_profiles` + `job_applications`
- Postes publiés (`is_public=true AND status='published'`) lisibles par tout le monde (anon inclus)
- Staff RH (`has_role` HR/admin) accède à tout

### RPC
- `apply_to_job(job_id, cover_letter)` — crée `job_application` lié au candidat connecté
- `hire_candidate(application_id, employee_data jsonb)` — crée `employee_records` + invite portail Employé + marque application `hired`
- `publish_job_posting(id)` / `unpublish_job_posting(id)`

---

## 2. Espace candidat public

### Routes nouvelles
- `/carrieres` — liste postes publiés (SEO, filtres département/type/lieu)
- `/carrieres/:slug` — détail poste, bouton **Postuler**
- `/carrieres/auth` — inscription/connexion candidat (séparé du portail Core)
- `/carrieres/mon-espace` — dashboard candidat (candidatures en cours, statuts, entrevues IA à compléter, profil)
- `/carrieres/entrevue/:id` — interface entrevue IA (réutilise composants existants)

### Pages
- `CareersPublicPage` — landing avec hero, recherche, grille de postes
- `JobDetailPage` — description complète, bouton Postuler (auth-gated)
- `CandidateAuthPage` — signup/login email + Google
- `CandidateDashboardPage` — onglets : Mes candidatures / Mon profil / Entrevues
- `CandidateInterviewPage` — wrapper sur l'entrevue IA

---

## 3. Pipeline RH (Core) — connexions

### `/core/hr/jobs` (Postes)
- Vérifier CRUD complet, ajout bouton **Publier sur site carrières** (toggle `is_public`)
- Aperçu lien public `/carrieres/:slug`

### `/core/hr/applications` (Candidatures)
- Kanban + liste, déjà en place
- Ajouter action **Lancer entrevue IA** (crée `ai_interviews` + email candidat avec lien `/carrieres/entrevue/:id`)
- Ajouter action **Embaucher → créer dossier employé** : ouvre modal pré-remplie (nom, email, poste, département, date début, salaire), appelle `hire_candidate`, redirige vers `/core/hr/employees/:id`

### `/core/hr/interviews` (Entrevues IA)
- Liste entrevues, statut, score, recommandation
- Lien vers transcript + application source

---

## 4. Edge Functions

- `send-candidate-invite-email` — email post-application (confirmation + accès espace candidat)
- `send-interview-invite-email` — email avec lien entrevue IA
- `convert-candidate-to-employee` — orchestrateur : crée employee_record, crée auth user (si pas déjà), envoie invitation portail Employé, met à jour application

---

## 5. UI/UX (style Xfinity Premium dark)
- Espace carrières : design clean clair (palette site public Nivra Fizz-style), pas le dark Core
- Sidebar RH : section **Recrutement** déjà ajoutée, garder Postes / Applications / Entrevues IA
- Boutons cohérents, états loading/error explicites, toast confirmations
- Tous les libellés en français

## Technique
- React Query pour fetch/mutations, invalidation systématique
- Zod pour validation forms (candidature, profil, embauche)
- Pas de calculs côté front pour données business
- RLS strict, jamais d'`auth.users` exposé
- Email candidat avec template corporatif existant

## Hors scope (ne touche pas)
- Logique paiement/facturation
- Portail Field/Employee existant (sauf invitation à la fin)
- i18n custom (utiliser `t()` si déjà branché sur les pages, sinon FR direct)

Veux-tu que je commence par la migration DB + l'espace carrières public, ou tu préfères un ordre différent ?
