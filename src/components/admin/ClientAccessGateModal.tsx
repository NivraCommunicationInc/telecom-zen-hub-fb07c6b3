import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, AlertTriangle, Mail, Loader2, KeyRound, ShieldCheck, User, AlertCircle } from "lucide-react";

interface ClientAccessGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccessGranted: () => void;
  client: {
    id: string;
    user_id: string;
    full_name?: string;
    email?: string;
    date_of_birth?: string;
    service_postal_code?: string;
    client_pin?: string | null;
  };
  staffUser: {
    id: string;
    name: string;
    email?: string;
    role: string;
  };
  isAdminBypass?: boolean;
}

const accessReasons = [
  { value: "billing", label: "Facturation" },
  { value: "plan_change", label: "Changement de forfait" },
  { value: "equipment", label: "Équipement" },
  { value: "appointment", label: "Rendez-vous" },
  { value: "support", label: "Support" },
  { value: "other", label: "Autre" },
];

export const ClientAccessGateModal = ({
  isOpen,
  onClose,
  onAccessGranted,
  client,
  staffUser,
  isAdminBypass = false,
}: ClientAccessGateModalProps) => {
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"pin" | "recovery">("pin");
  const [hasNoPin, setHasNoPin] = useState(false);
  
  // Recovery form state
  const [recoveryMethod, setRecoveryMethod] = useState<"email_otp" | "dob_postal" | "email_postal">("dob_postal");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryDob, setRecoveryDob] = useState("");
  const [recoveryPostal, setRecoveryPostal] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  
  // Force PIN setup after no-pin recovery
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setReason("");
      setFailedAttempts(0);
      setIsLockedOut(false);
      setActiveTab("pin");
      setOtpSent(false);
      setOtpCode("");
      setRecoveryEmail("");
      setRecoveryDob("");
      setRecoveryPostal("");
      setShowPinSetup(false);
      setNewPin("");
      setConfirmPin("");
      checkPinStatus();
    }
  }, [isOpen, client.user_id]);

  const checkPinStatus = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("client_pin, pin_failed_attempts, pin_lockout_until")
        .eq("user_id", client.user_id)
        .maybeSingle();

      // Check if no PIN is set
      if (!profile?.client_pin) {
        setHasNoPin(true);
        setActiveTab("recovery");
      } else {
        setHasNoPin(false);
      }

      // Check lockout status
      if (profile?.pin_lockout_until) {
        const lockoutEnd = new Date(profile.pin_lockout_until);
        if (lockoutEnd > new Date()) {
          setIsLockedOut(true);
          setLockoutEndTime(lockoutEnd);
          setFailedAttempts(profile.pin_failed_attempts || 0);
        }
      }
    } catch (error) {
      console.error("Error checking PIN status:", error);
    }
  };

  const logAccess = async (method: string, result: "success" | "fail") => {
    try {
      await supabase.from("client_access_logs").insert({
        client_id: client.user_id,
        client_name: client.full_name || client.email,
        staff_user_id: staffUser.id,
        staff_name: staffUser.name,
        staff_email: staffUser.email,
        staff_role: staffUser.role,
        access_method: method,
        access_reason: reason || null,
        result,
        failed_attempt_count: failedAttempts,
      });
    } catch (error) {
      console.error("Error logging access:", error);
    }
  };

  const handlePinSubmit = async () => {
    if (!pin || pin.length !== 4) {
      toast({ title: "Veuillez entrer un NIP de 4 chiffres", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Get client's PIN
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("client_pin, pin_failed_attempts, pin_lockout_until")
        .eq("user_id", client.user_id)
        .maybeSingle();

      if (error) throw error;

      // Check if locked out
      if (profile?.pin_lockout_until && new Date(profile.pin_lockout_until) > new Date()) {
        toast({ title: "Compte verrouillé", description: "Trop de tentatives. Réessayez plus tard.", variant: "destructive" });
        setIsLockedOut(true);
        setLockoutEndTime(new Date(profile.pin_lockout_until));
        return;
      }

      // Verify PIN
      if (!profile?.client_pin) {
        toast({ title: "NIP non configuré", description: "Le client n'a pas encore configuré son NIP. Utilisez la récupération.", variant: "destructive" });
        setHasNoPin(true);
        setActiveTab("recovery");
        return;
      }

      if (profile.client_pin === pin) {
        // Success - reset failed attempts
        await supabase
          .from("profiles")
          .update({ pin_failed_attempts: 0, pin_lockout_until: null })
          .eq("user_id", client.user_id);

        await logAccess("pin", "success");
        toast({ title: "Accès accordé", description: `Profil de ${client.full_name || client.email}` });
        onAccessGranted();
      } else {
        // Failed attempt
        const newAttempts = (profile.pin_failed_attempts || 0) + 1;
        const updateData: any = { pin_failed_attempts: newAttempts };
        
        if (newAttempts >= 5) {
          const lockoutUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
          updateData.pin_lockout_until = lockoutUntil.toISOString();
          setIsLockedOut(true);
          setLockoutEndTime(lockoutUntil);
          toast({ title: "Compte verrouillé", description: "5 tentatives échouées. Verrouillé pour 10 minutes.", variant: "destructive" });
        } else {
          toast({ title: "NIP incorrect", description: `${5 - newAttempts} tentatives restantes`, variant: "destructive" });
        }

        await supabase
          .from("profiles")
          .update(updateData)
          .eq("user_id", client.user_id);

        setFailedAttempts(newAttempts);
        await logAccess("pin", "fail");
        setPin("");
      }
    } catch (error) {
      console.error("Error verifying PIN:", error);
      toast({ title: "Erreur", description: "Impossible de vérifier le NIP", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverySubmit = async () => {
    setIsLoading(true);
    try {
      let verified = false;
      let method = recoveryMethod;

      if (recoveryMethod === "dob_postal") {
        // Verify DOB + Postal
        const { data: profile } = await supabase
          .from("profiles")
          .select("date_of_birth, service_postal_code")
          .eq("user_id", client.user_id)
          .maybeSingle();

        if (profile) {
          const dobMatch = profile.date_of_birth === recoveryDob;
          const postalMatch = profile.service_postal_code?.toLowerCase().replace(/\s/g, "") === 
                             recoveryPostal.toLowerCase().replace(/\s/g, "");
          verified = dobMatch && postalMatch;
        }
      } else if (recoveryMethod === "email_postal") {
        // Verify Email + Postal
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, service_postal_code")
          .eq("user_id", client.user_id)
          .maybeSingle();

        if (profile) {
          const emailMatch = profile.email?.toLowerCase() === recoveryEmail.toLowerCase();
          const postalMatch = profile.service_postal_code?.toLowerCase().replace(/\s/g, "") === 
                             recoveryPostal.toLowerCase().replace(/\s/g, "");
          verified = emailMatch && postalMatch;
        }
      }

      if (verified) {
        // If client has no PIN, prompt staff to set one (for admin/employee only)
        if (hasNoPin && (staffUser.role === "admin" || staffUser.role === "employee")) {
          await logAccess("no_pin_recovery", "success");
          setShowPinSetup(true);
          toast({ title: "Identité vérifiée", description: "Veuillez définir un NIP pour ce client." });
        } else {
          await logAccess(hasNoPin ? "no_pin_recovery" : method, "success");
          toast({ title: "Identité vérifiée", description: "Accès accordé pour cette session" });
          onAccessGranted();
        }
      } else {
        await logAccess(method, "fail");
        toast({ title: "Vérification échouée", description: "Les informations ne correspondent pas", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error in recovery:", error);
      toast({ title: "Erreur", description: "Impossible de vérifier l'identité", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({ title: "Le NIP doit contenir exactement 4 chiffres", variant: "destructive" });
      return;
    }
    if (newPin !== confirmPin) {
      toast({ title: "Les NIP ne correspondent pas", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          client_pin: newPin,
          pin_failed_attempts: 0,
          pin_lockout_until: null,
        })
        .eq("user_id", client.user_id);

      if (error) throw error;

      toast({ title: "NIP créé avec succès", description: "Le client peut maintenant utiliser ce NIP." });
      onAccessGranted();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminBypass = async () => {
    setIsLoading(true);
    try {
      await logAccess("admin_bypass", "success");
      toast({ title: "Accès admin accordé" });
      onAccessGranted();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };


  const formatLockoutTime = () => {
    if (!lockoutEndTime) return "";
    const now = new Date();
    const diff = Math.max(0, Math.floor((lockoutEndTime.getTime() - now.getTime()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Accès sécurisé au profil client
          </DialogTitle>
          <DialogDescription>
            Entrez le NIP client pour accéder au profil
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Staff info */}
          <div className="p-3 rounded-lg bg-accent/50 border border-border">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Connecté en tant que:</span>
              <span className="font-medium">{staffUser.name}</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {staffUser.role}
              </Badge>
            </div>
          </div>

          {/* Client info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">Profil demandé:</p>
            <p className="font-medium">{client.full_name || client.email}</p>
          </div>

          {/* No PIN warning */}
          {hasNoPin && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-amber-600 font-medium">
                  Ce client n'a pas encore configuré de NIP
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Utilisez la vérification d'identité pour accéder au profil.
              </p>
            </div>
          )}

          {/* PIN Setup after recovery */}
          {showPinSetup && (
            <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <p className="text-sm font-medium">Créer un NIP pour ce client:</p>
              <div className="space-y-2">
                <Label>Nouveau NIP (4 chiffres)</Label>
                <Input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="text-center text-xl tracking-[0.5em]"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmer le NIP</Label>
                <Input
                  type="password"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="text-center text-xl tracking-[0.5em]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPinSetup(false);
                    onAccessGranted();
                  }}
                  className="flex-1"
                >
                  Ignorer
                </Button>
                <Button
                  onClick={handleSetNewPin}
                  disabled={isLoading || newPin.length !== 4}
                  className="flex-1"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Créer NIP
                </Button>
              </div>
            </div>
          )}

          {isAdminBypass && staffUser.role === "admin" && !showPinSetup && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-amber-600">
                  Mode bypass admin disponible
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdminBypass}
                disabled={isLoading}
                className="mt-2 w-full"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Accéder sans NIP (journalisé)
              </Button>
            </div>
          )}

          {isLockedOut && !showPinSetup ? (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="font-medium text-red-600">Compte verrouillé</p>
              <p className="text-sm text-muted-foreground mt-1">
                Trop de tentatives échouées. Réessayez dans {formatLockoutTime()}
              </p>
              <Button 
                variant="link" 
                className="mt-2"
                onClick={() => setActiveTab("recovery")}
              >
                Utiliser la récupération d'identité
              </Button>
            </div>
          ) : !showPinSetup && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pin" | "recovery")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pin" className="flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  NIP
                </TabsTrigger>
                <TabsTrigger value="recovery" className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Récupération
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pin" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>NIP client (4 chiffres)</Label>
                  <Input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="text-center text-2xl tracking-[0.5em]"
                    autoFocus
                  />
                  {failedAttempts > 0 && (
                    <p className="text-xs text-amber-500">
                      {5 - failedAttempts} tentative(s) restante(s)
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Raison de l'accès (optionnel)</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une raison" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessReasons.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handlePinSubmit}
                  disabled={isLoading || pin.length !== 4}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  Confirmer
                </Button>
              </TabsContent>

              <TabsContent value="recovery" className="space-y-4 mt-4">
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p className="font-medium mb-1">Client a oublié son NIP?</p>
                  <p className="text-muted-foreground">
                    Vérifiez l'identité du client avec l'une des méthodes ci-dessous.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Méthode de vérification</Label>
                  <Select 
                    value={recoveryMethod} 
                    onValueChange={(v) => setRecoveryMethod(v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dob_postal">Date de naissance + Code postal</SelectItem>
                      <SelectItem value="email_postal">Courriel + Code postal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recoveryMethod === "dob_postal" && (
                  <>
                    <div className="space-y-2">
                      <Label>Date de naissance</Label>
                      <Input
                        type="date"
                        value={recoveryDob}
                        onChange={(e) => setRecoveryDob(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code postal</Label>
                      <Input
                        value={recoveryPostal}
                        onChange={(e) => setRecoveryPostal(e.target.value)}
                        placeholder="H1A 1A1"
                      />
                    </div>
                  </>
                )}

                {recoveryMethod === "email_postal" && (
                  <>
                    <div className="space-y-2">
                      <Label>Courriel du client</Label>
                      <Input
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="client@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Code postal</Label>
                      <Input
                        value={recoveryPostal}
                        onChange={(e) => setRecoveryPostal(e.target.value)}
                        placeholder="H1A 1A1"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Raison de l'accès</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une raison" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessReasons.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleRecoverySubmit}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 mr-2" />
                  )}
                  Vérifier l'identité
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
