# Nivra Telecom — Plan de Reprise après Sinistre (DR)

**Révision:** 2026-06-13 | **Approuvé par:** Lavau (Fondateur)

---

## 1. Objectifs RPO / RTO

| Composant | RPO (perte max) | RTO (temps de reprise) |
|---|---|---|
| Base de données (Supabase) | 24h (daily backup) → 1s (PITR activé) | < 30 min |
| Fonctions Edge (Deno) | 0 (code dans GitHub) | < 10 min (redeploy) |
| Frontend (Lovable/Vercel) | 0 (code dans GitHub) | < 5 min (redeploy) |
| Stockage S3/R2 | 0 (géré par AWS/Cloudflare) | N/A |
| OpenPhone | 0 (SaaS externe) | N/A |

---

## 2. Backups actifs

### Base de données Supabase
- **Snapshots journaliers** : automatiques, 7 jours de rétention (confirmé actif)
- **PITR** : désactivé → **ACTION REQUISE** : activer dans Supabase Dashboard > Settings > Backups
  - Une fois activé : RPO = quelques secondes
- **Export S3 quotidien** : via `daily-backup-export` (s'exécute à 10:00 UTC), exports CSV vers AWS S3

### Code source
- **GitHub** : `NivraCommunicationInc/telecom-zen-hub-fb07c6b3` (branche `main`)
- **Fonctions Edge** : 301 fonctions dans `supabase/functions/`, redéployables en < 10 min

---

## 3. Scénarios de panne et procédures

### Scénario A — Panne Supabase (base de données inaccessible)

**Détection** : NOC monitor détectera l'absence de réponse API en < 30 min.

**Procédure** :
1. Vérifier statut : https://status.supabase.com
2. Si panne Supabase : attendre restauration (SLA Supabase Pro = 99.9%)
3. Si corruption de données → restaurer depuis snapshot :
   ```
   Supabase Dashboard > Settings > Backups > Restore
   ```
4. Si PITR activé : sélectionner le point précis avant la corruption
5. Après restauration : redéployer toutes les fonctions pour synchroniser
   ```powershell
   cd C:\Users\Lavau\nivra-site
   supabase functions deploy --project-ref lacxnbjvcyvhrttprkxr
   ```

### Scénario B — Panne d'une fonction Edge

**Détection** : Erreurs dans Supabase Dashboard > Functions > Logs

**Procédure** :
1. Identifier la fonction en erreur via les logs
2. Corriger le code dans `supabase/functions/<nom>/index.ts`
3. Redéployer la fonction spécifique :
   ```powershell
   supabase functions deploy <nom-fonction> --project-ref lacxnbjvcyvhrttprkxr
   ```
4. Valider via Supabase Dashboard

### Scénario C — Corruption des données de facturation

**Procédure** :
1. Identifier la période affectée via `billing_system_alerts`
2. Restaurer depuis snapshot Supabase vers environnement de staging
3. Exporter les données saines en CSV
4. Importer les corrections avec transactions SQL atomiques
5. Vérifier via `revenue-assurance` function

### Scénario D — Compromission des clés API

**Procédure** :
1. Révoquer immédiatement dans Supabase Dashboard > Settings > API
2. Révoquer PayPal credentials dans le portail PayPal
3. Révoquer Resend API key
4. Régénérer et mettre à jour tous les secrets :
   ```powershell
   supabase secrets set NOM_SECRET=nouvelle_valeur --project-ref lacxnbjvcyvhrttprkxr
   ```
5. Redéployer toutes les fonctions pour charger les nouveaux secrets
6. Auditer les logs pour détecter usage malveillant

### Scénario E — Perte totale (destruction du projet Supabase)

**Procédure** :
1. Créer nouveau projet Supabase Pro
2. Restaurer backup physique depuis snapshot S3
3. Mettre à jour `.env` local + secrets dans le nouveau projet
4. Redéployer toutes les fonctions
5. Mettre à jour DNS si nécessaire
6. Notifier les clients via support@nivra-telecom.ca

**Temps estimé** : 2-4 heures

---

## 4. Contacts d'urgence

| Rôle | Contact |
|---|---|
| Responsable technique | support@nivra-telecom.ca |
| Support Supabase | https://supabase.com/support (ticket Pro) |
| Support PayPal | 1-888-221-1161 |
| Support AWS | https://console.aws.amazon.com/support |
| Support Cloudflare | https://dash.cloudflare.com/support |

---

## 5. Actions manuelles requises (OSS/Réseau)

Les secrets suivants sont absents et requièrent des valeurs réelles de l'équipement réseau :

| Secret | Description | Impact si absent |
|---|---|---|
| `OLT_API_URL` | URL API de l'OLT (Optical Line Terminal) | Provisioning fibre = manuel |
| `OLT_API_KEY` | Clé API OLT | Provisioning fibre = manuel |
| `RADIUS_API_URL` | URL serveur RADIUS | Provisioning PPPoE = manuel |
| `RADIUS_API_KEY` | Clé RADIUS | Provisioning PPPoE = manuel |

**À configurer** :
```powershell
supabase secrets set OLT_API_URL=https://votre-olt/api --project-ref lacxnbjvcyvhrttprkxr
supabase secrets set OLT_API_KEY=votre-cle --project-ref lacxnbjvcyvhrttprkxr
supabase secrets set RADIUS_API_URL=https://votre-radius/api --project-ref lacxnbjvcyvhrttprkxr
supabase secrets set RADIUS_API_KEY=votre-cle --project-ref lacxnbjvcyvhrttprkxr
```

---

## 6. Tests DR (à effectuer trimestriellement)

- [ ] Tester la restauration depuis snapshot Supabase (vers staging)
- [ ] Valider que `daily-backup-export` génère bien des fichiers S3
- [ ] Tester le redéploiement complet des 301 fonctions
- [ ] Vérifier que le NOC monitor détecte une panne simulée en < 30 min
- [ ] Valider les runbooks avec un incident simulé

---

## 7. PITR — Seuil d'activation

> ⏳ **RAPPEL : Activer PITR Supabase (7 jours = ~$100/mois) quand Nivra atteint 50 clients actifs.**
> Actuellement trop cher pour 13 clients. Réévaluer à chaque palier de 10 clients.

```
Supabase Dashboard → https://supabase.com/dashboard/project/lacxnbjvcyvhrttprkxr
→ Settings → Backups → Enable Point-in-Time Recovery
```

**En attendant :** snapshots journaliers (7 jours) + WAL archiving actifs — RPO = 24h max.
