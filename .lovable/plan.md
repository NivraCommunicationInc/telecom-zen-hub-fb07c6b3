
# Refonte Marketing Hub Nivra — Style Mailchimp

Objectif: remplacer le portail marketing actuel par une suite complète type Mailchimp (Audiences, Éditeur visuel, Campagnes, Automations, Analytics, A/B, Planification), migrer l'envoi vers **Resend** (fiable, plus d'échecs), garder Push web comme canal secondaire.

## 1. Réparer l'envoi d'abord (bloqueur)

- Connecter **Resend** via `standard_connectors--connect` (tu vas voir un écran pour lier ton compte Resend une seule fois).
- Nouvelle edge function `marketing-send` unifiée qui envoie via Resend (au lieu du queue Lovable qui échoue).
- Vérifier le domaine `notify.nivra-telecom.ca` côté Resend (ou utiliser un sous-domaine dédié `mail.nivra-telecom.ca`).
- Table `marketing_send_log` (une ligne par destinataire, avec message_id Resend, status, opens, clicks, bounces via webhook Resend).
- Webhook Resend → edge function `marketing-resend-webhook` qui met à jour statuts (delivered/opened/clicked/bounced/complained).

## 2. Nouveau modèle de données

Nouvelles tables (avec GRANT + RLS admin only):
- `mkt_audiences` — audiences nommées avec règles JSON (segments dynamiques)
- `mkt_audience_members` — lien contact/client → audience (matérialisé + rafraîchi)
- `mkt_contacts_imports` — imports CSV (fichier, mapping, tags, rowCount)
- `mkt_contacts_custom` — contacts importés hors CRM (nom, email, tel, tags[])
- `mkt_templates` — templates visuels (JSON blocks + HTML compilé + thumbnail)
- `mkt_campaigns` — campagne (email/push), status draft/scheduled/sending/sent, audience_id, template_id, A/B config, scheduled_at
- `mkt_campaign_variants` — variantes A/B (subject, template, % traffic, winner metric)
- `mkt_automations` — flows visuels (trigger + steps JSON)
- `mkt_automation_runs` — exécutions par contact avec position dans le flow
- `mkt_send_log` — log unifié (déduplication par message_id, ouvertures, clics)
- `mkt_webhooks_events` — events Resend bruts pour audit

Trigger: chaque nouveau `crm_contact`, `client`, ou membre importé recalcule automatiquement les audiences dynamiques.

## 3. Frontend — refonte complète `/marketing`

Remplacement de `src/core-app/pages/marketing/*` par une nouvelle IA style Mailchimp:

```text
/marketing
  Dashboard        → KPIs 30j (envoyés, open rate, click rate, bounces, désabo)
  Audiences        → Liste segments + builder de segments (règles + preview count)
  Contacts         → Table unifiée (CRM + clients + imports) + import CSV + tags
  Campagnes        → Liste + création wizard 4 étapes:
                       1) Type (email / push)
                       2) Audience
                       3) Template (choisir ou éditer)
                       4) Sujet + A/B + planification
                     → Preview HTML fidèle avant envoi
                     → Envoyer maintenant / Planifier / Sauver brouillon
  Templates        → Galerie + éditeur visuel drag-drop (blocs Header/Text/Image/Button/
                     Columns/Divider/Spacer/Footer)
  Automations      → Éditeur visuel de flows (Trigger → Attente → Email → Condition)
  Analytics        → Par campagne: opens/clicks/bounces/désabo + heatmap horaire
  Paramètres       → Domaine Resend, from name, reply-to, footer légal, unsubscribe
```

Composants clés à créer (src/core-app/pages/marketing/):
- `MarketingLayout.tsx` (sidebar interne + header)
- `pages/DashboardPage.tsx`
- `pages/AudiencesPage.tsx` + `AudienceBuilderDialog.tsx` (règles: ville, statut CRM, dernière activité, forfait, tags…)
- `pages/ContactsPage.tsx` + `ImportCsvDialog.tsx`
- `pages/CampaignsPage.tsx` + `campaign-wizard/*` (Step1Type, Step2Audience, Step3Template, Step4ReviewSchedule)
- `pages/TemplatesPage.tsx` + `visual-editor/` (BlockCanvas, BlockPalette, BlockSettings)
- `pages/AutomationsPage.tsx` + `flow-editor/` (nodes React Flow)
- `pages/AnalyticsPage.tsx`
- `pages/SettingsPage.tsx`

Hooks: `useAudiences`, `useContacts`, `useCampaigns`, `useTemplates`, `useAutomations`, `useAnalytics`.

## 4. Éditeur visuel (drag-drop)

- Basé sur `@dnd-kit/core` (déjà OK pour Tailwind).
- Modèle JSON: `{ blocks: [{ id, type, props, children? }] }`.
- Compilation JSON → HTML via un compiler dédié `mkt/templateCompiler.ts` qui produit du HTML compatible email (tables inline), garde le style Nivra bleu #0066CC.
- Preview desktop/mobile toggle.

## 5. Automations

- Éditeur avec `reactflow`.
- Triggers: `contact.created`, `contact.tag_added`, `client.checkout_completed`, `contact.no_activity_days`, `date.anniversary`, `campaign.opened`, `campaign.clicked`, `manual`.
- Steps: `wait`, `send_email`, `send_push`, `add_tag`, `remove_tag`, `condition_if`, `end`.
- Runner: edge function `mkt-automation-tick` en cron 5min qui avance chaque `mkt_automation_runs`.

## 6. Canaux d'envoi

- **Email**: Resend via gateway Lovable (`connector-gateway.lovable.dev/resend/emails`). From: `Nivra <marketing@notify.nivra-telecom.ca>`. Unsubscribe HMAC signé (déjà en place).
- **Push web**: table `push_subscriptions` existe déjà → nouvelle edge function `marketing-send-push` avec web-push (VAPID).
- **SMS**: hors scope (pas demandé), on garde une slot vide pour plus tard.

## 7. A/B testing + planification

- `mkt_campaign_variants` avec % de trafic + métrique gagnante (open ou click).
- Cron `mkt-abtest-decide` qui, après X heures, promeut la variante gagnante et envoie au reste.
- Planification: `scheduled_at` + cron `mkt-scheduler` qui déclenche les campaigns à l'heure dite.

## 8. Suppressions & désabonnement

- Table `mkt_unsubscribes` (déjà `email_unsubscribes` existante — on la réutilise).
- Cross-check systématique avant tout envoi.
- Bounces Resend → auto-suppression.

## 9. Nettoyage

- Désactiver définitivement `agent-crm-email-blast` (déjà fait) + supprimer route associée.
- Ne pas casser les emails transactionnels existants (factures, KYC, etc.) — ils gardent Lovable Emails, seul le marketing bascule vers Resend.

## Détails techniques
- Resend: connecteur standard Lovable, on passe par le gateway (pas de clé API à gérer côté user au-delà de la connexion).
- Domaine sender: `marketing@notify.nivra-telecom.ca` (DNS SPF/DKIM Resend à valider — je te guiderai).
- RLS: toutes les tables `mkt_*` réservées à `has_role(auth.uid(),'admin')` + `service_role`.
- Types Supabase régénérés après migration.
- Aucune modification des flows facturation/PayPal/KYC.

## Livraison en 3 vagues

**Vague 1 (cette session)**: Resend connecté, `marketing-send` opérationnel, nouvelles tables, refonte des pages Dashboard/Audiences/Contacts/Campagnes + wizard basique + envoi email réel qui fonctionne. Import CSV.

**Vague 2**: Éditeur visuel drag-drop + Templates + preview.

**Vague 3**: Automations (react-flow) + A/B + planification + Push web + Analytics avancés (heatmap).

Je te confirme la vague 1 dès que tu approuves le plan, et je t'invite à connecter ton compte Resend au moment voulu.
