/**
 * TechProtectedRoute — Guards all /tech/* routes.
 * Allows users with role 'technician' OR any admin/employee/supervisor/techops role.
 * Does NOT require hub session (techs may install the PWA and stay logged in).
 *
 * Security hardening:
 *  - Idle timeout (30 min) signs the tech out automatically if the device is
 *    left unattended at a customer site.
 *  - MFA enrolment + verification REQUIRED. A stolen phone with the PWA
 *    installed must not give access to customer data without the TOTP code.
 *    The check uses checkMfaStatus() — same helper as Employee/Field.
 */
import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert, LogIn } from "lucide-react";
import { toast } from "sonner";
import { checkMfaStatus } from "@/lib/security/mfaUtils";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { isActiveStaffImpersonationForPortal } from "@/lib/staffAssistance";
import { isHrOnboardingComplete } from "@/lib/security/hrOnboardingGate";

type State = "loading" | "authorized" | "unauthorized" | "hr_pending" | "no_session" | "mfa_enroll" | "mfa_verify";

const ALLOWED_ROLES = ["technician", "admin", "employee", "supervisor", "techops"];
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const IDLE_WARNING_MS = 28 * 60 * 1000; // warn 2 minutes before logout

export default function TechProtectedRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Idle-timeout logic — only attaches once authorized.
  useEffect(() => {
    if (state !== "authorized") return;

    const performLogout = async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        // continue regardless
      }
      toast.info("Session expirée après 30 minutes d'inactivité.");
      navigate("/nivra-secure-hub-2617-internal/login");
    };

    const resetTimers = () => {
      lastActivityRef.current = Date.now();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      warningTimerRef.current = setTimeout(() => {
        toast.warning("Votre session expirera dans 2 minutes faute d'activité.");
      }, IDLE_WARNING_MS);
      idleTimerRef.current = setTimeout(performLogout, IDLE_TIMEOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "touchmove", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimers, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimers));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [state, navigate]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (mounted) setState("no_session");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, is_active, status")
        .eq("user_id", session.user.id)
        .eq("status", "active");

      const ok = (roles ?? []).some(
        (r: any) => r.is_active && ALLOWED_ROLES.includes(r.role),
      );
      if (!ok) {
        if (mounted) setState("unauthorized");
        return;
      }

      // HR onboarding gate
      const hrOk = await isHrOnboardingComplete(session.user.id);
      if (!hrOk) {
        if (mounted) setState("hr_pending");
        return;
      }


      const bypassMfa = await isActiveStaffImpersonationForPortal(session.user.id, "technician");
      if (bypassMfa) {
        if (mounted) setState("authorized");
        return;
      }

      // MFA gate — REQUIRED for tech because of the offline / mobile-PWA
      // threat model (device theft at customer site).
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

      if (mounted) setState("authorized");
    })();
    return () => { mounted = false; };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (state === "no_session") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 text-center">
        <LogIn className="h-12 w-12 text-violet-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Connexion requise</h2>
        <p className="text-sm text-slate-400 mb-6">Connectez-vous pour accéder au portail technicien.</p>
        <button
          onClick={() => navigate("/nivra-secure-hub-2617-internal/login")}
          className="rounded-full bg-violet-600 px-8 py-3 text-base font-semibold text-white"
        >
          Se connecter
        </button>
      </div>
    );
  }

  if (state === "mfa_enroll") {
    return (
      <MfaEnrollmentDialog
        onComplete={() => window.location.reload()}
        onCancel={async () => {
          await supabase.auth.signOut();
          navigate("/nivra-secure-hub-2617-internal/login");
        }}
      />
    );
  }

  if (state === "mfa_verify" && factorId) {
    return (
      <MfaVerificationGate
        factorId={factorId}
        onVerified={() => setState("authorized")}
        onLogout={async () => {
          await supabase.auth.signOut();
          navigate("/nivra-secure-hub-2617-internal/login");
        }}
      />
    );
  }

  if (state === "unauthorized" || state === "hr_pending") {
    const isHr = state === "hr_pending";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 text-center">
        <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">
          {isHr ? "Onboarding RH non terminé" : "Accès refusé"}
        </h2>
        <p className="text-sm text-slate-400 mb-6 max-w-sm">
          {isHr
            ? "Votre dossier RH doit être complété et activé par les Ressources Humaines avant d'accéder au portail Technicien."
            : "Votre compte n'a pas le rôle technicien."}
        </p>
        <button
          onClick={() => navigate("/nivra-secure-hub-2617-internal/login")}
          className="rounded-full bg-slate-800 px-8 py-3 text-base font-semibold text-white"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }


  return <Outlet />;
}
