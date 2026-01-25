import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Shield, Eye, EyeOff, Loader2, AlertCircle, Lock, Clock 
} from "lucide-react";
import { toast } from "sonner";

interface StaffClientAccessGateProps {
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  isOpen: boolean;
  onClose: () => void;
  onAccessGranted: () => void;
}

interface AccessSession {
  clientId: string;
  expiresAt: number;
}

const STORAGE_KEY = "nivra_staff_client_sessions";

export function StaffClientAccessGate({
  clientId,
  clientName,
  clientEmail,
  isOpen,
  onClose,
  onAccessGranted,
}: StaffClientAccessGateProps) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);

  // Check for existing valid session
  useEffect(() => {
    if (isOpen) {
      const session = getValidSession(clientId);
      if (session) {
        // Session still valid, grant access immediately
        onAccessGranted();
        onClose();
      }
    }
  }, [isOpen, clientId, onAccessGranted, onClose]);

  const getValidSession = (clientId: string): AccessSession | null => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      
      const sessions: AccessSession[] = JSON.parse(stored);
      const now = Date.now();
      const valid = sessions.find(
        (s) => s.clientId === clientId && s.expiresAt > now
      );
      return valid || null;
    } catch {
      return null;
    }
  };

  const saveSession = (clientId: string, expiresAt: string) => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const sessions: AccessSession[] = stored ? JSON.parse(stored) : [];
      
      // Remove old session for this client
      const filtered = sessions.filter((s) => s.clientId !== clientId);
      
      // Add new session
      filtered.push({
        clientId,
        expiresAt: new Date(expiresAt).getTime(),
      });
      
      // Clean expired sessions
      const now = Date.now();
      const valid = filtered.filter((s) => s.expiresAt > now);
      
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    } catch {
      // Ignore storage errors
    }
  };

  const handleSubmit = async () => {
    if (!pin || pin.length !== 4) {
      toast.error("Veuillez entrer votre NIP à 4 chiffres");
      return;
    }

    if (!reason || reason.length < 3) {
      toast.error("Veuillez indiquer la raison de l'accès");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("staff-verify-pin", {
        body: {
          pin,
          client_user_id: clientId,
          reason,
        },
      });

      if (error) {
        toast.error("Erreur de connexion au serveur");
        return;
      }

      if (data?.locked) {
        setIsLocked(true);
        if (data.lockout_until) {
          const minutes = Math.ceil(
            (new Date(data.lockout_until).getTime() - Date.now()) / 60000
          );
          setLockoutMinutes(minutes);
        }
        toast.error(data.message);
        return;
      }

      if (data?.ok) {
        // Save session
        saveSession(clientId, data.expires_at);
        toast.success("Accès accordé");
        onAccessGranted();
        onClose();
        // Reset form
        setPin("");
        setReason("");
      } else {
        setAttemptsRemaining(data?.attempts_remaining ?? null);
        toast.error(data?.message || "NIP incorrect");
        setPin("");
      }
    } catch (error) {
      console.error("PIN verification error:", error);
      toast.error("Erreur inattendue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
            <DialogTitle className="text-white">Authentification requise</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400">
            Pour accéder au profil de{" "}
            <span className="text-white font-medium">
              {clientName || clientEmail || "ce client"}
            </span>
            , veuillez entrer votre NIP de sécurité.
          </DialogDescription>
        </DialogHeader>

        {isLocked ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 p-4 rounded-full bg-red-500/20 w-fit">
              <Lock className="h-8 w-8 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-red-400 mb-2">
              Compte temporairement verrouillé
            </h3>
            <p className="text-slate-400">
              Trop de tentatives incorrectes. Réessayez dans{" "}
              <span className="text-white font-medium">{lockoutMinutes} minute(s)</span>.
            </p>
            <Button
              variant="outline"
              className="mt-6 border-slate-600 text-slate-300"
              onClick={onClose}
            >
              Fermer
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Raison de l'accès</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Vérification de l'abonnement, support technique..."
                className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Votre NIP (4 chiffres)</Label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  maxLength={4}
                  className="bg-slate-800 border-slate-700 text-white text-center text-2xl tracking-widest pr-10"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {attemptsRemaining !== null && attemptsRemaining < 5 && (
                <p className="text-amber-400 text-sm flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {attemptsRemaining} tentative(s) restante(s)
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || pin.length !== 4}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Vérifier"
                )}
              </Button>
            </div>

            <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              L'accès sera valide 15 minutes
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Hook to check if access is granted for a client
export function useStaffClientAccess() {
  const checkAccess = useCallback((clientId: string): boolean => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      
      const sessions: AccessSession[] = JSON.parse(stored);
      const now = Date.now();
      return sessions.some((s) => s.clientId === clientId && s.expiresAt > now);
    } catch {
      return false;
    }
  }, []);

  const revokeAccess = useCallback((clientId: string) => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const sessions: AccessSession[] = JSON.parse(stored);
      const filtered = sessions.filter((s) => s.clientId !== clientId);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Ignore
    }
  }, []);

  const revokeAllAccess = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return { checkAccess, revokeAccess, revokeAllAccess };
}
