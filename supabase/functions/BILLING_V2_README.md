# Billing V2 - Système de Facturation Prépayé Nivra

## 🔒 RÈGLE SYSTÈME VERROUILLÉE

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   LE CYCLE DE FACTURATION NE COMMENCE JAMAIS À LA DATE DE COMMANDE.        │
│                                                                              │
│   LE CYCLE COMMENCE UNIQUEMENT QUAND LE PAIEMENT INTERAC EST CONFIRMÉ.     │
│                                                                              │
│   Cette règle est IMMUABLE et protégée par des triggers SQL.               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Architecture

### Tables Principales

| Table | Description |
|-------|-------------|
| `billing_customers` | Clients facturables (lien optionnel vers auth.users) |
| `billing_subscriptions` | Abonnements par service (Mobile, Internet, TV, Sécurité) |
| `billing_invoices` | Factures avec cycle de 30 jours |
| `billing_invoice_lines` | Lignes de détail des factures |
| `billing_payments` | Enregistrements de paiements (Interac uniquement) |
| `billing_system_alerts` | Alertes de sécurité (tentatives d'activation non autorisées) |

### Edge Functions

| Function | Description |
|----------|-------------|
| `billing-create-order` | Crée customer + subscriptions (pending) + invoices (pending) |
| `billing-confirm-payment` | Confirme paiement Interac → active le cycle via trigger SQL |
| `billing-generate-renewals` | CRON J-3: génère factures de renouvellement |
| `billing-check-overdue` | CRON quotidien: suspend J+2, annule J+5 |
| `billing-migrate-clients` | Migration clients legacy vers V2 |

## Flow de Facturation

### 1. Nouvelle Commande
```
Client passe commande → billing-create-order
    ↓
Crée: billing_customer (si nouveau)
    ↓
Crée: billing_subscription (status = 'pending')
       cycle_start_date = date provisoire (aujourd'hui)
       cycle_end_date = date provisoire (+30 jours)
    ↓
Crée: billing_invoices (status = 'pending')
       payment_method = 'interac'
    ↓
Crée: billing_payments (status = 'pending')
    ↓
Email envoyé avec instructions Interac
```

### 2. Confirmation Paiement (ACTIVATION)
```
Admin reçoit Interac → billing-confirm-payment
    ↓
Met à jour: billing_invoices.status = 'paid'
            billing_invoices.paid_at = NOW()
    ↓
TRIGGER SQL (on_invoice_paid_update_subscription):
    ↓
Met à jour: billing_subscriptions.cycle_start_date = paid_at
            billing_subscriptions.cycle_end_date = paid_at + 30 jours
            billing_subscriptions.status = 'active'
    ↓
Email confirmation envoyé avec VRAIES dates de cycle
```

### 3. Renouvellement (J-3)
```
CRON billing-generate-renewals (quotidien)
    ↓
Cherche: subscriptions avec cycle_end_date = aujourd'hui + 3 jours
    ↓
Crée: nouvelle billing_invoice (status = 'pending')
      cycle_start_date = ancien cycle_end_date
      cycle_end_date = nouveau cycle + 30 jours
    ↓
Crée: billing_payment (status = 'pending')
    ↓
Email rappel de renouvellement
```

### 4. Non-Paiement
```
CRON billing-check-overdue (quotidien)
    ↓
J+2 après due_date: subscription.status = 'suspended'
                    Email avertissement
    ↓
J+5 après due_date: subscription.status = 'cancelled'
                    invoice.status = 'failed'
                    Email annulation
```

## Protections SQL

### Trigger: `protect_subscription_activation_trigger`
- **Quand**: Mise à jour d'un subscription vers `status = 'active'`
- **Vérifie**: Existe-t-il une facture `paid` pour cet abonnement?
- **Si non**: 
  - Bloque l'activation (revert to `pending`)
  - Crée alerte dans `billing_system_alerts`
  - Log warning dans Postgres

### Trigger: `protect_subscription_insert_trigger`
- **Quand**: Insertion d'un subscription avec `status = 'active'`
- **Action**: Force `status = 'pending'` + crée alerte

### Trigger: `on_invoice_paid_update_subscription`
- **Quand**: `billing_invoices.status` passe à `paid`
- **Action**: 
  - `subscription.cycle_start_date = invoice.paid_at`
  - `subscription.cycle_end_date = paid_at + 30 jours`
  - `subscription.status = 'active'`

## Frais d'Activation

| Services dans la commande | Frais |
|---------------------------|-------|
| 1 service | 25.00$ |
| 2+ services | 45.00$ (forfaitaire) |

## Taxes Quebec

- TPS: 5%
- TVQ: 9.975%

## Paiement

**Méthode unique: Interac e-Transfer**
- Email: `Support@nivratelecom.ca`
- Aucune carte de crédit
- Aucun prélèvement automatique
- Confirmation manuelle par admin requise

## Administration

- **Dashboard**: `/admin/billing-v2`
- **Playbook interne**: `/admin/billing-playbook`
- **Alertes système**: Table `billing_system_alerts` (temps réel)

## Migration Legacy

La fonction `billing-migrate-clients` migre les clients existants:
1. Lit les commandes `completed`/`paid` de la table `orders`
2. Crée `billing_customer` par client unique
3. Crée `billing_subscription` (status = `pending`) par service
4. Génère facture initiale V2 (pending)
5. Le cycle s'active UNIQUEMENT quand admin confirme le premier paiement V2

**Mode dry_run**: `{ "dry_run": true }` pour prévisualiser sans créer

---

## Contact

Nivra Telecom - Support technique
Email: Support@nivratelecom.ca
