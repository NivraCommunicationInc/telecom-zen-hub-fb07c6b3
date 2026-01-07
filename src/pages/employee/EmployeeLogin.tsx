import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import { employeeSupabase } from "@/integrations/supabase/employeeClient";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, AlertTriangle, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import OTPVerificationDialog from "@/components/admin/OTPVerificationDialog";

const EmployeeLogin = () => {
  const { signIn, user, isLoading: authLoading, role } = useEmployeeAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // 2FA state
  const [showOTPDialog, setShowOTPDialog] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingUserEmail, setPendingUserEmail] = useState<string>("");

  // Check if already logged in with valid employee/admin role
  useEffect(() => {
    if (!authLoading && user && role) {
      console.log("[EmployeeLogin] Already authenticated with role:", role);
      navigate("/employee", { replace: true });
    }
  }, [user, authLoading, role, navigate]);

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
      const { data: { user: currentUser } } = await employeeSupabase.auth.getUser();

      if (!currentUser) {
        setError("Erreur d'authentification");
        setIsLoading(false);
        return;
      }

      // SECURITY: Check if user has ONLY employee role (not admin)
      const { data: roleData, error: roleError } = await employeeSupabase
        .from("user_roles")
        .select("role, status, is_active, otp_required, otp_verified_at")
        .eq("user_id", currentUser.id)
        .eq("role", "employee")
        .maybeSingle();

      if (roleError || !roleData) {
        console.log("[EmployeeLogin] Role mismatch → signOut. No employee role found.");
        await employeeSupabase.auth.signOut();
        setError("Accès non autorisé. Cette page est réservée aux employés uniquement.");
        setIsLoading(false);
        return;
      }

      if (roleData.status !== "active" || roleData.is_active === false) {
        console.log("[EmployeeLogin] Account not active → signOut");
        await employeeSupabase.auth.signOut();
        setError("Votre compte est désactivé. Contactez un administrateur.");
        setIsLoading(false);
        return;
      }

      // Check if 2FA is required
      const requires2FA = roleData.otp_required !== false;
      
      if (requires2FA) {
        // Check if already verified within the last 24 hours
        const verifiedAt = roleData.otp_verified_at ? new Date(roleData.otp_verified_at) : null;
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        if (!verifiedAt || verifiedAt < twentyFourHoursAgo) {
          // Need to verify OTP
          setPendingUserId(currentUser.id);
          setPendingUserEmail(currentUser.email || email);
          setShowOTPDialog(true);
          setIsLoading(false);
          return;
        }
      }

      // No 2FA needed or already verified
      completeLogin();
    } catch (err: any) {
      console.error("[EmployeeLogin] Error:", err);
      setError(err.message || "Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  };

  const completeLogin = () => {
    toast.success("Connexion réussie");
    navigate("/employee", { replace: true });
  };

  const handleOTPSuccess = () => {
    setShowOTPDialog(false);
    setPendingUserId(null);
    completeLogin();
  };

  const handleOTPCancel = async () => {
    setShowOTPDialog(false);
    setPendingUserId(null);
    setIsLoading(false);
    // Sign out since 2FA was cancelled
    await employeeSupabase.auth.signOut();
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

            <Button type="submit" className="w-full" disabled={isLoading || authLoading}>
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

      {/* 2FA OTP Dialog */}
      <OTPVerificationDialog
        open={showOTPDialog}
        onOpenChange={setShowOTPDialog}
        userId={pendingUserId || ""}
        userEmail={pendingUserEmail}
        onSuccess={handleOTPSuccess}
        onCancel={handleOTPCancel}
      />
    </div>
  );
};

export default EmployeeLogin;
