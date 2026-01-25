/**
 * OfflineSyncIndicator - Shows sync status and pending offline items
 */
import { useState, useEffect } from "react";
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export function OfflineSyncIndicator() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();
  const [showDetails, setShowDetails] = useState(false);

  // Auto-hide details after 3 seconds
  useEffect(() => {
    if (showDetails) {
      const timer = setTimeout(() => setShowDetails(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showDetails]);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
          isOnline
            ? pendingCount > 0
              ? "bg-amber-500/20 text-amber-400"
              : "bg-emerald-500/20 text-emerald-400"
            : "bg-red-500/20 text-red-400 animate-pulse"
        )}
      >
        {isOnline ? (
          pendingCount > 0 ? (
            <>
              <Cloud className="h-4 w-4" />
              <span>{pendingCount} en attente</span>
            </>
          ) : (
            <>
              <Wifi className="h-4 w-4" />
              <span>Synchronisé</span>
            </>
          )
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Hors ligne</span>
          </>
        )}
      </button>

      {/* Dropdown details */}
      {showDetails && (
        <div className="absolute top-full right-0 mt-2 w-64 p-4 rounded-xl bg-slate-800/95 backdrop-blur-xl border border-slate-700/50 shadow-xl z-50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Statut</span>
              <span className={cn(
                "text-sm font-medium",
                isOnline ? "text-emerald-400" : "text-red-400"
              )}>
                {isOnline ? "En ligne" : "Hors ligne"}
              </span>
            </div>
            
            {pendingCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Ventes en attente</span>
                <span className="text-sm font-medium text-amber-400">{pendingCount}</span>
              </div>
            )}

            {isOnline && pendingCount > 0 && (
              <Button
                onClick={syncNow}
                disabled={isSyncing}
                size="sm"
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Synchronisation...
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4 mr-2" />
                    Synchroniser maintenant
                  </>
                )}
              </Button>
            )}

            {pendingCount === 0 && isOnline && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <Check className="h-4 w-4" />
                <span>Tout est synchronisé</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
