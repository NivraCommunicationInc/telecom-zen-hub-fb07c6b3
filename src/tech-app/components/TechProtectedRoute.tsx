/**
 * TechProtectedRoute — Guards all /tech/* routes.
 * Allows users with role 'technician' OR any admin/employee/supervisor/techops role.
 * Does NOT require hub session (techs may install the PWA and stay logged in).
 *
 * Security hardening: an idle timeout (default 30 minutes) signs the technician
 * out automatically. This protects customer data if the device is left
 * unattended at a customer site. Any user interaction (touch, keydown, scroll,
 * mouse move) resets the timer.
 */
import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert, LogIn } from "lucide-react";
import { toast } from "sonner";

type State = "loading" | "authorized" | "unauthorized" | "no_session";

const ALLOWED_ROLES = ["technician", "admin", "employee", "supervisor", "techops"];
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const IDLE_WARNING_MS = 28 * 60 * 1000; // warn 2 minutes before logout

export default function TechProtectedRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
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
      if (mounted) setState(ok ? "authorized" : "unauthorized");
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

  if (state === "unauthorized") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 text-center">
        <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Accès refusé</h2>
        <p className="text-sm text-slate-400 mb-6">Votre compte n'a pas le rôle technicien.</p>
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
