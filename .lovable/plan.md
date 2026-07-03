## Audit — Ce qui reste "ancien design" dans le checkout

### 1. Composants enfants qui n'ont PAS été refondus (rendent l'ancien style au milieu du flow)
Ces composants sont montés à l'intérieur de `GuestCheckout.tsx` mais utilisent encore `Card`/`CardHeader` shadcn avec `bg-card`, `text-muted-foreground`, `border-border`, icônes cyan/violet — d'où la sensation de "changer d'application".

| # | Composant | Étape utilisateur | Ancien style détecté |
|---|-----------|-------------------|----------------------|
| A | `CheckoutServiceAddress.tsx` | Adresse de service | `bg-card`, `text-muted-foreground`, icône cyan |
| B | `InstallationSection.tsx` | Installation (auto/technicien) | Card shadcn, texte muted, icônes vertes hors palette |
| C | `CheckoutShippingAndActivation.tsx` | Livraison + date d'activation | Card shadcn, ancien layout |
| D | `GuestIdentityVerification.tsx` / `GuestKycCard.tsx` | Vérification identité | Card shadcn, badges rouges shadcn |
| E | `PinSetupSection.tsx` | Création NIP client | Card shadcn, style ancien |
| F | `TVChannelSelection.tsx` + `StreamingServiceSelection.tsx` + `StreamingPlusSelector.tsx` | Sélection chaînes TV / streaming | Grid avec bordures grises, texte muted, checkboxes shadcn brutes |
| G | `ReferralCodeInput.tsx` / `PromoCodeInput.tsx` | Code promo / parrainage | Inputs shadcn nus, boutons violet primary |
| H | `AutoPayPalOption.tsx` | Opt-in facturation auto | Card émeraude, style ancien |
| I | `CheckoutEssentialTerms.tsx` | Consentements légaux | Checkboxes shadcn, texte muted-foreground |

### 2. Blocs JSX résiduels dans `GuestCheckout.tsx` (lignes)
- **L. 1944-1956** — bloc "Notes (optionnel)" : `<Card>` nu sans header bleu, incohérent
- **L. 1849-1871** — banner port-in "carrier détecté" : `Card bg-emerald-500/10`
- **L. 1876-1891** — banner promo "premier mois gratuit" : `Card bg-emerald-50`
- **L. 1392, 1412, 1461, 1476, 1486, 1495, 1506, 1543, 1547, 1552, 1556, 1566, 1574, 1632, 1642, 1666, 1702, 1727, 1740, 1766, 1775, 1799, 1830, 1839, 1856, 1864** — occurrences résiduelles de `text-muted-foreground`, `border-border`, `bg-primary/5`, `border-primary` qui doivent basculer sur la palette Nivra (`text-[#6B7280]`, `border-[#E5E7EB]`, `bg-[#0066CC]/5`, `border-[#0066CC]`)

### 3. Bug fonctionnel — frais d'auto-installation
Fichier `src/pages/GuestCheckout.tsx` L. 449 :
```ts
const deliveryFee = isStreamingOnlyOrder ? 0 
  : (installationChoice === "auto" ? (canonicalFees.deliverySelfInstall || 20) : 0);
```
Source canonique `src/hooks/useCanonicalFees.ts` L. 49 : `delivery_self_install: 30` (fallback), et migration SQL de fallback à 20 $.
**Correction demandée** : auto-installation = **0,00 $** partout (checkout + résumé + confirmation + `ClientNewOrder.tsx`).

### 4. Bug fonctionnel — adresse redemandée
`InternetPlans.tsx` (et `TVPlans.tsx`, `MobilePlans.tsx`) valident l'adresse via `AddressAutocomplete` puis appellent `navigate('/commander?plan=...')` **sans transmettre l'adresse**. Résultat : le checkout redemande tout.

---

## Plan d'exécution (un seul commit)

### Commit — refonte uniforme + fixes

**Fix 1 — Pré-remplissage adresse (avant checkout → checkout)**
- Dans `InternetPlans.tsx` / `TVPlans.tsx` / `MobilePlans.tsx` : au clic sur "Commander", écrire dans `sessionStorage` sous la clé `nivra_prechecked_address` un objet `{ line1, apartment, city, region, postalCode }` construit depuis `addressDetails`.
- Dans `GuestCheckout.tsx` `useEffect` initial : si `nivra_prechecked_address` existe ET que le draft checkout n'a pas encore d'adresse, hydrater `addressStreet / addressCity / addressProvince / addressPostalCode` puis retirer la clé.
- Champs restent modifiables (aucune UI verrouillée).

**Fix 2 — Auto-installation 0 $**
- `src/pages/GuestCheckout.tsx` L. 449 → `deliveryFee = isStreamingOnlyOrder ? 0 : 0` quand `installationChoice === "auto"` (retire fallback 20 $).
- `src/pages/client/ClientNewOrder.tsx` L. 1962 et L. 3282 → même traitement.
- `src/hooks/useCanonicalFees.ts` L. 49 → fallback `delivery_self_install: 0`.
- Migration SQL : `UPDATE public.operational_fees SET amount = 0 WHERE fee_key = 'delivery_self_install'`.
- Résumé de commande : conditionner l'affichage de la ligne "Livraison" pour ne plus l'afficher quand elle vaut 0.

**Fix 3 — Uniformisation visuelle**
Créer un composant partagé `<CheckoutCard title icon>` (calqué sur `CheckoutSection` déjà refait) : carte blanche `rounded-2xl shadow-sm border border-[#E5E7EB]`, header `bg-[#F0F6FC]` avec pastille bleue `#0066CC/10` + icône `#0066CC`, corps `p-5 sm:p-6 space-y-4`.

Puis refondre :
- **A. CheckoutServiceAddress.tsx** — remplace `Card` par `CheckoutCard`, icônes/labels au style Nivra, inputs shadcn conservés (déjà bien) mais wrapper cohérent.
- **B. InstallationSection.tsx** — deux cartes-choix radio (`auto` / `technician`) en tuiles `border-2` sélectionnables, prix affiché `Gratuit` / `25 $`, checklist bleue.
- **C. CheckoutShippingAndActivation.tsx** — un `CheckoutCard` unifié "Livraison & activation", date-picker Nivra.
- **D. GuestIdentityVerification.tsx / GuestKycCard.tsx** — même shell, upload styled comme le reste.
- **E. PinSetupSection.tsx** — `CheckoutCard` bleu avec 4 cases NIP grandes (48×48).
- **F. TVChannelSelection.tsx / StreamingServiceSelection.tsx / StreamingPlusSelector.tsx** — tuiles blanches `rounded-xl` hover `border-[#0066CC]`, prix en bleu.
- **G. ReferralCodeInput.tsx / PromoCodeInput.tsx** — input + bouton `bg-[#0066CC]`, message succès `bg-[#00A651]/10`.
- **H. AutoPayPalOption.tsx** — `CheckoutCard` avec toggle switch bleu.
- **I. CheckoutEssentialTerms.tsx** — checkboxes `border-[#0066CC]`, texte `text-[#1A1A2E]`, liens `#0066CC underline`.

**Fix 4 — Résidus dans GuestCheckout.tsx**
- Bloc Notes (1944-1956) : bascule en `CheckoutCard`.
- Banners port-in / promo : re-skin bleu Nivra (fond `#F0F6FC`, texte `#1A1A2E`, icône check `#00A651`).
- Mass-replace des `text-muted-foreground` → `text-[#6B7280]`, `border-border` → `border-[#E5E7EB]`, `border-primary` → `border-[#0066CC]`, `bg-primary/5` → `bg-[#0066CC]/5` **uniquement dans `GuestCheckout.tsx` et les 9 composants ci-dessus** (aucun autre fichier touché).

### Validation
- `npx tsgo --noEmit`
- Playwright : capture desktop 1280×1800 + mobile 390×800 sur `/commander?plan=<id>` pour vérifier que **toutes** les étapes ont le même langage visuel.
- Aucun changement à la logique (handlers, RPC, validations, state).

### Livraison
Après validation, publication via `preview_ui--publish` sur la prod.
