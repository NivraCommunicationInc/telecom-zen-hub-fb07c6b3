# RAPPORT D'IMPACT PORTAIL — DONNÉES MANQUANTES → BUGS OBSERVÉS
**Date :** 2026-06-15  
**Nouveau projet :** `lacxnbjvcyvhrttprkxr`  
**Basé sur :** CSV (439 tables) vs nouveau projet (356 tables) + analyse FK

---

## RÉSUMÉ EXÉCUTIF

| Symptôme signalé | Cause primaire | Tables affectées | Données récupérables |
|---|---|---|---|
| Portail client cassé | Tables vides, tables manquantes | support_tickets, loyalty_*, service_addresses | ✅ OUI — dans CSV |
| Comptes clients invisibles dans Nivra Core | profiles partiels, client_internal_notes absent | profiles (95 manquants), client_internal_notes | ✅ OUI — dans CSV |
| Services actifs introuvables | billing_subscription_services = 0 | billing_subscription_services, service_addresses | ✅ OUI — dans CSV |
| Menus vides | training_modules, marketing_campaigns, hub_posts partiels | Multiples tables | ✅ OUI — dans CSV |
| Pages incomplètes | Données historiques absentes | orders, quotes, support_tickets | ✅ OUI — dans CSV |

---

## 1. PORTAIL CLIENT CASSÉ

### 1.1 Onglet Tickets (`/portal/tickets`)

**Symptôme :** L'historique des tickets est vide pour tous les clients.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Écart |
|---|---|---|---|
| `support_tickets` | 14 264 | **104** | **-14 160 (99.3% perdu)** |
| `ticket_replies` | 33 873 | **242** | **-33 631 (99.3% perdu)** |

**Cause :** Les 14 264 tickets de l'ancien projet ont **ne pas été migrés**. Seulement 104 tickets existent (créés depuis le 2026-06-02). Les 14 160 tickets d'assistance historiques sont inaccessibles.  
**Impact :** Un client qui avait des tickets ouverts dans l'ancien système ne peut pas les voir. Les agents ne peuvent pas voir l'historique des demandes.  
**Récupération :** `support_tickets.csv` (14 264 lignes) + `ticket_replies.csv` (33 873 lignes) disponibles dans l'export.

---

### 1.2 Onglet Fidélité (`/portal/loyalty`)

**Symptôme :** Le solde de points est 0 pour tous les clients.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Écart |
|---|---|---|---|
| `loyalty_points` | 3 | **0** | **-3 (100% perdu)** |
| `loyalty_transactions` | 4 | **0** | **-4 (100% perdu)** |
| `loyalty_rewards` | 5 | 4 | -1 (partial) |
| `loyalty_redemptions` | 1 | **ABSENT** | Table manquante |

**Cause :** `loyalty_points` et `loyalty_transactions` sont deux tables créées vides dans le nouveau projet mais jamais alimentées. Les 3 soldes de points et 4 transactions de l'ancien système ne sont pas visibles.  
**Impact :** Le programme de fidélité apparaît à zéro pour tous les clients même s'ils avaient des points.  
**Récupération :** `loyalty_points.csv` (3 lignes) + `loyalty_transactions.csv` (4 lignes) disponibles.

---

### 1.3 Onglet Adresses de service (`/portal/services`)

**Symptôme :** Les adresses de service des clients n'apparaissent pas.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Écart |
|---|---|---|---|
| `service_addresses` | **17** | **0** | **-17 (100% perdu)** |
| `billing_subscription_services` | **17** | **0** | **-17 (100% perdu)** |

**Cause :** `service_addresses` est une table qui **existe dans le CSV mais n'a pas été créée dans le nouveau projet**. `billing_subscription_services` existe comme table vide. Aucune adresse de service n'est liée aux abonnements actifs.  
**Impact :** Les clients ne voient pas l'adresse d'installation de leur service.  
**Récupération :** `service_addresses.csv` (17 lignes) dans l'export. La table doit être recréée.

---

### 1.4 Onglet Documents (`/portal/documents`)

**Symptôme :** Les documents générés antérieurement ne sont plus visibles.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Écart |
|---|---|---|---|
| `client_auto_documents` | 54 | 54 | ✅ 0 |
| `client_documents` | 7 | 7 | ✅ 0 |
| `pending_document_jobs` | 55 | 58 | ✅ 0 |

**Cause :** Les tables de documents **sont complètes**. Si les documents ne s'affichent pas, c'est probablement un problème de Storage (les fichiers PDF dans Supabase Storage ne sont pas migrés) ou un problème de politiques RLS.  
**Note :** Les fichiers dans le bucket `client-documents` de l'ancien projet ne sont pas dans les CSV — ce sont des fichiers binaires. Le storage n'est **pas récupérable** via l'export CSV.

---

### 1.5 Onglet Commandes (`/portal/orders`)

**Symptôme :** Les commandes passées n'apparaissent pas ou sont incomplètes.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Écart |
|---|---|---|---|
| `orders` | **56** | **15** | **-41 (73% perdu)** |
| `order_items` | 4 | 4 | ✅ 0 |
| `order_status_history` | 35 | 35 | ✅ 0 |
| `quotes` | **195** | **18** | **-177 (91% perdu)** |

**Cause :** 41 commandes (73%) et 177 soumissions de prix (91%) ne sont pas dans le nouveau projet.  
**Impact :** Les clients voient une liste de commandes incomplète. L'historique de commandes depuis des années est manquant.  
**Récupération :** `orders.csv` (56 lignes) + `quotes.csv` (195 lignes) disponibles.

---

## 2. COMPTES CLIENTS INVISIBLES DANS NIVRA CORE

### 2.1 Liste des clients incomplète

**Symptôme :** Des clients existants n'apparaissent pas dans la liste Nivra Core.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Écart |
|---|---|---|---|
| `profiles` | **800** | **705** | **-95 (12% manquant)** |
| `accounts` | 15 | 17 | ✅ 0 (nouveau > ancien) |
| `user_roles` | 688 | 708 | ✅ 0 (nouveau > ancien) |

**Cause :** 95 profils de l'ancien projet ne sont pas dans le nouveau. Ces profils correspondent probablement à des clients qui se sont créé un compte avant la migration mais dont les données auth.users n'ont pas été transférées.  
**Impact :** Ces 95 clients ne peuvent pas se connecter au portail et ne sont pas visibles dans Nivra Core.  
**Récupération :** `profiles.csv` (800 lignes) disponible — mais les entrées `auth.users` correspondantes (gérées par Supabase Auth) ne sont **pas dans les CSV** et ne peuvent pas être récupérées via l'export CSV.

---

### 2.2 Notes internes clients absentes

**Symptôme :** Quand on ouvre la fiche d'un client dans Nivra Core, l'onglet "Notes internes" plante ou est vide.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Statut |
|---|---|---|---|
| `client_internal_notes` | **353** | **ABSENT** | Table n'existe pas dans nouveau projet |

**Cause :** La table `client_internal_notes` n'a **jamais été créée** dans le nouveau projet. Toute requête vers cette table retourne une erreur PostgreSQL `relation "client_internal_notes" does not exist`. Les 353 notes internes (historique agents) sont inaccessibles.  
**Impact :** Les agents ne voient pas les notes laissées sur les clients. Crash possible des composants React qui tentent de charger cette table.  
**Récupération :** `client_internal_notes.csv` (353 lignes) disponible. La table doit être recréée (schéma connu).

---

### 2.3 Historique des tickets clients vide

Voir section 1.1 — Le même problème affecte la vue ticket dans Nivra Core.

---

## 3. SERVICES ACTIFS INTROUVABLES

### 3.1 Détail des services d'abonnement

**Symptôme :** Dans Nivra Core ou le portail, les services inclus dans un abonnement ne s'affichent pas.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Écart |
|---|---|---|---|
| `billing_subscription_services` | **17** | **0** | **-17 (100% perdu)** |
| `billing_subscriptions` | 10 | 11 | ✅ 0 |
| `service_instances` | 12 | 12 | ✅ 0 |

**Cause :** `billing_subscription_services` est une table qui lie les abonnements aux services spécifiques inclus (ex: "Abonnement #123 inclut Internet 50 Mbps"). Cette table est vide dans le nouveau projet alors que l'ancien en avait 17 entrées.  
**Impact :** Les agents ne peuvent pas voir quels services sont inclus dans un abonnement. Le portail client affiche des abonnements sans détail de service.  
**Récupération :** `billing_subscription_services.csv` (17 lignes) disponible.

---

### 3.2 Frais et modalités de service

**Symptôme :** Les frais d'installation, de connexion et opérationnels ne s'appliquent pas correctement.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Statut |
|---|---|---|---|
| `operational_fees` | **11** | **ABSENT** | Table manquante |
| `stripe_plan_mapping` | **32** | **ABSENT** | Table manquante |

**Cause :** `operational_fees` (11 frais configurés) et `stripe_plan_mapping` (32 correspondances Stripe→service) sont absents du nouveau projet.  
**Impact :** Le système de billing ne peut pas appliquer les frais corrects. Stripe ne peut pas trouver le `price_id` pour facturer les clients automatiquement.  
**Récupération :** Les deux CSV sont disponibles. Les tables doivent être recréées.

---

## 4. MENUS VIDES

### 4.1 Hub Interne — Formation

**Symptôme :** La section Formation du Hub interne est quasi-vide.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | % récupéré |
|---|---|---|---|
| `training_modules` | **1 104** | **10** | **0.9%** |
| `training_lessons` | **1 756** | **10** | **0.6%** |
| `training_questions` | 100 | 100 | ✅ 100% |
| `training_simulations` | 3 | 3 | ✅ 100% |

**Cause :** 1094 modules et 1746 leçons de formation sont absents. Seulement 10 modules et 10 leçons ont été créés (manuellement?) dans le nouveau projet.  
**Impact :** Les employés ne voient pratiquement aucun contenu de formation. Les certifications et examens ne peuvent pas fonctionner sans les leçons.  
**Récupération :** `training_modules.csv` (1104 lignes) + `training_lessons.csv` (1756 lignes) disponibles. Import **massif** requis.

---

### 4.2 Marketing — Campagnes

**Symptôme :** La liste des campagnes marketing est quasi-vide.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | % récupéré |
|---|---|---|---|
| `marketing_campaigns` | **270** | **12** | **4%** |
| `campaign_sends` | 45 | 45 | ✅ 100% |
| `sms_campaigns` | 18 | 14 | 78% |

**Cause :** 258 campagnes marketing (96%) sont absentes.  
**Impact :** Les agents marketing ne voient qu'une fraction des campagnes historiques. Les rapports d'efficacité marketing sont incomplets.  
**Récupération :** `marketing_campaigns.csv` (270 lignes) disponible.

---

### 4.3 Hub Interne — Posts / Actualités

**Symptôme :** Le fil d'actualités du hub interne est presque vide.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | % récupéré |
|---|---|---|---|
| `hub_posts` | **47** | **5** | **11%** |
| `hub_announcements` | 1 | 1 | ✅ 100% |
| `hub_calendar_events` | 1 | 1 | ✅ 100% |

**Cause :** 42 posts du hub (89%) sont manquants.  
**Récupération :** `hub_posts.csv` (47 lignes) disponible.

---

### 4.4 CRM / Offres d'emploi

**Symptôme :** La liste des postes ouverts est quasi-vide.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | % récupéré |
|---|---|---|---|
| `jobs` | **77** | **2** | **3%** |
| `job_email_templates` | **22** | **4** | **18%** |
| `job_applicants` | 24 | 24 | ✅ 100% |

**Cause :** 75 offres d'emploi (97%) et 18 templates d'email RH (82%) sont absents.  
**Récupération :** `jobs.csv` (77 lignes) + `job_email_templates.csv` (22 lignes) disponibles.

---

## 5. PAGES INCOMPLÈTES

### 5.1 Page Soumissions (`/core/quotes`)

**Symptôme :** L'historique des soumissions de prix est incomplet.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | % récupéré |
|---|---|---|---|
| `quotes` | **195** | **18** | **9%** |
| `quote_lines` | 69 | 69 | ✅ 100% |
| `quote_events` | 135 | 135 | ✅ 100% |

**Cause :** 177 soumissions (91%) sont absentes.  
**Récupération :** `quotes.csv` (195 lignes) disponible.

---

### 5.2 Page Emails Directs (`/core/emails`)

**Symptôme :** L'historique des emails directs est incomplet.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | % récupéré |
|---|---|---|---|
| `direct_emails` | **70** | **6** | **9%** |
| `direct_email_recipients` | 429 | 429 | ✅ 100% |

**Cause :** 64 emails directs (91%) sont absents.  
**Récupération :** `direct_emails.csv` (70 lignes) disponible.

---

### 5.3 Page Email Queue (`/core/email-queue`)

**Symptôme :** Des emails en queue ne s'affichent pas.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | % récupéré |
|---|---|---|---|
| `email_queue` | **5 456** | **2 383** | **44%** |

**Cause :** 3073 emails en queue (56%) sont absents.  
**Récupération :** `email_queue.csv` (5456 lignes) disponible.

---

### 5.4 Page Social Media (`/marketing/social`)

**Symptôme :** L'historique des posts réseaux sociaux est incomplet.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | % récupéré |
|---|---|---|---|
| `social_media_posts` | **104** | **19** | **18%** |

**Cause :** 85 posts (82%) sont absents.  
**Récupération :** `social_media_posts.csv` (104 lignes) disponible.

---

### 5.5 Page Ventes Terrain (`/field/orders`)

**Symptôme :** Les commandes du terrain sont incomplètes.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | % récupéré |
|---|---|---|---|
| `field_sales_orders` | **27** | **14** | **52%** |

**Cause :** 13 commandes terrain (48%) sont absentes.  
**Récupération :** `field_sales_orders.csv` (27 lignes) disponible.

---

### 5.6 Module Email — Templates absents

**Symptôme :** Le système d'email automatique ne peut pas charger de templates.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Statut |
|---|---|---|---|
| `email_templates` | **82** | **ABSENT** | Table n'existe pas |
| `email_trigger_queue` | **704** | **ABSENT** | Table n'existe pas |
| `automatic_email_dispatches` | 189 | **ABSENT** | Table n'existe pas |

**Cause :** Les 3 tables centrales du système d'email n'existent pas dans le nouveau projet. Le système d'email automatique est **entièrement cassé** pour tout ce qui dépend de ces tables.  
**Impact :** Les fonctions qui tentent de charger un template par `slug` retournent une erreur. Les 704 déclencheurs email en queue sont perdus.  
**Récupération :** CSV disponibles + schémas connus dans les migrations Lovable.

---

### 5.7 Module Paie (`/hr/payroll`)

**Symptôme :** Le module paie du hub interne est cassé.

| Table | Lignes CSV (ancien) | Lignes DB (nouveau) | Statut |
|---|---|---|---|
| `pay_periods` | 6 | **ABSENT** | Table manquante |
| `payroll_entries` | 6 | **ABSENT** | Table manquante |
| `payroll_payments` | 5 | **ABSENT** | Table manquante |
| `payroll_runs` | 3 | **ABSENT** | Table manquante |
| `employee_payroll_settings` | 9 | **ABSENT** | Table manquante |
| `staff_schedules` | 61 | **ABSENT** | Table manquante |
| `tax_brackets_federal` | 5 | **ABSENT** | Table manquante |
| `tax_brackets_quebec` | 4 | **ABSENT** | Table manquante |

**Cause :** Le module paie complet n'existe pas dans le nouveau projet. 8 tables relatives à la paie sont absentes.  
**Impact :** Toute la fonctionnalité de paie du hub interne plante.  
**Récupération :** CSV disponibles pour toutes ces tables.

---

## MATRICE DE PRIORITÉ — IMPACT vs EFFORT

| Priorité | Action | Impact | Effort | Tables concernées |
|---|---|---|---|---|
| 🔴 1 | Créer + importer `support_tickets` + `ticket_replies` | CRITIQUE | ÉLEVÉ (48K lignes) | support_tickets, ticket_replies |
| 🔴 2 | Créer + importer `email_templates` | CRITIQUE | FAIBLE (82 lignes) | email_templates |
| 🔴 3 | Créer + importer `client_internal_notes` | ÉLEVÉ | FAIBLE (353 lignes) | client_internal_notes |
| 🔴 4 | Créer + importer `training_modules` + `training_lessons` | ÉLEVÉ | MOYEN (2860 lignes) | training_modules, training_lessons |
| 🔴 5 | Importer `orders` + `quotes` manquants | ÉLEVÉ | MOYEN (234 lignes) | orders, quotes |
| 🔴 6 | Créer + importer `stripe_plan_mapping` | CRITIQUE | FAIBLE (32 lignes) | stripe_plan_mapping |
| 🔴 7 | Importer `billing_subscription_services` | ÉLEVÉ | FAIBLE (17 lignes) | billing_subscription_services |
| 🟠 8 | Créer + importer `service_addresses` | MOYEN | FAIBLE (17 lignes) | service_addresses |
| 🟠 9 | Importer `marketing_campaigns` | MOYEN | FAIBLE (270 lignes) | marketing_campaigns |
| 🟠 10 | Importer `loyalty_points` + `loyalty_transactions` | MOYEN | FAIBLE (7 lignes) | loyalty_points, loyalty_transactions |
| 🟠 11 | Créer + importer module paie complet | MOYEN | MOYEN (37 lignes) | pay_periods, payroll_runs, payroll_entries, payroll_payments |
| 🟠 12 | Créer + importer `email_trigger_queue` | MOYEN | FAIBLE (704 lignes) | email_trigger_queue |
| 🟡 13 | Créer + importer `operational_fees` | MOYEN | FAIBLE (11 lignes) | operational_fees |
| 🟡 14 | Importer `jobs` + `job_email_templates` | FAIBLE | FAIBLE (99 lignes) | jobs, job_email_templates |
| 🟡 15 | Importer `hub_posts` | FAIBLE | FAIBLE (47 lignes) | hub_posts |
| 🟡 16 | Récupérer 95 profils manquants | FAIBLE | ÉLEVÉ (auth.users non récupérable via CSV) | profiles |
