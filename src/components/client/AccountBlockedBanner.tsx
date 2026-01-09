import { AlertTriangle } from "lucide-react";
import { useClientBlockStatus } from "@/hooks/useClientBlockStatus";

const AccountBlockedBanner = () => {
  const { isAccountBlocked, blockedReason } = useClientBlockStatus();

  if (!isAccountBlocked) return null;

  return (
    <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">
            Compte bloqué — contactez le support.
          </p>
          <p className="text-xs text-destructive/80 mt-0.5">
            Account blocked — contact support.
          </p>
          {blockedReason && (
            <p className="text-xs text-muted-foreground mt-1">
              {blockedReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountBlockedBanner;