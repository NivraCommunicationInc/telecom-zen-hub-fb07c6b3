/**
 * FieldProtectedRoute — Guards all /field/* routes.
 * Requires: authenticated + active role + can_access_field + MFA verified.
 */
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkMfaStatus } from "@/lib/security/mfaUtils";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { auditAccess } from "@/lib/security/internalAuditLogger";
import { Loader2, ShieldAlert } from "lucide-react";

type State = "loading" | "authorized" | "unauthorized" | "mfa_enroll" | "mfa_verify";

export default function FieldProtectedRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/hub/login", { replace: true });
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
      <div className="min-h-screen flex items-center justify-center bg-[hsl(225,20%,5%)]">
        <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
      </div>
    );
  }

  if (state === "mfa_enroll") {
    return (
      <MfaEnrollmentDialog
        onComplete={() => window.location.reload()}
        onCancel={async () => { await supabase.auth.signOut(); navigate("/hub/login", { replace: true }); }}
      />
    );
  }

  if (state === "mfa_verify" && factorId) {
    return (
      <MfaVerificationGate
        factorId={factorId}
        onVerified={() => { setState("authorized"); auditAccess("portal_entry", "field"); }}
        onLogout={async () => { await supabase.auth.signOut(); navigate("/hub/login", { replace: true }); }}
      />
    );
  }

  if (state === "unauthorized") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(225,20%,5%)]">
        <div className="text-center">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-red-400" />
          <h2 className="text-lg font-semibold text-white mb-1">Accès refusé</h2>
          <p className="text-sm text-[hsl(220,10%,45%)] mb-4">Vous n'avez pas accès au portail Field.</p>
          <button onClick={() => navigate("/hub")} className="text-sm text-amber-400 hover:underline">
            Retour au Hub
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
