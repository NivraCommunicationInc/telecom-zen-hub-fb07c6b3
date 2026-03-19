/**
 * HubLoginPage — Secure internal login for the Nivra staff hub.
 * Minimal, professional, no client-facing elements.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function HubLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data.session) {
        setError("Identifiants invalides.");
        setLoading(false);
        return;
      }

      // Verify the user has an internal role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role, status, is_active")
        .eq("user_id", data.session.user.id)
        .eq("status", "active")
        .in("role", ["admin", "employee", "technician", "supervisor", "sales", "kyc_agent", "billing_admin", "techops", "support", "field_sales"])
        .maybeSingle();

      if (roleError || !roleData || !roleData.is_active) {
        await supabase.auth.signOut();
        setError("Accès refusé. Ce portail est réservé au personnel interne Nivra.");
        setLoading(false);
        return;
      }

      // Log the login
      await supabase.from("hub_login_audit").insert({
        user_id: data.session.user.id,
        email: data.session.user.email,
        event: "login_success",
        portal_accessed: "hub",
      });

      navigate("/hub", { replace: true });
    } catch (err) {
      console.error("[HubLogin] Error:", err);
      setError("Erreur de connexion. Veuillez réessayer.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)] px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 mx-auto rounded-xl bg-emerald-600 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Nivra Internal</h1>
          <p className="text-xs text-[hsl(220,10%,40%)] mt-1 uppercase tracking-widest">
            Accès sécurisé
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="Courriel professionnel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11 bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white placeholder:text-[hsl(220,10%,35%)] focus:border-emerald-500/50 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11 bg-[hsl(220,20%,10%)] border-[hsl(220,15%,18%)] text-white placeholder:text-[hsl(220,10%,35%)] focus:border-emerald-500/50 focus:ring-emerald-500/20"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Connexion"
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-[hsl(220,10%,25%)] uppercase tracking-widest">
            Réservé au personnel autorisé
          </p>
        </div>
      </div>
    </div>
  );
}
