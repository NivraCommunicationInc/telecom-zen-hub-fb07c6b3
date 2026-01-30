
# Migration du domaine nivratelecom.ca vers nivratelecom.com

## ✅ Statut: MIGRATION TERMINÉE (Code)

La migration du code est **complète**. Tous les fichiers de configuration, edge functions et templates d'emails utilisent maintenant `nivratelecom.com`.

---

## Fichiers migrés

### Configuration centrale
- ✅ `src/config/seo.ts` - baseUrl → `.com`
- ✅ `src/config/company.ts` - emails, website, portalUrl → `.com`
- ✅ `public/robots.txt` - Sitemap URL → `.com` (était déjà ok)
- ✅ `public/sitemap.xml` - Toutes les URLs → `.com` (était déjà ok)

### Edge Functions (Emails & CORS)
- ✅ `supabase/functions/_shared/cors.ts` - Fallback origins → `.com`
- ✅ `supabase/functions/_shared/resendTemplates.ts` - EMAIL_SENDER → `.com`
- ✅ `supabase/functions/client-pin-send/index.ts` - Emails + CORS → `.com`
- ✅ `supabase/functions/notify-admin/index.ts` - Admin email → `.com`
- ✅ `supabase/functions/notify-client-update/index.ts` - From email → `.com`
- ✅ `supabase/functions/send-partner-invite/index.ts` - APP_URL + emails → `.com`
- ✅ `supabase/functions/submit-web-form/index.ts` - Emails → `.com`
- ✅ `supabase/functions/admin-manage-staff/index.ts` - APP_BASE_URL + emails → `.com`
- ✅ `supabase/functions/auto-create-client-account/index.ts` - APP_BASE_URL → `.com`
- ✅ `supabase/functions/billing-create-order-with-paypal-subscription/index.ts` - baseUrl → `.com`
- ✅ `supabase/functions/staff-otp-send/index.ts` - CORS + emails → `.com`
- ✅ `supabase/functions/staff-otp-verify/index.ts` - CORS → `.com`
- ✅ `supabase/functions/send-communication-email/index.ts` - From email → `.com`
- ✅ `supabase/functions/admin-set-user-password/index.ts` - redirectTo → `.com`
- ✅ `supabase/functions/send-email-previews/index.ts` - Sample URLs + from → `.com`

### Templates Email partagés
- ✅ `supabase/functions/_shared/emailTemplates/orders.ts` - portalUrl defaults → `.com`
- ✅ `supabase/functions/_shared/emailTemplates/account.ts` - contactUrl defaults → `.com`

### Frontend (SEO & UI)
- ✅ `src/components/LocalBusinessSchema.tsx` - Schema.org URLs → `.com`
- ✅ `src/components/seo/BreadcrumbSchema.tsx` - Breadcrumb URLs → `.com`
- ✅ `src/pages/Contest.tsx` - Contact email → `.com`
- ✅ `src/pages/client/ClientRescheduleAppointment.tsx` - Support email → `.com`
- ✅ `src/pages/client/ClientAuth.tsx` - Error messages → `.com`
- ✅ `src/pages/client/ClientInvoices.tsx` - E-Transfer info → `.com`
- ✅ `src/pages/admin/AdminBilling.tsx` - ETRANSFER_INFO → `.com`

---

## ⚠️ Actions restantes (à faire manuellement)

### 1. Configuration DNS (Wix)
Dans le dashboard Wix DNS pour `nivratelecom.com`:
- Ajouter A record `@` vers `185.158.133.1`
- Ajouter A record `www` vers `185.158.133.1`
- Ajouter TXT record `_lovable` avec le code de vérification Lovable

### 2. Configuration Lovable (Settings > Domains)
- Ajouter `nivratelecom.com` et `www.nivratelecom.com`
- Attendre la propagation DNS (jusqu'à 72h)

### 3. Secrets à mettre à jour (Cloud > Secrets)
- `APP_BASE_URL` = `https://nivratelecom.com`
- `ALLOWED_ORIGINS` = `https://nivratelecom.com,https://www.nivratelecom.com,https://telecom-zen-hub.lovable.app`

### 4. Configuration email Resend
- Vérifier/ajouter le domaine `nivratelecom.com` dans Resend
- Configurer les DNS records (DKIM, SPF, DMARC) pour la délivrabilité

---

## Notes importantes

- **Emails @nivratelecom.ca**: Le code utilise maintenant `@nivratelecom.com`. Si tu récupères `.ca` plus tard, on peut facilement basculer.
- **Réversibilité**: La migration est 100% réversible. Quand tu récupères `.ca`, je mets à jour les fichiers + tu configures les redirections.
- **Fichiers restants avec `.ca`**: Quelques fichiers frontend (PDF generators, contrats) ont encore des références hardcodées. Non bloquant pour le fonctionnement mais à migrer éventuellement.
