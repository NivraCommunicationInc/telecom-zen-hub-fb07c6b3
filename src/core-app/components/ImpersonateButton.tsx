/**
 * ImpersonateButton — Core "Voir comme le client" button.
 * Opens the client portal in a new tab with a secure impersonation token.
 */
import { Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { useImpersonation } from "@/hooks/useImpersonation";
import { cn } from "@/lib/utils";

interface Props {
  clientId: string;
  clientEmail?: string | null;
  clientName?: string | null;
  variant?: "default" | "compact";
  className?: string;
}

export function ImpersonateButton({
  clientId,
  clientEmail,
  clientName,
  variant = "default",
  className,
}: Props) {
  const { startImpersonation } = useImpersonation();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy || !clientId) return;
    setBusy(true);
    try {
      await startImpersonation({ clientId, clientEmail, clientName });
    } finally {
      setBusy(false);
    }
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy || !clientId}
        title="Voir le portail comme le client"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-medium text-violet-300 transition-colors hover:bg-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
        Voir comme le client
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || !clientId}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-[10px] font-medium text-violet-300 transition-colors hover:bg-violet-500/15 disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]",
        className,
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
      Voir client
    </button>
  );
}
