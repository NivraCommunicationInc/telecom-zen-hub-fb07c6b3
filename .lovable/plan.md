
## Périmètre — visuel uniquement

Aucune modification de logique, validation, appels API (PayPal/Square), noms de composants ou props. Uniquement classes Tailwind, structure JSX présentationnelle, tokens de couleur.

## Fichiers composant le checkout public

Point d'entrée : `src/pages/GuestCheckout.tsx` (2222 l.) — orchestrateur des étapes.

Composants dans `src/components/checkout/` :

**Structure & progression**
- `CheckoutLayout.tsx` — shell 2 colonnes + drawer mobile
- `CheckoutProgress.tsx` — barre d'étapes (actuellement violet/dark)
- `CheckoutSection.tsx` — wrapper card de section
- `CheckoutFormField.tsx` — input + label
- `CheckoutPhoneField.tsx`

**Étapes du flow (ordre actuel dans `GuestCheckout.tsx`)**
1. Coordonnées (nom, email, téléphone) — `CheckoutFormField`, `CheckoutPhoneField`
2. Renseignements / KYC — `GuestIdentityVerification`, `GuestKycCard`, `QRVerificationStep`
3. Forfait & options — `CheckoutServiceAddress`, `CheckoutAddressStep`, `InstallationSection`, `CheckoutShippingAndActivation`, `TVChannelSelectionBase`, `StreamingServiceSelection`, `StreamingPlusSelector`, `PromoCodeInput`, `ReferralCodeInput`, `FirstMonthFreeExplanation`, `PinSetupSectionBase`
4. Paiement — `CheckoutPaymentSection`, `AutoPayPalOption`, `SecurityTrustBox`, `CheckoutEssentialTermsBase`
5. Confirmation — `ConfirmationSuccess`, `ProfessionalConfirmation`
- Sidebar : `OrderSummaryCard`, `ProfessionalOrderSummary`

## Changements prévus par fichier (visuel seulement)

| Fichier | Changement |
|---|---|
| `CheckoutLayout.tsx` | Fond page `#F5F7FA` (au lieu de blanc), titre "Caisse" en `text-slate-900` avec sous-titre trust-signals bandeau (Sans contrat / Sans crédit / Activation rapide / Support QC). Drawer mobile : header bleu #0066CC. |
| `CheckoutProgress.tsx` | Repalette : violet → bleu Nivra `#0066CC`. Étape active = cercle bleu plein + ring bleu clair. Complétée = vert `#00A651` + ✓. Future = gris `#E5E7EB` outline. Ligne connectrice bleu/vert. Labels sous cercles en 12-13px semibold. Mobile : chips bleu/vert/gris (fini le dark). |
| `CheckoutSection.tsx` | Card blanche `rounded-xl shadow-sm border-slate-200 p-6`, titre avec icône colorée (18-20px semibold bleu), séparateur subtil. |
| `CheckoutFormField.tsx` | Label 14px medium au-dessus, `*` rouge si requis, input `border-slate-200 rounded-lg focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15`, helper 12px `text-slate-500`, ✓ vert / ✗ rouge inline. |
| `CheckoutPhoneField.tsx` | Même look que `CheckoutFormField`. |
| `CheckoutPaymentSection.tsx` | Badge SSL en haut à gauche, logos Visa/MC/Amex en haut à droite (SVG lucide/inline). Card Square dédiée. Bouton "Confirmer et payer X$" full-width `bg-[#0066CC] hover:bg-[#0052A3]` + icône 🔒. Mention "Paiement chiffré 256-bit SSL — Square PCI-DSS Level 1" dessous. Interac en secondaire (outline discret). |
| `SecurityTrustBox.tsx` | Ré-alignement palette bleu/vert, badges "Satisfait ou remboursé 30j", "SSL", "PCI-DSS". |
| `OrderSummaryCard.tsx` + `ProfessionalOrderSummary.tsx` | Card blanche shadow-sm, titre bleu, lignes forfait/équipement, rabais en vert avec "− $" et libellé "économie", TPS et TVQ séparées, Total en 20-22px bold bleu. Badge "1er mois GRATUIT" pill vert si applicable. |
| `ConfirmationSuccess.tsx` + `ProfessionalConfirmation.tsx` | Grande ✓ verte animée (`animate-scale-in`), titre "Commande confirmée !", n° commande dans encart bleu clair, liste "Prochaines étapes" avec puces vertes, bouton primaire "Accéder à mon portail client". |
| `CheckoutEssentialTermsBase.tsx` | Checkbox alignées, labels 14px, liens en `text-[#0066CC] underline`. |
| `GuestKycCard.tsx`, `GuestIdentityVerification.tsx`, `QRVerificationStep.tsx` | Réappliquer cards + palette bleu/vert, boutons primaires bleu Nivra. Zéro changement de logique de vérif. |
| `InstallationSection.tsx`, `CheckoutShippingAndActivation.tsx`, `CheckoutAddressStep.tsx`, `CheckoutServiceAddress.tsx` | Repalette + inputs unifiés + titres avec icône. |
| `TVChannelSelectionBase.tsx`, `StreamingServiceSelection.tsx`, `StreamingPlusSelector.tsx` | Cards de sélection avec état actif en ring bleu Nivra, prix en bleu bold. |
| `PromoCodeInput.tsx`, `ReferralCodeInput.tsx`, `FirstMonthFreeExplanation.tsx` | Input + bouton "Appliquer" bleu, message succès vert #00A651. |
| `PinSetupSectionBase.tsx` | Inputs OTP bleu au focus. |
| `AutoPayPalOption.tsx` | Card avec logo PayPal, radio bleu Nivra. |
| `GuestCheckout.tsx` | **Aucune touche à la logique**. Ajouts uniquement : bandeau trust-signals sous le header, wrapping des blocs existants dans `CheckoutSection` si pas déjà, harmonisation du fond `bg-[#F5F7FA]`. |

## Palette (tokens Tailwind arbitrary values, cohérents avec `#0066CC` déjà en mémoire projet)

- Primaire `#0066CC` / hover `#0052A3`
- Succès `#00A651`
- Fond page `#F5F7FA` / Card `#FFFFFF`
- Texte `#1A1A2E` / secondaire `#6B7280`
- Bordure `#E5E7EB`

## Vérification post-changements

- `npx tsgo --noEmit` (typecheck)
- Test visuel via Playwright sur `/commander` (desktop + mobile 440px) : screenshots des 5 étapes
- Publier après validation utilisateur des changements

## Ce qui NE bougera PAS

- Aucun handler, useEffect, appel `supabase.functions.invoke`, calcul de prix, schéma Zod, props publiques
- Aucun champ ni option retiré
- Aucun nom de composant ni export renommé
- Pas de CSS custom hors Tailwind

Attends ton approbation avant de commencer.
