# Passe complète Client 360 — plan d'exécution

## Principe directeur

Un seul standard, appliqué à tous les modules, identique à Upgrade/Downgrade et KYC :

1. **Contexte complet** dans `ClientModuleShell` (état, historique, entités liées, impacts).
2. **Workflow réel** : consultation → simulation (si applicable) → confirmation → exécution → audit → realtime.
3. **Réutilisation stricte** des tables, RPC, Edge Functions, triggers, templates existants. Zéro système parallèle.
4. **Preuve technique** livrée à chaque fermeture de module (fichiers, tables, RPC, EF, triggers, emails, audit, realtime, tests).
5. **UI unifiée** : dialog `max-w-6xl`, onglets Etat/Historique/Actions, contraste AA, aucun élément caché.

Un module reste ouvert tant qu'un agent ne peut pas terminer une opération réelle de bout en bout.

## Phase 0 — Audit + fondations (préalable, non skippable)

Avant de toucher un module, produire deux livrables :

**0.1 Inventaire technique** (`.lovable/c360/inventory.md`)
Pour chaque bouton listé, mapper :
- État actuel : "stub UI" / "partiel" / "connecté" / "conforme standard"
- Tables canoniques
- RPC / Edge Function officielle
- Template email associé
- Trigger / audit table
- Gaps identifiés

**0.2 Renforcement `ClientModuleShell`**
- Bannière contexte compte (nom, #, statut, MRR, cycle, tags)
- Slot `impactedTables` + `plannedEmails` toujours visible en mode Actions
- Slot `auditTrail` unifié via `useModuleAudit`
- Slot `realtimeChannels` via `useModuleRealtime`
- Boutons d'action collants en bas (jamais coupés)
- États : idle / loading / simulating / confirming / executing / success / error / warning-critical

Sortie Phase 0 : inventaire + shell durci + confirmation du prochain lot avec toi.

## Phase 1 — Lots par ordre de risque métier

Chaque lot = 2 à 4 modules maximum, fermé avec preuve avant le suivant.

**Lot A — Facturation critique** (impact $ direct)
1. Enregistrer paiement
2. Crédit / Promotion + Crédit / Frais facture (fusionnés en un centre "Ajustements")
3. Remboursement rapide
4. Write-off / Ajustement
5. Plan de paiement
6. Force AutoPay + Méthode de paiement (fusionnés)

**Lot B — Services & équipements** (opérationnel)
7. Service Internet (état ligne, actions modem)
8. Service TV (packs, terminaux)
9. Ligne mobile (SIM, addons, topup)
10. Reboot équipement
11. Diagnostic ligne
12. Gestion équipement (RMA, remplacements)
13. Geler cycle / essai
14. Transfert déménagement

**Lot C — Conformité & sécurité** (risque légal)
15. Restrictions
16. Verrouiller compte fraude
17. Réinitialiser NIP
18. Étiquettes & alertes
19. Journal consentements
20. Sécurité & sessions
21. Demandes Loi 25
22. Risque & fraude

**Lot D — Compte & lifecycle**
23. Modifier le profil
24. Accès en ligne
25. VIP / Churn risk
26. Pause temporaire
27. Annuler le compte
28. Cas recouvrement
29. Litige facturation

**Lot E — Commandes & fidélité**
30. Nouvelle commande (deep-link vers workflow commande existant + pré-remplissage)
31. Récompenses (déjà partiellement fait — mise au standard shell)
32. Parrainages (idem)
33. Bon de compensation

**Lot F — Communication & suivi**
34. Ticket support
35. Escalade superviseur
36. Envoyer un message / SMS / rappel (fusionnés en centre "Communications")
37. Appels & téléphonie
38. Planifier RDV
39. NPS / Satisfaction
40. Note interne
41. Préférences communication
42. Tâches & suivis
43. Documents
44. Historique & activité

Modules déjà conformes (ne pas retoucher) : **Voir comme client**, **Upgrade/Downgrade**, **Vérification KYC**.

## Definition of Done par module

Un module est fermé uniquement quand tous les critères sont vrais :

```text
[ ] Contexte affiché : état actuel + entités liées + historique
[ ] Simulation dispo si l'action a un impact $ / service / légal
[ ] Exécution passe par une RPC ou Edge Function officielle existante
[ ] admin_audit_log écrit (avant/après)
[ ] Email officiel envoyé si applicable (via templates registry)
[ ] Realtime : le portail client + Core reflètent le changement < 3s
[ ] UI : dialog max-w-6xl, aucun bouton caché, contraste AA
[ ] Preuve technique livrée dans le chat
[ ] Test QA validé (compte test-c360-planchange@nivra-test.ca)
```

## Livrable par module (format standard)

```text
Module: <nom>
Fichiers: <liste>
Tables: <liste canonique>
RPC: <liste>
Edge Functions: <liste>
Triggers: <liste>
Emails: <template_name → destinataire>
Audit: admin_audit_log entry avec action_type=<x>
Realtime: <channels>
Test QA: <résultat + IDs>
```

## Cadence de validation

- Je livre lot par lot, module par module à l'intérieur du lot.
- Après chaque module : preuve + attente de ton feu vert.
- Après chaque lot : rétrospective courte (ce qui a changé au shell, patterns réutilisables).
- Aucun saut de lot sans validation explicite.

## Prérequis à débloquer une seule fois

- **Compte QA** : `qa-provision-test-account` doit être invoqué une fois avec ta session admin (blocage actuel). Sans ça, la validation E2E ne peut pas tourner et aucun module ne peut être fermé formellement.

## Ce que je démarre dès que tu approuves

1. Phase 0.1 — inventaire technique complet des 44 modules (lecture code + DB, aucune écriture).
2. Phase 0.2 — durcissement `ClientModuleShell` + hooks partagés.
3. Retour vers toi avec l'inventaire + proposition d'ordre définitif pour Lot A.

Aucun module métier n'est modifié avant que tu aies validé l'inventaire et l'ordre du Lot A.
