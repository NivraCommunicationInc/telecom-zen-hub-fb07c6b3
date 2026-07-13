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
      <div data-portal="tech" className="min-h-screen flex items-center justify-center">
        <div className="tp-core-hero rounded-2xl p-8">
          <Loader2 className="h-8 w-8 animate-spin text-sky-300" />
        </div>
      </div>
    );
  }

  if (state === "no_session") {
    return (
      <div data-portal="tech" className="min-h-screen flex items-center justify-center px-6 text-center">
        <section className="tp-core-hero w-full max-w-md rounded-2xl p-6 space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/15">
            <LogIn className="h-7 w-7 text-sky-300" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-sky-300">Nivra Core · Portail technicien</p>
            <h2 className="mt-2 text-2xl font-black text-white">Connexion requise</h2>
            <p className="mt-2 text-sm text-slate-300">Connectez-vous pour accéder aux missions terrain, au GPS live et aux notifications client.</p>
          </div>
          <button
            onClick={() => navigate("/nivra-secure-hub-2617-internal/login")}
            className="tp-action-btn tp-action-primary w-full"
          >
            Se connecter
          </button>
        </section>
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
      <div data-portal="tech" className="min-h-screen flex items-center justify-center px-6 text-center">
        <section className="tp-core-hero w-full max-w-md rounded-2xl p-6 space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/15">
            <ShieldAlert className="h-7 w-7 text-red-300" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-sky-300">Nivra Core · Sécurité terrain</p>
            <h2 className="mt-2 text-2xl font-black text-white">
              {isHr ? "Onboarding RH non terminé" : "Accès refusé"}
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              {isHr
                ? "Votre dossier RH doit être complété et activé avant d'accéder au portail technicien."
                : "Votre compte n'a pas le rôle technicien."}
            </p>
          </div>
          <button
            onClick={() => navigate("/nivra-secure-hub-2617-internal/login")}
            className="tp-action-btn w-full"
          >
            Retour à l'accueil
          </button>
        </section>
      </div>
    );
  }


  return <Outlet />;
}
