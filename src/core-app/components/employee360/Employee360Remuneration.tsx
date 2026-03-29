import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const SALARY_LABELS: Record<string, string> = {
  hourly: "Horaire",
  fixed: "Fixe",
  commission: "Commission uniquement",
};

const PAYMENT_LABELS: Record<string, string> = {
  direct_deposit: "Dépôt direct",
  cheque: "Chèque",
  etransfer: "Virement Interac",
};

type Props = { profile: any; userId: string };

export default function Employee360Remuneration({ profile, userId }: Props) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    salary_type: profile.salary_type || "",
    hourly_rate: profile.hourly_rate?.toString() || "",
    base_salary: profile.base_salary?.toString() || "",
    payment_method: profile.payment_method || "direct_deposit",
  });

  const { data: gridAssignment } = useQuery({
    queryKey: ["employee-360-grid", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_grid_assignments")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (vals: typeof form) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          salary_type: vals.salary_type || null,
          hourly_rate: vals.hourly_rate ? parseFloat(vals.hourly_rate) : null,
          base_salary: vals.base_salary ? parseFloat(vals.base_salary) : null,
          payment_method: vals.payment_method || null,
        })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rémunération mise à jour");
      queryClient.invalidateQueries({ queryKey: ["employee-360-profile", userId] });
      setEditOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const fmtMoney = (v: number | null) => v != null ? `${v.toFixed(2)} $` : "—";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Structure salariale
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              <Edit className="mr-1 h-3 w-3" /> Modifier
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline">{SALARY_LABELS[profile.salary_type] || profile.salary_type || "—"}</Badge>
            </div>
            {(profile.salary_type === "hourly" || profile.hourly_rate) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taux horaire</span>
                <span className="font-medium text-foreground">{fmtMoney(profile.hourly_rate)}</span>
              </div>
            )}
            {(profile.salary_type === "fixed" || profile.base_salary) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salaire de base</span>
                <span className="font-medium text-foreground">{fmtMoney(profile.base_salary)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Méthode de paiement</span>
              <span className="text-foreground">{PAYMENT_LABELS[profile.payment_method] || profile.payment_method || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Grille de commission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {gridAssignment ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grille</span>
                  <span className="text-foreground">{gridAssignment.grid_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge variant={gridAssignment.is_active ? "default" : "secondary"}>{gridAssignment.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Aucune grille assignée</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la rémunération</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type de rémunération</Label>
              <Select value={form.salary_type} onValueChange={(v) => setForm({ ...form, salary_type: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Horaire</SelectItem>
                  <SelectItem value="fixed">Fixe</SelectItem>
                  <SelectItem value="commission">Commission uniquement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.salary_type === "hourly" && (
              <div>
                <Label>Taux horaire ($)</Label>
                <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
              </div>
            )}
            {form.salary_type === "fixed" && (
              <div>
                <Label>Salaire de base ($)</Label>
                <Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Méthode de paiement</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct_deposit">Dépôt direct</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="etransfer">Virement Interac</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
