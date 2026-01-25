/**
 * FieldSalesSetup - Onboarding flow for new field sales reps
 * 3-step process: Password → PIN → Terms & Conditions
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Lock, Key, FileCheck, ArrowRight, Loader2, 
  CheckCircle, Eye, EyeOff, Briefcase
} from "lucide-react";
import { hashPin, isValidPin } from "@/lib/pinUtils";
import StaffBackground from "@/components/staff/StaffBackground";

const STEPS = ["Mot de passe", "Code PIN", "Conditions"];

export default function FieldSalesSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 1: Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2: PIN
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  // Step 3: Terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Already authenticated, skip password step
        setCurrentStep(1);
      }
    };
    checkAuth();
  }, []);

  const handlePasswordSubmit = async () => {
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setIsLoading(true);
    try {
      // If token mode, update password
      if (token) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      }
      setCurrentStep(1);
    } catch (error: any) {
      console.error("Password error:", error);
      toast.error(error.message || "Erreur lors de la mise à jour du mot de passe");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async () => {
    if (!isValidPin(pin)) {
      toast.error("Le PIN doit contenir exactement 4 chiffres");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("Les codes PIN ne correspondent pas");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expirée");
        navigate("/field-sales");
        return;
      }

      const pinHash = await hashPin(pin);

      const { error } = await supabase
        .from("user_roles")
        .update({ staff_pin_hash: pinHash })
        .eq("user_id", session.user.id)
        .eq("role", "field_sales");

      if (error) throw error;
      setCurrentStep(2);
    } catch (error: any) {
      console.error("PIN error:", error);
      toast.error("Erreur lors de la configuration du PIN");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTermsSubmit = async () => {
    if (!termsAccepted) {
      toast.error("Vous devez accepter les conditions");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expirée");
        navigate("/field-sales");
        return;
      }

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("user_roles")
        .update({
          terms_accepted_at: now,
          onboarding_completed_at: now,
          is_active: true,
          status: "active",
        })
        .eq("user_id", session.user.id)
        .eq("role", "field_sales");

      if (error) throw error;

      toast.success("Configuration terminée!");
      navigate("/field-sales/dashboard");
    } catch (error: any) {
      console.error("Terms error:", error);
      toast.error("Erreur lors de l'activation du compte");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4">
      <StaffBackground />
      
      <div className="w-full max-w-md z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-xl shadow-orange-500/20 mb-4">
            <Briefcase className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configuration du compte</h1>
          <p className="text-slate-400">Vendeur Terrain - Nivra</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((step, index) => (
            <div key={step} className="flex-1">
              <div 
                className={`h-1.5 rounded-full transition-colors ${
                  index <= currentStep 
                    ? "bg-orange-500" 
                    : "bg-slate-700"
                }`}
              />
              <p className={`text-xs mt-2 text-center ${
                index <= currentStep ? "text-orange-400" : "text-slate-500"
              }`}>
                {step}
              </p>
            </div>
          ))}
        </div>

        {/* Step 1: Password */}
        {currentStep === 0 && (
          <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Lock className="h-5 w-5 text-orange-400" />
                Créer votre mot de passe
              </CardTitle>
              <CardDescription className="text-slate-400">
                Choisissez un mot de passe sécurisé pour votre compte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe (min. 8 caractères)"
                  className="bg-slate-800/50 border-slate-600 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le mot de passe"
                className="bg-slate-800/50 border-slate-600 text-white"
              />
              <Button
                onClick={handlePasswordSubmit}
                disabled={isLoading || password.length < 8}
                className="w-full bg-orange-500 hover:bg-orange-400"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continuer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: PIN */}
        {currentStep === 1 && (
          <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-orange-400" />
                Code PIN sécurisé
              </CardTitle>
              <CardDescription className="text-slate-400">
                Créez un code PIN à 4 chiffres pour les opérations sensibles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Code PIN (4 chiffres)"
                className="bg-slate-800/50 border-slate-600 text-white text-center text-2xl tracking-widest"
                maxLength={4}
              />
              <Input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Confirmer le PIN"
                className="bg-slate-800/50 border-slate-600 text-white text-center text-2xl tracking-widest"
                maxLength={4}
              />
              <Button
                onClick={handlePinSubmit}
                disabled={isLoading || pin.length !== 4}
                className="w-full bg-orange-500 hover:bg-orange-400"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continuer
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Terms */}
        {currentStep === 2 && (
          <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-orange-400" />
                Conditions d'utilisation
              </CardTitle>
              <CardDescription className="text-slate-400">
                Veuillez lire et accepter les conditions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-48 overflow-y-auto p-4 rounded-lg bg-slate-800/50 border border-slate-600 text-sm text-slate-300 space-y-3">
                <p className="font-semibold text-white">Termes & Conditions - Vendeur Terrain Nivra</p>
                <p>En acceptant ces conditions, vous vous engagez à :</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Respecter la confidentialité des données clients</li>
                  <li>Ne pas divulguer vos identifiants de connexion</li>
                  <li>Signaler immédiatement toute activité suspecte</li>
                  <li>Utiliser l'application uniquement à des fins professionnelles</li>
                  <li>Respecter le code de conduite de Nivra Télécom</li>
                </ul>
                <p>Toute violation de ces conditions peut entraîner la résiliation immédiate de votre accès et des poursuites légales.</p>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="mt-0.5 border-orange-500 data-[state=checked]:bg-orange-500"
                />
                <label htmlFor="terms" className="text-sm text-slate-300 cursor-pointer">
                  J'ai lu et j'accepte les conditions d'utilisation et la politique de confidentialité
                </label>
              </div>

              <Button
                onClick={handleTermsSubmit}
                disabled={isLoading || !termsAccepted}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Activer mon compte
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
