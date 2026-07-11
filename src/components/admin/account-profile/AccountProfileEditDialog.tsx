/**
 * AccountProfileEditDialog (admin legacy)
 * ---------------------------------------
 * MODULE 50 — Phase B2 (fusion).
 *
 * This dialog used to embed its own copy of the identity / email / phone
 * editing UI. It is now a THIN WRAPPER around the canonical Core dialog
 * `Account360ProfileEditDialog`, which is the single source of truth.
 *
 * ⚠️  DO NOT re-introduce direct writes here.
 * All identity mutations MUST go through the `client-account-actions`
 * edge function via `callCoreAction`:
 *   - profile.update
 *   - email.request_change / email.confirm_change
 *   - phone.request_change / phone.verify_otp
 *   - service_address.* / billing_address.*
 *
 * Any new mutation surface MUST be added inside `Account360ProfileEditDialog`
 * (or a dedicated Core 360 module), NEVER inline in this admin shell.
 * Bypasses (`.from('profiles').update`, `.from('accounts').update`,
 * writes to legacy `accounts.billing_*` / `accounts.primary_service_*`
 * columns) are forbidden — the CI scan in Module 50 will fail if any
 * appear under `src/components/admin/account-profile/`.
 */
import { Account360ProfileEditDialog } from "@/core-app/components/account-360/Account360ProfileEditDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  account: any;
  clientId: string;
  onSaved: () => void;
}

export function AccountProfileEditDialog(props: Props) {
  // Delegate to the canonical Core 360 dialog. `isAdminCore` unlocks the
  // admin-only affordances (identity relock bypass, protected field edits).
  return <Account360ProfileEditDialog {...props} isAdminCore />;
}

export default AccountProfileEditDialog;
