# Plan d’audit — Nivra Core → Commandes → Nouvelle commande

## Objectif strict
Produire un audit technique complet, exhaustif et reproductible d’une seule fonctionnalité :

`Nivra Core → Commandes → Nouvelle commande`

Aucune correction de code dans cette phase. Aucun résumé général. Chaque affirmation devra être appuyée par une preuve. Toute information non démontrable sera marquée explicitement : `NON VÉRIFIÉ`.

## Règles de preuve
Pour chaque point, l’audit distinguera clairement :

- `PROUVÉ` : preuve runtime, requête DB, log, capture, fichier:ligne ou résultat E2E.
- `NON VÉRIFIÉ` : impossible à démontrer avec les accès/outils disponibles.
- `CONCURRENT` : autre chemin pouvant faire une partie du même workflow.
- `MORT / NON MONTÉ` : code présent mais non atteint par le workflow audité, avec preuve.
- `DANGEREUX` : comportement pouvant créer doublon, contournement, écriture incohérente ou trou de sécurité.

## Livrable final
Un document d’audit complet écrit dans `/mnt/documents/` avec :

- requêtes exécutées,
- résultats observés,
- logs pertinents,
- captures si disponibles,
- run ID si un runner existe,
- preuves fichier:ligne,
- tableau final de verdict.

Le document répondra aux 13 sections demandées, dans le même ordre.

---

# Étapes d’audit

## 1. Point d’entrée réel
Identifier et prouver le seul workflow réellement utilisé depuis Core :

- route React exacte,
- page montée,
- composant racine,
- composants enfants,
- hooks,
- contextes,
- dialogs,
- services appelés.

Preuves prévues :

- navigation runtime dans la vraie interface Core,
- inspection DOM / captures,
- recherche routes dans le code,
- preuves fichier:ligne,
- logs navigateur si disponibles.

Comparer explicitement avec les surfaces similaires :

- `ManualOrderWizard`,
- `EmployeeCreateOrder`,
- `UnifiedPOSPage`,
- `InstallationScheduler`,
- toute autre page/dialog/service trouvé.

Pour chacune : `utilisé`, `non monté`, `mort`, `concurrent`, ou `NON VÉRIFIÉ`, avec preuve.

## 2. Workflow complet réel
Décomposer le workflow du premier clic jusqu’à la fin :

- ouverture de Nouvelle commande,
- saisie client,
- sélection services,
- installation/calendrier,
- promotions/rabais,
- récapitulatif,
- création quote/order/payment intent,
- courriel/payment link,
- paiement QA/canonique si possible,
- matérialisation commande Core,
- apparition dans Commandes,
- traitement,
- provisioning,
- timeline/audit/communications.

Pour chaque étape, documenter :

- composant,
- hook,
- fonction,
- service,
- Edge Function,
- RPC,
- fonction SQL,
- trigger,
- table,
- vue,
- audit,
- timeline,
- communications,
- provisioning.

## 3. Source de vérité
Pour chaque étape, identifier explicitement la source de vérité :

- frontend,
- Edge Function,
- RPC,
- fonction SQL,
- trigger,
- base de données,
- table/vue canonique.

Aucune source de vérité ne sera supposée. Si la preuve manque : `NON VÉRIFIÉ`.

## 4. Écritures
Lister toutes les écritures dans l’ordre réel :

- table modifiée,
- type : `INSERT`, `UPDATE`, `DELETE`, `UPSERT`,
- acteur : frontend, service, Edge Function, RPC, trigger,
- raison,
- ordre,
- transaction ou absence de preuve de transaction,
- idempotency si présente.

Les écritures seront prouvées par logs, traces DB, code fichier:ligne et/ou requêtes ciblées.

## 5. Lectures
Lister toutes les lectures :

- tables,
- vues,
- RPC,
- requêtes frontend,
- services,
- dépendances indirectes.

Inclure les lectures de configuration, produits, promotions, disponibilités calendrier, client, facturation, commande, paiement, provisioning et timeline.

## 6. Workflows parallèles / bypass
Rechercher tous les chemins pouvant créer une commande ou une partie de commande :

- pages frontend,
- dialogs,
- hooks,
- services,
- Edge Functions,
- RPC,
- fonctions SQL,
- triggers,
- runners QA,
- workflows employés/field/admin.

Classer chacun :

- utilisé par le workflow Core,
- concurrent,
- bypass partiel,
- mort,
- remplacé,
- `NON VÉRIFIÉ`.

## 7. Machine complète d’états
Reconstituer tous les états et transitions liés à la commande manuelle :

- brouillon,
- quote,
- payment intent,
- lien créé,
- email enfilé/envoyé,
- payé,
- order shell,
- commande matérialisée,
- en traitement,
- installation / auto-installation / technicien,
- provisioning,
- complété,
- annulé,
- erreur,
- refus,
- doublon,
- expiré.

Pour chaque transition :

- déclencheur,
- validation,
- table/source,
- erreur possible,
- preuve.

## 8. Sécurité
Auditer les contrôles du workflow :

- RBAC,
- RLS,
- policies,
- fonctions `has_role` ou équivalent,
- validations frontend,
- validations Zod,
- validations Edge Function,
- validations SQL,
- triggers,
- contraintes,
- idempotency,
- accès public au payment link.

Chaque contrôle sera lié à une étape précise du workflow.

## 9. Communications
Lister toutes les communications :

- emails,
- SMS,
- notifications,
- files d’attente,
- templates,
- idempotency,
- moment exact d’envoi/enfilage,
- Edge Function/RPC responsable.

Inclure explicitement ce qui n’est pas prouvé dans le runtime avec `NON VÉRIFIÉ`.

## 10. Timeline / Client 360 / Journal / Audit
Identifier exactement ce qui apparaît ou n’apparaît pas dans :

- `v_customer_timeline`,
- Client 360,
- Journal,
- tables d’audit,
- historiques de statut,
- events transactionnels.

Pour chaque événement attendu : `présent`, `absent`, ou `NON VÉRIFIÉ`, avec preuve.

## 11. Production / E2E reproductible
Exécuter ou documenter un run reproductible sur le vrai workflow :

- navigation Core,
- création commande de test si possible,
- génération payment link,
- vérification email enfilé,
- paiement QA/canonique si disponible,
- vérification création commande,
- apparition dans Core,
- traitement,
- suite workflow.

Inclure :

- Run ID si un runner existe,
- requêtes exécutées,
- réponses observées,
- logs Edge Functions ciblés,
- résultats DB,
- captures si disponibles.

Si une étape ne peut pas être exécutée ou démontrée : `NON VÉRIFIÉ`.

## 12. Code mort
Inventorier tout ce qui est lié à cette fonctionnalité :

- composants,
- pages,
- hooks,
- services,
- Edge Functions,
- RPC,
- fonctions SQL,
- triggers,
- migrations,
- runners QA.

Pour chacun :

- `utilisé`,
- `inutilisé`,
- `mort`,
- `concurrent`,
- `remplacé`,
- `NON VÉRIFIÉ`.

Chaque statut aura une preuve.

## 13. Verdict final
Produire un tableau final avec preuves :

- ce qui fonctionne,
- ce qui ne fonctionne pas,
- ce qui est incomplet,
- ce qui est en doublon,
- ce qui est dangereux,
- ce qui est mort,
- ce qui doit être supprimé,
- ce qui doit être migré.

Chaque ligne contiendra :

- constat,
- impact,
- preuve,
- statut,
- action recommandée.

---

# Méthode d’exécution

## Exploration code
Lire uniquement les fichiers nécessaires au workflow Nouvelle commande : routes, pages Core, composants du wizard, hooks, services, functions, migrations liées.

## Exploration runtime
Utiliser la vraie interface locale/preview avec Playwright pour prouver le chemin réel monté et capturer les étapes visibles.

## Exploration backend
Utiliser des requêtes read-only ciblées pour :

- inspecter les tables et vues touchées,
- lire les traces récentes,
- confirmer les écritures produites,
- vérifier timeline/audit/communications/provisioning,
- éviter toute supposition.

## Logs
Lire les logs ciblés des Edge Functions impliquées :

- création payment link,
- sync/materialization,
- paiement,
- communications,
- provisioning,
- runners QA si existants.

## Interdictions pendant l’audit
- Ne pas corriger de code.
- Ne pas créer de nouveau module.
- Ne pas modifier le schéma.
- Ne pas généraliser au reste du projet.
- Ne pas remplir les trous par supposition.
- Ne pas présenter un résumé court à la place du rapport demandé.

---

# Critère de fin
L’audit est terminé uniquement quand les 13 points sont couverts, avec preuve ou `NON VÉRIFIÉ`, et que le document final est disponible dans `/mnt/documents/`.