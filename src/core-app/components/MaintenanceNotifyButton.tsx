/**
 * MaintenanceNotifyButton — manually trigger the notify-maintenance edge function.
 * The edge function is the single source of truth: it writes to email_queue
 * (idempotent via event_key) AND notifications (in-portal banner).
 * Do NOT enqueue emails directly from the client.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  incidentId: string;
  label?: string;
  onDone?: () => void;
}

export default function MaintenanceNotifyButton({ incidentId, label = "Notifier tous les clients", onDone }: Props) {
  const [loading, setLoading] = useState(false);

  const handleNotify = async () => {
    if (!confirm("Envoyer la notification de maintenance (email + portail) à TOUS les clients actifs ?")) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("notify-maintenance", {
        body: { incident_id: incidentId },
      });
      if (error) throw error;
      const queued = data?.queued ?? 0;
      const portal = data?.portal_notified ?? 0;
      const total = data?.total_clients ?? 0;
      toast.success(`✓ ${total} clients notifiés (${queued} emails, ${portal} notifications portail)`);
      onDone?.();
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
