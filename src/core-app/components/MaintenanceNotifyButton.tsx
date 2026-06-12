/**
 * MaintenanceNotifyButton — manually trigger maintenance notification email
 * to all active clients for a given service_incident.
 * Routes through email_queue directly (no edge function needed).
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
      // Fetch incident details
      const { data: incident } = await (supabase as any)
        .from("service_incidents")
        .select("title, description, service_type, started_at")
        .eq("id", incidentId)
        .maybeSingle();

      // Fetch all active clients with emails
      const { data: clients, error: clientsErr } = await (supabase as any)
        .from("billing_customers")
        .select("id, email, first_name, last_name")
        .eq("status", "active")
        .not("email", "is", null);
      if (clientsErr) throw clientsErr;

      if (!clients || clients.length === 0) {
        toast.info("Aucun client actif trouvé");
        return;
      }

      // Batch insert into email_queue
      const rows = (clients as any[]).map((c: any) => ({
        template_key: "maintenance_notification",
        to_email: c.email,
        entity_type: "service_incident",
        entity_id: incidentId,
        variables: {
          client_name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client",
          incident_title: incident?.title ?? "Maintenance planifiée",
          incident_description: incident?.description ?? "",
          started_at: incident?.started_at ?? null,
        },
        priority: 2,
      }));

      const { error: queueErr } = await (supabase as any).from("email_queue").insert(rows);
      if (queueErr) throw queueErr;

      toast.success(`✓ ${clients.length} clients notifiés par email`);
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
