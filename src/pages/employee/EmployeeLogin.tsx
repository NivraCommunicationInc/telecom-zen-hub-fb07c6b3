import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, AlertTriangle, Lock } from "lucide-react";
import { Link } from "react-router-dom";

const EmployeeLogin = () => {
  const { signIn, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if already logged in and is employee/admin
  useEffect(() => {
    const checkExistingSession = async () => {
      if (user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["employee", "admin"])
          .maybeSingle();

        if (roleData) {
          navigate("/employee", { replace: true });
        }
      }
    };

    if (!authLoading) {
      checkExistingSession();
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setError("Email ou mot de passe incorrect");
        setIsLoading(false);
        return;
      }

      // Get the current user after sign in
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        setError("Erreur d'authentification");
        setIsLoading(false);
        return;
      }

      // Check if user has employee or admin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role, status")
        .eq("user_id", currentUser.id)
        .in("role", ["employee", "admin"])
        .maybeSingle();

      if (roleError || !roleData) {
        await supabase.auth.signOut();
        setError("Accès non autorisé. Cette page est réservée aux employés.");
        setIsLoading(false);
        return;
      }

      if (roleData.status !== "active") {
        await supabase.auth.signOut();
        setError("Votre compte est désactivé. Contactez un administrateur.");
        setIsLoading(false);
        return;
      }

      toast.success("Connexion réussie");
      navigate("/employee", { replace: true });
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center">
              <span className="text-navy-900 font-bold text-xl">N</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Portail Employé</CardTitle>
          <CardDescription>
            Connectez-vous pour accéder à votre espace de travail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Adresse courriel</Label>
              <Input
                id="email"
                type="email"
                placeholder="employe@nivratelecom.ca"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Se connecter
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/admin/login" className="hover:text-primary transition-colors">
              Accès administrateur →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeLogin;
