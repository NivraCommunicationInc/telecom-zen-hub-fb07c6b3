/**
 * GPSCapture - Geolocation capture for field sales
 * Captures and displays current location for sale validation
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface GPSData {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}

interface GPSCaptureProps {
  onCapture: (data: GPSData) => void;
  required?: boolean;
  capturedData?: GPSData | null;
}

export function GPSCapture({ onCapture, required = false, capturedData }: GPSCaptureProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [gpsData, setGpsData] = useState<GPSData | null>(capturedData || null);

  useEffect(() => {
    if (capturedData) {
      setGpsData(capturedData);
      setStatus("success");
    }
  }, [capturedData]);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError("Géolocalisation non supportée par ce navigateur");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const data: GPSData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        };
        setGpsData(data);
        setStatus("success");
        onCapture(data);
      },
      (err) => {
        setStatus("error");
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Accès à la localisation refusé. Veuillez autoriser l'accès.");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Position non disponible. Vérifiez votre GPS.");
            break;
          case err.TIMEOUT:
            setError("Délai d'attente dépassé. Réessayez.");
            break;
          default:
            setError("Erreur de localisation inconnue");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const formatCoordinate = (coord: number, isLat: boolean) => {
    const direction = isLat ? (coord >= 0 ? "N" : "S") : (coord >= 0 ? "E" : "O");
    return `${Math.abs(coord).toFixed(6)}° ${direction}`;
  };

  return (
    <Card className={cn(
      "border transition-colors",
      status === "success" ? "border-emerald-500/50 bg-emerald-500/5" :
      status === "error" ? "border-red-500/50 bg-red-500/5" :
      "border-slate-700/50 bg-slate-900/40"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-2 rounded-lg",
            status === "success" ? "bg-emerald-500/20" :
            status === "error" ? "bg-red-500/20" :
            "bg-slate-800"
          )}>
            {status === "loading" ? (
              <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
            ) : status === "success" ? (
              <Check className="h-5 w-5 text-emerald-400" />
            ) : status === "error" ? (
              <AlertCircle className="h-5 w-5 text-red-400" />
            ) : (
              <MapPin className="h-5 w-5 text-slate-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-white text-sm">
                Localisation GPS
                {required && <span className="text-red-400 ml-1">*</span>}
              </h4>
              {status !== "loading" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={captureLocation}
                  className="text-slate-400 hover:text-white h-8 px-2"
                >
                  {status === "success" ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-1" />
                      Capturer
                    </>
                  )}
                </Button>
              )}
            </div>

            {status === "idle" && (
              <p className="text-xs text-slate-500 mt-1">
                Cliquez pour enregistrer la position de la vente
              </p>
            )}

            {status === "loading" && (
              <p className="text-xs text-orange-400 mt-1">
                Acquisition de la position...
              </p>
            )}

            {status === "error" && error && (
              <p className="text-xs text-red-400 mt-1">{error}</p>
            )}

            {status === "success" && gpsData && (
              <div className="mt-1 space-y-1">
                <p className="text-xs text-slate-300 font-mono">
                  {formatCoordinate(gpsData.latitude, true)}, {formatCoordinate(gpsData.longitude, false)}
                </p>
                <p className="text-xs text-slate-500">
                  Précision: ±{gpsData.accuracy.toFixed(0)}m
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
