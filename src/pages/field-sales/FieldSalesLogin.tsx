/**
 * FieldSalesLogin - Login page for field sales representatives
 * Distinct orange/amber branding to differentiate from staff portal
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Loader2, Eye, EyeOff, AlertCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import StaffBackground from "@/components/staff/StaffBackground";

const loginSchema = z.object({
  email: z.string().email("Adresse courriel invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export default function FieldSalesLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if user has field_sales role
        const { data: hasRole } = await supabase.rpc("is_field_sales", {
          _user_id: session.user.id,
        });
        
        if (hasRole) {
          navigate("/field-sales/dashboard", { replace: true });
          return;
        }
      }
      setChecking(false);
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Identifiants incorrects");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (!data.user) {
        toast.error("Erreur de connexion");
        return;
      }

      // Check if user has field_sales role
      const { data: hasRole } = await supabase.rpc("is_field_sales", {
        _user_id: data.user.id,
      });

      if (!hasRole) {
        await supabase.auth.signOut();
        toast.error("Vous n'avez pas accès au portail Ventes Terrain");
        return;
      }

      toast.success("Bienvenue, vendeur !");
      navigate("/field-sales/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <StaffBackground />
      
      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/25 mb-4">
            <Briefcase className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Ventes Terrain</h1>
          <p className="text-slate-200 flex items-center justify-center gap-2">
            <MapPin className="h-4 w-4 text-orange-400" />
            Portail porte-à-porte
          </p>
        </div>

        {/* Login Form */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">Connexion Vendeur</CardTitle>
            <CardDescription className="text-slate-200">
              Connectez-vous pour commencer vos ventes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">Courriel</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendeur@nivra.ca"
                  className="bg-slate-800/60 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-orange-400/50 focus:ring-orange-400/20"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-slate-800/60 border-slate-600/50 text-white placeholder:text-slate-400 pr-10 focus:border-orange-400/50 focus:ring-orange-400/20"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold shadow-lg shadow-orange-500/25 transition-all duration-300"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-slate-400 text-sm">
          © {new Date().getFullYear()} Nivra Telecom. Équipe ventes terrain.
        </p>
      </div>
    </div>
  );
}
