
# Audit de la commande 58953 — origine réelle des lignes fantômes

J'ai lu la commande, la facture et le `field_sales_orders` d'origine. Voici la vérité brute avant de proposer la correction — pour que la solution vise les bonnes causes et pas juste les symptômes visibles.

## Ce que la facture contient réellement

| Ligne | Montant | Origine réelle |
|---|---|---|
| Internet Giga — 30 jours | 60,00 | Forfait vendu (correct) |
| Borne WiFi Nivra | 60,00 | Équipement vendu (correct) |
| Frais d'activation (1 service) | 10,00 | Ajouté automatiquement par `field-sales-sync` (règle 10$/1 service) |
| Livraison Express — Uber Direct | 40,00 | Ajouté par l'agent dans le portail terrain |
| **Deplacement** | **33,90** | **Ajouté par l'agent lui-même** comme "custom_adjustment" dans le portail terrain |
| **Ajustement promotionnel** | **−60,00** | **Fabriqué par le code** dans `field-sales-sync/index.ts` (lignes 550-570) pour forcer la facture à coller au `sale.total_amount` saisi par l'agent |
| **Paiement ID 7905998** | **−126,47** | **Saisi par l'agent** comme "custom_adjustment" pour représenter un paiement déjà reçu sur une autre plateforme — modélisé comme un rabais au lieu d'un paiement |

Subtotal facturé : 17,43 $ → TPS 0,87 + TVQ 1,74 = **20,04 $** encaissé. Le forfait Internet Giga a donc été taxé sur une base réduite à cause du rabais fantôme et du paiement transformé en rabais.

## Les deux vraies causes à éliminer

**Cause A — Fabrication de ligne par le back-end**
`supabase/functions/field-sales-sync/index.ts` (lignes 550-570) : quand le total calculé ne colle pas au total saisi par l'agent, le code insère de force une ligne `Ajustement promotionnel` négative pour combler l'écart. C'est la seule ligne réellement inventée par le système. Elle doit disparaître : le back-end doit refuser un total incohérent, pas maquiller la facture.

**Cause B — Confusion structurelle promotion / crédit / paiement**
Le portail terrain permet à l'agent de saisir n'importe quoi comme "custom_adjustment", ce qui produit une ligne de facture. C'est comme ça que "Deplacement 33,90" et "Paiement ID 7905998 −126,47" sont arrivés dans la facture : l'un est un vrai frais que l'agent voulait facturer, l'autre est un paiement externe que l'agent a modélisé comme un rabais parce qu'il n'y a pas de meilleur outil. Un paiement encaissé ailleurs n'est pas un rabais et ne doit **jamais** apparaître comme ligne négative dans la facture.

## Correctifs

### 1. Retirer définitivement la fabrication de la ligne d'ajustement (`field-sales-sync`)

- Supprimer le bloc "Keep invoice/PDF lines aligned with authoritative quote total" qui insère la ligne `Ajustement promotionnel`.
- Si `sale.total_amount` diffère de la somme des lignes réelles de plus de 0,01 $, la synchro **échoue** et l'ordre reste en `sync_error` avec un message clair. Aucun maquillage.
- Les taxes sont recalculées uniquement à partir des lignes réelles (service + équipement + frais légitimes − rabais réels sur services). Plus jamais de dérivation "à l'envers" depuis un total cible.

### 2. Séparer les quatre concepts au niveau du portail terrain et de la base

Le portail terrain doit exposer quatre actions distinctes, chacune écrite dans la bonne table :

| Concept | Où c'est écrit | Effet |
|---|---|---|
| **Promotion** | Ligne `line_type='discount'` sur la facture, rattachée à un service | Réduit le montant taxable du service concerné |
| **Crédit au compte** | `account_adjustments` | Consommé automatiquement sur la prochaine facture, n'apparaît pas comme ligne négative dans la facture d'origine |
| **Paiement reçu (autre plateforme)** | `billing_payments` avec `method='external'`, `provider` = plateforme, `reference` = ID externe | Réduit `balance_due`, apparaît dans la section Paiements de la facture, jamais dans les lignes |
| **Solde à payer** | `balance_due` = total facture − crédits appliqués − paiements confirmés | Calculé, jamais stocké comme ligne |

- La saisie "custom_adjustment" négative dans le portail terrain est retirée. À la place : bouton "Enregistrer un paiement externe" qui crée un `billing_payments` (statut `confirmed` après validation Core), et bouton "Appliquer un crédit compte" qui crée un `account_adjustments`.
- Les "custom_adjustment" positifs (comme Deplacement) restent permis mais uniquement comme `line_type='fee'` avec catégorie explicite ("Frais de déplacement", "Frais d'installation supplémentaire", etc.) — jamais anonymes.

### 3. Génération des documents = miroir strict de la base

- **Contrat** : lit uniquement les lignes récurrentes (`is_recurring` ou service catégoriel). Prix mensuel = somme des lignes récurrentes. Plus jamais d'affichage `0,00 $/mois` si des services récurrents existent.
- **Facture PDF** : reproduit les lignes de `billing_invoice_lines` telles quelles, section Paiements = `billing_payments`, section Crédits = `account_adjustments` appliqués. Aucun calcul dérivé.
- **Sommaire de commande** : plan mensuel = somme des lignes récurrentes de la commande, pas de la première ligne.
- **Portail client / abonnements** : `billing_subscriptions` créés uniquement à partir des lignes `is_recurring=true` (règle déjà mise en place hier, on la laisse en place et on la vérifie).

### 4. Nettoyage rétroactif ciblé de la facture 58953

- Retirer la ligne "Ajustement promotionnel −60,00" (fantôme système).
- Reclasser "Paiement ID 7905998" : suppression de la ligne discount, création d'un `billing_payments` `method='external'`, `provider='autre'`, `reference='7905998'`, `amount=126.47`, `status=confirmed`.
- Garder "Deplacement 33,90" comme ligne `fee` (c'est ce que l'agent voulait facturer) OU la retirer si tu confirmes qu'elle n'aurait jamais dû être ajoutée.
- Recalculer subtotal + taxes + `balance_due` à partir des lignes propres. Le `billing_payments` de 20,04 $ déjà encaissé reste. Le solde sera cohérent avec ce que le client doit réellement.

### Détails techniques (pour référence, tu peux sauter)

- Fichier principal : `supabase/functions/field-sales-sync/index.ts` — retirer le bloc lignes 550-570, ajouter une validation stricte totaux.
- Portail terrain : `src/field-app/pages/FieldNewSale.tsx` (et composants de saisie) — retirer la saisie `custom_adjustment` négative libre.
- Nouvelle migration pour introduire `billing_payments.method='external'` si absent + politique RLS pour insertion par staff terrain.
- Nettoyage rétroactif : migration one-shot ou script d'ajustement manuel sur la facture 4916796.

## Ce que je veux confirmer avant d'implémenter

1. Pour la facture 58953 : je garde "Deplacement 33,90" comme frais légitime, ou je la retire aussi ? (L'agent l'a saisie, mais tu dis qu'elle n'a jamais été demandée.)
2. Le paiement externe de 126,47 $ : je le reclasse en `billing_payments` avec `provider='autre_plateforme'`, ou tu veux un provider spécifique (Stripe externe, virement, etc.) ?
3. Après le nettoyage, quel est le solde attendu que le client doit voir ? (Si Deplacement retiré et paiement reclassé : total facture = 170 $ + taxes = 195,46 $, payé = 126,47 + 20,04 = 146,51, solde = 48,95 $. Si Deplacement gardé : total = 203,90 + taxes = 234,33, payé 146,51, solde = 87,82.)

Réponds à ces 3 points et je lance l'implémentation en une seule passe : correctifs code + migration de nettoyage + garde-fous de test.
