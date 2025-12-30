import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  new: "bg-cyan-500/20 text-cyan-400",
  contacted: "bg-amber-500/20 text-amber-500",
  converted: "bg-emerald-500/20 text-emerald-500",
  closed: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  converted: "Converti",
  closed: "Fermé",
};

const AdminRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("contact_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
      toast({ title: "Statut mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Demandes de consultation</h1>
          <p className="text-muted-foreground mt-1">Gérer les demandes de consultation entrantes</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              Liste des demandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : requests && requests.length > 0 ? (
              <div className="space-y-4">
                {requests.map((request: any) => (
                  <div
                    key={request.id}
                    className="p-4 rounded-lg border border-border hover:border-cyan-400/30 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-foreground">{request.name}</h3>
                          <Badge className={statusColors[request.status] || "bg-muted"}>
                            {statusLabels[request.status] || request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {request.email} • {request.phone}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Reçu le {format(new Date(request.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {request.status === "new" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: request.id, status: "contacted" })
                              }
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Marquer contacté
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateStatusMutation.mutate({ id: request.id, status: "closed" })
                              }
                            >
                              <X className="w-4 h-4 mr-1" />
                              Fermer
                            </Button>
                          </>
                        )}
                        {request.status === "contacted" && (
                          <Button
                            size="sm"
                            variant="hero"
                            onClick={() =>
                              updateStatusMutation.mutate({ id: request.id, status: "converted" })
                            }
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Converti en client
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune demande pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminRequests;
