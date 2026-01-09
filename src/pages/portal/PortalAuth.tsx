/**
 * Client Portal Authentication Page
 * 
 * PIN-based authentication for clients to access their portal.
 * Sessions use InMemoryStorage (no localStorage persistence).
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const PortalAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const isFrench = language === "fr";
  
  const [step, setStep] = useState<"email" | "pin">("email");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get redirect destination from location state
  const redirectTo = (location.state as any)?.redirectTo || "/portal/dashboard";

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Request PIN to be sent to email
      const { error: sendError } = await portalSupabase.functions.invoke("client-pin-send", {
        body: { email: email.toLowerCase().trim() }
      });

      if (sendError) {
        throw new Error(sendError.message || "Failed to send PIN");
      }

      setStep("pin");
    } catch (err: any) {
      setError(isFrench 
        ? "Erreur lors de l'envoi du code. Vérifiez votre courriel." 
        : "Error sending code. Please check your email."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await portalSupabase.functions.invoke("client-pin-verify", {
        body: { email: email.toLowerCase().trim(), pin }
      });

      if (verifyError || !data?.session) {
        throw new Error(verifyError?.message || "Invalid PIN");
      }

      // Set session in portal client
      await portalSupabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      // Navigate to destination
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(isFrench 
        ? "Code invalide ou expiré. Veuillez réessayer." 
        : "Invalid or expired code. Please try again."
      );
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (value: string) => {
    setPin(value);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {isFrench ? "Portail client" : "Client Portal"}
          </CardTitle>
          <CardDescription>
            {step === "email" 
              ? (isFrench ? "Entrez votre courriel pour recevoir un code de connexion" : "Enter your email to receive a login code")
              : (isFrench ? "Entrez le code à 6 chiffres envoyé à votre courriel" : "Enter the 6-digit code sent to your email")
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  {isFrench ? "Courriel" : "Email"}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !email}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                {isFrench ? "Envoyer le code" : "Send code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>
                  {isFrench ? "Code de vérification" : "Verification code"}
                </Label>
                <div className="flex justify-center">
                  <InputOTP
                    value={pin}
                    onChange={handlePinChange}
                    maxLength={6}
                    disabled={isLoading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || pin.length !== 6}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <KeyRound className="w-4 h-4 mr-2" />
                )}
                {isFrench ? "Vérifier" : "Verify"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("email");
                  setPin("");
                  setError(null);
                }}
                disabled={isLoading}
              >
                {isFrench ? "Utiliser un autre courriel" : "Use a different email"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PortalAuth;
