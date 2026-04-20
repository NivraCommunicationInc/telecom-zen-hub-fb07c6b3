/**
 * CoreReturnsPage — Equipment return (RMA) management
 * Lists every equipment_return_requests row with status/date filters and
 * lets staff move a request through its lifecycle:
 *   pending → approved → label_sent → shipped → received → completed
 * (or rejected at any pending/approved step).
 *
 * Refunds: when completing a return the agent can enter refund_amount.
 * If the request is linked to a billing_payment via the order, the agent
 * can additionally trigger paypal-refund manually from the payment screen
 * (kept out of this page to avoid double-refunds — Core Payments is the
 * single canonical refund surface).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RotateCcw, Filter, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

type ReturnRow = {
  id: string;
  order_id: string | null;
  account_id: string | null;
  equipment_inventory_id: string | null;
  client_user_id: string;
  reason: string;
  reason_detail: string | null;
  status: string;
  return_label_url: string | null;
  tracking_number: string | null;
  carrier: string | null;
  requested_at: string;
  approved_at: string | null;
  received_at: string | null;
  completed_at: string | null;
  equipment_condition: string | null;
  refund_amount: number | null;
  agent_notes: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Approuvé", cls: "bg-blue-100 text-blue-800" },
  label_sent: { label: "Étiquette envoyée", cls: "bg-indigo-100 text-indigo-800" },
  shipped: { label: "Expédié", cls: "bg-cyan-100 text-cyan-800" },
  received: { label: "Reçu", cls: "bg-purple-100 text-purple-800" },
  completed: { label: "Complété", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejeté", cls: "bg-red-100 text-red-800" },
};

type ActionKind = "approve" | "label_sent" | "received" | "complete" | "reject" | null;

const CoreReturnsPage = () => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [selected, setSelected] = useState<ReturnRow | null>(null);
  const [action, setAction] = useState<ActionKind>(null);
  // submitting is derived from mutations below

  // form fields
  const [labelUrl, setLabelUrl] = useState("");
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [condition, setCondition] = useState("");
  const [agentNotes, setAgentNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["core-returns", statusFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("equipment_return_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (dateFrom) q = q.gte("requested_at", dateFrom);
      if (dateTo) q = q.lte("requested_at", `${dateTo}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ReturnRow[];
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (data || []).forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [data]);

  const openAction = (row: ReturnRow, k: ActionKind) => {
    setSelected(row);
    setAction(k);
    setLabelUrl(row.return_label_url ?? "");
    setTracking(row.tracking_number ?? "");
    setCarrier(row.carrier ?? "");
    setCondition(row.equipment_condition ?? "");
    setAgentNotes(row.agent_notes ?? "");
    setRefundAmount(row.refund_amount ? String(row.refund_amount) : "");
    setRejectReason("");
  };

  const closeAction = () => {
    if (submitting) return;
    setSelected(null);
    setAction(null);
  };

  // ---- Mutations (one per lifecycle transition) ----
  const logActivity = async (id: string, from: string, to: string, action: string, patch: Record<string, any>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        action: `equipment_return_${action}`,
        entity_type: "equipment_return_request",
        entity_id: id,
        user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
        actor_email: user?.email ?? null,
        details: { from, to, ...patch },
      });
    } catch (e) {
      console.warn("[CoreReturns] activity log failed", e);
    }
  };

  const approveMut = useMutation({
    mutationFn: async (row: ReturnRow) => {
      const patch = { status: "approved", approved_at: new Date().toISOString() };
      const { error } = await supabase.from("equipment_return_requests").update(patch).eq("id", row.id);
      if (error) throw error;
      await logActivity(row.id, row.status, "approved", "approve", patch);
    },
    onSuccess: () => { toast.success("Demande approuvée"); qc.invalidateQueries({ queryKey: ["core-returns"] }); closeAction(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const labelSentMut = useMutation({
    mutationFn: async (row: ReturnRow) => {
      if (!labelUrl.trim()) throw new Error("URL de l'étiquette requise");
      const patch = {
        status: "label_sent",
        return_label_url: labelUrl.trim(),
        tracking_number: tracking.trim() || null,
        carrier: carrier.trim() || null,
      };
      const { error } = await supabase.from("equipment_return_requests").update(patch).eq("id", row.id);
      if (error) throw error;
      await logActivity(row.id, row.status, "label_sent", "label_sent", patch);
    },
    onSuccess: () => { toast.success("Étiquette enregistrée"); qc.invalidateQueries({ queryKey: ["core-returns"] }); closeAction(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const receivedMut = useMutation({
    mutationFn: async (row: ReturnRow) => {
      const patch = {
        status: "received",
        received_at: new Date().toISOString(),
        equipment_condition: condition.trim() || null,
        agent_notes: agentNotes.trim() || null,
      };
      const { error } = await supabase.from("equipment_return_requests").update(patch).eq("id", row.id);
      if (error) throw error;
      if (row.equipment_inventory_id) {
        try {
          await supabase.from("equipment_inventory").update({ status: "returned" }).eq("id", row.equipment_inventory_id);
        } catch (e) {
          console.warn("[CoreReturns] inventory update failed", e);
        }
      }
      await logActivity(row.id, row.status, "received", "received", patch);
    },
    onSuccess: () => { toast.success("Retour marqué reçu"); qc.invalidateQueries({ queryKey: ["core-returns"] }); closeAction(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const completeMut = useMutation({
    mutationFn: async (row: ReturnRow) => {
      const patch: Record<string, any> = { status: "completed", completed_at: new Date().toISOString() };
      if (refundAmount && Number(refundAmount) > 0) patch.refund_amount = Number(refundAmount);
      const { error } = await supabase.from("equipment_return_requests").update(patch).eq("id", row.id);
      if (error) throw error;
      await logActivity(row.id, row.status, "completed", "complete", patch);
    },
    onSuccess: () => { toast.success("Retour complété"); qc.invalidateQueries({ queryKey: ["core-returns"] }); closeAction(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const rejectMut = useMutation({
    mutationFn: async (row: ReturnRow) => {
      if (!rejectReason.trim()) throw new Error("Motif de rejet requis");
      const patch = {
        status: "rejected",
        agent_notes: [row.agent_notes, `Rejet: ${rejectReason.trim()}`].filter(Boolean).join("\n"),
      };
      const { error } = await supabase.from("equipment_return_requests").update(patch).eq("id", row.id);
      if (error) throw error;
      await logActivity(row.id, row.status, "rejected", "reject", patch);
    },
    onSuccess: () => { toast.success("Demande rejetée"); qc.invalidateQueries({ queryKey: ["core-returns"] }); closeAction(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const submitting =
    approveMut.isPending || labelSentMut.isPending || receivedMut.isPending ||
    completeMut.isPending || rejectMut.isPending;

  const submit = () => {
    if (!selected || !action) return;
    if (action === "approve") approveMut.mutate(selected);
    else if (action === "label_sent") labelSentMut.mutate(selected);
    else if (action === "received") receivedMut.mutate(selected);
    else if (action === "complete") completeMut.mutate(selected);
    else if (action === "reject") rejectMut.mutate(selected);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <RotateCcw className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Retours RMA</h1>
          <p className="text-sm text-muted-foreground">
            Gestion des demandes de retour d'équipement de service.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtres
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Statut</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous ({(data || []).length})</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label} ({counts[k] || 0})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Du</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Au</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Aucune demande de retour.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Équipement</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => {
                  const cfg = STATUS_LABEL[r.status] ?? { label: r.status, cls: "bg-slate-100 text-slate-700" };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {format(parseISO(r.requested_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.client_user_id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-xs font-mono">
                        {r.equipment_inventory_id ? r.equipment_inventory_id.slice(0, 8) + "…" : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                      <TableCell>
                        <Badge className={`${cfg.cls} border-0`}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => openAction(r, "approve")}>Approuver</Button>
                            <Button size="sm" variant="outline" onClick={() => openAction(r, "reject")}>Rejeter</Button>
                          </>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" onClick={() => openAction(r, "label_sent")}>Étiquette envoyée</Button>
                        )}
                        {(r.status === "label_sent" || r.status === "shipped") && (
                          <Button size="sm" onClick={() => openAction(r, "received")}>Marquer reçu</Button>
                        )}
                        {r.status === "received" && (
                          <Button size="sm" onClick={() => openAction(r, "complete")}>Compléter</Button>
                        )}
                        {r.return_label_url && (
                          <Button asChild size="sm" variant="ghost">
                            <a href={r.return_label_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action dialog */}
      <Dialog open={!!action} onOpenChange={(v) => !v && closeAction()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === "approve" && "Approuver la demande"}
              {action === "label_sent" && "Étiquette de retour envoyée"}
              {action === "received" && "Marquer comme reçu"}
              {action === "complete" && "Compléter le retour"}
              {action === "reject" && "Rejeter la demande"}
            </DialogTitle>
            <DialogDescription>
              {selected && `Demande du ${format(parseISO(selected.requested_at), "d MMM yyyy", { locale: fr })}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {action === "label_sent" && (
              <>
                <div className="space-y-1">
                  <Label>URL de l'étiquette *</Label>
                  <Input value={labelUrl} onChange={(e) => setLabelUrl(e.target.value)} placeholder="https://…" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>N° de suivi</Label>
                    <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Transporteur</Label>
                    <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Postes Canada…" />
                  </div>
                </div>
              </>
            )}

            {action === "received" && (
              <>
                <div className="space-y-1">
                  <Label>État de l'équipement</Label>
                  <Select value={condition} onValueChange={setCondition}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="bon">Bon</SelectItem>
                      <SelectItem value="usagé">Usagé</SelectItem>
                      <SelectItem value="endommagé">Endommagé</SelectItem>
                      <SelectItem value="défectueux">Défectueux</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea value={agentNotes} onChange={(e) => setAgentNotes(e.target.value)} rows={3} />
                </div>
              </>
            )}

            {action === "complete" && (
              <div className="space-y-1">
                <Label>Montant du remboursement (optionnel, CAD)</Label>
                <Input type="number" step="0.01" min="0" value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)} placeholder="0.00" />
                <p className="text-xs text-muted-foreground">
                  Le remboursement PayPal doit être traité depuis l'écran Paiements pour éviter les doublons.
                </p>
              </div>
            )}

            {action === "reject" && (
              <div className="space-y-1">
                <Label>Motif du rejet *</Label>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={submitting}>Annuler</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoreReturnsPage;
