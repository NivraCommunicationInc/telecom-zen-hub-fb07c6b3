/**
 * TechProtectedRoute — Guards all /tech/* routes.
 * Allows users with role 'technician' OR any admin/employee/supervisor/techops role.
 * Does NOT require hub session (techs may install the PWA and stay logged in).
 */
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert, LogIn } from "lucide-react";

type State = "loading" | "authorized" | "unauthorized" | "no_session";

const ALLOWED_ROLES = ["technician", "admin", "employee", "supervisor", "techops"];

export default function TechProtectedRoute() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");

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
          onClick={() => navigate("/")}
          className="rounded-full bg-slate-800 px-8 py-3 text-base font-semibold text-white"
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return <Outlet />;
}
