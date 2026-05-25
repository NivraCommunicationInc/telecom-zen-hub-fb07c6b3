/**
 * HrProtectedRoute — Guards all /hr/* routes.
 * Enforces: hub session → authenticated → active role → can_access_rh → MFA verified.
 * All employees, technicians, field_sales, and admins can access the HR portal.
 */
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkMfaStatus } from "@/lib/security/mfaUtils";
import { hasValidHubSession } from "@/lib/security/hubSession";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { auditAccess } from "@/lib/security/internalAuditLogger";
import { Loader2, ShieldAlert } from "lucide-react";
import { isActiveStaffImpersonationForPortal } from "@/lib/staffAssistance";

type State = "loading" | "authorized" | "unauthorized" | "mfa_enroll" | "mfa_verify";

export default function HrProtectedRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);

  const requestedPath = `${location.pathname}${location.search}${location.hash}`;
  const recruitmentRedirectMap: Record<string, string> = {
    "/hr/postes": "/core/hr/careers",
    "/hr/candidatures": "/core/hr/applications",
    "/hr/applications": "/core/hr/applications",
    "/hr/entrevues": "/core/hr/interviews",
  };
  const coreRecruitmentTarget = recruitmentRedirectMap[location.pathname];
  const loginPortal = coreRecruitmentTarget ? "core" : "rh";
  const loginRedirect = coreRecruitmentTarget ?? requestedPath;
  const loginPath = `/nivra-secure-hub-2617-internal/login?portal=${loginPortal}&redirect=${encodeURIComponent(loginRedirect)}`;

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      if (!hasValidHubSession()) {
        navigate(loginPath, { replace: true });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate(loginPath, { replace: true });
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

      const bypassMfa = await isActiveStaffImpersonationForPortal(session.user.id, "rh");
      if (bypassMfa) {
        await auditAccess("portal_entry", "rh");
        if (mounted) setState("authorized");
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
  }, [navigate, loginPath]);

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
        onCancel={async () => { await supabase.auth.signOut(); navigate("/nivra-secure-hub-2617-internal", { replace: true }); }}
      />
    );
  }

  if (state === "mfa_verify" && factorId) {
    return (
      <MfaVerificationGate
        factorId={factorId}
        onVerified={() => { setState("authorized"); auditAccess("portal_entry", "rh"); }}
        onLogout={async () => { await supabase.auth.signOut(); navigate("/nivra-secure-hub-2617-internal", { replace: true }); }}
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
          <button onClick={() => navigate("/nivra-secure-hub-2617-internal")} className="text-sm text-primary hover:opacity-80">
            Retour au Hub
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
