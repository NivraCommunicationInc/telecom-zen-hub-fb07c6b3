import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { toE164, getOpenPhoneDeepLink, formatPhoneDisplay } from "@/lib/phoneUtils";

interface ClientPhoneActionsProps {
  clientId: string;
  clientPhone?: string;
  clientName?: string;
  variant?: "default" | "compact";
}

/**
 * Call and SMS buttons that:
 * 1. Log the action to telephony_logs via Edge Function (audit trail)
 * 2. Open OpenPhone with the client's number prefilled
 */
export const ClientPhoneActions = ({ 
  clientId, 
  clientPhone, 
  clientName,
  variant = "default" 
}: ClientPhoneActionsProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [isLoggingSms, setIsLoggingSms] = useState(false);

  const phoneE164 = clientPhone ? toE164(clientPhone) : null;

  /**
   * Log telephony action via Edge Function (server-side with service role)
   * Returns true if logged successfully, false otherwise
   */
  const logTelephonyAction = async (action: "call" | "sms"): Promise<boolean> => {
    if (!user?.id || !clientId || !phoneE164) {
      console.error("TELEPHONY_LOG_ERROR", { error: "Missing required fields", user: user?.id, clientId, phoneE164 });
      return false;
    }

    const payload = {
      client_id: clientId,
      action,
      direction: "outbound",
      phone_number: phoneE164,
    };

    console.info("TELEPHONY_LOG_PAYLOAD", payload);

    try {
      const { data, error } = await supabase.functions.invoke("log-telephony-action", {
        body: payload,
      });

      console.info("TELEPHONY_LOG_RESPONSE", { data, error });

      if (error) {
        console.error("TELEPHONY_LOG_ERROR", { error: error.message });
        toast({
          title: "Erreur de journalisation",
          description: error.message || "Impossible de journaliser l'action.",
          variant: "destructive",
        });
        return false;
      }

      if (!data?.ok) {
        const errorMsg = data?.error || "Réponse inattendue du serveur";
        console.error("TELEPHONY_LOG_ERROR", { error: errorMsg, data });
        toast({
          title: "Erreur de journalisation",
          description: errorMsg,
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("TELEPHONY_LOG_ERROR", { error: errorMsg, err });
      toast({
        title: "Erreur de journalisation",
        description: errorMsg,
        variant: "destructive",
      });
      return false;
    }
  };

  const handleCall = async () => {
    if (!phoneE164) {
      toast({
        title: "Numéro invalide",
        description: "Le numéro de téléphone du client n'est pas valide ou est manquant.",
        variant: "destructive",
      });
      return;
    }

    setIsLoggingCall(true);
    try {
      // IMPORTANT: Log BEFORE opening the window to ensure the request completes
      const logged = await logTelephonyAction("call");
      
      if (!logged) {
        // Still open OpenPhone but warn user
        toast({
          title: "Action ouverte",
          description: "OpenPhone s'ouvre, mais la journalisation a échoué.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Appel initié",
          description: `Ouverture d'OpenPhone pour appeler ${clientName || formatPhoneDisplay(phoneE164)}`,
        });
      }

      // Open OpenPhone in new tab AFTER logging
      const url = getOpenPhoneDeepLink(phoneE164, "call");
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setIsLoggingCall(false);
    }
  };

  const handleSms = async () => {
    if (!phoneE164) {
      toast({
        title: "Numéro invalide",
        description: "Le numéro de téléphone du client n'est pas valide ou est manquant.",
        variant: "destructive",
      });
      return;
    }

    setIsLoggingSms(true);
    try {
      // IMPORTANT: Log BEFORE opening the window to ensure the request completes
      const logged = await logTelephonyAction("sms");
      
      if (!logged) {
        // Still open OpenPhone but warn user
        toast({
          title: "Action ouverte",
          description: "OpenPhone s'ouvre, mais la journalisation a échoué.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "SMS",
          description: `Ouverture d'OpenPhone pour envoyer un SMS à ${clientName || formatPhoneDisplay(phoneE164)}`,
        });
      }

      // Open OpenPhone SMS in new tab AFTER logging
      const url = getOpenPhoneDeepLink(phoneE164, "sms");
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setIsLoggingSms(false);
    }
  };

  if (!clientPhone) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Numéro manquant
      </div>
    );
  }

  if (!phoneE164) {
    return (
      <div className="text-sm text-destructive italic">
        Numéro invalide
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={handleCall}
          disabled={isLoggingCall}
          title="Appeler"
        >
          {isLoggingCall ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Phone className="h-4 w-4 text-cyan-500" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={handleSms}
          disabled={isLoggingSms}
          title="SMS"
        >
          {isLoggingSms ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4 text-emerald-500" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleCall}
        disabled={isLoggingCall}
        className="gap-2"
      >
        {isLoggingCall ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Phone className="h-4 w-4 text-cyan-500" />
        )}
        Appeler
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleSms}
        disabled={isLoggingSms}
        className="gap-2"
      >
        {isLoggingSms ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageSquare className="h-4 w-4 text-emerald-500" />
        )}
        SMS
      </Button>
    </div>
  );
};

export default ClientPhoneActions;
