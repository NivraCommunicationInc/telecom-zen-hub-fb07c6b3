/**
 * MaintenanceNotifyButton — manually trigger maintenance notification email
 * to all active clients for a given service_incident.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  incidentId: string;
  label?: string;
}

export default function MaintenanceNotifyButton({ incidentId, label = "Notifier tous les clients" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleNotify = async () => {
    if (!confirm("Envoyer un email de maintenance à TOUS les clients actifs ?")) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-maintenance", {
        body: { incident_id: incidentId },
      });
      if (error) throw error;
      const queued = (data as any)?.queued ?? 0;
      toast.success(`✓ ${queued} clients notifiés par email`);
    } catch (e: any) {
      toast.error(`Erreur notification: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1" onClick={handleNotify} disabled={loading}>
      <Bell className="h-3.5 w-3.5" />
      {loading ? "Envoi…" : label}
    </Button>
  );
}
