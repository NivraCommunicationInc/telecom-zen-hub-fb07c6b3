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
 * 1. Log the action to telephony_logs (audit trail)
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

  const logTelephonyAction = async (action: "call" | "sms") => {
    if (!user?.id || !clientId) return;

    try {
      // Get agent profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      // Insert audit log via edge function (server-side)
      const { error } = await supabase.functions.invoke("log-telephony-action", {
        body: {
          clientId,
          action,
          agentUserId: user.id,
          agentName: profile?.full_name || user.email?.split("@")[0] || "Agent",
          agentEmail: profile?.email || user.email,
          phoneNumber: phoneE164,
        },
      });

      if (error) {
        // If edge function doesn't exist, log directly (fallback)
        console.warn("Edge function not available, using direct insert:", error.message);
        await supabase.from("telephony_logs").insert({
          client_id: clientId,
          action,
          direction: "outbound",
          agent_user_id: user.id,
          agent_name: profile?.full_name || user.email?.split("@")[0] || "Agent",
          agent_email: profile?.email || user.email,
          phone_number: phoneE164,
        });
      }
    } catch (err) {
      console.error("Failed to log telephony action:", err);
      // Don't block the action - just log the error
    }
  };

  const handleCall = async () => {
    if (!phoneE164) {
      toast({
        title: "Numéro invalide",
        description: "Le numéro de téléphone du client n'est pas valide.",
        variant: "destructive",
      });
      return;
    }

    setIsLoggingCall(true);
    try {
      await logTelephonyAction("call");
      
      // Open OpenPhone in new tab
      const url = getOpenPhoneDeepLink(phoneE164, "call");
      window.open(url, "_blank", "noopener,noreferrer");
      
      toast({
        title: "Appel initié",
        description: `Ouverture d'OpenPhone pour appeler ${clientName || formatPhoneDisplay(phoneE164)}`,
      });
    } finally {
      setIsLoggingCall(false);
    }
  };

  const handleSms = async () => {
    if (!phoneE164) {
      toast({
        title: "Numéro invalide",
        description: "Le numéro de téléphone du client n'est pas valide.",
        variant: "destructive",
      });
      return;
    }

    setIsLoggingSms(true);
    try {
      await logTelephonyAction("sms");
      
      // Open OpenPhone SMS in new tab
      const url = getOpenPhoneDeepLink(phoneE164, "sms");
      window.open(url, "_blank", "noopener,noreferrer");
      
      toast({
        title: "SMS",
        description: `Ouverture d'OpenPhone pour envoyer un SMS à ${clientName || formatPhoneDisplay(phoneE164)}`,
      });
    } finally {
      setIsLoggingSms(false);
    }
  };

  if (!clientPhone) {
    return null;
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={handleCall}
          disabled={isLoggingCall || !phoneE164}
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
          disabled={isLoggingSms || !phoneE164}
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
        disabled={isLoggingCall || !phoneE164}
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
        disabled={isLoggingSms || !phoneE164}
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
