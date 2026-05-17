/**
 * FieldProtectedRoute — Guards all /field/* routes.
 * Enforces: hub session → authenticated → active role → can_access_field → MFA verified.
 * Redirects to /hub if not entered through the hub.
 */
import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkMfaStatus } from "@/lib/security/mfaUtils";
import { hasValidHubSession } from "@/lib/security/hubSession";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import { GraduationCap } from "lucide-react";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { auditAccess } from "@/lib/security/internalAuditLogger";
import { Loader2, ShieldAlert } from "lucide-react";

type State = "loading" | "authorized" | "unauthorized" | "mfa_enroll" | "mfa_verify" | "training_required";

export default function FieldProtectedRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [trainingDone, setTrainingDone] = useState<number>(0);
  const [trainingTotal, setTrainingTotal] = useState<number>(8);

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

      // ──── Training gate ────────────────────────────────────────────────
      // Block all Field routes except /field/training until the agent has
      // completed every mandatory training module, OR has an admin override.
      const [{ data: mandatoryModules }, { data: completedModules }, { data: profile }] = await Promise.all([
        supabase.from("training_modules").select("id").eq("is_mandatory", true).eq("is_active", true),
        supabase.from("training_progress").select("module_id").eq("agent_id", session.user.id).eq("status", "completed"),
        supabase.from("profiles").select("training_override").eq("user_id", session.user.id).maybeSingle(),
      ]);
      const mandatoryIds = (mandatoryModules ?? []).map((m: any) => m.id);
      const completedIds = (completedModules ?? []).map((m: any) => m.module_id);
      const allCompleted = mandatoryIds.length > 0 && mandatoryIds.every((id: string) => completedIds.includes(id));
      const hasOverride = ((profile as any)?.training_override) === true;

      if (mounted) {
        setTrainingDone(completedIds.length);
        setTrainingTotal(mandatoryIds.length || 8);
      }

      if (!allCompleted && !hasOverride) {
        if (mounted) setState("training_required");
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
        onVerified={() => { setState("authorized"); auditAccess("portal_entry", "field"); }}
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
          <p className="text-sm text-muted-foreground mb-4">Vous n'avez pas accès au portail Field.</p>
          <button onClick={() => navigate("/hub")} className="text-sm text-primary hover:opacity-80">
            Retour au Hub
          </button>
        </div>
      </div>
    );
  }

  if (state === "training_required") {
    // Allow ONLY the training route through; everything else is blocked.
    if (location.pathname.startsWith("/field/training")) {
      return <Outlet />;
    }
    return (
      <div className="internal-ui min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border rounded-2xl shadow-lg p-8 text-center">
          <div className="h-14 w-14 rounded-2xl mx-auto bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-md mb-4">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-2">⚠️ Formation obligatoire requise</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Vous devez compléter la formation Nivra avant d'accéder au portail de vente.
          </p>
          <div className="text-xs text-muted-foreground mb-5">
            Progression : <span className="font-semibold text-foreground">{trainingDone}/{trainingTotal} modules complétés</span>
          </div>
          <button
            onClick={() => navigate("/field/training", { replace: true })}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg py-3 transition-colors"
          >
            Commencer ma formation →
          </button>
          <p className="text-xs text-muted-foreground mt-4">
            Questions ? <a href="mailto:support@nivra-telecom.ca" className="text-violet-600 hover:underline">support@nivra-telecom.ca</a>
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
// Note: <Navigate /> kept available for future use; suppress unused-import.
void Navigate;
