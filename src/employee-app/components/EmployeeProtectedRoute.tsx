/**
 * EmployeeProtectedRoute — Guards all /employee/* routes.
 * Enforces: hub session → authenticated → active role → can_access_employee → MFA verified.
 * Redirects to /hub if not entered through the hub.
 * Periodic hub session re-check every 5 min + activity tracking mirrors CoreProtectedRoute.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkMfaStatus } from "@/lib/security/mfaUtils";
import { hasValidHubSession, touchHubSession } from "@/lib/security/hubSession";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { auditAccess } from "@/lib/security/internalAuditLogger";
import { Loader2, ShieldAlert } from "lucide-react";
import { isActiveStaffImpersonationForPortal } from "@/lib/staffAssistance";
import { isHrOnboardingComplete } from "@/lib/security/hrOnboardingGate";

type State = "loading" | "authorized" | "unauthorized" | "hr_pending" | "mfa_enroll" | "mfa_verify";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;
const ACTIVITY_THROTTLE_MS = 60_000;

export default function EmployeeProtectedRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const lastActivityRef = useRef(Date.now());

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
    lastActivityRef.current = now;
    touchHubSession();
  }, []);

  useEffect(() => {
    if (state !== "authorized") return;
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handleActivity, { passive: true });
    }
    const interval = setInterval(() => {
      if (!hasValidHubSession()) {
        navigate("/nivra-secure-hub-2617-internal", { replace: true });
      }
    }, 5 * 60 * 1000);
    return () => {
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, handleActivity);
      clearInterval(interval);
    };
  }, [state, navigate, handleActivity]);

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
        .select("role, status, is_active, can_access_employee")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .in("role", ["admin", "employee", "supervisor", "sales", "support", "billing_admin", "techops", "kyc_agent"])
        .maybeSingle();

      if (!roleData?.is_active || !roleData?.can_access_employee) {
        if (mounted) setState("unauthorized");
        return;
      }

      // HR onboarding gate
      const hrOk = await isHrOnboardingComplete(session.user.id);
      if (!hrOk) {
        if (mounted) setState("hr_pending");
        return;
      }

      const bypassMfa = await isActiveStaffImpersonationForPortal(session.user.id, "employee");
      if (bypassMfa) {
        await auditAccess("portal_entry", "employee");
        if (mounted) setState("authorized");
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
        onVerified={() => { setState("authorized"); auditAccess("portal_entry", "employee"); }}
        onLogout={async () => { await supabase.auth.signOut(); navigate("/nivra-secure-hub-2617-internal", { replace: true }); }}
      />
    );
  }

  if (state === "unauthorized" || state === "hr_pending") {
    const isHr = state === "hr_pending";
    return (
      <div className="internal-ui min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm px-6">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {isHr ? "Onboarding RH non terminé" : "Accès refusé"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isHr
              ? "Votre dossier RH doit être complété et activé par les Ressources Humaines avant d'accéder au portail Employé."
              : "Vous n'avez pas accès au portail Employé."}
          </p>
          <button onClick={() => navigate("/nivra-secure-hub-2617-internal")} className="text-sm text-primary hover:opacity-80">
            Retour au Hub
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
