/**
 * ClientsTable - Carrier-grade client list table
 * NO Card wrapper. Full-width table as primary surface.
 *
 * Status column uses AccountStateBadge — the canonical cross-portal state.
 * Falls back to the legacy account_status badge when account_id is missing
 * (e.g. billing-only customers without a real accounts row).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AccountStateBadge } from "@/components/AccountStateBadge";

interface Client {
  id: string;
  user_id: string;
  full_name?: string;
  email?: string;
  balance?: number;
  store_credit?: number;
  account_status?: string;
  account_id?: string | null;
  account_number?: string;
  client_number?: string;
  created_at: string;
  [key: string]: any;
}

interface ClientsTableProps {
  clients: Client[] | undefined;
  isLoading: boolean;
  searchQuery: string;
  onViewDetails: (client: Client) => void;
}

const getStatusConfig = (status: string | undefined) => {
  const configs: Record<string, { label: string; className: string }> = {
    active: { label: "Actif", className: "bg-emerald-500/20 text-emerald-400" },
    frozen: { label: "Gelé", className: "bg-blue-500/20 text-blue-400" },
    hold: { label: "Attente", className: "bg-amber-500/20 text-amber-400" },
    deactivated: { label: "Désactivé", className: "bg-red-500/20 text-red-400" },
  };
  return configs[status || "active"] || configs.active;
};

export function ClientsTable({ clients, isLoading, searchQuery, onViewDetails }: ClientsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-1">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 bg-secondary/30 animate-pulse rounded-sm" />
        ))}
      </div>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Users className="w-10 h-10 mb-2" />
        <p className="text-sm">{searchQuery ? "Aucun client trouvé" : "Aucun client pour le moment"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground border-b border-border pb-2">
        <Users className="w-4 h-4" />
        <span>{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-secondary border-b-2 border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compte</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nom</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Courriel</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solde</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Crédit</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inscrit le</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => {
              const legacyStatus = getStatusConfig(client.account_status);
              return (
                <tr key={client.id} className={`border-b border-border/40 transition-colors hover:bg-primary/5 ${index % 2 === 1 ? "bg-secondary/15" : ""}`}>
                  <td className="px-4 py-2.5 font-mono text-sm">
                    {client.account_number || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-foreground">
                    {client.full_name || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-foreground">
                    {client.email || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    <span className={Number(client.balance || 0) > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                      {Number(client.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    <span className={Number(client.store_credit || 0) > 0 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                      {Number(client.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {client.account_id ? (
                      <AccountStateBadge accountId={client.account_id} size="sm" />
                    ) : (
                      <Badge className={legacyStatus.className}>
                        {legacyStatus.label}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">
                    {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                  </td>
                  <td className="px-4 py-2.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onViewDetails(client)}>
                      <Eye className="w-3 h-3 mr-1.5" />
                      Gérer
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
