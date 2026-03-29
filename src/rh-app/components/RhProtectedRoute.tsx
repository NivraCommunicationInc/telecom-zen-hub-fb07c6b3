/**
 * RhProtectedRoute — Guards all /rh/* routes.
 * Enforces: hub session → authenticated → active role → can_access_rh → MFA verified.
 * All employees, technicians, field_sales, and admins can access the RH portal.
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

export default function RhProtectedRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
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
        .select("role, status, is_active, can_access_rh")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!roleData?.is_active) {
        if (mounted) setState("unauthorized");
        return;
      }

      // Check can_access_rh flag (defaults to true for all staff)
      if (roleData.can_access_rh === false) {
        if (mounted) setState("unauthorized");
        return;
      }

      // MFA: if enrolled must verify, if not enrolled let through
      const mfa = await checkMfaStatus();
      if (mfa.isEnrolled && !mfa.isVerified) {
        if (mounted) {
          setFactorId(mfa.factorId ?? null);
          setState("mfa_verify");
        }
        return;
      }

      await auditAccess("portal_entry", "rh");
      if (mounted) setState("authorized");
    };

    check();
    return () => { mounted = false; };
  }, [navigate]);

  if (state === "loading") {
    return (
      <div className="internal-ui min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
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
        onVerified={() => { setState("authorized"); auditAccess("portal_entry", "rh"); }}
        onLogout={async () => { await supabase.auth.signOut(); navigate("/hub", { replace: true }); }}
      />
    );
  }

  if (state === "unauthorized") {
    return (
      <div className="internal-ui min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground mb-1">Accès refusé</h2>
          <p className="text-sm text-muted-foreground mb-4">Vous n'avez pas accès au portail RH.</p>
          <button onClick={() => navigate("/hub")} className="text-sm text-primary hover:opacity-80">
            Retour au Hub
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
