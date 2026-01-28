import { useState } from "react";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLockdownMode } from "@/hooks/useLockdownMode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LockdownButtonProps {
  compact?: boolean;
}

export const LockdownButton = ({ compact = false }: LockdownButtonProps) => {
  const { isLockdownActive, isLoading } = useLockdownMode();
  const [isToggling, setIsToggling] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error("Session expirée. Veuillez vous reconnecter.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("toggle-lockdown", {
        body: { enabled: !isLockdownActive },
      });

      if (error) {
        console.error("Toggle lockdown error:", error);
        toast.error("Erreur lors du changement de mode");
        return;
      }

      if (data?.success) {
        if (data.lockdown.enabled) {
          toast.warning("🔒 MODE VERROUILLAGE ACTIVÉ", {
            description: "Tout le site est maintenant bloqué. Seul le mot de passe secret permet l'accès.",
            duration: 10000,
          });
        } else {
          toast.success("🔓 Site déverrouillé", {
            description: "Le site est maintenant accessible à tous.",
          });
        }
        setDialogOpen(false);
        // Force refresh the page to update lockdown state
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err) {
      console.error("Toggle lockdown error:", err);
      toast.error("Erreur de communication avec le serveur");
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return null;
  }

  const buttonContent = (
    <Button
      variant={isLockdownActive ? "destructive" : "ghost"}
      size={compact ? "icon" : "sm"}
      className={
        isLockdownActive
          ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      }
      disabled={isToggling}
    >
      {isToggling ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isLockdownActive ? (
        <>
          <ShieldAlert className="w-4 h-4" />
          {!compact && <span className="ml-2">VERROUILLÉ</span>}
        </>
      ) : (
        <>
          <ShieldCheck className="w-4 h-4" />
          {!compact && <span className="ml-2">Verrouiller</span>}
        </>
      )}
    </Button>
  );

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            {buttonContent}
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{isLockdownActive ? "Mode verrouillage actif - Cliquer pour désactiver" : "Verrouillage d'urgence"}</p>
        </TooltipContent>
      </Tooltip>

      <AlertDialogContent className="bg-slate-900 border-slate-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white flex items-center gap-2">
            {isLockdownActive ? (
              <>
                <ShieldCheck className="w-5 h-5 text-green-400" />
                Désactiver le verrouillage ?
              </>
            ) : (
              <>
                <ShieldAlert className="w-5 h-5 text-red-400" />
                Activer le verrouillage total ?
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            {isLockdownActive ? (
              "Le site redeviendra accessible à tous les visiteurs."
            ) : (
              <>
                <span className="text-red-400 font-semibold">ATTENTION :</span> Cette action bloquera 
                l'accès à <strong>tout</strong> le site (y compris l'admin). Seul le mot de passe 
                secret permettra de déverrouiller.
                <br /><br />
                <span className="text-slate-500">Les données ne seront pas effacées.</span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleToggle();
            }}
            disabled={isToggling}
            className={
              isLockdownActive
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }
          >
            {isToggling ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {isLockdownActive ? "Déverrouiller le site" : "Verrouiller maintenant"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
