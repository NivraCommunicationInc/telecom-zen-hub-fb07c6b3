/**
 * POSHeader - Professional POS header with branding and status
 */
import { Briefcase, Wifi, WifiOff, Clock, Battery, Signal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useEffect } from "react";

interface POSHeaderProps {
  repName?: string;
  showClock?: boolean;
}

export function POSHeader({ repName, showClock = true }: POSHeaderProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (showClock) {
      const interval = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(interval);
    }
  }, [showClock]);

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">NIVRA</h1>
              <p className="text-[10px] text-orange-400 font-medium">Point de Vente Terrain</p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
              isOnline 
                ? "bg-emerald-500/20 text-emerald-400" 
                : "bg-red-500/20 text-red-400"
            }`}>
              {isOnline ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="text-[10px] font-medium">
                {isOnline ? "En ligne" : "Hors ligne"}
              </span>
            </div>

            {/* Clock */}
            {showClock && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="h-3 w-3" />
                <span className="text-xs font-mono">
                  {format(currentTime, "HH:mm", { locale: fr })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Rep info */}
        {repName && (
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            <p className="text-xs text-slate-400">
              Représentant: <span className="text-white font-medium">{repName}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
