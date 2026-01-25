import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Shield, Loader2, Eye, EyeOff, AlertCircle, CheckCircle, 
  Lock, FileText, UserCog, ArrowRight, KeyRound 
} from "lucide-react";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TokenData {
  user_id: string;
  email: string;
  role: string;
  full_name?: string;
}

const STAFF_TERMS = `
TERMES ET CONDITIONS D'ACCÈS AU PORTAIL EMPLOYÉ/TECHNICIEN NIVRA TELECOM

Version 1.0 - Janvier 2026

En acceptant ces conditions, vous reconnaissez et acceptez ce qui suit :

1. CONFIDENTIALITÉ DES DONNÉES
- Toutes les informations clients (noms, adresses, numéros de téléphone, courriels, informations de paiement) sont strictement confidentielles.
- Il est interdit de copier, photographier, enregistrer ou transférer ces données par quelque moyen que ce soit.
- L'accès aux données clients doit être limité au strict nécessaire pour l'exécution de vos tâches.

2. ACTIVITÉS INTERDITES
- Téléchargement ou exportation de données clients non autorisé.
- Consultation de profils clients sans raison professionnelle légitime.
- Partage de vos identifiants de connexion (email, mot de passe, NIP).
- Accès au portail depuis des appareils non autorisés.
- Modification non autorisée des données clients.

3. SÉCURITÉ
- Votre NIP de sécurité est personnel et ne doit jamais être partagé.
- Vous devez verrouiller votre session lorsque vous vous éloignez de votre poste.
- Signaler immédiatement toute activité suspecte ou tentative d'accès non autorisé.

4. AUDIT ET SURVEILLANCE
- Toutes vos actions dans le portail sont enregistrées et auditées.
- Chaque accès à un profil client nécessite une justification et une authentification par NIP.
- Des contrôles réguliers sont effectués pour détecter les accès non autorisés.

5. CONSÉQUENCES DES VIOLATIONS
En cas de non-respect de ces conditions :
- Suspension immédiate de l'accès au portail.
- Mesures disciplinaires pouvant aller jusqu'au licenciement.
- Poursuites légales si applicable (vol de données, fraude, etc.).
- Signalement aux autorités compétentes si requis par la loi.

6. RESPONSABILITÉ
Vous êtes personnellement responsable de :
- La protection de vos identifiants de connexion.
- L'utilisation appropriée des données auxquelles vous accédez.
- Le signalement de toute faille de sécurité.

En cliquant "J'accepte", vous confirmez avoir lu, compris et accepté ces conditions.
`;

export default function StaffOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  // Form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stepper
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setErrorReason("no_token");
        setIsValidating(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("staff-validate-onboarding-token", {
          body: { token },
        });

        if (error || !data?.valid) {
          setErrorReason(data?.reason || "invalid_token");
          setIsValid(false);
        } else {
          setTokenData(data.data);
          setIsValid(true);
        }
      } catch (error) {
        console.error("Token validation error:", error);
        setErrorReason("server_error");
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const validateStep1 = () => {
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return false;
    }
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return false;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error("Le mot de passe doit contenir majuscules, minuscules et chiffres");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Le NIP doit être exactement 4 chiffres");
      return false;
    }
    if (pin !== confirmPin) {
      toast.error("Les NIP ne correspondent pas");
      return false;
    }
    if (pin === "0000" || pin === "1234" || pin === "1111") {
      toast.error("Ce NIP est trop simple. Choisissez un NIP plus sécuritaire.");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!acceptTerms) {
      toast.error("Vous devez accepter les termes et conditions");
      return;
    }

    if (!tokenData) {
      toast.error("Données d'invitation invalides");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("staff-complete-onboarding", {
        body: {
          token,
          password,
          pin,
          terms_accepted: true,
          terms_version: "1.0",
        },
      });

      if (error) {
        toast.error("Erreur de connexion au serveur");
        return;
      }

      if (data?.code === "ALREADY_CONFIGURED") {
        toast.success("Votre compte est déjà configuré!");
        navigate("/staff");
        return;
      }

      if (data?.ok === false) {
        toast.error(data?.message || "Erreur lors de la configuration");
        return;
      }

      if (data?.ok === true) {
        toast.success("Compte configuré avec succès! Vous pouvez maintenant vous connecter.");
        navigate("/staff");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Erreur inattendue");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
          <p className="text-slate-300">Validation du lien...</p>
        </div>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <StaffBackground />
        <Card className="w-full max-w-md border-red-500/50 bg-slate-900/80 backdrop-blur-xl z-10">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-red-500/20">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <CardTitle className="text-white">Lien invalide</CardTitle>
            <CardDescription className="text-slate-400">
              {errorReason === "no_token" && "Aucun token fourni dans l'URL."}
              {errorReason === "expired" && "Ce lien a expiré. Contactez votre administrateur."}
              {errorReason === "used" && "Ce lien a déjà été utilisé."}
              {errorReason === "invalid_token" && "Ce lien est invalide ou a expiré."}
              {errorReason === "server_error" && "Erreur serveur. Veuillez réessayer."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate("/staff")} 
              variant="outline" 
              className="w-full border-slate-600 text-slate-300"
            >
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleLabel = tokenData?.role === "employee" ? "Employé" : "Technicien";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <StaffBackground />
      
      <div className="w-full max-w-lg space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg shadow-teal-500/25 mb-4">
            <UserCog className="h-8 w-8 text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configuration de votre compte</h1>
          <p className="text-slate-400">
            Bienvenue {tokenData?.full_name || tokenData?.email}! Configurez votre accès {roleLabel}.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step < currentStep
                    ? "bg-teal-500 text-slate-900"
                    : step === currentStep
                    ? "bg-teal-500/20 border-2 border-teal-500 text-teal-400"
                    : "bg-slate-700 text-slate-500"
                }`}
              >
                {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
              </div>
              {step < 3 && (
                <div
                  className={`w-12 h-0.5 ${
                    step < currentStep ? "bg-teal-500" : "bg-slate-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500 px-2">
          <span>Mot de passe</span>
          <span>NIP sécurité</span>
          <span>Conditions</span>
        </div>

        {/* Form Card */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl shadow-2xl">
          <CardContent className="pt-6">
            {/* Step 1: Password */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="h-5 w-5 text-teal-400" />
                  <h3 className="text-lg font-semibold text-white">Créez votre mot de passe</h3>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-300">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      className="bg-slate-800/50 border-slate-700 text-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Doit contenir majuscules, minuscules et chiffres
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Confirmer le mot de passe</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le mot de passe"
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
              </div>
            )}

            {/* Step 2: PIN */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <KeyRound className="h-5 w-5 text-teal-400" />
                  <h3 className="text-lg font-semibold text-white">Créez votre NIP de sécurité</h3>
                </div>
                
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-amber-300 text-sm">
                    <strong>Important:</strong> Ce NIP sera requis chaque fois que vous accédez à un profil client. 
                    Ne le partagez jamais.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">NIP (4 chiffres)</Label>
                  <div className="relative">
                    <Input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      maxLength={4}
                      className="bg-slate-800/50 border-slate-700 text-white text-center text-2xl tracking-widest pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Confirmer le NIP</Label>
                  <Input
                    type={showPin ? "text" : "password"}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    className="bg-slate-800/50 border-slate-700 text-white text-center text-2xl tracking-widest"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Terms */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-teal-400" />
                  <h3 className="text-lg font-semibold text-white">Termes et conditions</h3>
                </div>

                <ScrollArea className="h-64 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                    {STAFF_TERMS}
                  </pre>
                </ScrollArea>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                    className="mt-0.5 border-teal-500 data-[state=checked]:bg-teal-500"
                  />
                  <label htmlFor="terms" className="text-sm text-slate-300 cursor-pointer">
                    J'ai lu et j'accepte les termes et conditions d'accès au portail. 
                    Je comprends que toute violation peut entraîner des mesures disciplinaires 
                    et des poursuites légales.
                  </label>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevStep}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Retour
                </Button>
              )}
              
              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 font-semibold"
                >
                  Continuer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !acceptTerms}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Configuration...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Activer mon compte
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-sm">
          © {new Date().getFullYear()} Nivra Telecom. Portail du personnel.
        </p>
      </div>
    </div>
  );
}
