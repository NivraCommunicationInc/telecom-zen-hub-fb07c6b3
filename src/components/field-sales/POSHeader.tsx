/**
 * POSHeader - Premium telecom POS header with branding and real-time status
 */
import { Briefcase, Wifi, WifiOff, Clock, ArrowLeft, Store, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface POSHeaderProps {
  repName?: string;
  showClock?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function POSHeader({ repName, showClock = true, showBackButton = true, onBack }: POSHeaderProps) {
  const navigate = useNavigate();
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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/field-sales/dashboard");
    }
  };

  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50 shadow-lg">
      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Back button */}
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="text-slate-400 hover:text-white hover:bg-slate-700/50 shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Brand */}
          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30">
                <Store className="h-6 w-6 text-white" />
              </div>
              {/* Pulse indicator */}
              <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                isOnline ? "bg-emerald-400" : "bg-red-400"
              }`}>
                {isOnline && <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />}
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-lg font-black text-white tracking-wide">NIVRA</h1>
                <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">POS</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Point de Vente Terrain</p>
            </div>
          </div>

          {/* Status section */}
          <div className="flex items-center gap-3">
            {/* Connection status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
              isOnline 
                ? "bg-emerald-500/15 border border-emerald-500/30" 
                : "bg-red-500/15 border border-red-500/30"
            }`}>
              {isOnline ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-400" />
              )}
              <span className={`text-[11px] font-semibold ${isOnline ? "text-emerald-400" : "text-red-400"}`}>
                {isOnline ? "En ligne" : "Hors ligne"}
              </span>
            </div>

            {/* Clock */}
            {showClock && (
              <div className="hidden sm:flex items-center gap-1.5 text-slate-400 bg-slate-800/50 px-2.5 py-1.5 rounded-lg border border-slate-700/50">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-mono font-semibold">
                  {format(currentTime, "HH:mm:ss", { locale: fr })}
                </span>
              </div>
            )}

            {/* Rep badge */}
            {repName && (
              <div className="hidden md:flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-white font-medium">{repName}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
