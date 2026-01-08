# Security Regression Prevention Checklist

This document defines security rules that MUST be followed to prevent regressions.

## 1. Session Token Storage

### ❌ NEVER
- Store custom auth tokens in `localStorage` or `sessionStorage`
- Create new localStorage keys for authentication tokens

### ✅ ALWAYS
- Use Supabase built-in auth which manages tokens securely
- For staff portals, tokens have 8-hour expiry and server-side validation
- Trust window cookies for device remembrance are time-limited (20 min)

### Current Implementation
- Admin/Employee/Client portals use Supabase JS SDK auth storage
- Known limitation: Supabase JS SDK uses localStorage by default
- Mitigation: Short expiry, server-side validation on every edge function call

---

## 2. RLS Policies

### ❌ NEVER
- Use `USING (true)` or `WITH CHECK (true)` for tables accessible by `authenticated` users
- Create tables with RLS enabled but no policies
- Allow `anon` users direct access to tables with internal metadata

### ✅ ALWAYS
- Use `TO service_role` when policies need `USING (true)` (system tables only)
- Verify all new tables have proper RLS policies before merging
- Use `has_role()` or similar security definer functions for role checks

### System Tables (service_role only)
These tables use `USING (true)` but are restricted to `service_role`:
- `email_queue`
- `rate_limits`
- `rate_limit_attempts`
- `rate_limit_lockouts`
- `client_login_pins`
- `staff_otp_codes`
- `admin_audit_log`
- `security_incidents`

---

## 3. PostgreSQL Extensions

### ❌ NEVER
- Install new extensions in the `public` schema

### ✅ ALWAYS
- Use the `extensions` schema for new extensions
- Exception: `pg_net` is a Supabase system extension that cannot be moved

---

## 4. Public Data Exposure

### ❌ NEVER
- Expose internal metadata (`created_by_id`, `updated_by_id`, etc.) to anonymous users
- Allow direct table access when a secure view exists
- Include internal pricing logic/margins in frontend code

### ✅ ALWAYS
- Use secure views (`*_public`) for anonymous access
- Views must use `WITH (security_invoker = true)`
- Frontend should use `site_settings_public` and `site_offers_public` views

### Secure Public Views
- `site_settings_public` - Excludes: `updated_by_id`, `updated_by_name`, `updated_by_role`, `is_public`
- `site_offers_public` - Excludes: `created_by_id`, `created_by_name`, `updated_by_id`, `updated_by_name`, `updated_by_role`, `is_active`

---

## 5. Payment/Transaction Security

### ❌ NEVER
- Create ledger entries for unconfirmed payments
- Allow client-side modification of payment amounts

### ✅ ALWAYS
- Only create `PAYMENT` ledger entries when status is `captured`/`paid`/`complete`/`confirmed`
- Validate all payment operations server-side

---

## Pre-Commit Checklist

Before merging any database changes:
- [ ] Run Supabase linter: `supabase db lint`
- [ ] Verify no `USING (true)` for authenticated users
- [ ] Verify no tables with RLS enabled but no policies
- [ ] Verify extensions are not in `public` schema
- [ ] Verify no internal metadata exposed to anonymous users

Before merging any frontend changes:
- [ ] Search for new `localStorage.setItem` calls with auth tokens
- [ ] Verify no pricing strategy logic in client code
- [ ] Verify use of `*_public` views for anonymous data access

---

## Related Files

- `src/hooks/useSiteSettings.tsx` - Uses `site_settings_public` view
- `src/hooks/useSiteOffers.tsx` - Uses `site_offers_public` view
- `src/integrations/backend/adminClient.ts` - Admin auth storage
- `src/integrations/backend/portalClient.ts` - Client auth storage
