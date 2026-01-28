
# Migration du domaine nivratelecom.ca vers nivratelecom.com

## Contexte
Tu as acheté le domaine `nivratelecom.com` via Wix mais les DNS ne sont pas encore configurés. Plusieurs fichiers et configurations du projet font toujours reference au domaine `.ca` ce qui causera des problemes.

---

## 1. Impact critique - Ce qui ne fonctionne PAS actuellement

### Configuration SEO (affecte le referencement Google)
| Fichier | Probleme |
|---------|----------|
| `src/config/seo.ts` | `baseUrl: "https://nivratelecom.ca"` - URLs canoniques incorrectes |
| `public/robots.txt` | Sitemap pointe vers `nivratelecom.ca/sitemap.xml` |
| `public/sitemap.xml` | Toutes les URLs pointent vers `.ca` (30+ URLs) |

### Configuration Entreprise (affecte emails et liens)
| Fichier | Probleme |
|---------|----------|
| `src/config/company.ts` | `website`, `portalUrl`, emails `@nivratelecom.ca` |

### Edge Functions (affecte les appels API)
| Fichier | Probleme |
|---------|----------|
| `supabase/functions/_shared/cors.ts` | Fallback CORS vers `.ca` |
| `supabase/functions/_shared/resendTemplates.ts` | Emails envoyes depuis `@nivratelecom.ca` |
| `src/lib/serviceEmailPayloadBuilder.ts` | `PORTAL_BASE_URL` pointe vers `.ca` |
| Plusieurs Edge Functions | Fallback `SITE_URL` / `APP_BASE_URL` vers `.ca` |

### Templates Emails (liens brises dans les emails envoyes)
| Fichier | Probleme |
|---------|----------|
| `supabase/functions/_shared/emailTemplates/components.ts` | Liens hardcodes vers `.ca` |

---

## 2. Secrets Supabase a mettre a jour

Ces secrets contiennent probablement des references au domaine `.ca`:

| Secret | Action |
|--------|--------|
| `APP_BASE_URL` | Changer vers `https://nivratelecom.com` |
| `ALLOWED_ORIGINS` | Ajouter `nivratelecom.com` et retirer `.ca` |
| `SUPPORT_EMAIL` | Verifier si reste `@nivratelecom.ca` ou devient `@nivratelecom.com` |

---

## 3. Plan de migration en 3 phases

### Phase 1 - Configuration Lovable + DNS Wix
1. Aller dans **Settings > Domains** dans Lovable
2. Ajouter `nivratelecom.com` et `www.nivratelecom.com`
3. Dans le dashboard Wix DNS:
   - Ajouter A record `@` vers `185.158.133.1`
   - Ajouter A record `www` vers `185.158.133.1`
   - Ajouter TXT record `_lovable` avec le code fourni par Lovable
4. Attendre la verification (jusqu'a 72h)

### Phase 2 - Mise a jour du code (13 fichiers)

**Fichiers de configuration centraux:**
- `src/config/seo.ts` - baseUrl
- `src/config/company.ts` - website, portalUrl
- `public/robots.txt` - URL sitemap
- `public/sitemap.xml` - Toutes les URLs

**Edge Functions (fallbacks):**
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/resendTemplates.ts`
- `src/lib/serviceEmailPayloadBuilder.ts`
- `supabase/functions/_shared/emailTemplates/components.ts`
- Autres edge functions avec fallbacks hardcodes

### Phase 3 - Mise a jour des Secrets
Via le panel Cloud > Secrets:
- `APP_BASE_URL` = `https://nivratelecom.com`
- `ALLOWED_ORIGINS` = `https://nivratelecom.com,https://www.nivratelecom.com,https://telecom-zen-hub.lovable.app`

---

## 4. Question importante: Emails @nivratelecom.ca

Les emails (`support@nivratelecom.ca`) sont utilises partout. Options:
- **Option A**: Garder `@nivratelecom.ca` pour les emails (si tu as encore le domaine email configure)
- **Option B**: Migrer vers `@nivratelecom.com` (necessite configuration email chez Wix + Resend)

---

## Section technique - Fichiers a modifier

```text
src/config/seo.ts (ligne 36)
src/config/company.ts (lignes 8-9, 17-18, 32-33, 45-46)
public/robots.txt (lignes 2, 18)
public/sitemap.xml (toutes les URLs - 30+ occurrences)
supabase/functions/_shared/cors.ts (lignes 24-25)
supabase/functions/_shared/resendTemplates.ts (lignes 69-70)
supabase/functions/_shared/emailTemplates/components.ts (~10 URLs)
src/lib/serviceEmailPayloadBuilder.ts (ligne 85)
+ Fallbacks dans ~10 edge functions
```

**Estimation**: ~50-60 changements de `.ca` vers `.com` repartis sur 15+ fichiers
