## Phase 3.C.4 — Plan de nettoyage final

### Audit de départ (état actuel constaté)

**RPC legacy encore présentes en base** (wrappers dépréciés depuis 3.C.1) :
- `public.fn_run_subscription_renewals(p_lookahead_days int)`
- `public.fn_generate_subscription_renewal(p_subscription_id uuid)`
- `public.generate_billing_renewals()`

Références dans le code : **0** appel exécutable dans `src/` et `supabase/functions/`. Seules occurrences = `src/integrations/supabase/types.ts` (auto-généré, se régénère après DROP).

**Cron jobs PayPal actifs** :
- `jobid=101` — `billing-paypal-retry-failed` (06h daily) → cible une Edge Function déjà stubbée en 410.
- `jobid=104` — `paypal-reconcile` (04h daily) → cible une Edge Function **encore vivante** qui lit l'API PayPal.

**Edge Functions PayPal** (16 au total) :
- **Déjà stubbées 410** (10) : `paypal-capture-order`, `paypal-create-order`, `paypal-client-token`, `paypal-refund`, `paypal-charge-subscription`, `paypal-sync-subscription-state`, `paypal-balance-pay-create`, `paypal-balance-pay-capture`, `paypal-create-subscription`, `billing-create-order-with-paypal-subscription`, `billing-paypal-retry-failed`, `core-paypal-order-link`.
- **Encore vivantes** (4) : `paypal-webhook`, `paypal-cancel-subscription`, `paypal-verify-subscription`, `paypal-reconcile`.

**Appelants résiduels côté serveur** :
- `cancel-account/index.ts:281` → `fetch(paypal-cancel-subscription)` (encore live).
- `crm-create-sale/index.ts:420` → `fetch(paypal-create-order)` (déjà 410, appel mort).
- `ops-watchdog/index.ts:37` → surveille `paypal-reconcile` (à retirer).
- `nivra-diagnostic/index.ts:477` → liste les webhooks PayPal (diagnostic lecture seule).

**Références front (`rg -i paypal src/`)** : ~60 fichiers. Après inspection, la grande majorité sont :
- Constantes de statut historique (`payment_method='paypal'` en lecture pour anciens paiements)
- Types TS (`billing/types.ts` — enum contient encore `paypal` car données historiques présentes en base)
- Textes légaux, pages preview, tests legacy, docs
- Colonnes `paypal_*` historiques dans `useCanonicalClientData`, `useContractSummary`, etc. (LECTURE SEULE — audit/comptabilité)

Aucun composant actif ne **crée** un flux PayPal — le seul chemin de paiement neuf passe par Square.

---

### Actions à exécuter

#### 1. Base de données (migration SQL)
- `DROP FUNCTION public.fn_run_subscription_renewals(int);`
- `DROP FUNCTION public.fn_generate_subscription_renewal(uuid);`
- `DROP FUNCTION public.generate_billing_renewals();`
- `SELECT cron.unschedule(101);` (`billing-paypal-retry-failed`)
- `SELECT cron.unschedule(104);` (`paypal-reconcile`)

`types.ts` sera régénéré automatiquement post-migration et perdra ces trois entrées.

#### 2. Edge Functions — convertir en 410 stubs
Les 4 fonctions encore vivantes sont réécrites en stubs HTTP 410 identiques aux 10 déjà décommissionnées :
- `paypal-webhook` → 410 (aucun webhook PayPal n'est plus enregistré en prod, à confirmer côté PayPal dashboard)
- `paypal-cancel-subscription` → 410
- `paypal-verify-subscription` → 410
- `paypal-reconcile` → 410

#### 3. Suppression des appelants exécutables
- `cancel-account/index.ts` : retirer le bloc fetch `paypal-cancel-subscription` (les abonnements PayPal actifs n'existent plus ; annulation côté DB seulement).
- `crm-create-sale/index.ts` : retirer le fetch `paypal-create-order` mort.
- `ops-watchdog/index.ts` : retirer l'entrée de surveillance `paypal-reconcile`.

#### 4. Renommage neutre — **différé**
Vous aviez précisé « à intégrer au fur et à mesure de la migration, je ne veux pas de big-bang ». Le renommage massif (`paypalCaptureId → providerCaptureId`, `paypalOrderId → providerOrderId`, etc.) touche 60+ fichiers front, plusieurs colonnes DB, et casserait potentiellement des PDF/emails historiques.

**Proposition** : garder ce renommage pour une phase 3.C.4-bis dédiée, avec adaptateurs de compatibilité, ou l'intégrer opportunément lors des prochaines modifications de chaque fichier concerné.

À trancher : `[a]` faire le renommage maintenant en un big-bang contrôlé, `[b]` le différer comme prévu à l'origine.

#### 5. Ce qui reste intact (par design — historique/audit)
- Table `billing_payments` avec `provider='paypal'`
- Colonnes `paypal_*` sur `billing_subscriptions`, `orders`, `contracts`, etc.
- Table `paypal_autopay_attempts`, `paypal_plan_cache`
- Enum `BillingPaymentMethod` contient toujours `'paypal'`
- PDF/reçus/journaux d'audit historiques
- Tests legacy (`paypal-error-serialization.test.ts`, `system-lock-invariants.test.ts` sections PayPal) qui valident encore l'immutabilité des anciens paiements
- Pages légales, `CookieConsent`, `RefundPolicy` — mentions historiques
- `types.ts` conservera toujours l'enum `paypal` puisque des lignes existent en base

#### 6. Audit infrastructure externe (rapport uniquement)
Je n'ai pas d'accès direct aux dashboards Vercel / Cloudflare / GitHub / PayPal. Le rapport listera ce qu'il faut vérifier manuellement :
- Secrets Supabase : `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_BN_CODE` (à supprimer)
- Variable Vite : `VITE_PAYPAL_CLIENT_ID` dans `.env` (à supprimer — plus consommée par du code actif)
- Webhook PayPal dashboard : à désactiver (l'endpoint devient 410)
- GitHub Secrets / CI : rechercher `PAYPAL_*`
- Vercel / Cloudflare : idem

### Livrables finaux
- 1 migration SQL (DROP RPC + unschedule cron)
- 4 fichiers Edge Functions convertis en stubs 410
- 3 fichiers TS nettoyés (appelants morts)
- `docs/PHASE_3C4_AUDIT.md` — rapport complet avec checklist infra manuelle

### Confirmation demandée
- Point 4 : renommage `paypal*Id → provider*Id` — **maintenant** ou **différé** ?
- Point 5 : je confirme bien qu'on **ne touche pas** aux données historiques ni aux colonnes `paypal_*` ?
