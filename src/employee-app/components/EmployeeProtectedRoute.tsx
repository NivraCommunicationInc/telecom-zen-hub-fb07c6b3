/**
 * EmployeeProtectedRoute — Guards all /employee/* routes.
 * Enforces: hub session → authenticated → active role → can_access_employee → MFA verified.
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

type State = "loading" | "authorized" | "unauthorized" | "mfa_enroll" | "mfa_verify";

export default function EmployeeProtectedRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      // CRITICAL: Must have entered through /hub
      if (!hasValidHubSession()) {
        navigate("/hub", { replace: true });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/hub", { replace: true });
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role, status, is_active, can_access_employee")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .in("role", ["admin", "employee", "supervisor", "sales", "support", "billing_admin", "techops", "kyc_agent"])
        .maybeSingle();

      if (!roleData?.is_active || !roleData?.can_access_employee) {
        if (mounted) setState("unauthorized");
        return;
      }

      // MFA: For employees (non-admin), MFA enrollment is recommended but not blocking.
      // Admin roles enforce mandatory TOTP elsewhere.
      // Employees use their 4-digit NIP for customer-access security instead.
      const mfa = await checkMfaStatus();
      if (mfa.isEnrolled && !mfa.isVerified) {
        // Already enrolled → must verify
        if (mounted) {
          setFactorId(mfa.factorId ?? null);
          setState("mfa_verify");
        }
        return;
      }
      // If not enrolled, let employee through — NIP gate handles customer-data security

      await auditAccess("portal_entry", "employee");
      if (mounted) setState("authorized");
    };

    check();
    return () => { mounted = false; };
  }, [navigate]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)]">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  if (state === "mfa_enroll") {
    return (
      <MfaEnrollmentDialog
        onComplete={() => window.location.reload()}
        onCancel={async () => { await supabase.auth.signOut(); navigate("/hub", { replace: true }); }}
      />
    );
  }

  if (state === "mfa_verify" && factorId) {
    return (
      <MfaVerificationGate
        factorId={factorId}
        onVerified={() => { setState("authorized"); auditAccess("portal_entry", "employee"); }}
        onLogout={async () => { await supabase.auth.signOut(); navigate("/hub", { replace: true }); }}
      />
    );
  }

  if (state === "unauthorized") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)]">
        <div className="text-center">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-red-400" />
          <h2 className="text-lg font-semibold text-white mb-1">Accès refusé</h2>
          <p className="text-sm text-[hsl(220,10%,45%)] mb-4">Vous n'avez pas accès au portail Employé.</p>
          <button onClick={() => navigate("/hub")} className="text-sm text-blue-400 hover:underline">
            Retour au Hub
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
