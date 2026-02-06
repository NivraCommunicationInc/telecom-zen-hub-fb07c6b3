/**
 * ClientsTable - Extracted component for displaying the clients table
 * Reduces AdminClients.tsx complexity
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Client {
  id: string;
  user_id: string;
  full_name?: string;
  email?: string;
  balance?: number;
  store_credit?: number;
  account_status?: string;
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
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Liste des clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          Liste des clients ({clients?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clients && clients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Compte</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nom</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Courriel</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Solde</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Crédit</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Inscrit le</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const statusConfig = getStatusConfig(client.account_status);
                  return (
                    <tr key={client.id} className="border-b border-border/50 hover:bg-accent/50">
                      <td className="py-3 px-4 text-sm font-mono text-cyan-400 font-medium">
                        {client.account_number || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground font-medium">
                        {client.full_name || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {client.email || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className={Number(client.balance || 0) > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                          {Number(client.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span className={Number(client.store_credit || 0) > 0 ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                          {Number(client.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                      </td>
                      <td className="py-3 px-4">
                        <Button size="sm" variant="outline" onClick={() => onViewDetails(client)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Gérer
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "Aucun client trouvé" : "Aucun client pour le moment"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
