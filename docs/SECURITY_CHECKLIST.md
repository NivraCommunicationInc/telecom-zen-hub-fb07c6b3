# Security Regression Prevention Checklist

**Last Updated:** 2026-01-08
**Status:** All security warnings resolved or documented as Accepted Risk

This document defines security rules that MUST be followed to prevent regressions.

## Summary of Fixes Applied

| Warning | Status | Fix Applied |
|---------|--------|-------------|
| Staff tokens in localStorage | ✅ **FIXED** | Migrated to InMemoryStorage - zero persistence |
| Extension in public | ⚠️ **Accepted Risk** | Cannot modify (see proof below) - documented |
| RLS Policy Always True | ✅ **FIXED** | 28 tables have explicit DENY for anon |
| Business contact info exposed | ✅ **FIXED** | Using `site_settings_public` secure view |
| Pricing strategy visible | ✅ **FIXED** | Using `site_offers_public` secure view |

---

## 1. Session Token Storage — FIXED ✅

### Implementation
All auth clients now use `InMemoryStorage` with:
- `persistSession: false`
- `autoRefreshToken: false`
- `storage: inMemoryStorage` (custom in-memory adapter)

### Files Modified
- `src/lib/inMemoryStorage.ts` — New secure storage adapter
- `src/integrations/supabase/adminClient.ts`
- `src/integrations/supabase/portalClient.ts`
- `src/integrations/backend/adminClient.ts`
- `src/integrations/backend/portalClient.ts`
- `src/integrations/backend/client.ts`

### Verification
After login, `verifyNoStoredTokens()` is called automatically and logs:
```
[SECURITY] ✅ No session tokens found in browser storage
```

### Trade-off
Users must re-login after page refresh. This is the security cost for zero persistent token storage.

---

## 2. Extension in Public — ACCEPTED RISK ⚠️

### Proof of Non-Modifiability
Attempted migration failed with:
```
ERROR: 42501: must be owner of schema net
```

The `net` schema is owned by `supabase_admin` (Lovable Cloud managed). We cannot:
- Move the extension (`ALTER EXTENSION pg_net SET SCHEMA extensions`)
- Revoke privileges (`REVOKE ... FROM PUBLIC` fails with same error)

### Mitigation Applied
1. **Edge functions only**: All `net.http_*` calls are made via edge functions (service_role)
2. **No direct client access**: Frontend code never calls `net.*` directly
3. **RLS on all tables**: Even if `net.*` were exploited, RLS protects data

### Risk Assessment
- **Impact**: Low — `net.*` functions are HTTP helpers, not data access
- **Likelihood**: Low — requires authenticated user + knowledge of function signatures
- **Residual Risk**: Accepted with documentation

---

## 3. RLS Policies — VERIFIED ✅

### Tables with DENY for anon (28 total)
Verified via query:
```sql
SELECT tablename FROM pg_policies 
WHERE qual::text = 'false' AND 'anon' = ANY(roles::text[]);
```

**Result:**
- account_service_locations
- accounts
- activity_logs
- appointments
- authorized_users
- billing
- channel_selections
- client_activity_logs
- client_documents
- client_internal_notes
- client_streaming_subscriptions
- contracts
- employees
- equipment_order_lines
- fulfillment_snapshots
- ledger_entries
- ledger_invoice_allocations
- messages
- monthly_invoices
- orders
- payment_methods
- profiles
- replacement_internal_orders
- replacement_request_tickets
- subscriptions
- support_tickets
- technicians
- work_orders

---

## 4. Public Data Exposure — FIXED ✅

### Secure Public Views
- `site_settings_public` — Excludes internal metadata
- `site_offers_public` — Excludes pricing strategy

### ❌ NEVER
- Expose `updated_by_id`, `created_by_id` to anon
- Include internal pricing/margins in frontend

### ✅ ALWAYS
- Use `*_public` views for anonymous access
- Views use `WITH (security_invoker = true)`

---

## Pre-Commit Checklist

### Database Changes
- [ ] Run `supabase--linter` before merge
- [ ] Verify no `USING (true)` for anon/authenticated on sensitive tables
- [ ] Add DENY policy for anon on any new sensitive table
- [ ] Never install extensions in `public` schema

### Frontend Changes
- [ ] No `localStorage.setItem` or `sessionStorage.setItem` for tokens
- [ ] Use only `inMemoryStorage` for auth clients
- [ ] Call `verifyNoStoredTokens()` in security-critical flows
- [ ] Public pages use only `*_public` views

### E2E Tests
- `e2e/security-token-check.spec.ts` — Verify no stored tokens
- Anonymous access tests — Verify RLS denies anon

---

## Related Files

- `src/lib/inMemoryStorage.ts` - Secure in-memory storage adapter
- `src/integrations/supabase/adminClient.ts` - Admin auth (InMemoryStorage)
- `src/integrations/supabase/portalClient.ts` - Client auth (InMemoryStorage)
- `src/integrations/backend/adminClient.ts` - Admin backend (InMemoryStorage)
- `src/integrations/backend/portalClient.ts` - Client backend (InMemoryStorage)
- `src/integrations/backend/client.ts` - General backend (InMemoryStorage)

---

## Audit Trail

| Date | Action | Proof |
|------|--------|-------|
| 2026-01-08 | Migrated to InMemoryStorage | `verifyNoStoredTokens()` logs ✅ |
| 2026-01-08 | Added 28 DENY policies for anon | SQL query verified |
| 2026-01-08 | pg_net accepted as risk | Error: `must be owner of schema net` |
| 2026-01-08 | Created secure public views | `site_*_public` views |
