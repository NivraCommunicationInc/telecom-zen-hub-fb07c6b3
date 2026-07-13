/**
 * LiveTrackingTimeline — Phase 4
 * Real-time Ship24 tracking status timeline for a Core order.
 * Subscribes to `orders` row updates and reflects tracking_status transitions
 * as they arrive from the Ship24 webhook (in_transit → out_for_delivery → delivered).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Truck, Package, MapPin, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  orderId: string;
  initialStatus?: string | null;
  initialCarrier?: string | null;
  initialTrackingNumber?: string | null;
  initialTrackingUrl?: string | null;
  initialLastUpdate?: string | null;
}

type Step = { key: string; label: string; icon: any };

const STEPS: Step[] = [
  { key: "label_created", label: "Étiquette créée", icon: Package },
  { key: "in_transit", label: "En transit", icon: Truck },
  { key: "out_for_delivery", label: "En livraison", icon: MapPin },
  { key: "delivered", label: "Livré", icon: CheckCircle2 },
];

const ORDER: Record<string, number> = {
  registered: 0, pending: 0, label_created: 0, info_received: 0,
  in_transit: 1, shipped: 1, picked_up: 1, accepted: 1, en_route: 1,
  out_for_delivery: 2, delivering: 2,
  delivered: 3,
};

function stepIndex(status?: string | null): number {
  const k = (status || "").toLowerCase();
  return ORDER[k] ?? -1;
}

export function LiveTrackingTimeline({
  orderId,
  initialStatus,
  initialCarrier,
  initialTrackingNumber,
  initialTrackingUrl,
  initialLastUpdate,
}: Props) {
  const [status, setStatus] = useState(initialStatus || null);
  const [carrier, setCarrier] = useState(initialCarrier || null);
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber || null);
  const [trackingUrl, setTrackingUrl] = useState(initialTrackingUrl || null);
  const [lastUpdate, setLastUpdate] = useState(initialLastUpdate || null);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload: any) => {
          const n = payload?.new || {};
          if (n.tracking_status !== status) {
            setStatus(n.tracking_status);
            setFlashing(true);
            setTimeout(() => setFlashing(false), 1200);
          }
          if (n.carrier !== carrier) setCarrier(n.carrier);
          if (n.tracking_number !== trackingNumber) setTrackingNumber(n.tracking_number);
          if (n.tracking_url !== trackingUrl) setTrackingUrl(n.tracking_url);
          if (n.tracking_last_update_at !== lastUpdate) setLastUpdate(n.tracking_last_update_at);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const idx = stepIndex(status);
  const hasTracking = !!trackingNumber;

  return (
    <div className={`rounded-xl border border-slate-800 bg-[#0d1421] p-4 transition-colors ${flashing ? "ring-2 ring-purple-500/70" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Suivi en temps réel (Ship24)</div>
          <div className="text-sm text-slate-100 font-medium">
            {hasTracking ? `${carrier || "Transporteur"} · ${trackingNumber}` : "Aucun numéro de suivi enregistré"}
          </div>
        </div>
        {trackingUrl && (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200"
          >
            Ouvrir <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const done = i <= idx;
          const current = i === idx;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
                    done
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-slate-900 border-slate-700 text-slate-500"
                  } ${current ? "ring-2 ring-purple-400/60" : ""}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className={`text-[10px] ${done ? "text-slate-200" : "text-slate-500"}`}>{s.label}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${i < idx ? "bg-purple-500" : "bg-slate-700"}`} />
              )}
            </div>
          );
        })}
      </div>

      {lastUpdate && (
        <div className="text-[10px] text-slate-500 mt-3">
          Dernière mise à jour&nbsp;: {format(new Date(lastUpdate), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
        </div>
      )}
      {!hasTracking && (
        <div className="text-[11px] text-slate-500 mt-3">
          Enregistrez le transporteur et le numéro de suivi ci-dessous : les mises à jour Ship24 apparaîtront ici automatiquement et le client sera notifié à chaque transition (en transit, en livraison, livré).
        </div>
      )}
    </div>
  );
}
