# Configuration Email Nivra Telecom

## ✅ MIGRATION COMPLÈTE vers support@nivra-telecom.ca

Toutes les références email dans le code utilisent maintenant `support@nivra-telecom.ca`.

---

## Fichiers migrés

### Configuration centrale
- ✅ `src/config/company.ts` - supportEmail, paymentEmail → `support@nivra-telecom.ca`
- ✅ `src/config/partnerContact.ts` - PARTNER_SUPPORT_EMAIL → `Support@nivra-telecom.ca`
- ✅ `src/config/seo.ts` - baseUrl → `nivra-telecom.ca`

### Frontend (SEO, UI, Pages légales)
- ✅ `src/components/LocalBusinessSchema.tsx` - Schema.org URLs → `nivra-telecom.ca`
- ✅ `src/components/seo/BreadcrumbSchema.tsx` - URLs → `nivra-telecom.ca`
- ✅ `src/components/seo/ProductSchema.tsx` - URLs → `nivra-telecom.ca`
- ✅ `src/components/Footer.tsx` - Email depuis config
- ✅ `src/pages/legal/PrivacyPolicyPage.tsx` - Email → `support@nivra-telecom.ca`
- ✅ `src/pages/legal/TermsAndConditions.tsx` - Email → `support@nivra-telecom.ca`
- ✅ `src/pages/client/ClientRescheduleAppointment.tsx` - Email → `support@nivra-telecom.ca`
- ✅ `src/pages/client/ClientDocumentUpload.tsx` - Email → `support@nivra-telecom.ca`
- ✅ `src/pages/admin/AdminAuditLog.tsx` - Placeholder → `admin@nivra-telecom.ca`
- ✅ `src/pages/admin/AdminPDFTest.tsx` - Email → `support@nivra-telecom.ca`
- ✅ `src/pages/admin/AdminEmailActivity.tsx` - Emails et DNS config → `nivra-telecom.ca`
- ✅ `src/components/admin/users/CreateEmployeeDialog.tsx` - Placeholder → `@nivra-telecom.ca`
- ✅ `src/components/admin/field-sales/CreateRepresentativeDialog.tsx` - Placeholder → `@nivra-telecom.ca`

### PDF Generators
- ✅ `src/lib/prepaidContractGenerator.ts` - Email → `support@nivra-telecom.ca`
- ✅ `src/lib/fieldSalesInvoiceGenerator.ts` - Email → `support@nivra-telecom.ca`
- ✅ `src/lib/pdfEngine/sampleData.ts` - Sample agent email → `@nivra-telecom.ca`

### Edge Functions
- ✅ `supabase/functions/_shared/cors.ts` - Fallback origins → `nivra-telecom.ca`
- ✅ `supabase/functions/submit-web-form/index.ts` - Emails → `support@nivra-telecom.ca`
- ✅ `supabase/functions/send-partner-invite/index.ts` - Emails → `support@nivra-telecom.ca`
- ✅ `supabase/functions/send-communication-email/index.ts` - From → `communication@nivra-telecom.ca`
- ✅ `supabase/functions/admin-manage-staff/index.ts` - APP_BASE_URL → `nivra-telecom.ca`
- ✅ `supabase/functions/staff-otp-send/index.ts` - From → `noreply@nivra-telecom.ca`
- ✅ `supabase/functions/client-pin-send/index.ts` - Domain → `nivra-telecom.ca`
- ✅ `supabase/functions/send-email-previews/index.ts` - From → `support@nivra-telecom.ca`
- ✅ `supabase/functions/process-email-queue/index.ts` - Emails → `support@nivra-telecom.ca`
- ✅ `supabase/functions/send-template-test/index.ts` - Emails → `support@nivra-telecom.ca`
- ✅ `supabase/functions/notify-admin-alert/index.ts` - From → `admin@nivra-telecom.ca`
- ✅ `supabase/functions/billing-create-order/index.ts` - Payment email → `support@nivra-telecom.ca`
- ✅ `supabase/functions/chatbot-jonathan/index.ts` - Support email → `support@nivra-telecom.ca`

### Tests E2E
- ✅ `playwright.config.ts` - Test email → `test@nivra-telecom.ca`
- ✅ `e2e/support-contact-regression.spec.ts` - Assertion → `nivra-telecom.ca`

---

## Configuration actuelle

### Domaine primaire
- **Site web**: `https://nivra-telecom.ca`
- **Email support**: `support@nivra-telecom.ca`

### Resend (Email)
- Domaine vérifié: `nivra-telecom.ca`
- Sous-domaine d'envoi: `send.nivra-telecom.ca`

### Secrets Lovable Cloud
- `APP_BASE_URL` = `https://nivra-telecom.ca`
- `ALLOWED_ORIGINS` = `https://nivra-telecom.ca,https://www.nivra-telecom.ca,https://telecom-zen-hub.lovable.app`
- `SUPPORT_EMAIL` = `support@nivra-telecom.ca`
