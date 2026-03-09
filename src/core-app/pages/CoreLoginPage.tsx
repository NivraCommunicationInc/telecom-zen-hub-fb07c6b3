/**
 * CoreLoginPage — Dark ops-grade login for Nivra Core.
 * Uses the existing Supabase auth system.
 */
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { Terminal, LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function CoreLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || corePath("/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError("Identifiants invalides. Vérifiez votre courriel et mot de passe.");
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Erreur d'authentification inattendue.");
        setLoading(false);
        return;
      }

      // Verify internal role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role, status")
        .eq("user_id", data.user.id)
        .eq("status", "active")
        .in("role", ["admin", "employee", "technician"])
        .maybeSingle();

      if (roleError || !roleData) {
        setError("Accès refusé. Votre compte n'est pas autorisé pour Nivra Core.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      navigate(from, { replace: true });
    } catch {
      setError("Erreur de connexion. Réessayez.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,8%)] px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center mb-4">
            <Terminal className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Nivra Core</h1>
          <p className="text-sm text-[hsl(220,10%,45%)] mt-1">Console d'opérations internes</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[hsl(220,10%,55%)] uppercase tracking-wider">
              Courriel
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="w-full h-10 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] px-3 text-sm text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors"
              placeholder="operateur@nivra.ca"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[hsl(220,10%,55%)] uppercase tracking-wider">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full h-10 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] px-3 pr-10 text-sm text-white placeholder:text-[hsl(220,10%,35%)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(220,10%,40%)] hover:text-[hsl(220,10%,60%)] transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Connexion
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-[hsl(220,10%,30%)] mt-8">
          Accès réservé au personnel autorisé de Nivra.
        </p>
      </div>
    </div>
  );
}
