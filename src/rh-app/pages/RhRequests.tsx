/**
 * RhRequests — Employee leave / absence / personal requests.
 * Insert into hr_requests; list own submissions with status.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Inbox, Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const TYPE_LABELS: Record<string, string> = {
  vacation: "Vacances",
  sick_leave: "Congé maladie",
  personal_leave: "Congé personnel",
  part_time: "Temps partiel",
  other: "Autre",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  declined: "destructive",
  cancelled: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  declined: "Refusée",
  cancelled: "Annulée",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-amber-600",
  approved: "text-emerald-600",
  declined: "text-destructive",
  cancelled: "text-muted-foreground",
};

interface RequestForm {
  request_type: string;
  start_date: string;
  end_date: string;
  hours_requested: string;
  reason: string;
}

const emptyForm: RequestForm = {
  request_type: "vacation",
  start_date: "",
  end_date: "",
  hours_requested: "",
  reason: "",
};

export default function RhRequests() {
  usePortalRealtime(["leave_requests", "service_change_requests"], [["rh-requests"]]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RequestForm>(emptyForm);

  const { data: userId } = useQuery({
    queryKey: ["rh-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["rh-my-requests", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("hr_requests")
        .select("*")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const submitMut = useMutation({
    mutationFn: async (f: RequestForm) => {
      if (!userId) throw new Error("Non authentifié");
      if (!f.start_date) throw new Error("Date de début requise");
      const payload: any = {
        employee_id: userId,
        request_type: f.request_type,
        start_date: f.start_date,
        end_date: f.end_date || null,
        hours_requested: f.hours_requested ? Number(f.hours_requested) : null,
        reason: f.reason || null,
        status: "pending",
      };
      const { error } = await supabase.from("hr_requests").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande envoyée à l'équipe RH");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["rh-my-requests"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const cancelMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("hr_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande annulée");
      qc.invalidateQueries({ queryKey: ["rh-my-requests"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const pendingCount = requests.filter((r: any) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-violet-600" />
            Mes demandes RH
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingCount > 0 ? `${pendingCount} en attente · ` : ""}
            Vacances, absences, congés et temps partiel
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />Nouvelle demande
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Historique de mes demandes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune demande. Cliquez sur « Nouvelle demande » pour commencer.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Du</TableHead>
                  <TableHead>Au</TableHead>
                  <TableHead>Heures</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Soumise</TableHead>
                  <TableHead>Note RH</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">
                      {TYPE_LABELS[r.request_type] ?? r.request_type}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(r.start_date), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.end_date ? format(new Date(r.end_date), "d MMM yyyy", { locale: fr }) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.hours_requested ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"} className={`text-[11px] ${STATUS_COLOR[r.status] ?? ""}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.created_at), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate text-muted-foreground">
                      {r.review_note ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.status === "pending" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => cancelMut.mutate(r.id)} disabled={cancelMut.isPending}
                          title="Annuler la demande">
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Submit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvelle demande</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type de demande *</Label>
              <Select value={form.request_type} onValueChange={(v) => setForm((p) => ({ ...p, request_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début *</Label>
                <Input type="date" value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Date de fin</Label>
                <Input type="date" value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            {form.request_type === "part_time" && (
              <div>
                <Label>Heures demandées</Label>
                <Input type="number" min="0" step="0.5" value={form.hours_requested}
                  onChange={(e) => setForm((p) => ({ ...p, hours_requested: e.target.value }))} />
              </div>
            )}
            <div>
              <Label>Raison / commentaire</Label>
              <Textarea rows={3} value={form.reason}
                placeholder={form.request_type === "sick_leave" ? "Optionnel pour congé maladie" : ""}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={submitMut.isPending || !form.start_date} onClick={() => submitMut.mutate(form)}>
              {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
