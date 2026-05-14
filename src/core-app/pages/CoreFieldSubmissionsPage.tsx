/**
 * CoreFieldSubmissionsPage — Admin view of all field_submissions across agents.
 * Read-only listing with status, agent, customer, total and expiry.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Mail } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { StatusBadge, type StatusVariant } from "@/core-app/components/ui/StatusBadge";

const STATUS_VARIANT: Record<string, { label: string; variant: StatusVariant }> = {
  pending_client: { label: "En attente client", variant: "warning" },
  completed: { label: "Payée", variant: "success" },
  expired: { label: "Expirée", variant: "neutral" },
  cancelled: { label: "Annulée", variant: "danger" },
};

export default function CoreFieldSubmissionsPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["core-field-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_submissions" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Send className="h-6 w-6 text-primary" />
            Soumissions terrain
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rows.length} soumission{rows.length !== 1 ? "s" : ""} envoyée{rows.length !== 1 ? "s" : ""} par les agents
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Aucune soumission terrain pour le moment.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Numéro</th>
                  <th className="text-left px-4 py-3 font-semibold">Agent</th>
                  <th className="text-left px-4 py-3 font-semibold">Client</th>
                  <th className="text-left px-4 py-3 font-semibold">Services</th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-center px-4 py-3 font-semibold">Statut</th>
                  <th className="text-left px-4 py-3 font-semibold">Expire</th>
                  <th className="text-center px-4 py-3 font-semibold">Emails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((sub: any) => {
                  const status = STATUS_VARIANT[sub.status] || STATUS_VARIANT.pending_client;
                  const services = Array.isArray(sub.services) ? sub.services : [];
                  const serviceNames = services.map((s: any) => s.name).filter(Boolean).join(", ");
                  const orderNumber = `SUB-${String(sub.id).slice(0, 8).toUpperCase()}`;
                  return (
                    <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{orderNumber}</td>
                      <td className="px-4 py-3">
                        <div className="text-foreground font-medium">{sub.agent_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{sub.agent_email || ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground font-medium">{sub.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{sub.customer_email}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate" title={serviceNames}>
                        {serviceNames || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {Number(sub.total || 0).toFixed(2)} $
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge label={status.label} variant={status.variant} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {sub.expires_at ? format(new Date(sub.expires_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {sub.email_sent_count || 0}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
