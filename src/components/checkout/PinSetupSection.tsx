import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface PinSetupSectionProps {
  userId: string | undefined;
  onPinChange: (pin: string) => void;
  pin: string;
  confirmPin: string;
  onConfirmPinChange: (pin: string) => void;
  isFrench?: boolean;
}

export const PinSetupSection = ({
  userId,
  onPinChange,
  pin,
  confirmPin,
  onConfirmPinChange,
  isFrench = true,
}: PinSetupSectionProps) => {
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    const checkExistingPin = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("client_pin")
          .eq("user_id", userId)
          .maybeSingle();

        if (!error && data?.client_pin) {
          setHasExistingPin(true);
        }
      } catch (error) {
        console.error("Error checking PIN:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingPin();
  }, [userId]);

  const isPinValid = pin.length === 4 && /^\d{4}$/.test(pin);
  const pinsMatch = pin === confirmPin && pin.length > 0;

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-4 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">
            {isFrench ? "Chargement..." : "Loading..."}
          </span>
        </CardContent>
      </Card>
    );
  }

  // If user already has a PIN, show confirmation
  if (hasExistingPin) {
    return (
      <Card className="bg-emerald-500/10 border-emerald-500/30">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-600">
              {isFrench ? "NIP client déjà configuré" : "Client PIN already configured"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isFrench
                ? "Votre NIP sécurise l'accès à votre compte."
                : "Your PIN secures access to your account."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-5 h-5 text-primary" />
          {isFrench ? "NIP de sécurité (4 chiffres)" : "Security PIN (4 digits)"}
          <Badge variant="outline" className="ml-2 text-xs">
            {isFrench ? "Requis" : "Required"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              {isFrench
                ? "Ce NIP protégera votre compte. Notre équipe vous le demandera pour accéder à vos informations."
                : "This PIN will protect your account. Our team will ask for it to access your information."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{isFrench ? "NIP (4 chiffres)" : "PIN (4 digits)"}</Label>
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                maxLength={4}
                value={pin}
                onChange={(e) => onPinChange(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="text-center text-xl tracking-[0.3em] pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{isFrench ? "Confirmer le NIP" : "Confirm PIN"}</Label>
            <Input
              type={showPin ? "text" : "password"}
              maxLength={4}
              value={confirmPin}
              onChange={(e) => onConfirmPinChange(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="text-center text-xl tracking-[0.3em]"
            />
          </div>
        </div>

        {/* Validation feedback */}
        <div className="flex items-center gap-4 text-xs">
          <span className={isPinValid ? "text-emerald-500" : "text-muted-foreground"}>
            {isPinValid ? "✓" : "○"} {isFrench ? "4 chiffres" : "4 digits"}
          </span>
          <span className={pinsMatch ? "text-emerald-500" : "text-muted-foreground"}>
            {pinsMatch ? "✓" : "○"} {isFrench ? "Correspondants" : "Matching"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
