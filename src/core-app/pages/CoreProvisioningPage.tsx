/**
 * CoreProvisioningPage — Carrier provisioning queue management.
 * Track SIM activations, port-ins, and number assignments.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, CheckCircle2, XCircle, Clock, Send, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  submitted: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed:    "bg-red-500/15 text-red-400 border-red-500/30",
  cancelled: "bg-[hsl(220,15%,20%)] text-[hsl(var(--core-text-label))] border-[hsl(220,15%,25%)]",
};
const STATUS_FR: Record<string, string> = {
  pending: "En attente", submitted: "Soumis", confirmed: "Confirmé", failed: "Échoué", cancelled: "Annulé",
};
const ACTION_FR: Record<string, string> = {
  activate_sim: "Activation SIM", port_in: "Portabilité entrante", port_out: "Portabilité sortante",
  deactivate: "Désactivation", number_assign: "Attribution numéro",
};

const BLANK_FORM = { action: "activate_sim", carrier: "", customer_email: "", notes: "", payload: "" };

export default function CoreProvisioningPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [addOpen, setAddOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [carrierRef, setCarrierRef] = useState("");
  const [form, setForm] = useState({ ...BLANK_FORM });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["provisioning-queue", filter],
    queryFn: async () => {
      let q = supabase
        .from("provisioning_queue")
        .select("*, billing_customers(first_name, last_name, email), orders(order_number), did_numbers(number)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      let customerId: string | null = null;
      if (form.customer_email) {
        const { data: cust } = await supabase
          .from("billing_customers").select("id").ilike("email", form.customer_email.trim()).maybeSingle();
        customerId = cust?.id || null;
      }
      let payloadObj = {};
      if (form.payload) { try { payloadObj = JSON.parse(form.payload); } catch { /* ignore */ } }
      const { error } = await supabase.from("provisioning_queue").insert({
        action: form.action,
        carrier: form.carrier || null,
        customer_id: customerId,
        notes: form.notes || null,
        payload: payloadObj,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provisioning-queue"] });
      setAddOpen(false);
      setForm({ ...BLANK_FORM });
      toast.success("Tâche ajoutée à la queue");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("provisioning_queue")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provisioning-queue"] }); toast.success("Marqué comme soumis"); },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ id, ref }: { id: string; ref: string }) => {
      const { error } = await supabase
        .from("provisioning_queue")
        .update({ status: "confirmed", carrier_reference_id: ref || null, confirmed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provisioning-queue"] });
      setConfirmOpen(false);
      setCarrierRef("");
      toast.success("Confirmé");
    },
  });

  const failMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("provisioning_queue")
        .update({ status: "failed", failed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provisioning-queue"] }); toast.error("Marqué comme échoué"); },
  });

  const pending  = items.filter((i: any) => i.status === "pending").length;
  const submitted = items.filter((i: any) => i.status === "submitted").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Provisionnement Carrier</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Queue d'activations SIM, portabilités et attributions</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["provisioning-queue"] })}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />Nouvelle tâche
          </Button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex gap-3">
        {pending > 0 && <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30"><Clock className="w-4 h-4 text-amber-400" /><span className="text-sm text-amber-400">{pending} en attente</span></div>}
        {submitted > 0 && <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/30"><Send className="w-4 h-4 text-sky-400" /><span className="text-sm text-sky-400">{submitted} soumis carrier</span></div>}
      </div>

      {/* Filter */}
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-44 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          {Object.entries(STATUS_FR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-[hsl(var(--core-text-secondary))] text-center py-4">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[hsl(var(--core-text-secondary))] text-center py-8">Aucune tâche{filter !== "all" ? ` en statut « ${STATUS_FR[filter]} »` : ""}</p>
        ) : items.map((item: any) => (
          <div key={item.id} className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">{ACTION_FR[item.action] || item.action}</span>
                  <Badge className={`text-xs border ${STATUS_STYLE[item.status] || ""}`}>{STATUS_FR[item.status] || item.status}</Badge>
                  {item.carrier && <Badge variant="outline" className="text-xs">{item.carrier}</Badge>}
                </div>
                <div className="text-xs text-[hsl(var(--core-text-secondary))] space-x-3">
                  {item.billing_customers && <span>{item.billing_customers.first_name} {item.billing_customers.last_name} · {item.billing_customers.email}</span>}
                  {item.did_numbers && <span>📞 {item.did_numbers.number}</span>}
                  {item.orders && <span>Commande #{item.orders.order_number}</span>}
                  {item.carrier_reference_id && <span className="text-emerald-400">Ref carrier: {item.carrier_reference_id}</span>}
                </div>
                {item.notes && <p className="text-xs text-[hsl(var(--core-text-label))] italic">{item.notes}</p>}
              </div>
              <div className="text-xs text-[hsl(var(--core-text-label))] whitespace-nowrap">
                {format(new Date(item.created_at), "d MMM HH:mm", { locale: fr })}
              </div>
            </div>
            {item.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => submitMutation.mutate(item.id)}>
                  <Send className="w-3 h-3 mr-1" />Marquer soumis
                </Button>
              </div>
            )}
            {item.status === "submitted" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-7 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30"
                  onClick={() => { setSelectedItem(item); setConfirmOpen(true); }}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />Confirmer
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400"
                  onClick={() => failMutation.mutate(item.id)}>
                  <XCircle className="w-3 h-3 mr-1" />Échoué
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle tâche de provisionnement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Action</Label>
              <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_FR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Carrier</Label>
              <Input placeholder="Bell, Telus, Rogers…" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} /></div>
            <div><Label>Email client</Label>
              <Input placeholder="client@exemple.com" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></div>
            <div><Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div><Label>Données carrier (JSON)</Label>
              <Textarea rows={3} placeholder='{"iccid":"...","account_number":"..."}' value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} /></div>
            <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Ajout…" : "Créer tâche"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmer {ACTION_FR[selectedItem?.action] || ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Référence carrier (optionnel)</Label>
              <Input placeholder="ex. PORT-2026-12345" value={carrierRef} onChange={(e) => setCarrierRef(e.target.value)} /></div>
            <Button className="w-full" onClick={() => confirmMutation.mutate({ id: selectedItem?.id, ref: carrierRef })}
              disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? "Confirmation…" : "Confirmer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
