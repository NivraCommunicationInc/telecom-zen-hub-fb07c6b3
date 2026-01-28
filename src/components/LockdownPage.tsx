import { useState } from "react";
import { Shield, Lock, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface LockdownPageProps {
  messageFr?: string;
  messageEn?: string;
  onUnlock?: () => void;
}

const LockdownPage = ({ messageFr, messageEn, onUnlock }: LockdownPageProps) => {
  const { language } = useLanguage();
  const [showUnlockForm, setShowUnlockForm] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const message = language === "fr" 
    ? (messageFr || "Site temporairement verrouillé pour maintenance de sécurité.")
    : (messageEn || "Site temporarily locked for security maintenance.");

  const handleUnlock = async () => {
    if (!password.trim()) {
      toast.error(language === "fr" ? "Veuillez entrer le mot de passe" : "Please enter the password");
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-lockdown-password", {
        body: { password },
      });

      if (error || !data?.success) {
        toast.error(language === "fr" ? "Mot de passe incorrect" : "Incorrect password");
        setPassword("");
        return;
      }

      // Store unlock token in sessionStorage
      sessionStorage.setItem("lockdown_unlocked", "true");
      sessionStorage.setItem("lockdown_unlock_time", Date.now().toString());
      
      toast.success(language === "fr" ? "Site déverrouillé!" : "Site unlocked!");
      onUnlock?.();
      
      // Force page reload to bypass lockdown
      window.location.reload();
    } catch (err) {
      console.error("Unlock error:", err);
      toast.error(language === "fr" ? "Erreur de vérification" : "Verification error");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg w-full">
        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl mb-4">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Nivra
            </h1>
          </div>

          {/* Alert */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-semibold text-red-400 mb-1">
                  {language === "fr" ? "Site Verrouillé" : "Site Locked"}
                </h2>
                <p className="text-slate-300 text-sm">
                  {message}
                </p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="text-center text-slate-400 text-sm mb-6">
            <p>
              {language === "fr" 
                ? "Ce site est actuellement en mode de sécurité totale. L'accès est restreint."
                : "This site is currently in total security mode. Access is restricted."}
            </p>
          </div>

          {/* Unlock Section */}
          {!showUnlockForm ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUnlockForm(true)}
              className="w-full text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
            >
              <Lock className="w-4 h-4 mr-2" />
              {language === "fr" ? "Accès administrateur" : "Administrator access"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={language === "fr" ? "Mot de passe de déverrouillage" : "Unlock password"}
                  className="bg-slate-700/50 border-slate-600 text-white pr-10"
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                  disabled={isVerifying}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowUnlockForm(false);
                    setPassword("");
                  }}
                  className="flex-1 text-slate-400"
                  disabled={isVerifying}
                >
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button
                  onClick={handleUnlock}
                  disabled={isVerifying || !password.trim()}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                >
                  {isVerifying 
                    ? (language === "fr" ? "Vérification..." : "Verifying...")
                    : (language === "fr" ? "Déverrouiller" : "Unlock")
                  }
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          © {new Date().getFullYear()} Nivra Telecom Inc.
        </p>
      </div>
    </div>
  );
};

export default LockdownPage;
