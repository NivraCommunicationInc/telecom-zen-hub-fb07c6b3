# Nivra AI Console (Core) — Refonte complète

Un assistant IA centralisé dans Core qui prend en entrée **un client** + **un contexte**, et qui :
1. Affiche les infos clés du client (compte, services, factures, balance, KYC, tickets, RMA, rendez-vous).
2. Propose une **suggestion IA** contextuelle (résumé + actions recommandées).
3. Offre un **catalogue exhaustif d'actions** organisées en sections, chacune avec **lien direct** vers la page Core existante préchargée avec l'ID client.

## Sections d'actions (toutes liées à des pages existantes)

| Catégorie | Actions | Lien Core |
|---|---|---|
| **Compte** | Voir 360, Notes, Historique, Impersonate | `/accounts/:id`, `/clients/:id` |
| **Facturation** | Factures, Paiements, Contestées paiement, Contestées facture, Recouvrement | `/billing`, `/payments`, `/contested-payments`, `/contested-invoices`, `/recouvrement` |
| **Services** | Services actifs, Activation, Suspension, Changement forfait, Résiliation, Pause | `/services`, `/activations`, `/pause-requests`, `/plan-changes`, `/cancellations` |
| **Terrain** | Carte technicien, Dispatch, Installations, Rendez-vous, Couverture | `/installations`, `/appointments`, `/coverage` + TechnicianMapView |
| **Support** | Tickets internes, Métriques support, SLA, SOPs | `/internal-tickets`, `/support-metrics`, `/sla`, `/sops` |
| **Équipement** | Stock, Retours, RMA, Inventaire mobile | `/stock`, `/returns`, `/rma`, `/phone-inventory` |
| **Communication** | Email composer, SMS, Activité email, Marketing email | `/communication/email`, `/communication/sms`, `/email/activity` |
| **Conformité** | KYC, Contrats, Documents, PDF Templates, Audit log | `/kyc`, `/contracts`, `/documents`, `/audit-log` |
| **Commercial** | Devis, Promotions, Référents, Discounts agents | `/quotes`, `/promotions`, `/referrals`, `/agent-discounts` |
| **Sécurité** | Events sécurité, Guardian, Anti-fraude | `/security-events`, `/security-guardian` |

## UI / Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Header : 🧠 Nivra AI Console     [Client ▾ search]         │
├──────────────┬──────────────────────────────────────────────┤
│ Sidebar      │ Panel central                                │
│ Catégories   │  ┌────────────────────────────────────────┐ │
│ (10 sections)│  │ Carte client : nom, email, balance,    │ │
│              │  │ KYC, statut, services actifs           │ │
│              │  └────────────────────────────────────────┘ │
│              │  ┌────────────────────────────────────────┐ │
│              │  │ 🤖 Suggestion IA (streaming)           │ │
│              │  │ "Ce client a 2 factures en retard..."  │ │
│              │  │ [Action recommandée → lien]            │ │
│              │  └────────────────────────────────────────┘ │
│              │  ┌────────────────────────────────────────┐ │
│              │  │ Grille actions (cards) avec icône,     │ │
│              │  │ description courte, bouton "Ouvrir →"  │ │
│              │  └────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

## Composants à créer

- `src/core-app/pages/CoreAIConsolePage.tsx` — page principale
- `src/core-app/components/ai-console/ClientPicker.tsx` — combobox avec recherche `billing_customers`
- `src/core-app/components/ai-console/ClientSummaryCard.tsx` — fiche 360 condensée
- `src/core-app/components/ai-console/AISuggestionPanel.tsx` — suggestion IA streamée
- `src/core-app/components/ai-console/ActionCatalog.tsx` — grille des actions
- `src/core-app/components/ai-console/actionsRegistry.ts` — registry typé (id, label, icon, category, hrefBuilder, eligibilityCheck)

## Backend

- **Nouvelle edge function** `core-ai-suggest` — reçoit `{ customerId, intent? }`, charge un contexte minimal (balance, factures impayées, statut services, tickets ouverts, dernier paiement) et appelle `google/gemini-3-flash-preview` via Lovable AI Gateway pour générer une suggestion + 3 actions recommandées (IDs du registry).
- Pas d'écriture en base. Mode **suggérer + lien** seulement.

## Routing / Sidebar

- Route : `/core/ai-console`
- Item sidebar Core : "🧠 Nivra AI" (en haut, sous Dashboard)
- Replace l'ancien item "Entrevues IA" du HR ? **Non** — l'item Entrevues HR reste, on ajoute un nouvel item Core.

## Sécurité

- `CoreProtectedRoute` requis (déjà en place).
- Edge function : vérifier `has_role(auth.uid(), 'admin')` ou `billing_admin`.
- CORS standard Core.

## Hors scope (pas dans ce sprint)

- Exécution directe d'actions (suspendre, charger, etc.) → reste manuel dans les pages Core.
- Mémoire de conversation / threads.
- Voice input.

## Livrables

1. Migration : aucune (lecture seule).
2. Edge function `core-ai-suggest`.
3. 5 nouveaux composants React.
4. 1 nouvelle page Core.
5. Ajout route + sidebar item.
