/**
 * OfflineIndicator — Banner shown while navigator.onLine is false.
 */
import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setReconnected(true);
      setTimeout(() => setReconnected(false), 3000);
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!online) {
    return (
      <div
        role="status"
        className="sticky top-0 z-30 bg-red-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-2"
      >
        <WifiOff className="h-4 w-4" />
        ⚠️ Mode hors ligne — données sauvegardées localement
      </div>
    );
  }
  if (reconnected) {
    return (
      <div
        role="status"
        className="sticky top-0 z-30 bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-2"
      >
        <Wifi className="h-4 w-4" />
        ✅ Connexion rétablie — synchronisation en cours...
      </div>
    );
  }
  return null;
}
