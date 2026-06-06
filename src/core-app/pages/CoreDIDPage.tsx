/**
 * CoreDIDPage — DID / Phone number inventory management.
 * List, add, assign, and release phone numbers.
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
import { toast } from "sonner";
import { Phone, Plus, Search, RefreshCw, UserCheck, UserX } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_STYLE: Record<string, string> = {
  available:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  assigned:       "bg-violet-500/15 text-violet-400 border-violet-500/30",
  ported_in:      "bg-sky-500/15 text-sky-400 border-sky-500/30",
  ported_out:     "bg-amber-500/15 text-amber-400 border-amber-500/30",
  reserved:       "bg-orange-500/15 text-orange-400 border-orange-500/30",
  decommissioned: "bg-red-500/15 text-red-400 border-red-500/30",
};
const STATUS_FR: Record<string, string> = {
  available: "Disponible", assigned: "Assigné", ported_in: "Porté entrant",
  ported_out: "Porté sortant", reserved: "Réservé", decommissioned: "Décommissionné",
};

const BLANK = { number: "", number_type: "local", area_code: "", province: "QC", carrier: "", monthly_cost: "", notes: "" };

export default function CoreDIDPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedDID, setSelectedDID] = useState<any>(null);
  const [customerEmail, setCustomerEmail] = useState("");

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ["did-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("did_numbers")
        .select("*, billing_customers(id, first_name, last_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("did_numbers").insert({
        number: form.number.trim(),
        number_type: form.number_type,
        area_code: form.area_code || form.number.replace(/\D/g, "").slice(1, 4),
        province: form.province,
        carrier: form.carrier || null,
        monthly_cost: parseFloat(form.monthly_cost) || 0,
        notes: form.notes || null,
        status: "available",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["did-numbers"] });
      setAddOpen(false);
      setForm({ ...BLANK });
      toast.success("Numéro ajouté");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ didId, email }: { didId: string; email: string }) => {
      const { data: cust } = await supabase
        .from("billing_customers")
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle();
      if (!cust) throw new Error("Client introuvable avec cet email");
      const { error } = await supabase
        .from("did_numbers")
        .update({ status: "assigned", assigned_to_customer_id: cust.id, assigned_at: new Date().toISOString() })
        .eq("id", didId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["did-numbers"] });
      setAssignOpen(false);
      setCustomerEmail("");
      toast.success("Numéro assigné");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const releaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("did_numbers")
        .update({ status: "available", assigned_to_customer_id: null, assigned_to_order_id: null, assigned_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["did-numbers"] }); toast.success("Numéro libéré"); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const filtered = numbers.filter((n: any) => {
    const matchSearch = !search || n.number.includes(search) || (n.billing_customers?.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || n.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: numbers.length,
    available: numbers.filter((n: any) => n.status === "available").length,
    assigned: numbers.filter((n: any) => n.status === "assigned").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Inventaire DID</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Numéros de téléphone Nivra</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="flex items-center gap-1">
          <Plus className="w-4 h-4" /> Ajouter numéro
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-[hsl(var(--core-text-primary))]" },
          { label: "Disponibles", value: stats.available, color: "text-emerald-400" },
          { label: "Assignés", value: stats.assigned, color: "text-violet-400" },
        ].map((k) => (
          <div key={k.label} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
            <p className="text-xs text-[hsl(var(--core-text-label))]">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Numéro ou email client…"
            className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_FR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(220,15%,12%)]">
            <tr>
              {["Numéro", "Type", "Région", "Carrier", "Statut", "Client assigné", "Assigné le", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-[hsl(var(--core-text-label))]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-[hsl(var(--core-text-secondary))]">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-[hsl(var(--core-text-secondary))]">Aucun numéro</td></tr>
            ) : filtered.map((n: any) => (
              <tr key={n.id} className="border-t border-[hsl(220,15%,16%)] hover:bg-[hsl(220,15%,12%)]">
                <td className="px-3 py-2 font-mono font-medium text-[hsl(var(--core-text-primary))]">
                  <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-[hsl(var(--core-text-label))]" />{n.number}</div>
                </td>
                <td className="px-3 py-2 text-[hsl(var(--core-text-secondary))]">{n.number_type}</td>
                <td className="px-3 py-2 text-[hsl(var(--core-text-secondary))]">{n.area_code} · {n.province}</td>
                <td className="px-3 py-2 text-[hsl(var(--core-text-secondary))]">{n.carrier || "—"}</td>
                <td className="px-3 py-2">
                  <Badge className={`text-xs border ${STATUS_STYLE[n.status] || ""}`}>{STATUS_FR[n.status] || n.status}</Badge>
                </td>
                <td className="px-3 py-2 text-[hsl(var(--core-text-secondary))]">
                  {n.billing_customers ? `${n.billing_customers.first_name} ${n.billing_customers.last_name}` : "—"}
                </td>
                <td className="px-3 py-2 text-[hsl(var(--core-text-secondary))] text-xs">
                  {n.assigned_at ? format(new Date(n.assigned_at), "d MMM yyyy", { locale: fr }) : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {n.status === "available" && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setSelectedDID(n); setAssignOpen(true); }}>
                        <UserCheck className="w-3 h-3 mr-1" />Assigner
                      </Button>
                    )}
                    {n.status === "assigned" && (
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                        onClick={() => { if (confirm("Libérer ce numéro ?")) releaseMutation.mutate(n.id); }}>
                        <UserX className="w-3 h-3 mr-1" />Libérer
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un numéro DID</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Numéro (E.164)</Label>
              <Input placeholder="+15141234567" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={form.number_type} onValueChange={(v) => setForm({ ...form, number_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="toll_free">Sans frais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Province</Label>
                <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Carrier</Label>
                <Input placeholder="Bell, Telus…" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} /></div>
              <div><Label>Coût mensuel ($)</Label>
                <Input type="number" placeholder="0.00" value={form.monthly_cost} onChange={(e) => setForm({ ...form, monthly_cost: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.number || addMutation.isPending}>
              {addMutation.isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assigner {selectedDID?.number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email du client</Label>
              <Input placeholder="client@exemple.com" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
            <Button className="w-full" onClick={() => assignMutation.mutate({ didId: selectedDID?.id, email: customerEmail })}
              disabled={!customerEmail || assignMutation.isPending}>
              {assignMutation.isPending ? "Assignation…" : "Assigner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
