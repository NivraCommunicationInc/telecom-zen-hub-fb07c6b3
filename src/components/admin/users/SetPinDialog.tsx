import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface SetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  isReset?: boolean;
  onSubmit: (pin: string, requireChange: boolean) => void;
  isPending: boolean;
}

export function SetPinDialog({
  open,
  onOpenChange,
  userName,
  isReset = false,
  onSubmit,
  isPending,
}: SetPinDialogProps) {
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [requireChange, setRequireChange] = useState(true);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");
    
    if (!/^\d{4}$/.test(pin)) {
      setError("Le PIN doit être exactement 4 chiffres");
      return;
    }
    
    if (pin !== pinConfirm) {
      setError("Les PINs ne correspondent pas");
      return;
    }
    
    onSubmit(pin, requireChange);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPin("");
      setPinConfirm("");
      setError("");
      setRequireChange(true);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {isReset ? "Réinitialiser le PIN" : "Définir le PIN"}
          </DialogTitle>
          <DialogDescription>
            {isReset
              ? `Réinitialiser le PIN de ${userName}`
              : `Définir un nouveau PIN pour ${userName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nouveau PIN (4 chiffres)</Label>
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
                placeholder="****"
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Confirmer le PIN</Label>
            <Input
              type={showPin ? "text" : "password"}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              placeholder="****"
              inputMode="numeric"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="require-change"
              checked={requireChange}
              onCheckedChange={(checked) => setRequireChange(checked === true)}
            />
            <label htmlFor="require-change" className="text-sm">
              Exiger changement de PIN au prochain login
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Enregistrement..." : isReset ? "Réinitialiser" : "Définir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
