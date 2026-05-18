# Refonte visuelle complète + i18n FR/EN total

## Périmètre

**Visuel** (niveau Fizz/Vidéotron/Koodo) — uniquement les pages publiques :
- `/` (Home), `/internet`, `/mobile`, `/tv`, `/comparer`
- `/a-propos`, `/contact`, `/faq`, `/couverture`
- Tunnel `/commander` + page confirmation
- Pages légales (footer)
- **NON touché** : `/hub`, `/core`, `/rh`, `/field`, `/employee` (portails internes restent identiques)

**Langues** : Français + Anglais, 100% des deux côtés (UI, DB, emails).

---

## Phase 1 — Fondations visuelles (design system)

Avant de toucher les pages, je consolide les tokens existants pour garder la cohérence Xfinity Premium / Fizz déjà en place :

1. **Audit `index.css` + `tailwind.config.ts`** — vérifier que tous les tokens sémantiques sont là (`--primary`, `--background`, `--accent`, gradients, shadows, radii).
2. **Composants partagés à upgrader** : Header public, Footer public, `PlanCard`, `ServiceCard`, `HeroSection`, `CTASection`, `TestimonialCard`, `ComparisonTable`. Aucun nouveau contenu — seulement le polish (spacing, hover states, micro-animations, typographie fluide, bordures, ombres premium).
3. **Règles strictes** : 0 nouvelle donnée inventée. Aucun nouveau forfait, prix, témoignage, partenaire, stat. Tout le contenu reste celui de la DB / des fichiers de copie actuels.

## Phase 2 — Refonte page par page

Pour chaque page : améliorer hiérarchie visuelle, espacement, hover states, transitions, responsive 320–1920px, anti-overflow (`overflow-x: hidden`, `min-w-0`, `truncate` où nécessaire). Aucun ajout de contenu.

Ordre : Home → Internet → Mobile → TV → Comparer → Couverture → À propos → Contact → FAQ → Commander → Légales.

Tests à chaque page :
- Screenshot 1920 / 1366 / 947 (viewport actuel) / 414 / 375
- Vérifier qu'aucun texte ne sort, ne se casse, ne se chevauche
- Vérifier que tous les CTA restent fonctionnels (pas de changement de routing)

## Phase 3 — i18n total FR/EN

### 3a. Audit fichiers de traduction
- Scanner `src/contexts/LanguageContext.tsx` + tous les fichiers `t('...')` pour lister les clés manquantes en EN.
- Compléter le dictionnaire FR/EN pour 100% des chaînes UI publiques (menus, boutons, labels, messages d'erreur, footer, légal).

### 3b. Traduction DB (services / forfaits)
- Migration : ajouter colonnes `name_en`, `description_en` (si elles n'existent pas déjà) sur `services` et autres tables de contenu public (plans, FAQ, témoignages, features).
- **Auto-traduction via Lovable AI** (Gemini 3 Flash) : script qui lit les valeurs FR, génère EN, écrit dans les colonnes `_en`. Tu valides/édites ensuite via Core si besoin.
- Front : `useLanguage()` choisit `name_en` vs `name` selon la langue active. Fallback FR si EN manquant.

### 3c. Détection / persistance langue
- Garder le `LanguageContext` existant + persister dans `localStorage`.
- Toggle FR/EN bien visible dans le header public.

## Phase 4 — Emails dans la langue active

1. **Captation** : au moment d'une commande / signup / contact, on lit la langue active du `LanguageContext` et on la passe en paramètre à toutes les edge functions qui envoient un email (`recipient_language: 'fr' | 'en'`).
2. **Templates** : duplication des templates existants dans `supabase/functions/_shared/emailTemplates/` avec variante `_en` (ou injection conditionnelle par bloc). Sujet, header, corps, footer, CTA, signature — tout traduit.
3. **Edge functions concernées** (à scanner et patcher) : confirmations de commande, factures, reçus, contrats, welcome, password reset, contact form ack, notifications de statut.
4. **Fallback** : si langue absente → FR par défaut (marché principal QC).

## Détails techniques

- Pas de nouvelle librairie i18n — on reste sur le `LanguageContext` custom (memory rule).
- Tokens HSL uniquement, jamais de couleurs hardcodées dans les composants.
- Migrations DB via tool migration ; data updates via tool insert.
- Auto-traduction : script ponctuel via `code--exec` + Lovable AI Gateway (`google/gemini-3-flash-preview`), pas une edge function permanente.
- Aucune modification de logique business / pricing / RLS / portails internes.
- Aucun ajout de contenu non approuvé — si une chaîne EN n'existe pas et que l'auto-traduction échoue, je laisse `[À COMPLÉTER EN]` et te le signale.

## Livraison itérative

Vu l'ampleur, je livre par lots et tu valides entre chaque :

1. **Lot 1** : Fondations + Home + Internet (visuel) — tu valides le style.
2. **Lot 2** : Mobile + TV + Comparer + Couverture (visuel).
3. **Lot 3** : À propos + Contact + FAQ + Commander + Légales (visuel).
4. **Lot 4** : i18n UI complet (toutes clés FR/EN).
5. **Lot 5** : Auto-traduction DB + branchement front.
6. **Lot 6** : Emails bilingues.

Si tu veux, je peux aussi tout enchaîner sans pause — dis-moi.

## Ce que je ne fais PAS

- Aucun changement de prix, de plan, de partenaire, de témoignage, de stat.
- Aucun nouveau contenu marketing.
- Aucune modif des portails `/hub`, `/core`, `/rh`, `/field`, `/employee`.
- Aucune modif de la logique de paiement / facturation / KYC.
- Aucune nouvelle 3e langue (ES/AR) — strictement FR + EN comme demandé.
