/**
 * FieldProtectedRoute — Guards all /field/* routes.
 * Enforces: hub session → authenticated → active role → can_access_field → MFA verified.
 * Redirects to /hub if not entered through the hub.
 */
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkMfaStatus } from "@/lib/security/mfaUtils";
import { hasValidHubSession } from "@/lib/security/hubSession";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { auditAccess } from "@/lib/security/internalAuditLogger";
import { Loader2, ShieldAlert } from "lucide-react";
import { isActiveStaffImpersonationForPortal } from "@/lib/staffAssistance";

type State = "loading" | "authorized" | "unauthorized" | "mfa_enroll" | "mfa_verify";

export default function FieldProtectedRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      // CRITICAL: Must have entered through /hub
      if (!hasValidHubSession()) {
        navigate("/nivra-secure-hub-2617-internal", { replace: true });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/nivra-secure-hub-2617-internal", { replace: true });
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, status, is_active, can_access_field")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!roleData?.is_active || !roleData?.can_access_field) {
        if (mounted) setState("unauthorized");
        return;
      }

      const bypassMfa = await isActiveStaffImpersonationForPortal(session.user.id, "field");
      if (bypassMfa) {
        await auditAccess("portal_entry", "field");
        if (mounted) setState("authorized");
        return;
      }

      const mfa = await checkMfaStatus();
      if (!mfa.isEnrolled) {
        if (mounted) setState("mfa_enroll");
        return;
      }
      if (!mfa.isVerified) {
        if (mounted) {
          setFactorId(mfa.factorId ?? null);
          setState("mfa_verify");
        }
        return;
      }

      await auditAccess("portal_entry", "field");
      if (mounted) setState("authorized");
    };

    check();
    return () => { mounted = false; };
  }, [navigate]);

  if (state === "loading") {
    return (
      <div className="internal-ui min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "mfa_enroll") {
    return (
      <MfaEnrollmentDialog
        onComplete={() => window.location.reload()}
        onCancel={async () => { await supabase.auth.signOut(); navigate("/nivra-secure-hub-2617-internal", { replace: true }); }}
      />
    );
  }

  if (state === "mfa_verify" && factorId) {
    return (
      <MfaVerificationGate
        factorId={factorId}
        onVerified={() => { setState("authorized"); auditAccess("portal_entry", "field"); }}
        onLogout={async () => { await supabase.auth.signOut(); navigate("/nivra-secure-hub-2617-internal", { replace: true }); }}
      />
    );
  }

  if (state === "unauthorized") {
    return (
      <div className="internal-ui min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-semibold text-gray-50 mb-1">Accès refusé</h2>
          <p className="text-sm text-gray-400 mb-4">Vous n'avez pas accès au portail Field.</p>
          <button onClick={() => navigate("/nivra-secure-hub-2617-internal")} className="text-sm text-primary hover:opacity-80">
            Retour au Hub
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
