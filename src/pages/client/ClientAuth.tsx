import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import HoneypotField, { isHoneypotTriggered } from "@/components/shared/HoneypotField";
import CloudflareTurnstile from "@/components/shared/CloudflareTurnstile";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, CheckCircle, ShieldCheck, Wifi, Lock, Phone } from "lucide-react";
// FIXED: Use portalClient for all portal operations to avoid session mismatch
// backendClient uses a different auth storage key, causing function invocations to fail
import { portalClient as portalFunctions } from "@/integrations/backend/portalClient";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { ClientSignupForm } from "@/components/client/ClientSignupForm";
import ClientPortalBackground from "@/components/client/ClientPortalBackground";
import { COMPANY_CONTACT } from "@/config/company";

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

  // Anti-bot
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const handleTurnstileVerify = useCallback((token: string) => setTurnstileToken(token), []);

  const verifyInFlightRef = useRef(false);
  const supportEmailDisplay = COMPANY_CONTACT.supportEmailDisplay;
  
  const pinIsValid = useMemo(() => /^\d{6}$/.test(pin), [pin]);
  
  const sanitizePin = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  // Send PIN via edge function with robust error handling
  const sendPinEmail = async (email: string, userId: string): Promise<{ success: boolean; error?: string; rateLimited?: boolean }> => {
    try {
      // FIXED: Use portalClient (portalFunctions) instead of backendClient
      // backendClient has a different auth storage key and causes session mismatch
      const { data, error } = await portalFunctions.functions.invoke("client-pin-send", {
        body: { email, user_id: userId },
      });
      
      if (error) {
        console.error("[sendPinEmail] Invocation error:", error);
        return { 
          success: false, 
          error: `Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez ${supportEmailDisplay}`
        };
      }
      
      if (data?.sent === false) {
        if (data.reason === "rate_limited") {
          return { success: false, rateLimited: true, error: "Code déjà envoyé récemment" };
        }
        const errorMsg = data.error || `Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez ${supportEmailDisplay}`;
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
        error: `Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez ${supportEmailDisplay}`
      };
    } catch (err: any) {
      console.error("[sendPinEmail] Unexpected error:", err);
      return { 
        success: false, 
        error: `Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez ${supportEmailDisplay}`
      };
    }
  };

  // Verify PIN via edge function
  const verifyPin = async (email: string, pinCode: string): Promise<{ valid: boolean; error?: string; reason?: string }> => {
    try {
      // FIXED: Use portalClient for consistency
      const { data, error } = await portalFunctions.functions.invoke("client-pin-verify", {
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
      <div className="min-h-screen flex items-center justify-center relative bg-gradient-to-br from-slate-50 to-slate-100">
        <ClientPortalBackground />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-teal-500/30 animate-pulse">
            <span className="font-display font-bold text-white text-3xl">N</span>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <p className="text-slate-600 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isHoneypotTriggered(honeypot)) return; // Silent reject
    if (!loginData.email || !loginData.password) {
      toast({ title: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    
    if (error) {
      setIsLoading(false);
      console.error("[ClientAuth] Login failed:", { message: error.message, name: error.name });
      toast({ 
        title: "Erreur de connexion", 
        description: error.message === "Invalid login credentials" 
          ? "Identifiants invalides. Vérifiez votre courriel et mot de passe."
          : error.message, 
        variant: "destructive" 
      });
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

    // IMPORTANT: Ne jamais forcer l'étape PIN si l'envoi a réellement échoué.
    // Sinon l'utilisateur est bloqué sur un écran "code" sans code valide.
    if (!pinResult.success && !pinResult.rateLimited) {
      // FIX: Do NOT sign out on PIN send failure — this was causing the
      // "nobody can log in" outage. Instead, keep the session alive and
      // show the PIN step with a retry option.
      console.warn("[handleLogin] PIN send failed but keeping session alive:", pinResult.error);

      toast({
        title: "Erreur d'envoi du code",
        description: (pinResult.error || "Impossible d'envoyer le code de vérification") +
          " — Cliquez « Renvoyer le code » pour réessayer.",
        variant: "destructive",
      });
      // Still transition to PIN step so user can retry
    }

    setAuthStep("pin");
    setPin("");

    if (pinResult.rateLimited) {
      toast({
        title: "Code déjà envoyé récemment",
        description: "Utilisez le dernier code reçu (vérifiez aussi le dossier spam).",
      });
    } else {
      toast({ title: "Code envoyé", description: "Vérifiez votre boîte de réception (et le dossier spam)." });
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
    if (verifyInFlightRef.current) return;
    if (!pinIsValid) {
      toast({ title: "Veuillez entrer un NIP valide de 6 chiffres", variant: "destructive" });
      return;
    }

    if (!pendingEmail) {
      toast({ title: "Erreur", description: "Session expirée, veuillez vous reconnecter", variant: "destructive" });
      setAuthStep("credentials");
      return;
    }

    verifyInFlightRef.current = true;
    setIsVerifyingPin(true);
    const result = await verifyPin(pendingEmail, pin);
    setIsVerifyingPin(false);
    verifyInFlightRef.current = false;
    
    if (!result.valid) {
      const fallbackMessage = (() => {
        switch (result.reason) {
          case "no_valid_pin":
            return "Aucun code valide trouvé. Cliquez sur « renvoyer le code » pour en obtenir un nouveau.";
          case "too_many_attempts":
            return "Trop de tentatives. Cliquez sur « renvoyer le code » pour obtenir un nouveau code.";
          case "invalid_pin":
            return "Code invalide. Vérifiez que vous utilisez le dernier code reçu.";
          default:
            return "Veuillez réessayer.";
        }
      })();

      toast({ 
        title: "NIP invalide", 
        description: result.error || fallbackMessage,
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
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-gradient-to-br from-slate-50 to-slate-100">
        <ClientPortalBackground />
        <div className="w-full max-w-md relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          
          <Card className="bg-white/95 backdrop-blur-2xl border-slate-200 shadow-2xl shadow-slate-900/10">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                  <span className="font-display font-bold text-white text-2xl">N</span>
                </div>
              </div>
              <CardTitle className="text-2xl text-slate-900">Nouveau mot de passe</CardTitle>
              <CardDescription className="text-slate-600">Entrez votre nouveau mot de passe</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <Label htmlFor="new-password" className="text-slate-700">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-new-password" className="text-slate-700">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20"
                  />
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold shadow-lg shadow-teal-500/25" disabled={isLoading}>
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
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-gradient-to-br from-slate-50 to-slate-100">
        <ClientPortalBackground />
        <div className="w-full max-w-md relative z-10">
          <button 
            onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </button>
          
          <Card className="bg-white/95 backdrop-blur-2xl border-slate-200 shadow-2xl shadow-slate-900/10">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                  <span className="font-display font-bold text-white text-2xl">N</span>
                </div>
              </div>
              <CardTitle className="text-2xl text-slate-900">Mot de passe oublié</CardTitle>
              <CardDescription className="text-slate-600">
                {resetEmailSent 
                  ? "Un email vous a été envoyé" 
                  : "Entrez votre email pour réinitialiser votre mot de passe"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetEmailSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 mx-auto flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-900 font-medium">Email envoyé!</p>
                    <p className="text-slate-600 text-sm">
                      Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full mt-4 border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                    onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
                  >
                    Retour à la connexion
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <Label htmlFor="reset-email" className="text-slate-700">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold shadow-lg shadow-teal-500/25" disabled={isLoading}>
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
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-gradient-to-br from-slate-50 to-slate-100">
        <ClientPortalBackground />
        <div className="w-full max-w-md relative z-10">
          <button 
            onClick={() => { setAuthStep("credentials"); setPin(""); }}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la connexion
          </button>
          
          <Card className="bg-white/95 backdrop-blur-2xl border-slate-200 shadow-2xl shadow-slate-900/10">
            <CardHeader className="text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-100 to-teal-50 border border-teal-200 mx-auto flex items-center justify-center mb-4">
                <ShieldCheck className="w-10 h-10 text-teal-600" />
              </div>
              <CardTitle className="text-2xl text-slate-900">Vérification en 2 étapes</CardTitle>
              <CardDescription className="text-slate-600">Entrez le code à 6 chiffres envoyé par email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-teal-50 rounded-xl border border-teal-100 text-center">
                <p className="text-sm text-slate-700">
                  Un code de vérification à 6 chiffres a été envoyé à votre adresse email. Veuillez le saisir pour continuer.
                </p>
              </div>
              
              <div>
                <Label htmlFor="pin-input" className="text-slate-700">Code de vérification</Label>
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
                  className="text-center text-3xl tracking-[0.5em] font-mono bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 h-14"
                  aria-label="Code de vérification à 6 chiffres"
                />
              </div>
              
              <Button 
                onClick={handleVerifyPin}
                className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold shadow-lg shadow-teal-500/25 h-12" 
                disabled={!pinIsValid || isVerifyingPin}
              >
                {isVerifyingPin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Vérifier et continuer
              </Button>
              
              <p className="text-sm text-slate-600 text-center">
                Vous n'avez pas reçu le code? Vérifiez votre dossier spam ou{" "}
                <button 
                  type="button"
                  onClick={handleResendPin}
                  disabled={isSendingPin}
                  className="text-teal-600 hover:text-teal-700 underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
      <ClientPortalBackground />
      
      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </Link>
        
        <Card className="bg-white/95 backdrop-blur-2xl border-slate-200 shadow-2xl shadow-slate-900/10">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-xl shadow-teal-500/30">
                <span className="font-display font-bold text-white text-2xl">N</span>
              </div>
              <div className="text-left">
                <span className="font-display font-bold text-2xl text-slate-900 block">Nivra</span>
                <span className="text-xs text-teal-600 font-medium tracking-wider uppercase">Telecom</span>
              </div>
            </div>
            <CardTitle className="text-2xl text-slate-900">Espace Client</CardTitle>
            <CardDescription className="text-slate-600">Connectez-vous pour gérer vos services</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger 
                  value="login" 
                  className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-lg transition-all"
                >
                  Connexion
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-lg transition-all"
                >
                  Inscription
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <HoneypotField value={honeypot} onChange={setHoneypot} />
                  <div>
                    <Label htmlFor="login-email" className="text-slate-700 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-teal-600" />
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 h-11"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password" className="text-slate-700 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-teal-600" />
                      Mot de passe
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500/20 h-11"
                    />
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-teal-600 hover:text-teal-700 transition-colors"
                    >
                      Mot de passe oublié?
                    </button>
                  </div>
                  <CloudflareTurnstile onVerify={handleTurnstileVerify} className="flex justify-center" />
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold shadow-lg shadow-teal-500/25 h-12 text-base" 
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
        <div className="mt-6 flex items-center justify-center gap-6 text-slate-600 text-xs">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" /> 
            <span>Connexion sécurisée</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-teal-600" /> 
            <span>Vérification 2FA</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClientAuth;
