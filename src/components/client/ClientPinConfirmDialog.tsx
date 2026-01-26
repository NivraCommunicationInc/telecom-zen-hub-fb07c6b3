import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portalClient as supabase } from "@/integrations/backend";
import { Loader2, Shield, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hashPin, isValidPin, DEFAULT_PIN } from "@/lib/pinUtils";

interface ClientPinConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onConfirmed: () => void;
  title?: string;
  description?: string;
}

export const ClientPinConfirmDialog = ({
  open,
  onOpenChange,
  userId,
  onConfirmed,
  title = "Confirmation de sécurité",
  description = "Pour votre sécurité, veuillez entrer votre NIP client pour confirmer cette action.",
}: ClientPinConfirmDialogProps) => {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!isValidPin(pin)) {
      setError("Le NIP doit contenir 4 chiffres");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      // Check if user has default PIN
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("pin_is_default, client_pin_hash")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;

      // If no PIN set, allow through with warning
      if (!profile?.client_pin_hash) {
        onConfirmed();
        onOpenChange(false);
        setPin("");
        return;
      }

      // Verify PIN
      let isValid = false;

      if (profile.pin_is_default) {
        // Check against default PIN
        isValid = pin === DEFAULT_PIN;
      } else {
        // Use server-side verification
        const { data: verifyResult, error: verifyError } = await supabase.rpc(
          "verify_pin",
          { user_id_input: userId, pin_input: pin }
        );
        if (verifyError) throw verifyError;
        isValid = verifyResult === true;
      }

      if (isValid) {
        onConfirmed();
        onOpenChange(false);
        setPin("");
        toast({ title: "Identité confirmée" });
      } else {
        setError("NIP incorrect");
      }
    } catch (err: any) {
      console.error("PIN verification error:", err);
      setError(err.message || "Erreur de vérification");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setPin("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>NIP client (4 chiffres)</Label>
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                placeholder="••••"
                className={`text-center text-xl tracking-[0.5em] pr-10 ${
                  error ? "border-destructive" : ""
                }`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pin.length === 4) {
                    handleVerify();
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isVerifying}>
            Annuler
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isVerifying || pin.length !== 4}
          >
            {isVerifying ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClientPinConfirmDialog;
