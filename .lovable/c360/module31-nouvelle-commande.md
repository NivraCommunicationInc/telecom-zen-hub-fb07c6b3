# Module 31 — Nouvelle commande — Audit statique

Méthodologie identique aux Modules 21–30. Aucune correction appliquée.
Portée : bouton **« Nouvelle commande »** exposé dans Client 360, Dashboard,
OrdersPage, ClientsPage, ClientFullHistory, CorePhoneOrdersPage, ainsi que
la route Core `/pos` (= `CoreManualOrderPage` → `FieldNewSale`).

---

## 1. Cartographie du flux

### Points d'entrée UI
| Emplacement | Fichier | Cible |
|---|---|---|
| Client 360 → « Nouvelle commande » | `src/core-app/components/account-actions/OrderActions.tsx:52` | `navigate(corePath("/pos"))` |
| Quick actions Client 360 | `src/core-app/components/account-360/Account360QuickActions.tsx` | `/pos?client=…&adresse=…` |
| Sidebar / Dashboard / ClientsPage / OrdersPage / ClientFullHistory | `DashboardPage.tsx`, `ClientsPage.tsx`, `OrdersPage.tsx`, `ClientFullHistory.tsx` | `/pos` |
| CorePhoneOrdersPage | `CorePhoneOrdersPage.tsx` | route dédiée mobile |

### Route
`CoreManualOrderPage.tsx` = shell qui réutilise `FieldNewSale` avec
`allowCoreAdjustments=true` et `exitRedirect=corePath("/orders")`.

### Chaîne fonctionnelle (5 étapes agent)
```
FieldNewSale.tsx
  ├─ Step 1 Client       → checkServiceability (RPC), duplicates, prefill accounts/service_addresses
  ├─ Step 2 Forfaits     → useEquipmentCatalog / useServiceCatalog
  ├─ Step 3 Rabais       → agent_discount_assignments, computeDiscountBreakdown (frontend)
  ├─ Step 4 Récap        → LiveSummary (tous les totaux calculés côté frontend)
  └─ Step 5 Paiement     → 3 branches :
        a) StepPaymentPaypal (nom historique, en réalité Square link)
              → fieldQuoteService.saveQuoteAndEmail
                    → INSERT direct field_quotes (frontend)
                    → invoke field-payment-link-create
                          → INSERT field_payment_intents
                          → INSERT email_queue (field_payment_link)
        b) Carte saisie sur place
              → invoke field-card-intent            (crypt + card_payment_intents)
              → INSERT direct field_commissions     (frontend)
              → INSERT direct email_queue           (order_confirmation, x3 retries)
              → INSERT direct field_sales_orders    (frontend)
              → invoke field-sales-sync (sync_single)
                    → generate_order_number RPC
                    → INSERT orders
                    → UPDATE field_sales_orders.converted_order_id
                    → writePaymentAutoNote / computeTaxes shared
              → UPDATE direct orders.coaxial_survey
              → linkOrderToServiceAddress(saleId)   (UPDATE orders directement)
        c) Réutilisation intent existant / résumé de reprise
              → UPDATE direct field_payment_intents
              → UPDATE direct orders (status=cancelled|on_hold)
              → INSERT direct email_queue (cancel / hold / confirmation)
```

### Tables touchées (writes)
Frontend direct : `field_quotes`, `field_sales_orders`, `orders`,
`field_commissions`, `email_queue`, `field_payment_intents`,
`field_submissions`, `billing_invoices` (read seulement),
`accounts` / `profiles` / `service_addresses` (read).
Edge canoniques : `field-sales-sync` écrit `orders`, `order_items` (via
`orchestrate_order`), `provisioning_jobs`, `shipments`, `client_activity_logs`,
`activity_logs`, `field_order_sync_events`, `sales_commissions`.

### Edge Functions / RPC impliquées
- `field-payment-link-create`
- `field-card-intent`
- `field-sales-sync` (`sync_single`, `force_sync_all`, `get_stats`)
- `field-order-engine` (dashboard/leads/notifs, pas l'insertion nouvelle commande depuis /pos)
- `field-pricing-quote` (JAMAIS appelé depuis /pos — les prix sont calculés côté frontend)
- `pos-square-intent` (payment link générique — non utilisé par /pos actuel)
- `send-order-confirmation`, `order-shipping-notify`, `order-status-notifications`
- RPC : `generate_order_number`, `orchestrate_order`, `compute_checkout_pricing` (non utilisé dans ce flux), `compute_invoice_breakdown`

### Emails
- `field_payment_link` (Square link, envoyé par edge)
- `order_confirmation` (INSERT frontend direct)
- Emails de reprise : hold / cancel / send-again (INSERT frontend direct)
- Emails post-sync : générés par `field-sales-sync` / `send-order-confirmation`

### Audit
- `field_order_sync_events` (edge)
- `field_order_events` (edge)
- `client_activity_logs` (edge)
- `activity_logs` — **écrit uniquement au moment de l'annulation**
  (`OrderActions.tsx:82` — INSERT direct frontend)
- `admin_audit_log` — **jamais écrit** par ce flux
- `client_internal_notes` — non utilisé (seul `field_sales_orders.internal_notes` est écrit)

---

## 2. Vérifications architecture

| Contrôle | État | Détail |
|---|---|---|
| Aucune écriture directe frontend | ❌ | `field_quotes`, `field_sales_orders`, `orders`, `email_queue`, `field_commissions`, `field_payment_intents` sont tous écrits en direct depuis `FieldNewSale.tsx` |
| Edge Function canonique unique | ❌ | 3 edge distinctes + writes directs; aucun `order-new-actions` unifié comme dans les M28–30 |
| Source de vérité unique | ❌ | Prix calculés dans `FieldNewSale.tsx` (TPS/TVQ constantes frontend), reproduits dans `field_quotes.total` puis re-calculés dans `field-sales-sync` — dérive possible |
| Sync facturation | ⚠️ | `field-sales-sync` crée l'ordre; les factures sont créées plus tard par un autre pipeline (pas garanti idempotent au niveau /pos) |
| Sync services | ⚠️ | `orchestrate_order` déclenché après sync — pas au moment de la création de la commande /pos |
| Sync commandes | ⚠️ | `field_sales_orders.converted_order_id` sert de pont; risque d'orphelins si sync échoue (message toast mais aucun retry serveur) |
| Sync inventaire | ❌ | Aucune décrémentation `inventory_stock` / `equipment_inventory` au moment de la création |
| Sync provisioning | ⚠️ | Dépendant de `orchestrate_order` post-sync — pas de garantie transactionnelle |
| Sync portail client | ❌ | `customer_portal_snapshots` / projections non déclenchés explicitement |

---

## 3. Sécurité

| Contrôle | État | Détail |
|---|---|---|
| Ownership `client_user_id` / `account_id` / `order_id` | ❌ | `linkOrderToServiceAddress` fait un UPDATE direct sur `orders` par id, sans revalider que l'`account_id` appartient bien au client sélectionné dans le tunnel staff |
| RBAC par action | ❌ | Aucune vérif de rôle : n'importe quel `authenticated` avec accès à `field_sales_orders` peut insérer une commande "Core". `allowCoreAdjustments` n'est qu'un flag UI |
| Cross-client | ❌ | `prefillAccountId` + `prefillAddressId` viennent des query params; aucune validation serveur qu'ils sont cohérents entre eux ni qu'ils appartiennent au même client |
| Validation paramètres | ⚠️ | Validation front (checkServiceability, dob, phone) mais aucune revalidation dans `field-sales-sync` (fait confiance au payload) |
| Validation catalogue | ❌ | `draft.services` et `draft.equipment` sont envoyés tels quels; les prix `monthlyPrice` / `price` viennent du frontend et sont persistés sans vérif contre `services` / `mobile_addons_catalog` / `equipment_inventory` |
| Validation prix | ❌ | `subtotal`, `tps`, `tvq`, `total` sont calculés côté frontend (constantes `TPS_RATE=0.05`, `TVQ_RATE=0.09975`) et écrits directement dans `field_quotes` / `field_sales_orders` |
| Validation taxes | ❌ | Aucun appel à `compute_checkout_pricing` sur ce chemin — même si le RPC autoritaire existe (`src/lib/pricing/serverPricing.ts`) |
| Validation adresses | ⚠️ | `checkServiceability` valide la couverture, mais l'adresse n'est pas normalisée côté serveur avant insertion dans `field_sales_orders.customer_address` |
| Validation équipements | ❌ | Aucun contrôle des règles `product_equipment_rules` / max routers / slots — reposent sur l'UI |

---

## 4. Standardisation vs Modules 28–30

| Standard M28–M30 | Module 31 |
|---|---|
| Ownership serveur `assertOwnership()` | ❌ Absent |
| RBAC `ALLOWED_ROLES` par action | ❌ Absent (uniquement JWT valid) |
| Idempotency serveur | ⚠️ Partielle — `field-payment-link-create` réutilise un intent pending; `field-sales-sync` recherche `converted_order_id`. Rien pour le chemin carte |
| Anti-flood | ❌ Aucun (agent peut spammer INSERT `field_sales_orders`) |
| `metadata.simulated` | ❌ Non supporté |
| `actor_role` propagé | ❌ Non transmis |
| Codes d'erreur normalisés | ❌ Retour texte libre (`toast.error(err.message)`) |
| Motifs obligatoires (min N chars) | ❌ Absent sur annulation/hold depuis ce flux |
| Machine à états | ⚠️ `field_sales_orders.sync_status` (pending/synced/error) + `orders.status` non verrouillés serveur |
| Replay sécurisé | ❌ Pas de clé d'idempotence côté client; un double-clic peut créer deux `field_sales_orders` |

---

## 5. Traçabilité

| Journal | Écrit ? | Par qui |
|---|---|---|
| `admin_audit_log` | ❌ | Aucun accès |
| `client_activity_logs` | ⚠️ | Uniquement via `field-sales-sync` (dépend du succès) |
| `client_internal_notes` | ❌ | Non alimenté (seul `field_sales_orders.internal_notes` texte libre) |
| `email_queue` | ✅ | Multiple INSERT directs (order_confirmation, cancel, hold, resend) — non tracé |
| `billing_system_alerts` | ❌ | Aucun soulèvement en cas de désync facturation |
| `activity_logs` | ⚠️ | Écrit **uniquement** à l'annulation (frontend direct, `OrderActions.tsx:82`), pas à la création |
| `field_order_sync_events` | ✅ | Edge `field-sales-sync` |
| `field_order_events` | ✅ | Edge |
| `sync_audit_log` | ❌ | Non utilisé pour ce flux |

---

## 6. Intégrations

| Intégration | État |
|---|---|
| Commandes (`orders`, `order_items`) | ⚠️ Via `field-sales-sync` + `orchestrate_order` (post-hoc, pas atomique) |
| Facturation (`billing_invoices`, `billing_subscriptions`) | ⚠️ Non déclenchée au moment de la création — pipeline séparé |
| Inventaire (`equipment_inventory`, `inventory_stock`) | ❌ Zéro décrémentation |
| Provisioning (`provisioning_jobs`) | ⚠️ Créés par `orchestrate_order` seulement si sync réussit |
| Expédition (`shipments`) | ⚠️ Idem provisioning; pas de `shipping-register-tracker` déclenché |
| Paiements | ⚠️ `field-card-intent` (carte encrypt) + `field-payment-link-create` (Square link). Chemin carte crée `field_commissions` avant paiement réel — commission "pending" attribuée sur intent non capturé |
| Square uniquement | ✅ Chemin Square respecté; aucun appel PayPal détecté dans FieldNewSale |
| PayPal résiduel | ⚠️ Composant `StepPaymentPaypal` porte le nom historique mais utilise Square; renommage recommandé pour éviter confusion |

---

## 7. Findings & Recommandations

### P1 — Bloquants sécurité / intégrité
| ID | Finding | Recommandation |
|---|---|---|
| **F31-1** | Écritures directes frontend sur `orders`, `field_sales_orders`, `field_quotes`, `field_commissions`, `email_queue`, `field_payment_intents` | Centraliser dans une **Edge Function canonique `new-order-actions`** (create_quote / confirm_card / send_link / cancel / hold / resend) — même pattern que `internet-account-actions` (M28), `tv-account-actions` (M29), `mobile-account-actions` (M30) |
| **F31-2** | Prix, TPS, TVQ, discount calculés côté frontend et persistés tels quels dans `field_quotes.total` / `field_sales_orders.total_amount` | Rendre `compute_checkout_pricing` obligatoire côté edge; recomputer serveur avant tout INSERT — refuser si `abs(client_total - server_total) > 0.01` |
| **F31-3** | Aucune validation catalogue serveur (services, équipements, add-ons) | Résoudre `product_id` → `services` / `mobile_addons_catalog` / `equipment_inventory` côté edge avant écriture |
| **F31-4** | Aucun `assertOwnership()` sur `prefillAccountId` / `prefillAddressId` — cross-client possible via query params | Vérifier serveur que le staff a le droit d'agir sur cet `account_id` et que `service_address_id` appartient bien à `account_id` |
| **F31-5** | RBAC absent : tout `authenticated` peut créer un `field_sales_orders` "Core-tunnel" et déclencher un `orders` | Introduire `ALLOWED_ROLES = ['core_admin','core_ops','field_agent']` dans l'edge, différencier `field_agent` (ses propres ventes) vs `core_*` (n'importe quel compte) |
| **F31-6** | `field_commissions` créé AVANT capture réelle (chemin carte) — pas de retour arrière si carte refusée | Ne créer la commission qu'après paiement confirmé (`square-webhook` → status=paid) |
| **F31-7** | Aucune idempotency key — double-clic ⇒ deux commandes | Ajouter `Idempotency-Key` header côté client + table `edge_idempotency_keys` côté edge |

### P2 — Standardisation Client 360
| ID | Finding | Recommandation |
|---|---|---|
| **F31-8** | Pas d'anti-flood par agent | Table `rate_limit_attempts` : max 3 nouvelles commandes / 60s / agent |
| **F31-9** | Aucun `metadata.simulated=true` supporté | Ajouter drapeau QA pour runners E2E — comme M28–M30 |
| **F31-10** | Codes d'erreur texte libre | Normaliser (`E_OWNERSHIP`, `E_CATALOG`, `E_PRICE_MISMATCH`, `E_RATE_LIMIT`…) |
| **F31-11** | Motifs absents pour annulation / hold depuis `FieldNewSale` | Motif min 10 chars + `metadata.reason_code` |
| **F31-12** | Machine à états `field_sales_orders.sync_status` non verrouillée serveur (peut passer synced→pending côté client) | Trigger + edge-only transitions |
| **F31-13** | `email_queue` INSERT directs (order_confirmation, cancel, hold, resend) | Router via `email-send` edge canonique |

### P3 — Traçabilité & sync
| ID | Finding | Recommandation |
|---|---|---|
| **F31-14** | `admin_audit_log` jamais écrit pour créations de commandes | Ajouter entrée `entity_type='order'`, `action='order_created'` avec `actor_role` |
| **F31-15** | `client_internal_notes` non alimenté (seul `field_sales_orders.internal_notes` texte libre) | Migrer les notes internes vers `client_internal_notes` (structuré) |
| **F31-16** | `billing_system_alerts` non levée si `orchestrate_order` échoue | Alerte serveur automatique + retry cron |
| **F31-17** | Aucune décrémentation `equipment_inventory` / `inventory_stock` à la création | Réserver (status=`reserved`) au moment de l'insertion, libérer sur cancel |
| **F31-18** | `shipping-register-tracker` non appelé au moment "marquer expédié" pour ces commandes | Vérifier l'intégration (déjà branchée pour M-shipping mais confirmer que /pos y passe) |
| **F31-19** | `customer_portal_snapshots` / projection non déclenchés | Appeler la projection après création |

### P4 — Cosmétique / dette technique
| ID | Finding | Recommandation |
|---|---|---|
| **F31-20** | `StepPaymentPaypal.tsx` mal nommé (utilise Square) | Renommer `StepPaymentSquare.tsx` (mémoire projet : PayPal decommissioned 3.B) |
| **F31-21** | Constantes `TPS_RATE`/`TVQ_RATE` dupliquées dans `FieldNewSale.tsx` (ligne 36-37) | Utiliser `serverTaxEngine` / RPC |
| **F31-22** | `field-pricing-quote` existe mais n'est pas utilisé par `/pos` | Soit brancher, soit déprécier |
| **F31-23** | Draft persisté en `localStorage` (`field_sale_draft_<userId>`) contient PII (DOB, adresse) | Chiffrer ou expirer après N min |
| **F31-24** | `pos-square-intent` et `field-payment-link-create` sont redondants sur le chemin /pos | Fusionner |
| **F31-25** | `SUB-{intentId.slice(0,8)}` comme numéro de commande "temporaire" côté carte — divergent de `generate_order_number` | Toujours passer par `generate_order_number` avant d'afficher un numéro au client |

---

## 8. Comparaison synthétique avec Modules 28–30

| Critère | M28 Internet | M29 TV | M30 Mobile | **M31 Nouv. cmd** |
|---|---|---|---|---|
| Edge canonique unique | ✅ | ✅ | ✅ | ❌ (3 edges + writes directs) |
| Ownership serveur | ✅ | ✅ | ✅ | ❌ |
| RBAC ALLOWED_ROLES | ✅ | ✅ | ✅ | ❌ |
| Anti-flood | ✅ | ✅ | ✅ | ❌ |
| Idempotency | ✅ | ✅ | ✅ | ⚠️ partielle |
| Catalogue serveur | ✅ | ✅ | ✅ | ❌ |
| `metadata.simulated` | ✅ | ✅ | ✅ | ❌ |
| Prix serveur autoritaire | ✅ | ✅ | ✅ | ❌ |
| QA runner dédié | ✅ | ✅ | ✅ | ❌ |

**Verdict** : Module 31 est le module Client 360 le plus en retard sur la
standardisation. 25 findings dont 7 P1 bloquants. Correction majeure requise
avant toute campagne E2E.

---

## Prochaines étapes proposées (en attente feu vert)

1. **Lot A** — F31-1 à F31-7 (P1) : créer `new-order-actions` edge, migrer les
   writes, brancher `compute_checkout_pricing`, ajouter ownership+RBAC+idempotency.
2. **Lot B** — F31-8 à F31-13 (P2) : anti-flood, simulated, motifs, machine
   à états, routing emails.
3. **Lot C** — F31-14 à F31-19 (P3) : audit logs, inventaire, provisioning,
   projection portail.
4. **Lot D** — F31-20 à F31-25 (P4) : cosmétique + renommage.
5. **Runner `qa-module31-runner`** en fin de Lot A pour E2E ≥ 40 checks.

**Aucune correction n'a été appliquée. En attente de ton feu vert.**
