import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const AdminClients = () => {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">Gérer tous les profils clients</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Liste des clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : clients && clients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nom</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Courriel</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Téléphone</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rôle</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Inscrit le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client: any) => (
                      <tr key={client.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-medium">
                          {client.full_name || "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">{client.email || "—"}</td>
                        <td className="py-3 px-4 text-sm text-foreground">{client.phone || "—"}</td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              client.user_roles?.[0]?.role === "admin"
                                ? "bg-cyan-500/20 text-cyan-400"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {client.user_roles?.[0]?.role === "admin" ? "Admin" : "Client"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(client.created_at), "d MMM yyyy", { locale: fr })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun client pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminClients;
