import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, CheckCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { portalSupabase } from "@/integrations/supabase/portalClient";

type AuthStep = "credentials" | "pin";

const ClientAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, resetPassword, updatePassword, user, isLoading: authLoading } = useClientAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({ email: "", password: "", confirmPassword: "", fullName: "" });
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  // 2-step PIN verification state
  const [authStep, setAuthStep] = useState<AuthStep>("credentials");
  const [pin, setPin] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [isSendingPin, setIsSendingPin] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");
  
  const pinIsValid = useMemo(() => /^\d{6}$/.test(pin), [pin]);
  
  const sanitizePin = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  // Send PIN via edge function
  const sendPinEmail = async (email: string, userId: string): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> => {
    try {
      const { data, error } = await supabase.functions.invoke("client-pin-send", {
        body: { email, user_id: userId },
      });
      
      if (error) {
        console.error("[sendPinEmail] Error:", error);
        return { success: false, error: error.message };
      }
      
      // Handle new response format: { sent: true/false, reason?: string }
      if (data?.sent === false) {
        if (data.reason === "rate_limited") {
          return { success: false, rateLimited: true, error: "Code déjà envoyé récemment" };
        }
        return { success: false, error: data.reason || data.error || "Failed to send PIN" };
      }
      
      if (data?.sent === true) {
        return { success: true };
      }
      
      // Legacy fallback
      if (data?.error) {
        return { success: false, error: data.error };
      }
      
      return { success: true };
    } catch (err: any) {
      console.error("[sendPinEmail] Unexpected error:", err);
      return { success: false, error: err.message || "Failed to send PIN" };
    }
  };

  // Verify PIN via edge function
  const verifyPin = async (email: string, pinCode: string): Promise<{ valid: boolean; error?: string; reason?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("client-pin-verify", {
        body: { email, pin: pinCode },
      });
      
      if (error) {
        console.error("[verifyPin] Error:", error);
        return { valid: false, error: error.message };
      }
      
      return { valid: data?.valid === true, error: data?.error, reason: data?.reason };
    } catch (err: any) {
      console.error("[verifyPin] Unexpected error:", err);
      return { valid: false, error: err.message || "Failed to verify PIN" };
    }
  };

  // Check if coming from password reset link
  useEffect(() => {
    if (searchParams.get("reset") === "true") {
      setIsResetMode(true);
    }
  }, [searchParams]);

  // Restore PIN pending state if user is logged in but PIN not verified
  useEffect(() => {
    if (user && !authLoading && !isResetMode) {
      const pinVerified = sessionStorage.getItem("client_pin_verified");
      const pendingPinEmail = sessionStorage.getItem("client_pin_pending_email");
      const pendingPinUserId = sessionStorage.getItem("client_pin_pending_user_id");
      
      if (pinVerified === "true") {
        // Already verified, redirect to portal
        navigate("/portal", { replace: true });
      } else if (pendingPinEmail && pendingPinUserId) {
        // Resume PIN step
        setPendingEmail(pendingPinEmail);
        setPendingUserId(pendingPinUserId);
        setAuthStep("pin");
      }
      // If not verified and no pending email, stay on credentials step
    }
  }, [user, authLoading, navigate, isResetMode]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      toast({ title: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    
    if (error) {
      setIsLoading(false);
      toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
      return;
    }
    
    // Get user from session after successful login
    const { data: { user: currentUser } } = await portalSupabase.auth.getUser();
    
    if (!currentUser?.id) {
      setIsLoading(false);
      toast({ title: "Erreur de connexion", description: "Impossible de récupérer les informations utilisateur", variant: "destructive" });
      return;
    }
    
    const userEmail = loginData.email;
    const userId = currentUser.id;
    
    // Check if device is trusted (within 20 minutes window)
    const trustedUntil = Number(localStorage.getItem("portal_trusted_until") || 0);
    const isTrusted = Date.now() < trustedUntil;
    
    if (isTrusted) {
      // Trusted device: skip PIN step entirely
      sessionStorage.setItem("client_pin_verified", "true");
      sessionStorage.removeItem("client_pin_pending_email");
      sessionStorage.removeItem("client_pin_pending_user_id");
      setIsLoading(false);
      toast({ title: "Connexion réussie" });
      navigate("/portal");
      return;
    }
    
    // Not trusted: proceed with PIN verification
    // Store pending PIN state in sessionStorage (for route guard and persistence)
    sessionStorage.setItem("client_pin_pending_email", userEmail);
    sessionStorage.setItem("client_pin_pending_user_id", userId);
    sessionStorage.removeItem("client_pin_verified");
    
    // Store email and user ID for PIN verification
    setPendingEmail(userEmail);
    setPendingUserId(userId);
    
    // Send PIN email
    setIsSendingPin(true);
    const pinResult = await sendPinEmail(userEmail, userId);
    setIsSendingPin(false);
    setIsLoading(false);
    
    // Move to PIN verification step (even if rate-limited, show PIN screen)
    setAuthStep("pin");
    setPin("");
    
    if (!pinResult.success) {
      // Check if rate-limited
      if (pinResult.rateLimited) {
        toast({ 
          title: "Code déjà envoyé récemment", 
          description: "Veuillez patienter 60 secondes avant de redemander un code.", 
        });
      } else {
        toast({ 
          title: "Erreur d'envoi du code", 
          description: pinResult.error || "Impossible d'envoyer le code de vérification", 
          variant: "destructive" 
        });
      }
    } else {
      toast({ title: "Code envoyé", description: "Vérifiez votre boîte de réception" });
    }
  };
  const handleResendPin = async () => {
    if (!pendingEmail || !pendingUserId) {
      toast({ title: "Erreur", description: "Session expirée, veuillez vous reconnecter", variant: "destructive" });
      setAuthStep("credentials");
      return;
    }
    
    setIsSendingPin(true);
    const result = await sendPinEmail(pendingEmail, pendingUserId);
    setIsSendingPin(false);
    
    if (!result.success) {
      // Check if rate-limited
      if (result.rateLimited) {
        toast({ 
          title: "Code déjà envoyé récemment", 
          description: "Veuillez patienter 60 secondes avant de redemander un code.", 
        });
      } else {
        toast({ 
          title: "Erreur", 
          description: result.error || "Impossible de renvoyer le code", 
          variant: "destructive" 
        });
      }
    } else {
      toast({ title: "Code renvoyé", description: "Un nouveau code a été envoyé à votre email" });
    }
  };

  const handleVerifyPin = async () => {
    if (!pinIsValid) {
      toast({ title: "Veuillez entrer un NIP valide de 6 chiffres", variant: "destructive" });
      return;
    }

    if (!pendingEmail) {
      toast({ title: "Erreur", description: "Session expirée, veuillez vous reconnecter", variant: "destructive" });
      setAuthStep("credentials");
      return;
    }

    setIsVerifyingPin(true);
    const result = await verifyPin(pendingEmail, pin);
    setIsVerifyingPin(false);
    
    if (!result.valid) {
      toast({ 
        title: "NIP invalide", 
        description: result.error || result.reason || "Veuillez réessayer", 
        variant: "destructive" 
      });
      return;
    }

    // Mark PIN as verified and set trusted device for 20 minutes
    sessionStorage.setItem("client_pin_verified", "true");
    sessionStorage.removeItem("client_pin_pending_email");
    sessionStorage.removeItem("client_pin_pending_user_id");
    
    // Set trusted device expiry (20 minutes from now)
    const trustedUntil = Date.now() + 20 * 60 * 1000;
    localStorage.setItem("portal_trusted_until", trustedUntil.toString());
    
    toast({ title: "Connexion réussie" });
    navigate("/portal");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupData.email || !signupData.password || !signupData.fullName) {
      toast({ title: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    if (signupData.password !== signupData.confirmPassword) {
      toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    if (signupData.password.length < 6) {
      toast({ title: "Le mot de passe doit contenir au moins 6 caractères", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(signupData.email, signupData.password, signupData.fullName);
    setIsLoading(false);
    if (error) {
      if (error.message.includes("already registered")) {
        toast({ title: "Cet email est déjà utilisé", variant: "destructive" });
      } else {
        toast({ title: "Erreur lors de l'inscription", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Compte créé avec succès", description: "Vous pouvez maintenant vous connecter" });
      navigate("/portal");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail) {
      toast({ title: "Veuillez entrer votre email", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await resetPassword(forgotPasswordEmail);
    setIsLoading(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setResetEmailSent(true);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmNewPassword) {
      toast({ title: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Le mot de passe doit contenir au moins 6 caractères", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await updatePassword(newPassword);
    setIsLoading(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mot de passe mis à jour", description: "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe" });
      setIsResetMode(false);
      navigate("/auth", { replace: true });
    }
  };

  // Password reset mode (user clicked link in email)
  if (isResetMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          
          <Card className="bg-card border-border">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                  <span className="font-display font-bold text-navy-900 text-xl">N</span>
                </div>
                <span className="font-display font-bold text-xl text-foreground">Nivra</span>
              </div>
              <CardTitle className="text-2xl">Nouveau mot de passe</CardTitle>
              <CardDescription>Entrez votre nouveau mot de passe</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-new-password">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Mettre à jour le mot de passe
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Forgot password view
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button 
            onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </button>
          
          <Card className="bg-card border-border">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                  <span className="font-display font-bold text-navy-900 text-xl">N</span>
                </div>
                <span className="font-display font-bold text-xl text-foreground">Nivra</span>
              </div>
              <CardTitle className="text-2xl">Mot de passe oublié</CardTitle>
              <CardDescription>
                {resetEmailSent 
                  ? "Un email vous a été envoyé" 
                  : "Entrez votre email pour réinitialiser votre mot de passe"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetEmailSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-foreground font-medium">Email envoyé!</p>
                    <p className="text-muted-foreground text-sm">
                      Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
                  >
                    Retour à la connexion
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                    Envoyer le lien de réinitialisation
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // PIN verification step
  if (authStep === "pin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <button 
            onClick={() => { setAuthStep("credentials"); setPin(""); }}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </button>
          
          <Card className="bg-card border-border">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                  <span className="font-display font-bold text-navy-900 text-xl">N</span>
                </div>
                <span className="font-display font-bold text-xl text-foreground">Nivra</span>
              </div>
              <div className="w-16 h-16 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mx-auto flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-cyan-600" />
              </div>
              <CardTitle className="text-2xl">Vérification en 2 étapes</CardTitle>
              <CardDescription>Entrez le code à 6 chiffres</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Un code de vérification à 6 chiffres a été envoyé à votre adresse email. Veuillez le saisir pour continuer.
                </p>
              </div>
              
              <div>
                <Label htmlFor="pin-input">Code de vérification</Label>
                <Input
                  id="pin-input"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(sanitizePin(e.target.value))}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData("text");
                    setPin(sanitizePin(text));
                  }}
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  aria-label="Code de vérification à 6 chiffres"
                />
              </div>
              
              <Button 
                onClick={handleVerifyPin}
                className="w-full" 
                variant="hero" 
                disabled={!pinIsValid || isVerifyingPin}
              >
                {isVerifyingPin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Vérifier et continuer
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Vous n'avez pas reçu le code? Vérifiez votre dossier spam ou{" "}
                <button 
                  type="button"
                  onClick={handleResendPin}
                  disabled={isSendingPin}
                  className="text-cyan-500 hover:text-cyan-400 underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingPin ? "Envoi en cours..." : "renvoyer le code"}
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </Link>
        
        <Card className="bg-card border-border">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                <span className="font-display font-bold text-navy-900 text-xl">N</span>
              </div>
              <span className="font-display font-bold text-xl text-foreground">Nivra</span>
            </div>
            <CardTitle className="text-2xl">Portail Client</CardTitle>
            <CardDescription>Connectez-vous ou créez un compte</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    />
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-cyan-500 hover:text-cyan-400 underline"
                    >
                      Mot de passe oublié?
                    </button>
                  </div>
                  <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Se connecter
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <Label htmlFor="signup-name">Nom complet</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Jean Dupont"
                      value={signupData.fullName}
                      onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-confirm">Confirmer le mot de passe</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" variant="hero" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Créer un compte
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientAuth;