import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, CheckCircle, ShieldCheck, Wifi, Lock, Phone } from "lucide-react";
import { backendClient as supabase } from "@/integrations/backend/client";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { ClientSignupForm } from "@/components/client/ClientSignupForm";
import ClientPortalBackground from "@/components/client/ClientPortalBackground";

type AuthStep = "credentials" | "pin";

const ClientAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, resetPassword, updatePassword, user, isLoading: authLoading } = useClientAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
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

  // Send PIN via edge function with robust error handling
  const sendPinEmail = async (email: string, userId: string): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> => {
    try {
      const { data, error } = await supabase.functions.invoke("client-pin-send", {
        body: { email, user_id: userId },
      });
      
      if (error) {
        console.error("[sendPinEmail] Invocation error:", error);
        return { 
          success: false, 
          error: "Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez Support@nivratelecom.ca" 
        };
      }
      
      if (data?.sent === false) {
        if (data.reason === "rate_limited") {
          return { success: false, rateLimited: true, error: "Code déjà envoyé récemment" };
        }
        const errorMsg = data.error || "Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez Support@nivratelecom.ca";
        return { success: false, error: errorMsg };
      }
      
      if (data?.sent === true) {
        return { success: true };
      }
      
      if (data?.error) {
        return { success: false, error: data.error };
      }
      
      console.warn("[sendPinEmail] Unexpected response shape:", data);
      return { 
        success: false, 
        error: "Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez Support@nivratelecom.ca" 
      };
    } catch (err: any) {
      console.error("[sendPinEmail] Unexpected error:", err);
      return { 
        success: false, 
        error: "Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez Support@nivratelecom.ca" 
      };
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
        navigate("/portal", { replace: true });
      } else if (pendingPinEmail && pendingPinUserId) {
        setPendingEmail(pendingPinEmail);
        setPendingUserId(pendingPinUserId);
        setAuthStep("pin");
      }
    }
  }, [user, authLoading, navigate, isResetMode]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <ClientPortalBackground />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-2xl shadow-cyan-500/30 animate-pulse">
            <span className="font-display font-bold text-[#0d1526] text-3xl">N</span>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <p className="text-slate-400 text-sm">Chargement...</p>
        </div>
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
    
    const { data: { user: currentUser } } = await portalSupabase.auth.getUser();
    
    if (!currentUser?.id) {
      setIsLoading(false);
      toast({ title: "Erreur de connexion", description: "Impossible de récupérer les informations utilisateur", variant: "destructive" });
      return;
    }
    
    const userEmail = loginData.email.trim();
    const userId = currentUser.id;
    
    const trustedUntil = Number(localStorage.getItem("portal_trusted_until") || 0);
    const isTrusted = Date.now() < trustedUntil;

    const isE2E = import.meta.env.DEV === true && import.meta.env.VITE_E2E_MODE === "true";
    const e2eEmail = (import.meta.env.VITE_E2E_TEST_EMAIL || "").toLowerCase();
    if (isE2E && e2eEmail && userEmail.toLowerCase() === e2eEmail) {
      sessionStorage.setItem("client_pin_verified", "true");
      sessionStorage.removeItem("client_pin_pending_email");
      sessionStorage.removeItem("client_pin_pending_user_id");
      localStorage.setItem("portal_trusted_until", (Date.now() + 20 * 60 * 1000).toString());

      setIsLoading(false);
      toast({ title: "Connexion réussie" });
      navigate("/portal");
      return;
    }
    
    if (isTrusted) {
      sessionStorage.setItem("client_pin_verified", "true");
      sessionStorage.removeItem("client_pin_pending_email");
      sessionStorage.removeItem("client_pin_pending_user_id");
      setIsLoading(false);
      toast({ title: "Connexion réussie" });
      navigate("/portal");
      return;
    }
    
    sessionStorage.setItem("client_pin_pending_email", userEmail);
    sessionStorage.setItem("client_pin_pending_user_id", userId);
    sessionStorage.removeItem("client_pin_verified");
    
    setPendingEmail(userEmail);
    setPendingUserId(userId);
    
    setIsSendingPin(true);
    const pinResult = await sendPinEmail(userEmail, userId);
    setIsSendingPin(false);
    setIsLoading(false);
    
    setAuthStep("pin");
    setPin("");
    
    if (!pinResult.success) {
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

    sessionStorage.setItem("client_pin_verified", "true");
    sessionStorage.removeItem("client_pin_pending_email");
    sessionStorage.removeItem("client_pin_pending_user_id");
    
    const trustedUntil = Date.now() + 20 * 60 * 1000;
    localStorage.setItem("portal_trusted_until", trustedUntil.toString());
    
    toast({ title: "Connexion réussie" });
    navigate("/portal");
  };

  const handleSignup = async (formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    pin: string;
    serviceAddress: string;
    serviceCity: string;
    servicePostalCode: string;
  }) => {
    setIsLoading(true);
    const { error } = await signUp({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      pin: formData.pin,
      serviceAddress: formData.serviceAddress,
      serviceCity: formData.serviceCity,
      servicePostalCode: formData.servicePostalCode,
    });
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

  // Password reset mode
  if (isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <ClientPortalBackground />
        <div className="w-full max-w-md relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          
          <Card className="bg-[#0d1526]/90 backdrop-blur-2xl border-slate-800/50 shadow-2xl shadow-cyan-500/5">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <span className="font-display font-bold text-[#0d1526] text-2xl">N</span>
                </div>
              </div>
              <CardTitle className="text-2xl text-white">Nouveau mot de passe</CardTitle>
              <CardDescription className="text-slate-300">Entrez votre nouveau mot de passe</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <Label htmlFor="new-password" className="text-slate-200">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-new-password" className="text-slate-200">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:ring-cyan-500/20"
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-[#0d1526] font-semibold shadow-lg shadow-cyan-500/25" disabled={isLoading}>
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
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <ClientPortalBackground />
        <div className="w-full max-w-md relative z-10">
          <button 
            onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </button>
          
          <Card className="bg-[#0d1526]/90 backdrop-blur-2xl border-slate-800/50 shadow-2xl shadow-cyan-500/5">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <span className="font-display font-bold text-[#0d1526] text-2xl">N</span>
                </div>
              </div>
              <CardTitle className="text-2xl text-white">Mot de passe oublié</CardTitle>
              <CardDescription className="text-slate-300">
                {resetEmailSent 
                  ? "Un email vous a été envoyé" 
                  : "Entrez votre email pour réinitialiser votre mot de passe"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetEmailSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 mx-auto flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-white font-medium">Email envoyé!</p>
                    <p className="text-slate-300 text-sm">
                      Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800/50"
                    onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
                  >
                    Retour à la connexion
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <Label htmlFor="reset-email" className="text-slate-200">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:ring-cyan-500/20"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-[#0d1526] font-semibold shadow-lg shadow-cyan-500/25" disabled={isLoading}>
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
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <ClientPortalBackground />
        <div className="w-full max-w-md relative z-10">
          <button 
            onClick={() => { setAuthStep("credentials"); setPin(""); }}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </button>
          
          <Card className="bg-[#0d1526]/90 backdrop-blur-2xl border-slate-800/50 shadow-2xl shadow-cyan-500/5">
            <CardHeader className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 mx-auto flex items-center justify-center mb-4">
                <ShieldCheck className="w-10 h-10 text-cyan-400" />
              </div>
              <CardTitle className="text-2xl text-white">Vérification en 2 étapes</CardTitle>
              <CardDescription className="text-slate-300">Entrez le code à 6 chiffres envoyé par email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30 text-center">
                <p className="text-sm text-slate-300">
                  Un code de vérification à 6 chiffres a été envoyé à votre adresse email. Veuillez le saisir pour continuer.
                </p>
              </div>
              
              <div>
                <Label htmlFor="pin-input" className="text-slate-200">Code de vérification</Label>
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
                  className="text-center text-3xl tracking-[0.5em] font-mono bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:ring-cyan-500/20 h-14"
                  aria-label="Code de vérification à 6 chiffres"
                />
              </div>
              
              <Button 
                onClick={handleVerifyPin}
                className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-[#0d1526] font-semibold shadow-lg shadow-cyan-500/25 h-12" 
                disabled={!pinIsValid || isVerifyingPin}
              >
                {isVerifyingPin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Vérifier et continuer
              </Button>
              
              <p className="text-sm text-slate-300 text-center">
                Vous n'avez pas reçu le code? Vérifiez votre dossier spam ou{" "}
                <button 
                  type="button"
                  onClick={handleResendPin}
                  disabled={isSendingPin}
                  className="text-cyan-400 hover:text-cyan-300 underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

  // Main login/signup view
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <ClientPortalBackground />
      
      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-300 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </Link>
        
        <Card className="bg-[#0d1526]/90 backdrop-blur-2xl border-slate-800/50 shadow-2xl shadow-cyan-500/5">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-xl shadow-cyan-500/30">
                <span className="font-display font-bold text-[#0d1526] text-2xl">N</span>
              </div>
              <div className="text-left">
                <span className="font-display font-bold text-2xl text-white block">Nivra</span>
                <span className="text-xs text-cyan-400/80 font-medium tracking-wider uppercase">Telecom</span>
              </div>
            </div>
            <CardTitle className="text-2xl text-white">Espace Client</CardTitle>
            <CardDescription className="text-slate-300">Connectez-vous pour gérer vos services</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-800/50 p-1 rounded-xl">
                <TabsTrigger 
                  value="login" 
                  className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-[#0d1526] data-[state=active]:font-semibold data-[state=active]:shadow-lg transition-all"
                >
                  Connexion
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-[#0d1526] data-[state=active]:font-semibold data-[state=active]:shadow-lg transition-all"
                >
                  Inscription
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email" className="text-slate-200 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-cyan-400/70" />
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:ring-cyan-500/20 h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password" className="text-slate-200 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-cyan-400/70" />
                      Mot de passe
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-cyan-500 focus:ring-cyan-500/20 h-11"
                    />
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Mot de passe oublié?
                    </button>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-[#0d1526] font-semibold shadow-lg shadow-cyan-500/25 h-12 text-base" 
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                    Se connecter
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <ClientSignupForm onSubmit={handleSignup} isLoading={isLoading} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* Trust badges */}
        <div className="mt-6 flex items-center justify-center gap-6 text-slate-300 text-xs">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" /> 
            <span>Connexion sécurisée</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-cyan-400" /> 
            <span>Vérification 2FA</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClientAuth;
