# Refonte structurelle — GuestCheckout.tsx (/commander)

Fichier unique modifié : `src/pages/GuestCheckout.tsx` (2226 lignes).
**Zéro touche à la logique** : tous les `useState`, `useEffect`, handlers, appels API, validations, `submitOrder`, PayPal/Square, promo/référral restent **identiques**. Seul le JSX de rendu (lignes ~1138 → fin) est restructuré.

---

## Commit 1 — Layout 2 colonnes + accordéon progressif

### 1.1 Header checkout dédié
- Remplacer `<Header />` global par un header checkout minimal : fond blanc, `border-b`, logo Nivra à gauche (Link → `/`), à droite `🔒 Commande sécurisée` + langue. Pas de menu de navigation (le client reste focus achat).
- Style Bell : hauteur 64px, `sticky top-0 z-50`.

### 1.2 Barre de progression pleine largeur (style Bell)
- Sous le header, bande blanche `border-b` contenant une barre horizontale pleine largeur avec 5 pastilles numérotées connectées par un trait progressif bleu `#0066CC`.
- Labels sous chaque pastille : Forfait · Adresse · Informations · Options · Paiement.
- État : futur = gris, courant = bleu plein anneau, complété = vert `#00A651` avec ✓.
- Mobile : version compacte "Étape X / 5 — Label" + barre linéaire (déjà existante, on la garde).

### 1.3 Grille desktop 60/40 avec sidebar sticky
- Remplacer la grille actuelle `col-span-2 / col-span-6 / col-span-4` par `lg:grid-cols-5` → **col-gauche `lg:col-span-3`** (formulaire, ~60%) + **col-droite `lg:col-span-2`** (récap, ~40%).
- Supprimer la colonne stepper vertical gauche (redondante avec la nouvelle barre pleine largeur).
- Sidebar droite : `sticky top-[header+progress]`, `max-h-[calc(100vh-...)]`, `overflow-y-auto`.

### 1.4 Étapes en accordéon progressif (style Rogers)
- Nouveau composant local `StepShell({ id, title, isOpen, isDone, summary, onEdit, children })` inline dans le fichier.
- États :
  - **Ouverte** (id === step) : card blanche `shadow-md rounded-xl p-6`, header avec pastille numérotée bleue + titre + description.
  - **Complétée** (id < step) : card repliée `p-4` fond `#F9FAFB`, ✓ vert + résumé 1 ligne (nom+prix pour Forfait, adresse formatée, `Prénom Nom · email`, options cochées) + bouton "Modifier" texte bleu à droite qui fait `setStep(id)`.
  - **Future** (id > step) : card repliée grisée, opacity-60, non-cliquable, juste numéro + titre.
- Wrapper chaque bloc `{step === N && (…)}` existant dans un `<StepShell>`. On rend **tous les steps 1-5 en même temps** dans la colonne gauche, chacun dans son état (ouvert/complété/futur). La logique de navigation reste `setStep(step+1)`.
- Auto-scroll : dans un `useEffect([step])`, `document.getElementById(`step-${step}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`.

### 1.5 Sidebar récap (colonne droite desktop)
- Card blanche `shadow-lg rounded-2xl` :
  1. Header `bg-[#F0F6FC]` : "Votre commande"
  2. Forfait sélectionné : nom en gras + prix `/mois` gros (24px), badge vert "1er mois GRATUIT" si applicable
  3. Liste équipements requis (WiFi router, terminal TV, SIM) avec qty × prix
  4. `Separator`
  5. Sous-total, TPS, TVQ (labels gris, montants alignés droite)
  6. **Total** ligne bleue `#0066CC` gros 20px bold
  7. Promo/référral appliqués : ligne verte avec pastille
  8. Espace + petit texte "Payable aujourd'hui : X$"
- Extraire du JSX existant (déjà présent sous forme d'aside) — juste re-structurer, garder les mêmes `useMemo` de pricing.

---

## Commit 2 — Paiement + Mobile + Micro-détails

### 2.1 Section paiement pro (step 5)
- Header dédié dans le StepShell : titre `Paiement sécurisé` à gauche + `🔒` + logos cartes SVG (Visa, MC, Amex, Interac) alignés à droite.
- Encadré `bg-[#FAFBFC] border rounded-lg p-4` autour du `<SquarePaymentForm>`.
- Sous le bouton "Confirmer et payer" : ligne de réassurance centrée 3 pictos : `🔒 Chiffré SSL 256-bit` · `✓ PCI-DSS Level 1` · `↩ Remboursable 30j`.

### 2.2 Barre mobile sticky bottom
- Remplacer l'actuelle nav mobile bas par 2 zones empilées `fixed bottom-0 inset-x-0 z-40` :
  - **Bandeau récap collapsible** (fond blanc, `border-t`) : `Total : 45,99 $ — Voir le détail ▲` → click ouvre un `<Sheet>` shadcn qui affiche le contenu de la sidebar récap.
  - **Bouton d'action pleine largeur** au-dessus : "Continuer →" ou "Confirmer et payer" selon step, hauteur 56px, bleu `#0066CC`.
- Padding-bottom du form mobile augmenté pour compenser (`pb-40 lg:pb-0`).

### 2.3 Micro-détails
- Transitions accordéon : classes `transition-all duration-300 ease-out` sur ouverture/fermeture des StepShell.
- Skeleton loaders : déjà présents pour services, ajouter aussi pour `isServerPricingLoading` dans la sidebar (3 lignes skeleton à la place des chiffres).
- Erreurs de champ : ajouter `id={\`field-${name}\`}` + après `toast.error`, `document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })`.
- Formatage : `formatCanadianPhone` et `formatPostalCode` déjà utilisés — vérifier que tous les inputs `phone`/`postal` passent par eux (ils le font déjà).
- AddressAutocomplete : déjà importé, vérifier qu'il est bien branché en step 2 (il l'est).

---

## Vérifications avant chaque commit
1. `npx tsgo --noEmit` doit passer.
2. Grep : aucun handler / `useState` / `useEffect` / `submitOrder` / `handlePayment` supprimé ou renommé.
3. Playwright headless : ouvrir `/commander`, screenshot desktop 1280×1800 et mobile 390×800 → viewer les 2 pour valider visuellement.
4. `security--get_scan_results` avant publication.
5. `preview_ui--publish` après commit 2.

---

## Ce que je ne toucherai PAS
- Tous les imports de logique, hooks, edge functions.
- Signatures et handlers : `handleSubmit`, `handleNext`, `handleBack`, `applyPromoCode`, `handlePayPalApprove`, `submitOrder`, etc.
- `useEffect` de tracking, abandonment email, draft persistence.
- Validations (`validateShipping`, `validateActivation`, `validateDob`, `validateCanadianPhone`, `validateCanadianPostalCode`, `isChecklistComplete`).
- Composants externes : `CheckoutShippingAndActivation`, `SquarePaymentForm`, `InstallationSection`, `PromoCodeInput`, `ReferralCodeInput`, `ConfirmationSuccess`, `CheckoutEssentialTermsBase`, `AddressAutocomplete`.

## Après approbation
J'exécute commit 1 → typecheck → screenshot → commit 2 → typecheck → screenshot → scan sécurité → publish.

**Approuves-tu ce plan pour que je démarre le commit 1 ?**
