import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PinSetupSectionBaseProps {
  userId: string | undefined;
  onPinChange: (pin: string) => void;
  pin: string;
  confirmPin: string;
  onConfirmPinChange: (pin: string) => void;
  isFrench?: boolean;
  /** If true, check for existing orders to determine if this is first order */
  checkFirstOrder?: boolean;
  supabaseClient: SupabaseClient<Database>;
}

export const PinSetupSectionBase = ({
  userId,
  onPinChange,
  pin,
  confirmPin,
  onConfirmPinChange,
  isFrench = true,
  checkFirstOrder = true,
  supabaseClient,
}: PinSetupSectionBaseProps) => {
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [isFirstOrder, setIsFirstOrder] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    const checkPinAndOrderStatus = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        // Check for existing PIN
        const { data: profileData, error: profileError } = await supabaseClient
          .from("profiles")
          .select("client_pin")
          .eq("user_id", userId)
          .maybeSingle();

        if (!profileError && profileData?.client_pin) {
          setHasExistingPin(true);
        }

        // If checking first order status, check for previous orders
        if (checkFirstOrder) {
          const { data: ordersData, error: ordersError } = await supabaseClient
            .from("orders")
            .select("id")
            .eq("user_id", userId)
            .limit(1);

          if (!ordersError && ordersData && ordersData.length > 0) {
            setIsFirstOrder(false);
          }
        }
      } catch (error) {
        console.error("Error checking PIN/order status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkPinAndOrderStatus();
  }, [userId, checkFirstOrder, supabaseClient]);


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

  // If not first order and no PIN (shouldn't happen normally), don't show section
  if (!isFirstOrder && !hasExistingPin) {
    return null;
  }

  return (
    <Card className="bg-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="w-5 h-5 text-primary" />
          {isFrench ? "Sécurité du compte — NIP à 4 chiffres" : "Account Security — 4-Digit PIN"}
          <Badge variant="outline" className="ml-2 text-xs bg-primary/10 text-primary border-primary/30">
            {isFrench ? "Requis" : "Required"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Explanation */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-700">
                {isFrench ? "Pourquoi un NIP?" : "Why a PIN?"}
              </p>
              <p className="text-xs text-amber-700/80">
                {isFrench
                  ? "Ce NIP protège votre compte. Notre équipe vous le demandera pour vérifier votre identité lors d'appels ou pour accéder à vos informations sensibles."
                  : "This PIN protects your account. Our team will ask for it to verify your identity during calls or to access your sensitive information."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">{isFrench ? "NIP (4 chiffres)" : "PIN (4 digits)"}</Label>
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                maxLength={4}
                value={pin}
                onChange={(e) => onPinChange(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="text-center text-xl tracking-[0.3em] pr-10 font-mono"
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
            <Label className="text-sm">{isFrench ? "Confirmer le NIP" : "Confirm PIN"}</Label>
            <Input
              type={showPin ? "text" : "password"}
              maxLength={4}
              value={confirmPin}
              onChange={(e) => onConfirmPinChange(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="text-center text-xl tracking-[0.3em] font-mono"
            />
          </div>
        </div>

        {/* Validation feedback */}
        <div className="flex items-center gap-4 text-xs">
          <span className={isPinValid ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
            {isPinValid ? "✓" : "○"} {isFrench ? "4 chiffres" : "4 digits"}
          </span>
          <span className={pinsMatch ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
            {pinsMatch ? "✓" : "○"} {isFrench ? "Correspondants" : "Matching"}
          </span>
        </div>

        {/* Note about management */}
        <p className="text-xs text-muted-foreground">
          {isFrench 
            ? "Vous pourrez modifier ce NIP plus tard dans les paramètres de votre profil."
            : "You can change this PIN later in your profile settings."}
        </p>
      </CardContent>
    </Card>
  );
};

// Helper function to validate PIN
export const validatePinSetup = (pin: string, confirmPin: string): { valid: boolean; error?: string } => {
  if (!pin || pin.length !== 4) {
    return { valid: false, error: "PIN must be 4 digits" };
  }
  if (!/^\d{4}$/.test(pin)) {
    return { valid: false, error: "PIN must contain only numbers" };
  }
  if (pin !== confirmPin) {
    return { valid: false, error: "PINs do not match" };
  }
  return { valid: true };
};
