import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const AdminContracts = () => {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["admin-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, profiles:user_id(email, full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Contrats & Documents</h1>
          <p className="text-muted-foreground mt-1">Gérer les contrats clients signés</p>
        </div>
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Liste des contrats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : contracts && contracts.length > 0 ? (
              <div className="space-y-3">
                {contracts.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-foreground">{c.contract_name}</p>
                      <p className="text-sm text-muted-foreground">{c.profiles?.full_name || c.profiles?.email}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(c.created_at), "d MMM yyyy", { locale: fr })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={c.is_signed ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"}>
                        {c.is_signed ? "Signé" : "En attente"}
                      </Badge>
                      <Button size="sm" variant="outline"><Download className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost"><Send className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun contrat</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminContracts;
