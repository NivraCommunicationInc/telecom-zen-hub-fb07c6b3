/**
 * AccountCreditTab — Credit classification and risk management
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Edit, Save, History, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const creditClasses: Record<string, { label: string; color: string }> = {
  A: { label: "Excellent", color: "bg-green-500" },
  B: { label: "Bon", color: "bg-blue-500" },
  C: { label: "Moyen", color: "bg-yellow-500" },
  D: { label: "Mauvais", color: "bg-red-500" },
};

interface AccountCreditTabProps {
  account: any;
}

export function AccountCreditTab({ account }: AccountCreditTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [newClass, setNewClass] = useState(account?.credit_class || "C");

  const mutation = useMutation({
    mutationFn: async (creditClass: string) => {
      const { error } = await supabase
        .from("accounts")
        .update({
          credit_class: creditClass,
          credit_last_reviewed_at: new Date().toISOString(),
          credit_last_reviewed_by_admin_id: user?.id,
        })
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-profile"] });
      toast({ title: "Classe de crédit mise à jour" });
      setEditing(false);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const info = creditClasses[account?.credit_class] || null;

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600">
            <Star className="h-4 w-4" />
            Profil de crédit (INTERNE UNIQUEMENT)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cette information est strictement interne. Elle n'est jamais visible par les clients.
          </p>

          <div className="flex items-center gap-4">
            {editing ? (
              <div className="flex items-center gap-3">
                <Select value={newClass} onValueChange={setNewClass}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(creditClasses).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{key} - {val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => mutation.mutate(newClass)} disabled={mutation.isPending}>
                  <Save className="h-4 w-4 mr-1" />
                  Sauvegarder
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${info?.color || "bg-muted"}`}>
                  {account?.credit_class || "?"}
                </div>
                <span className="font-medium text-sm">{info?.label || "Non défini"}</span>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Modifier
                </Button>
              </div>
            )}
          </div>

          {account?.credit_last_reviewed_at && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <History className="h-3 w-3" />
              Dernière révision: {format(new Date(account.credit_last_reviewed_at), "d MMM yyyy à HH:mm", { locale: fr })}
            </p>
          )}

          <div className="border-t pt-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Indicateurs de risque</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-md border">
                <p className="text-xs text-muted-foreground">Dépôt requis</p>
                <p className="text-sm font-medium">{account?.credit_class === "D" ? "Oui" : "Non"}</p>
              </div>
              <div className="p-2.5 rounded-md border">
                <p className="text-xs text-muted-foreground">Niveau de risque</p>
                <p className="text-sm font-medium">
                  {account?.credit_class === "A" ? "Faible" :
                   account?.credit_class === "B" ? "Faible" :
                   account?.credit_class === "C" ? "Moyen" : "Élevé"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
