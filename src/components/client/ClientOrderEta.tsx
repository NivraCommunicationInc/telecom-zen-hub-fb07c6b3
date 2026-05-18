/**
 * ClientOrderEta — Public ETA display for the order tracking page.
 * Polls the public RPC `get_order_technician_eta` every 30s.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Wrench } from "lucide-react";

interface Props {
  orderNumber: string;
  isFr: boolean;
}

type EtaRow = {
  has_technician: boolean;
  on_site: boolean;
  eta_minutes: number | null;
  last_update: string | null;
  technician_name: string | null;
};

export default function ClientOrderEta({ orderNumber, isFr }: Props) {
  const [eta, setEta] = useState<EtaRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchEta = async () => {
      const { data, error } = await (supabase.rpc as any)("get_order_technician_eta", {
        p_order_number: orderNumber,
      });
      if (cancelled || error) return;
      const row = Array.isArray(data) ? data[0] : data;
      setEta((row as EtaRow) ?? null);
    };
    void fetchEta();
    const t = setInterval(fetchEta, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [orderNumber]);

  if (!eta || !eta.has_technician) return null;

  const onSite = eta.on_site;
  const updatedLabel = eta.last_update
    ? new Date(eta.last_update).toLocaleTimeString(isFr ? "fr-CA" : "en-CA", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className="border-0 shadow-lg shadow-black/5 bg-gradient-to-br from-emerald-50 to-background">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${onSite ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"}`}>
            {onSite ? <Wrench className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">
              {onSite
                ? isFr ? "🔧 Votre technicien est sur place" : "🔧 Your technician is on site"
                : isFr ? "🚗 Votre technicien est en route" : "🚗 Your technician is on the way"}
            </h3>
            {eta.technician_name && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {isFr ? "Technicien: " : "Technician: "}
                <span className="font-medium text-foreground">{eta.technician_name}</span>
              </p>
            )}
            {eta.eta_minutes != null && !onSite && (
              <p className="text-sm font-medium text-emerald-700 mt-1">
                ETA: {isFr ? "environ" : "approximately"} {eta.eta_minutes} min
              </p>
            )}
            {updatedLabel && (
              <p className="text-xs text-muted-foreground mt-1">
                {isFr ? "Position actualisée à " : "Updated at "}{updatedLabel}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
