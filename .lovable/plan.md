L'infra existe déjà à ~90%. Voici le plan pour connecter les pièces qui manquent — aucune double-saisie, commission agent préservée.

## Ce qui existe déjà (réutilisé tel quel)

- **Page publique** `/payer/:intentId` (`src/pages/PayerCommande.tsx`) — affiche le récap + widget Square (carte, Apple Pay, Google Pay). Aucun changement.
- **Widget Square** — Web Payments SDK déjà intégré (carte, débit Visa/MC, Apple/Google Pay).
- **Template courriel** `field_payment_link` (`supabase/functions/_shared/customQueueTemplates.ts:3645`) — shell corporate bleu #0066CC, CTA "Revoir ma commande & payer".
- **Modèle de données** `field_quotes` (services, équipement, promo, rabais, frais, totaux, agent_id) + `field_payment_intents` (le UUID sert de token, `expires_at` = 7j).
- **Attribution commission** — `field-sales-sync` action `materialize_from_quote` insère `field_sales_orders.salesperson_id = quote.agent_id` puis crée `sales_commissions` + `field_commissions` automatiquement.

## Ce qui doit être ajouté (les 3 chaînons manquants)

### 1. Edge function `field-payment-link-create` (net-new, ~80 lignes)
Miroir léger de `core-square-payment-link` mais lit `field_quotes` au lieu de `billing_invoices`.
- Input : `{ quote_id }` (JWT agent requis, vérifie `quote.agent_id === auth.uid` OU rôle staff).
- Insère `field_payment_intents` : `quote_id`, `agent_id`, `amount_cents`, `customer_email/name`, `payment_method: "square"`, `expires_at: now()+7d`, `status: "pending"`.
- Enqueue `email_queue` : `template_key: "field_payment_link"`, `template_vars: { client_name, agent_name, total, summary, payment_url: "{origin}/payer/{intent.id}" }`.
- Retourne `{ payment_url, intent_id, expires_at }`.

### 2. Bouton agent "Envoyer au client" dans `StepRecap.tsx`
À côté du bouton "Enregistrer comme soumission" :
- Sauvegarde le brouillon comme `field_quote` (réutilise `saveQuoteAndEmail` sans envoi courriel), puis appelle `field-payment-link-create`.
- Affiche un toast + dialog : lien affiché, bouton "Copier le lien", indicateur "Courriel envoyé à {email}".
- Idem accessible depuis `FieldOrderDetail` pour renvoyer le lien d'une soumission déjà existante.

### 3. Post-paiement : matérialisation auto de la commande (patch dans `square-charge-invoice`)
Après la charge Square réussie sur un `field_payment_intent` :
```ts
if (intent.quote_id && !intent.converted_invoice_id) {
  await supabase.functions.invoke('field-sales-sync', {
    body: { action: 'materialize_from_quote', quote_id: intent.quote_id, agent_id: intent.agent_id, payment_reference: square_payment_id }
  });
}
```
Ceci garantit :
- Création de `field_sales_orders` avec `salesperson_id = agent_id` (commission préservée).
- Déclenchement du workflow d'installation (déjà géré par `field-sales-sync`).
- Enregistrement `billing_payments` + note automatique client (déjà géré).

## UX de la page `/payer/:intentId` — polish premium

Ajustements légers à `PayerCommande.tsx` :
- Bandeau haut : ✓ "Votre commande est prête — Votre représentant {agent_name} l'a préparée pour vous. Vérifiez et procédez au paiement sécurisé."
- Récap verrouillé par défaut, bouton "Modifier" par champ pour : téléphone, courriel, adresse de facturation.
- Section paiement Square directement sous le récap, aucun formulaire intermédiaire.

## Hors scope (déjà OK ou clarification requise)

- **Date d'installation** dans le lien : pas dans le type `FieldSaleCustomer` actuellement. À ajouter comme champ optionnel `install_date` dans `field_quotes` si tu veux l'afficher dans le lien. Confirme si tu veux ce champ maintenant ou plus tard.
- **Signature électronique** : non détectée dans le flux actuel. Le contrat est généré au moment de l'activation post-paiement. Confirme si tu veux forcer la signature AVANT le paiement dans ce nouveau flux.

## Ordre d'exécution

1. Migration : ajouter colonne `quote_id` sur `field_payment_intents` si absente + colonne `install_date` sur `field_quotes` (si tu confirmes).
2. Créer `supabase/functions/field-payment-link-create/index.ts` + deploy.
3. Patcher `square-charge-invoice/index.ts` (bloc matérialisation post-paiement).
4. Ajouter bouton "Envoyer au client" dans `StepRecap.tsx` + petit `SendPaymentLinkDialog.tsx`.
5. Polish `PayerCommande.tsx` (bandeau + bouton "Modifier" par champ).
6. `tsgo --noEmit` = 0 → publier.

**Confirme les 2 points hors scope** (install_date maintenant/plus tard, signature avant/après paiement) et je build tout d'un coup.