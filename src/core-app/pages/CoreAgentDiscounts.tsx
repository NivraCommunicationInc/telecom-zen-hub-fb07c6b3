/**
 * CoreAgentDiscounts — FIX 3
 *
 * Admin page to manage agent discounts in 4 sections:
 *   1) Active discounts table (CRUD)
 *   2) Create new discount form
 *   3) Assignments tab — who can use which discount
 *   4) Usage history — which agents used which discount where
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Power, Trash2, Pencil, X } from "lucide-react";
import { ProfileName } from "@/hooks/useProfileName";

interface AgentDiscount {
  id: string;
  name: string;
  description: string | null;
  type: string;
  value: number | null;
  duration_months: number | null;
  min_plan_price: number | null;
  applies_to: string;
  max_uses: number | null;
  uses_count: number | null;
  expires_at: string | null;
  is_active: boolean;
}

interface Assignment {
  id: string;
  discount_id: string;
  agent_id: string | null;
  role: string | null;
  applies_to_all: boolean;
  assigned_at: string;
}

interface UsageRow {
  id: string;
  agent_id: string;
  field_order_id: string | null;
  discount_amount: number;
  customer_name: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  fixed_monthly: "Montant fixe mensuel",
  percentage: "Pourcentage",
  first_month_free: "Premier mois gratuit",
  remove_fee: "Installation gratuite",
};

const APPLIES_LABEL: Record<string, string> = {
  all: "Tous les services",
  plan_only: "Forfait seulement",
  installation: "Frais d'installation",
  plans_80_plus: "Forfaits ≥ 80 $",
  plans_90_plus: "Forfaits ≥ 90 $",
  internet: "Internet",
  tv: "TV",
  mobile: "Mobile",
};

const formatCAD = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const emptyForm = {
  name: "",
  description: "",
  type: "fixed_monthly",
  value: "",
  duration_months: "12",
  min_plan_price: "",
  applies_to: "all",
  expires_at: "",
  max_uses: "",
};

export default function CoreAgentDiscounts() {
  const [discounts, setDiscounts] = useState<AgentDiscount[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  // Assignment form state
  const [assignDiscountId, setAssignDiscountId] = useState<string>("");
  const [assignTarget, setAssignTarget] = useState<"all" | "role" | "agent">("all");
  const [assignAgentId, setAssignAgentId] = useState<string>("");

  const reload = async () => {
    setLoading(true);
    const [dRes, aRes, uRes] = await Promise.all([
      supabase.from("agent_discounts").select("*").order("created_at", { ascending: false }),
      supabase.from("agent_discount_assignments").select("*").order("assigned_at", { ascending: false }),
      supabase.from("field_agent_discounts").select("id, agent_id, field_order_id, discount_amount, customer_name, notes, status, created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    if (dRes.error) toast.error(dRes.error.message);
    setDiscounts((dRes.data as any) || []);
    setAssignments((aRes.data as any) || []);
    setUsage((uRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const startEdit = (d: AgentDiscount) => {
    setEditingId(d.id);
    setCreating(true);
    setForm({
      name: d.name,
      description: d.description || "",
      type: d.type,
      value: d.value?.toString() || "",
      duration_months: d.duration_months?.toString() || "",
      min_plan_price: d.min_plan_price?.toString() || "",
      applies_to: d.applies_to,
      expires_at: d.expires_at ? d.expires_at.slice(0, 10) : "",
      max_uses: d.max_uses?.toString() || "",
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setCreating(false);
  };

  const submitForm = async () => {
    if (!form.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      type: form.type,
      value: form.value ? Number(form.value) : 0,
      duration_months: form.duration_months ? Number(form.duration_months) : null,
      min_plan_price: form.min_plan_price ? Number(form.min_plan_price) : null,
      applies_to: form.applies_to,
      expires_at: form.expires_at || null,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      is_active: true,
    };

    const { error } = editingId
      ? await supabase.from("agent_discounts").update(payload).eq("id", editingId)
      : await supabase.from("agent_discounts").insert(payload);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Rabais mis à jour" : "Rabais créé");
    resetForm();
    await reload();
  };

  const toggleActive = async (d: AgentDiscount) => {
    const { error } = await supabase
      .from("agent_discounts")
      .update({ is_active: !d.is_active })
      .eq("id", d.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(d.is_active ? "Rabais désactivé" : "Rabais activé");
    await reload();
  };

  const createAssignment = async () => {
    if (!assignDiscountId) {
      toast.error("Choisissez un rabais");
      return;
    }
    const payload: any = {
      discount_id: assignDiscountId,
      applies_to_all: assignTarget === "all",
      role: assignTarget === "role" ? "field_sales" : null,
      agent_id: assignTarget === "agent" ? assignAgentId || null : null,
    };
    const { error } = await supabase.from("agent_discount_assignments").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assignation créée");
    setAssignDiscountId("");
    setAssignAgentId("");
    setAssignTarget("all");
    await reload();
  };

  const revokeAssignment = async (id: string) => {
    const { error } = await supabase.from("agent_discount_assignments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assignation retirée");
    await reload();
  };

  const discountsById = useMemo(() => {
    const m = new Map<string, AgentDiscount>();
    discounts.forEach((d) => m.set(d.id, d));
    return m;
  }, [discounts]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rabais agents</h1>
          <p className="text-sm text-muted-foreground">
            Gérez les rabais disponibles aux agents terrain et leur attribution.
          </p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nouveau rabais
          </Button>
        )}
      </div>

      {/* SECTION 2 — Create / edit form */}
      {creating && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{editingId ? "Modifier le rabais" : "Créer un rabais"}</CardTitle>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Nom du rabais</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_monthly">Montant fixe mensuel</SelectItem>
                  <SelectItem value="percentage">Pourcentage</SelectItem>
                  <SelectItem value="first_month_free">Premier mois gratuit</SelectItem>
                  <SelectItem value="remove_fee">Installation gratuite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valeur ($ ou %)</Label>
              <Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div>
              <Label>Durée (mois)</Label>
              <Input type="number" value={form.duration_months} onChange={(e) => setForm({ ...form, duration_months: e.target.value })} />
            </div>
            <div>
              <Label>Service minimum ($) — optionnel</Label>
              <Input type="number" step="0.01" value={form.min_plan_price} onChange={(e) => setForm({ ...form, min_plan_price: e.target.value })} />
            </div>
            <div>
              <Label>Applicable à</Label>
              <Select value={form.applies_to} onValueChange={(v) => setForm({ ...form, applies_to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="internet">Internet</SelectItem>
                  <SelectItem value="tv">TV</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="plan_only">Forfait seulement</SelectItem>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="plans_80_plus">Forfaits ≥ 80 $</SelectItem>
                  <SelectItem value="plans_90_plus">Forfaits ≥ 90 $</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date d'expiration — optionnel</Label>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
            <div>
              <Label>Limite d'utilisations — optionnel</Label>
              <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>Annuler</Button>
              <Button onClick={submitForm}>{editingId ? "Enregistrer" : "Créer"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Rabais actifs</TabsTrigger>
          <TabsTrigger value="assignments">Assignations</TabsTrigger>
          <TabsTrigger value="usage">Historique d'utilisation</TabsTrigger>
        </TabsList>

        {/* SECTION 1 — Active table */}
        <TabsContent value="active">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : discounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun rabais configuré.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Valeur</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead>Service min</TableHead>
                      <TableHead>Utilisations</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discounts.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>{TYPE_LABEL[d.type] || d.type}</TableCell>
                        <TableCell>{d.type === "percentage" ? `${d.value}%` : formatCAD(d.value)}</TableCell>
                        <TableCell>{d.duration_months ? `${d.duration_months} mois` : "—"}</TableCell>
                        <TableCell>{d.min_plan_price ? formatCAD(d.min_plan_price) : "—"}</TableCell>
                        <TableCell>{d.uses_count ?? 0}{d.max_uses ? ` / ${d.max_uses}` : ""}</TableCell>
                        <TableCell>
                          <Badge variant={d.is_active ? "default" : "secondary"}>
                            {d.is_active ? "Actif" : "Inactif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(d)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(d)}>
                            <Power className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 3 — Assignments */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader><CardTitle>Nouvelle assignation</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label>Rabais</Label>
                <Select value={assignDiscountId} onValueChange={setAssignDiscountId}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {discounts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cible</Label>
                <Select value={assignTarget} onValueChange={(v: any) => setAssignTarget(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les agents</SelectItem>
                    <SelectItem value="role">Rôle field_sales</SelectItem>
                    <SelectItem value="agent">Agent spécifique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{assignTarget === "agent" ? "ID de l'agent" : "—"}</Label>
                <Input
                  placeholder="UUID agent"
                  value={assignAgentId}
                  onChange={(e) => setAssignAgentId(e.target.value)}
                  disabled={assignTarget !== "agent"}
                />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <Button onClick={createAssignment}>Créer l'assignation</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader><CardTitle>Assignations actives</CardTitle></CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune assignation.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rabais</TableHead>
                      <TableHead>Cible</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => {
                      const d = discountsById.get(a.discount_id);
                      const target = a.applies_to_all
                        ? "Tous les agents"
                        : a.role
                          ? `Rôle: ${a.role}`
                          : a.agent_id
                            ? null
                            : "—";
                      return (
                        <TableRow key={a.id}>
                          <TableCell>{d?.name || a.discount_id.slice(0, 8)}</TableCell>
                          <TableCell>{target ?? <ProfileName userId={a.agent_id} />}</TableCell>
                          <TableCell>{new Date(a.assigned_at).toLocaleDateString("fr-CA")}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => revokeAssignment(a.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 4 — Usage history */}
        <TabsContent value="usage">
          <Card>
            <CardContent className="pt-6">
              {usage.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun rabais appliqué pour le moment.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Commande</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Montant économisé</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell><ProfileName userId={u.agent_id} /></TableCell>
                        <TableCell>{u.customer_name || "—"}</TableCell>
                        <TableCell>{u.field_order_id ? u.field_order_id.slice(0, 8) + "…" : "—"}</TableCell>
                        <TableCell>{new Date(u.created_at).toLocaleDateString("fr-CA")}</TableCell>
                        <TableCell className="text-right font-medium">{formatCAD(u.discount_amount)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{u.status || "applied"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
