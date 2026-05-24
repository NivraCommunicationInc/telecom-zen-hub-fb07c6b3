## Diagnostic

Trois problèmes confirmés en BD :

1. **Rôles incorrects** dans certaines edge functions des phases 11-15 :
   - `account-documents-list`, `security-account-actions`, `communication-account-actions` vérifient le rôle inexistant `support_agent` → 403 systématique pour les staff `employee`. L'enum réel contient : `admin, client, technician, employee, influencer, field_sales, sales, kyc_agent, billing_admin, techops, support, supervisor`.

2. **Documents incomplets** : `account-documents-list` lit `contracts`, `client_auto_documents`, `client_documents`, `order_documents` — mais **ignore** `billing_invoices` et `monthly_invoices` qui contiennent les vraies factures du client. Résultat : un client avec 5 factures mensuelles voit "Aucun document".

3. **Phases 12-20 isolées** : les nouvelles dialogues (SMS, Appels, Préférences, Étiquettes, Suivis, Loi 25, Fraude) ont leur propre table mais n'agrègent rien depuis l'existant (notes, tickets, paiements, sessions). Vivantes mais vides au premier ouverture.

## Plan — 2 lots

### Lot A — Audit & correctifs des dialogues existantes (Phases 11-20)

**A1. Standardiser la vérification de rôles staff**
Créer une fonction PL/pgSQL `public.has_staff_role(_user_id uuid)` retournant `true` si l'utilisateur a au moins un de : `admin, employee, supervisor, support, billing_admin, kyc_agent, techops`. Remplacer les multi-`has_role()` dans **toutes** les edge functions du Compte 360 par cet appel unique. Élimine les erreurs `support_agent`.

**A2. Étendre `account-documents-list`**
Ajouter la lecture de :
- `billing_invoices` (factures mensuelles auto) → catégorie "Facture"
- `monthly_invoices` (factures cycle) → catégorie "Facture mensuelle"  
- `payments` → générer un item "Reçu de paiement" par paiement complété
- `quotes` (si lié au client) → catégorie "Soumission"

Chaque item conserve son `source` (`invoice`, `receipt`, `quote`) avec icône dédiée et tab supplémentaire.

**A3. Test fumée systématique**
Pour chaque dialogue (Documents, Sécurité, Communications, SMS, Appels, Préférences, Étiquettes, Suivis, Loi 25, Fraude, Timeline, Disputes, Collections, KYC, Référrals) :
- Appeler l'action `list` via `curl_edge_functions` avec un client réel ayant des données
- Vérifier : pas de 403, pas de 500, payload non-vide quand des données existent
- Corriger les colonnes erronées, les filtres trop stricts, les rôles manquants

**A4. Fix le bouton "Documents" qui s'affiche vide**
Vérifier explicitement avec un client qui a des `client_auto_documents` (38 rows en BD) que le dialogue les affiche après les corrections A1 + A2.

### Lot B — Phase 21 : Claim de commandes/factures par vérification d'email

**Règle métier** : lorsqu'un utilisateur crée un compte avec un email qui apparaît déjà dans `orders.guest_email`, `quotes.client_email`, `billing_invoices.recipient_email` ou `client_auto_documents.recipient_email`, le système doit :
1. Détecter ces enregistrements orphelins à la création du compte
2. **Bloquer le claim** tant que l'email n'est pas vérifié par un code OTP envoyé par courriel
3. Une fois le code validé, rattacher tous les enregistrements au nouveau `user_id` et `account_id`
4. Auditer chaque rattachement dans `admin_audit_log`

**B1. Migration BD**
- Table `email_claim_challenges` : `id, target_email, user_id, code_hash (sha256), expires_at (10 min), attempts (max 5), verified_at, created_at`. RLS : user voit/modifie uniquement ses propres challenges.
- Fonction `count_claimable_records(_email text)` : retourne un JSON `{orders: n, quotes: n, invoices: n, auto_docs: n}` sans exposer les données.
- Fonction `apply_email_claim(_user_id uuid, _email text)` (SECURITY DEFINER) : exécute le rattachement transactionnel et insère l'audit log. N'est appelée qu'après vérification du code.

**B2. Edge function `account-claim-actions`**
Actions :
- `detect` : appelée à la première connexion. Retourne le compteur via `count_claimable_records`.
- `request_code` : génère un code 6 chiffres, le hash, l'insère dans `email_claim_challenges` (expire 10 min), envoie l'email via `send-transactional-email` (template `account-claim-verification`).
- `verify_code` : vérifie le code, incrémente `attempts`, et si valide appelle `apply_email_claim` puis envoie l'email de confirmation (template `account-claim-success`).

**B3. Template email**
Créer `_shared/transactional-email-templates/account-claim-verification.tsx` avec le template corporate (bleu #0066CC, footer Nivra). Code 6 chiffres en gros. Expire en 10 min. Mention sécurité.

**B4. UI**
- Bannière `AccountClaimBanner.tsx` dans le portail client (`/portal`) : si `count > 0`, afficher "Nous avons trouvé X commandes / Y factures associées à votre email. Vérifiez votre adresse pour les récupérer." Bouton "Vérifier mon email".
- Dialogue `ClaimVerificationDialog.tsx` : champ code 6 chiffres, bouton "Renvoyer le code" (rate-limit 60s), affiche le résultat.

**B5. Audit & sécurité**
- Rate limit : max 3 demandes de code par adresse par heure
- Lock après 5 mauvais codes (challenge expiré)
- Audit chaque `claim_apply` avec compteur d'éléments rattachés
- Aucune fuite : `count_claimable_records` retourne uniquement des compteurs, jamais les IDs/numéros

## Détails techniques

```text
Tables touchées
├── A1: helper SQL public.has_staff_role(_user_id uuid) → bool
├── A2: account-documents-list ajoute billing_invoices, monthly_invoices, payments
├── B1: email_claim_challenges (nouvelle)
│       count_claimable_records (SQL function)
│       apply_email_claim (SQL function, SECURITY DEFINER)
└── B5: admin_audit_log entries: account_ops.claim_request|verify|apply

Edge functions
├── A1: patch ~10 fonctions (rôles)
├── A2: patch account-documents-list
└── B2: account-claim-actions (nouvelle)

Composants UI
├── A3: aucune modif UI si edge fix suffit
├── B4: AccountClaimBanner.tsx
└── B4: ClaimVerificationDialog.tsx (dans src/pages/portal/)
```

## Ordre d'exécution

1. **Lot A d'abord** (fonctionnel cassé → priorité) — migration helper + patch des fonctions + test fumée
2. **Lot B ensuite** — migration + edge function + template email + UI portail client

## Hors scope

- Refonte UI des dialogues (déjà OK)
- Migration des roles existants (l'enum reste tel quel)
- Auto-claim sans vérification (refusé pour raison de sécurité)
- Notification staff lors d'un claim (peut être ajouté en suivi)