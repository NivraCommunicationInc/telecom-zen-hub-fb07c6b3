# Nouveau standard Client 360 — Fin des modules "à moitié"

Reçu 5/5. Le message est clair : à partir de maintenant, **un module = un outil opérationnel complet pour un agent**, pas une fenêtre qui s'ouvre. Je change la méthode de travail, pas juste le code.

---

## 1. Règle d'or : réutilisation, jamais reconstruction

Le Client 360 est une **console d'orchestration**. Il n'invente aucun workflow. Pour chaque module, avant d'écrire une seule ligne, je dresse la carte de ce qui existe déjà dans Nivra :

| Domaine | Workflow existant à réutiliser (à confirmer par audit code) |
|---|---|
| KYC | Sessions `identity_verification_sessions` + `kyc_requests` + `kyc_verifications` + workflow public de capture ID |
| Documents | `client_documents` + `client_auto_documents` + `AccountDocumentsDialog` + pipeline PDF canonique |
| Restrictions | `account_tags` + triggers de blocage réels (paiement, provisioning, portail) — pas juste un tag décoratif |
| Fraude / Verrouillage | `account_fraud_incidents` + `security_incidents` + révocation sessions + gel AutoPay + blocage login portail |
| Sécurité & Sessions | `customer_access_sessions` + `staff_impersonation_sessions` + `auth_login_attempts` + révocation réelle |
| Consentements | `checkout_consent_records` + `client_email_preferences` + `data_retention_log` (Loi 25) |
| Communications | `email_send_log` + `sms_queue` + `telephony_logs` + `send-transactional-email` (registry officiel uniquement) |
| Récompenses | `CoreLoyaltyPage` + `AdminReferralAdvancedDialog` déjà en place — intégrés en modules 360 |
| Facturation | RPC canoniques `fn_apply_credit`, `fn_apply_promotion`, `fn_write_off` + `square-*` edge functions |
| Provisioning | `provisioning_jobs` + `activation_requests` |
| Commandes | `useOrderProcessing` + `OrderProcessingWorkspace` |
| Équipements | `equipment_inventory` + `equipment_return_requests` + `replacement_orders` |
| Abonnements | `apply_plan_change` + `core-apply-plan-change` (livré Lot 1.1) |

**Règle** : si un module 360 ne branche pas sur au moins un de ces workflows existants, il n'est pas prêt à être livré.

---

## 2. Definition of Done — non négociable

Un module est terminé **uniquement** si les 10 critères suivants sont validés et documentés :

1. **Contexte complet affiché** : état actuel, historique métier, données liées, services/équipements/facturation impactés
2. **Simulation d'impact avant confirmation** : chiffré, multi-domaine, réversible en preview
3. **Workflow existant réutilisé** : preuve = liste RPC/tables/edge functions branchées
4. **Validations métier appliquées** côté serveur (pas juste UI)
5. **Permissions RLS + `has_role`** vérifiées sur toute écriture
6. **Audit** inséré dans `admin_audit_log` avec `before_state`, `after_state`, `reason` obligatoire
7. **Historique** lisible dans l'onglet Historique du module (données réelles, pas mock)
8. **Emails/notifications** via `send-transactional-email` + templates registry officiels uniquement
9. **Realtime** : les autres portails (Client, Employee, Field) reflètent le changement immédiatement
10. **UI opérationnelle validée** (voir §4)

---

## 3. Preuves techniques livrées avec chaque module

Pour chaque module fermé, je livre un **bloc de preuve** structuré :

```
Module : <nom>
- Tables lues     : ...
- Tables écrites  : ...
- RPC appelées    : ...
- Edge Functions  : ...
- Triggers actifs : ...
- Emails envoyés  : <template registry> vers <destinataire>
- Audit           : admin_audit_log entry <id> avec before/after
- Portails sync   : Client / Employee / Field via <channel>
- Tests exécutés  : Playwright <fichier> + captures écran
- Requête DB de vérification : SELECT ... (résultat collé)
```

Sans ce bloc, le module reste en état "en cours".

---

## 4. Standard UI — Upgrade/Downgrade = référence

`PlanChangeModule` (livré Lot 1.1) devient la **référence visuelle et interactionnelle** pour tous les futurs modules. Les règles applicables partout :

- **Structure** : `ClientModuleShell` (4 onglets État · Historique · Audit · Actions + aperçu d'impact + footer confirmation)
- **Aucun texte caché**, aucun élément derrière le background, aucun bouton coupé
- **Contrastes AA min.** partout (badges, alertes critiques distinctes)
- **États explicites** : succès / erreur / avertissement / action critique avec couleurs sémantiques distinctes
- **Motif obligatoire** sur toute action mutative, journalisé
- **Boutons d'action toujours dans le footer sticky**, jamais en fin de scroll perdu
- **Responsive** jusqu'à 1024px min (poste agent)
- **Aucun placeholder décoratif** : si une donnée manque au schéma, on le dit, on décide, on ne peint pas de faux champ

Passe de revue UI systématique sur chaque module avant fermeture (capture Playwright fournie).

---

## 5. Réordonnancement du travail

**J'arrête l'élargissement horizontal** (ajouter des boutons partout). Je passe en **profondeur verticale** : un module à la fois, entièrement fini, avec preuves.

Ordre proposé, du plus critique au moins critique pour un agent qui gère un dossier client :

1. **Upgrade/Downgrade** — ✅ Lot 1.1 livré (à re-valider contre nouveau standard : preuves + passe UI)
2. **Vérification KYC** — brancher sur le workflow `identity_verification_sessions` existant + capture pièces
3. **Verrouiller compte (fraude)** — révocation sessions réelle + gel AutoPay + blocage login + `account_fraud_incidents`
4. **Restrictions** — triggers de blocage effectifs (paiement/provisioning/portail), pas juste des tags
5. **Documents** — brancher sur pipeline PDF canonique + `client_documents` + upload signé
6. **Historique & activité** — timeline unifiée via `useCustomerTimeline` déjà existant
7. **Sécurité & sessions** — liste sessions actives réelles + révocation + `auth_login_attempts`
8. **Journal consentements** — `checkout_consent_records` + `client_email_preferences` + export Loi 25
9. **Risque & fraude** — score depuis `account_risk_scores` + incidents + actions
10. Suite (Facturation avancée, Services, Commandes, Communication, Récompenses…)

Chaque étape = un livrable fermé avec preuves avant de passer à la suivante.

---

## Ce que je te demande maintenant

Avant que je ré-attaque du code, deux confirmations rapides :

1. **Tu confirmes l'ordre ci-dessus** (KYC → Verrouillage fraude → Restrictions → Documents → …) ou tu veux prioriser autre chose ?
2. **Tu confirmes qu'on ferme d'abord Upgrade/Downgrade au nouveau standard** (audit contre les 10 critères + bloc de preuve + passe UI) avant d'ouvrir le module suivant ? C'est notre référence — elle doit être irréprochable avant de servir de modèle.

Dès que tu réponds, j'attaque **un seul module**, jusqu'au bout, preuves à l'appui. Fini les listes de 16 options à moitié faites.
