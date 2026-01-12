import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [isLoggingSms, setIsLoggingSms] = useState(false);

  const phoneE164 = clientPhone ? toE164(clientPhone) : null;

  /**
   * Log telephony action via Edge Function (server-side with service role)
   * Throws on error (caller decides whether to still proceed).
   */
  const logTelephonyAction = async (action: "call" | "sms"): Promise<{ ok: true; id: string }> => {
    if (!clientId || !phoneE164) {
      throw new Error("Missing required fields (clientId/phone)");
    }

    const payload = {
      client_id: clientId,
      action,
      direction: "outbound",
      phone_number: phoneE164,
      raw_payload: {},
    };

    console.info("TELEPHONY_LOG_PAYLOAD", payload);

    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/log-telephony-action`;
    const apikey = (import.meta.env as any).VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    console.info("TELEPHONY_FETCH_URL", url);
    console.info("TELEPHONY_JWT_PRESENT", Boolean(jwt), "len", jwt?.length);

    if (!jwt) {
      throw new Error("No session JWT available (not logged in?)");
    }
    if (!apikey) {
      throw new Error("Missing publishable API key (VITE_SUPABASE_PUBLISHABLE_KEY)");
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
        apikey,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.info("TELEPHONY_FETCH_STATUS", res.status);
    console.info("TELEPHONY_FETCH_BODY", text);

    if (!res.ok) {
      throw new Error(`log-telephony-action failed ${res.status}: ${text}`);
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // ignore
    }

    if (!parsed?.ok || !parsed?.id) {
      throw new Error(`log-telephony-action unexpected response: ${text}`);
    }

    console.info("TELEPHONY_LOG_RESPONSE", parsed);
    return parsed as { ok: true; id: string };
  };

  const handleCall = async () => {
    // TEMPORARY DEBUG LOG - proves handler is wired correctly
    console.info("CALL_CLICK_HANDLER_HIT", { clientId, clientPhone, phoneE164 });
    
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
      try {
        await logTelephonyAction("call");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("TELEPHONY_LOG_ERROR", msg);
        toast({
          title: "Erreur de journalisation",
          description: msg,
          variant: "destructive",
        });
      }

      // Open OpenPhone in new tab AFTER logging attempt
      const url = getOpenPhoneDeepLink(phoneE164, "call");
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setIsLoggingCall(false);
    }
  };

  const handleSms = async () => {
    // TEMPORARY DEBUG LOG - proves handler is wired correctly
    console.info("SMS_CLICK_HANDLER_HIT", { clientId, clientPhone, phoneE164 });
    
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
      try {
        await logTelephonyAction("sms");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("TELEPHONY_LOG_ERROR", msg);
        toast({
          title: "Erreur de journalisation",
          description: msg,
          variant: "destructive",
        });
      }

      // Open OpenPhone SMS in new tab AFTER logging attempt
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
