import { ReactNode } from "react";
import { useClientBlockStatus } from "@/hooks/useClientBlockStatus";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockedActionWrapperProps {
  children: ReactNode;
  /** The action button/element to wrap */
  action?: "order" | "change" | "request" | "submit";
  /** Custom tooltip message */
  tooltip?: string;
  /** Whether to show inline notice instead of tooltip */
  showInlineNotice?: boolean;
  /** Additional className for the wrapper */
  className?: string;
}

/**
 * Wraps action buttons/elements and disables them when account is blocked.
 * Shows a tooltip or inline notice explaining why the action is disabled.
 */
const BlockedActionWrapper = ({
  children,
  action = "order",
  tooltip,
  showInlineNotice = false,
  className,
}: BlockedActionWrapperProps) => {
  const { isAccountBlocked, blockedReason } = useClientBlockStatus();

  if (!isAccountBlocked) {
    return <>{children}</>;
  }

  const defaultMessages: Record<string, { fr: string; en: string }> = {
    order: {
      fr: "Compte bloqué — les nouvelles commandes sont désactivées.",
      en: "Account blocked — new orders are disabled.",
    },
    change: {
      fr: "Compte bloqué — les modifications de service sont désactivées.",
      en: "Account blocked — service changes are disabled.",
    },
    request: {
      fr: "Compte bloqué — les demandes sont désactivées.",
      en: "Account blocked — requests are disabled.",
    },
    submit: {
      fr: "Compte bloqué — contactez le support.",
      en: "Account blocked — contact support.",
    },
  };

  const message = tooltip || `${defaultMessages[action].fr} / ${defaultMessages[action].en}`;

  if (showInlineNotice) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="pointer-events-none opacity-50">{children}</div>
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          <Ban className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("pointer-events-none opacity-50", className)}>
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-destructive" />
          <span>{message}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default BlockedActionWrapper;