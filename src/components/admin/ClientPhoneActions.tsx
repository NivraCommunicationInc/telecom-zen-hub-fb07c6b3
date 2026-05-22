import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, MessageSquare, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { toE164, getOpenPhoneDeepLink } from "@/lib/phoneUtils";
import { Badge } from "@/components/ui/badge";

interface ClientPhoneActionsProps {
  clientId: string;
  clientPhone?: string;
  clientName?: string;
  variant?: "default" | "compact";
}

interface LastLogStatus {
  ok: boolean;
  status: number;
  message: string;
  timestamp: Date;
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
  const [lastLogStatus, setLastLogStatus] = useState<LastLogStatus | null>(null);

  const phoneE164 = clientPhone ? toE164(clientPhone) : null;

  /**
   * Log telephony action via Edge Function (server-side with service role)
   * Returns result with status info for UI feedback.
   */
  const logTelephonyAction = async (action: "call" | "sms"): Promise<{ ok: boolean; status: number; body: string; id?: string }> => {
    if (!clientId || !phoneE164) {
      const error = "Missing required fields (clientId/phone)";
      console.error("TELEPHONY_LOG_ERROR", error);
      return { ok: false, status: 0, body: error };
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
      const error = "No session JWT available (not logged in?)";
      console.error("TELEPHONY_LOG_ERROR", error);
      return { ok: false, status: 0, body: error };
    }
    if (!apikey) {
      const error = "Missing publishable API key (VITE_SUPABASE_PUBLISHABLE_KEY)";
      console.error("TELEPHONY_LOG_ERROR", error);
      return { ok: false, status: 0, body: error };
    }

    try {
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

      // Always show toast with status + body
      const isOk = res.ok;
      toast({
        title: isOk ? "Log téléphonie OK" : "Log téléphonie ÉCHEC",
        description: `Status ${res.status}: ${text.substring(0, 100)}`,
        variant: isOk ? "default" : "destructive",
      });

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // ignore parse error
      }

      if (isOk && parsed?.ok && parsed?.id) {
        console.info("TELEPHONY_LOG_RESPONSE", parsed);
        return { ok: true, status: res.status, body: text, id: parsed.id };
      }

      return { ok: false, status: res.status, body: text };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error("TELEPHONY_FETCH_ERROR", error);
      toast({
        title: "Erreur réseau",
        description: error,
        variant: "destructive",
      });
      return { ok: false, status: 0, body: error };
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
      const result = await logTelephonyAction("call");
      
      // Update UI badge
      setLastLogStatus({
        ok: result.ok,
        status: result.status,
        message: result.ok ? `ID: ${result.id}` : result.body.substring(0, 50),
        timestamp: new Date(),
      });

      // Open OpenPhone in new tab AFTER logging attempt
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
      const result = await logTelephonyAction("sms");
      
      // Update UI badge
      setLastLogStatus({
        ok: result.ok,
        status: result.status,
        message: result.ok ? `ID: ${result.id}` : result.body.substring(0, 50),
        timestamp: new Date(),
      });

      // Open OpenPhone SMS in new tab AFTER logging attempt
      const url = getOpenPhoneDeepLink(phoneE164, "sms");
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setIsLoggingSms(false);
    }
  };

  // Render last log status badge
  const renderStatusBadge = () => {
    if (!lastLogStatus) return null;
    
    const timeDiff = Date.now() - lastLogStatus.timestamp.getTime();
    // Auto-hide after 30 seconds
    if (timeDiff > 30000) return null;

    return (
      <Badge 
        variant={lastLogStatus.ok ? "default" : "destructive"} 
        className="text-xs flex items-center gap-1"
      >
        {lastLogStatus.ok ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : (
          <XCircle className="h-3 w-3" />
        )}
        Dernier log: {lastLogStatus.ok ? "OK" : "KO"} ({lastLogStatus.status})
      </Badge>
    );
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
      <div className="flex flex-col gap-1">
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
        {renderStatusBadge()}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
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
      {renderStatusBadge()}
    </div>
  );
};

export default ClientPhoneActions;
