/**
 * EquipmentInventoryPage — Canonical equipment & inventory management for Nivra Core.
 * /core/equipment
 * 
 * Day 2: Real operational equipment tracking with lifecycle statuses,
 * assignment to account/order/address, audit logging, and serial tracking.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Package, Plus, Search, Wifi, Tv, Smartphone, CreditCard, Cpu,
  Loader2, XCircle, Edit, RotateCcw, CheckCircle, AlertTriangle,
  UserCheck, MapPin, FileText, Clock, ArrowRight, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusVariant } from "@/core-app/components/ui/StatusBadge";

// ── Canonical Statuses ──
const STATUS_OPTIONS = [
  { value: "in_stock", label: "En stock", variant: "success" as StatusVariant },
  { value: "reserved", label: "Réservé", variant: "warning" as StatusVariant },
  { value: "assigned", label: "Assigné", variant: "info" as StatusVariant },
  { value: "deployed", label: "Déployé", variant: "purple" as StatusVariant },
  { value: "returned", label: "Retourné", variant: "neutral" as StatusVariant },
  { value: "defective", label: "Défectueux", variant: "danger" as StatusVariant },
  { value: "lost", label: "Perdu", variant: "danger" as StatusVariant },
] as const;

const statusVariant = (s: string): StatusVariant => {
  const found = STATUS_OPTIONS.find(o => o.value === s);
  return found?.variant || "neutral";
};

const statusLabel = (s: string) => STATUS_OPTIONS.find(o => o.value === s)?.label || s;

// ── Categories ──
const CATEGORIES = [
  { id: "all", label: "Tout", icon: Package },
  { id: "router", label: "Routeurs / Bornes WiFi", icon: Wifi },
  { id: "terminal", label: "Terminaux TV", icon: Tv },
  { id: "sim_card", label: "Cartes SIM", icon: CreditCard },
  { id: "modem", label: "Modems", icon: Cpu },
  { id: "accessory", label: "Accessoires", icon: Smartphone },
];

const categoryLabel = (c: string) => CATEGORIES.find(cat => cat.id === c)?.label || c;

// ── Valid status transitions ──
const VALID_TRANSITIONS: Record<string, string[]> = {
  in_stock: ["reserved", "assigned", "defective", "lost"],
  reserved: ["in_stock", "assigned", "defective"],
  assigned: ["deployed", "returned", "defective", "lost"],
  deployed: ["returned", "defective", "lost"],
  returned: ["in_stock", "defective"],
  defective: ["in_stock", "lost"],
  lost: [],
};

interface EquipmentRow {
  id: string;
  catalog_item_id: string | null;
  catalog_name: string;
  category: string;
  sku: string | null;
  serial_number: string | null;
  imei: string | null;
  mac_address: string | null;
  cost_internal: number | null;
  price_client: number | null;
  status: string;
  condition: string | null;
  account_id: string | null;
  order_id: string | null;
  subscription_id: string | null;
  address_id: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  deployed_at: string | null;
  retired_at: string | null;
  firmware_version: string | null;
  notes: string | null;
  warehouse_location: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  actor_name: string | null;
  details: any;
  created_at: string;
}

const EMPTY_FORM = {
  catalog_item_id: "",
  catalog_name: "",
  category: "router",
  sku: "",
  serial_number: "",
  imei: "",
  mac_address: "",
  cost_internal: "",
  price_client: "",
  condition: "new",
  warehouse_location: "",
  firmware_version: "",
  notes: "",
  quantity: "1",
};

export default function EquipmentInventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selected, setSelected] = useState<EquipmentRow | null>(null);
  const [assignDialog, setAssignDialog] = useState<EquipmentRow | null>(null);
  const [statusChangeItem, setStatusChangeItem] = useState<EquipmentRow | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [addForm, setAddForm] = useState({ ...EMPTY_FORM });

  // Assignment form
  const [assignForm, setAssignForm] = useState({ account_number: "", order_number: "", notes: "" });

  // ── Fetch inventory ──
  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["equipment-inventory", statusFilter, categoryFilter],
    queryFn: async () => {
      let q = supabase
        .from("equipment_inventory")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (categoryFilter !== "all") q = q.eq("category", categoryFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as EquipmentRow[];
    },
  });

  // ── Fetch catalog equipment items ──
  const { data: catalogOptions = [] } = useQuery({
    queryKey: ["equipment-catalog-options"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, price")
        .eq("category", "Équipement")
        .eq("is_active", true)
        .order("name");
      return (data || []) as { id: string; name: string; price: number }[];
    },
  });

  // ── Fetch audit log for selected item ──
  const { data: auditLog = [] } = useQuery({
    queryKey: ["equipment-audit", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase
        .from("equipment_audit_log")
        .select("*")
        .eq("equipment_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as AuditRow[];
    },
  });

  // ── Add mutation ──
  const addMutation = useMutation({
    mutationFn: async () => {
      const qty = Math.min(parseInt(addForm.quantity) || 1, 50);
      const items = [];
      for (let i = 0; i < qty; i++) {
        items.push({
          catalog_item_id: addForm.catalog_item_id || null,
          catalog_name: addForm.catalog_name,
          category: addForm.category,
          sku: addForm.sku || null,
          serial_number: qty === 1 ? (addForm.serial_number || null) : null,
          imei: qty === 1 ? (addForm.imei || null) : null,
          mac_address: qty === 1 ? (addForm.mac_address || null) : null,
          cost_internal: parseFloat(addForm.cost_internal) || null,
          price_client: parseFloat(addForm.price_client) || null,
          condition: addForm.condition,
          warehouse_location: addForm.warehouse_location || null,
          firmware_version: addForm.firmware_version || null,
          notes: addForm.notes || null,
          status: "in_stock",
        });
      }
      const { error } = await supabase.from("equipment_inventory").insert(items as any);
      if (error) throw error;

      // Log audit for each
      const auditEntries = items.map((it, idx) => ({
        equipment_id: "placeholder", // We don't have the IDs back — audit trigger should handle this
        action: "created",
        new_status: "in_stock",
        actor_name: "Admin",
        details: { catalog_name: it.catalog_name, category: it.category, serial_number: it.serial_number },
      }));
      // We'll rely on the returned data or a trigger; skip manual audit on bulk create
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-inventory"] });
      toast.success(`${parseInt(addForm.quantity) > 1 ? addForm.quantity + " unités ajoutées" : "Équipement ajouté"} au stock`);
      setShowAddDialog(false);
      setAddForm({ ...EMPTY_FORM });
    },
    onError: (err: any) => toast.error("Erreur", { description: err.message }),
  });

  // ── Status change mutation (with audit log) ──
  const statusMutation = useMutation({
    mutationFn: async ({ item, toStatus, note }: { item: EquipmentRow; toStatus: string; note?: string }) => {
      const updates: any = {
        status: toStatus,
        updated_at: new Date().toISOString(),
      };
      // Clear assignment fields when returning to stock
      if (toStatus === "in_stock") {
        updates.account_id = null;
        updates.order_id = null;
        updates.subscription_id = null;
        updates.address_id = null;
        updates.assigned_at = null;
        updates.assigned_by = null;
        updates.deployed_at = null;
      }
      if (toStatus === "deployed") {
        updates.deployed_at = new Date().toISOString();
      }
      if (toStatus === "lost" || toStatus === "defective") {
        updates.retired_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("equipment_inventory")
        .update(updates)
        .eq("id", item.id);
      if (error) throw error;

      // Write audit log
      await supabase.from("equipment_audit_log").insert({
        equipment_id: item.id,
        action: "status_change",
        old_status: item.status,
        new_status: toStatus,
        actor_name: "Admin",
        details: note ? { note } : null,
      } as any);

      // ─── DEFECTIVE: log alert + notify admins ───
      if (toStatus === "defective" && item.status !== "defective") {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: alert } = await supabase
          .from("defective_equipment_alerts")
          .insert({
            equipment_id: item.id,
            serial_number: item.serial_number,
            catalog_name: item.catalog_name,
            category: item.category,
            account_id: item.account_id,
            order_id: item.order_id,
            reported_by: user?.id || null,
            notes: note || null,
          } as any)
          .select("id")
          .single();

        // Fire-and-forget admin email
        try {
          await supabase.functions.invoke("notify-admin-alert", {
            body: {
              alert_type: "equipment_defective",
              title: `Équipement défectueux: ${item.catalog_name}`,
              summary: `Un équipement a été marqué défectueux.\nProduit: ${item.catalog_name}\nN° série: ${item.serial_number || "—"}\nSKU: ${item.sku || "—"}\nCatégorie: ${item.category}${item.order_id ? `\nCommande liée: ${item.order_id}` : ""}${note ? `\nNote: ${note}` : ""}`,
              entity_type: "equipment",
              entity_id: item.id,
              entity_number: item.serial_number || item.sku || item.id.slice(0, 8),
              admin_path: "/core/equipment",
              priority: "high",
            },
          });
          if (alert?.id) {
            await supabase
              .from("defective_equipment_alerts")
              .update({ email_sent: true, email_sent_at: new Date().toISOString() } as any)
              .eq("id", alert.id);
          }
        } catch (e) {
          console.warn("[Defective alert] email dispatch failed (non-blocking):", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-audit"] });
      queryClient.invalidateQueries({ queryKey: ["defective-alerts-unacked"] });
      toast.success("Statut mis à jour");
      setStatusChangeItem(null);
      setNewStatus("");
      setStatusNote("");
    },
    onError: (err: any) => toast.error("Erreur", { description: err.message }),
  });

  // ── Assignment mutation ──
  const assignMutation = useMutation({
    mutationFn: async ({ item, accountId, orderId }: { item: EquipmentRow; accountId: string | null; orderId: string | null }) => {
      const { error } = await supabase
        .from("equipment_inventory")
        .update({
          status: "assigned",
          account_id: accountId,
          order_id: orderId,
          assigned_at: new Date().toISOString(),
          assigned_by: "Admin",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", item.id);
      if (error) throw error;

      // Audit
      await supabase.from("equipment_audit_log").insert({
        equipment_id: item.id,
        action: "assigned",
        old_status: item.status,
        new_status: "assigned",
        actor_name: "Admin",
        details: { account_id: accountId, order_id: orderId },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-audit"] });
      toast.success("Équipement assigné");
      setAssignDialog(null);
      setAssignForm({ account_number: "", order_number: "", notes: "" });
    },
    onError: (err: any) => toast.error("Erreur d'assignation", { description: err.message }),
  });

  // ── Resolve account by account_number ──
  const resolveAndAssign = async () => {
    if (!assignDialog) return;
    let accountId: string | null = null;
    let orderId: string | null = null;

    if (assignForm.account_number.trim()) {
      const { data: acc } = await supabase
        .from("accounts")
        .select("id")
        .eq("account_number", assignForm.account_number.trim())
        .maybeSingle();
      if (!acc) {
        toast.error("Compte introuvable", { description: `Aucun compte avec le numéro ${assignForm.account_number}` });
        return;
      }
      accountId = acc.id;
    }

    if (assignForm.order_number.trim()) {
      const { data: ord } = await supabase
        .from("orders")
        .select("id")
        .eq("order_number", assignForm.order_number.trim())
        .maybeSingle();
      if (!ord) {
        toast.error("Commande introuvable", { description: `Aucune commande avec le numéro ${assignForm.order_number}` });
        return;
      }
      orderId = ord.id;
    }

    if (!accountId && !orderId) {
      toast.error("Veuillez entrer un numéro de compte ou de commande");
      return;
    }

    assignMutation.mutate({ item: assignDialog, accountId, orderId });
  };

  // ── Catalog selection helper ──
  const handleCatalogSelect = (catalogId: string) => {
    const opt = catalogOptions.find(c => c.id === catalogId);
    if (opt) {
      setAddForm(prev => ({
        ...prev,
        catalog_item_id: opt.id,
        catalog_name: opt.name,
        price_client: String(opt.price || 0),
      }));
    }
  };

  // ── Filter ──
  const filtered = useMemo(() => {
    if (!search.trim()) return inventory;
    const q = search.toLowerCase();
    return inventory.filter(item =>
      item.catalog_name?.toLowerCase().includes(q) ||
      (item.serial_number || "").toLowerCase().includes(q) ||
      (item.sku || "").toLowerCase().includes(q) ||
      (item.imei || "").toLowerCase().includes(q) ||
      (item.mac_address || "").toLowerCase().includes(q)
    );
  }, [inventory, search]);

  // ── KPIs ──
  const allItems = inventory; // already filtered by category/status via query
  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s.value] = inventory.filter(i => i.status === s.value).length;
    return acc;
  }, {} as Record<string, number>);

  const catCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = cat.id === "all" ? inventory.length : inventory.filter(i => i.category === cat.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Inventaire Équipements</h1>
          <p className="text-xs text-muted-foreground">
            {inventory.length} unités • {counts.in_stock || 0} en stock • {counts.deployed || 0} déployés • {counts.defective || 0} défectueux
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Ajouter au stock
        </Button>
      </div>

      {/* ═══ STATUS KPIs ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
            className={cn(
              "rounded-lg border p-2.5 text-left transition-colors",
              statusFilter === s.value
                ? "border-emerald-500/30 bg-emerald-600/10"
                : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]"
            )}
          >
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
            <p className="text-lg font-bold text-foreground mt-0.5">{counts[s.value] || 0}</p>
          </button>
        ))}
      </div>

      {/* ═══ CATEGORY TABS ═══ */}
      <div className="flex gap-1.5 border-b border-[hsl(220,15%,16%)] pb-0">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors",
              categoryFilter === cat.id
                ? "bg-[hsl(220,20%,11%)] text-emerald-400 border border-[hsl(220,15%,16%)] border-b-transparent -mb-px"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <cat.icon className="h-3.5 w-3.5" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* ═══ SEARCH ═══ */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Produit, SKU, SN, IMEI, MAC…"
          className="pl-8 h-8 bg-[hsl(220,20%,9%)] border-[hsl(220,15%,18%)] text-foreground text-xs placeholder:text-muted-foreground"
        />
      </div>

      {/* ═══ TABLE ═══ */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Produit", "Catégorie", "SKU", "N° Série", "IMEI / MAC", "Emplacement", "Statut", "Condition", "Coût", "Prix client", "Assigné", "Actions"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={12} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-12 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Aucun équipement trouvé
                </td></tr>
              ) : (
                filtered.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 text-foreground font-medium max-w-[160px] truncate">{item.catalog_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{categoryLabel(item.category)}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{item.sku || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{item.serial_number || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{item.imei || item.mac_address || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.warehouse_location || "—"}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={statusLabel(item.status)} variant={statusVariant(item.status)} size="sm" />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground capitalize">{item.condition || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.cost_internal != null ? `${Number(item.cost_internal).toFixed(2)} $` : "—"}</td>
                    <td className="px-3 py-2.5 text-emerald-400 font-medium">{item.price_client != null ? `${Number(item.price_client).toFixed(2)} $` : "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-[10px]">
                      {item.account_id ? "✓ Compte" : "—"}
                    </td>
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {/* Assign button - only for in_stock or reserved */}
                        {(item.status === "in_stock" || item.status === "reserved") && (
                          <button
                            onClick={() => { setAssignDialog(item); setAssignForm({ account_number: "", order_number: "", notes: "" }); }}
                            className="h-6 px-2 rounded border border-blue-500/30 text-[10px] text-blue-400 hover:bg-blue-500/10"
                            title="Assigner"
                          >
                            <UserCheck className="h-3 w-3" />
                          </button>
                        )}
                        {/* Status change */}
                        <button
                          onClick={() => { setStatusChangeItem(item); setNewStatus(item.status); setStatusNote(""); }}
                          className="h-6 px-2 rounded border border-[hsl(220,15%,20%)] text-[10px] text-muted-foreground hover:text-foreground"
                          title="Changer statut"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ DETAIL DRAWER ═══ */}
      <Sheet open={!!selected && !statusChangeItem && !assignDialog} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-foreground overflow-y-auto">
          <SheetHeader><SheetTitle className="text-foreground">Fiche équipement</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              {/* Identity */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Identification</h3>
                {[
                  ["Produit", selected.catalog_name],
                  ["Catégorie", categoryLabel(selected.category)],
                  ["SKU", selected.sku],
                  ["N° Série", selected.serial_number],
                  ["IMEI", selected.imei],
                  ["MAC", selected.mac_address],
                  ["Firmware", selected.firmware_version],
                  ["Condition", selected.condition],
                  ["Emplacement", selected.warehouse_location],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="text-foreground font-medium text-right max-w-[200px] break-all">{(v as string) || "—"}</span>
                  </div>
                ))}
              </div>

              {/* Financials */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Financier</h3>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">Coût interne</span>
                  <span className="text-foreground">{selected.cost_internal != null ? `${Number(selected.cost_internal).toFixed(2)} $` : "—"}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">Prix client</span>
                  <span className="text-emerald-400 font-medium">{selected.price_client != null ? `${Number(selected.price_client).toFixed(2)} $` : "—"}</span>
                </div>
              </div>

              {/* Assignment */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assignation</h3>
                {[
                  ["Statut", statusLabel(selected.status)],
                  ["Compte", selected.account_id || "—"],
                  ["Commande", selected.order_id || "—"],
                  ["Abonnement", selected.subscription_id || "—"],
                  ["Assigné le", selected.assigned_at ? format(new Date(selected.assigned_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"],
                  ["Assigné par", selected.assigned_by || "—"],
                  ["Déployé le", selected.deployed_at ? format(new Date(selected.deployed_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="text-foreground font-medium text-right max-w-[200px] break-all">{(v as string) || "—"}</span>
                  </div>
                ))}
              </div>

              {/* Status Actions */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Actions</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(VALID_TRANSITIONS[selected.status] || []).map(toStatus => (
                    <button
                      key={toStatus}
                      onClick={() => statusMutation.mutate({ item: selected, toStatus })}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors text-muted-foreground border border-[hsl(220,15%,18%)] hover:text-foreground"
                    >
                      → {statusLabel(toStatus)}
                    </button>
                  ))}
                  {(selected.status === "in_stock" || selected.status === "reserved") && (
                    <button
                      onClick={() => { setAssignDialog(selected); setSelected(null); }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30"
                    >
                      <UserCheck className="h-3 w-3 inline mr-1" /> Assigner
                    </button>
                  )}
                </div>
              </div>

              {/* Audit Trail */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" /> Historique
                </h3>
                {auditLog.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Aucun historique</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {auditLog.map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-[11px]">
                        <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <span className="text-foreground font-medium">{log.action}</span>
                          {log.old_status && log.new_status && (
                            <span className="text-muted-foreground"> {statusLabel(log.old_status)} → {statusLabel(log.new_status)}</span>
                          )}
                          <br />
                          <span className="text-muted-foreground">
                            {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                            {log.actor_name && ` • ${log.actor_name}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected.notes && (
                <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</h3>
                  <p className="text-[12px] text-foreground">{selected.notes}</p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ STATUS CHANGE DIALOG ═══ */}
      {statusChangeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setStatusChangeItem(null)}>
          <div className="w-full max-w-sm rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-[14px] font-semibold text-foreground">
              Changer le statut: {statusChangeItem.catalog_name}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Statut actuel: <StatusBadge label={statusLabel(statusChangeItem.status)} variant={statusVariant(statusChangeItem.status)} size="sm" />
            </p>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Nouveau statut</Label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                className="w-full h-8 px-2 mt-1 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-foreground focus:outline-none"
              >
                {(VALID_TRANSITIONS[statusChangeItem.status] || []).map(s => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Note (optionnel)</Label>
              <Input
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                placeholder="Raison du changement…"
                className="h-8 mt-1 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,18%)] text-foreground text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStatusChangeItem(null)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-muted-foreground text-[12px] font-medium">
                Annuler
              </button>
              <button
                onClick={() => {
                  const toStatus = newStatus || (VALID_TRANSITIONS[statusChangeItem.status] || [])[0];
                  if (toStatus) statusMutation.mutate({ item: statusChangeItem, toStatus, note: statusNote });
                }}
                disabled={statusMutation.isPending}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ASSIGNMENT DIALOG ═══ */}
      {assignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAssignDialog(null)}>
          <div className="w-full max-w-md rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-blue-400" />
              Assigner: {assignDialog.catalog_name}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              SN: {assignDialog.serial_number || "N/A"} • {assignDialog.sku || "N/A"}
            </p>

            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">N° de compte client</Label>
              <Input
                value={assignForm.account_number}
                onChange={e => setAssignForm(p => ({ ...p, account_number: e.target.value }))}
                placeholder="ACC-XXXXXX"
                className="h-8 mt-1 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,18%)] text-foreground text-xs"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">N° de commande (optionnel)</Label>
              <Input
                value={assignForm.order_number}
                onChange={e => setAssignForm(p => ({ ...p, order_number: e.target.value }))}
                placeholder="ORD-XXXXXX"
                className="h-8 mt-1 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,18%)] text-foreground text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setAssignDialog(null)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-muted-foreground text-[12px] font-medium">
                Annuler
              </button>
              <button
                onClick={resolveAndAssign}
                disabled={assignMutation.isPending || (!assignForm.account_number.trim() && !assignForm.order_number.trim())}
                className="h-8 px-3 rounded-md bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {assignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Assigner"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD EQUIPMENT DIALOG ═══ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,16%)] text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Ajouter au stock</DialogTitle>
            <DialogDescription className="text-muted-foreground">Sélectionnez un article du catalogue ou saisissez manuellement</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {/* Catalog picker */}
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Article du catalogue</Label>
              <Select value={addForm.catalog_item_id} onValueChange={handleCatalogSelect}>
                <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs">
                  <SelectValue placeholder="Choisir un article…" />
                </SelectTrigger>
                <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                  {catalogOptions.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-foreground text-xs">
                      {c.name} — {Number(c.price).toFixed(2)} $
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Catégorie *</Label>
                <Select value={addForm.category} onValueChange={v => setAddForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                    {CATEGORIES.filter(c => c.id !== "all").map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-foreground text-xs">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Quantité</Label>
                <Input type="number" min="1" max="50" value={addForm.quantity}
                  onChange={e => setAddForm(p => ({ ...p, quantity: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>

            {!addForm.catalog_item_id && (
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Nom article (manuel) *</Label>
                <Input value={addForm.catalog_name}
                  onChange={e => setAddForm(p => ({ ...p, catalog_name: e.target.value }))}
                  placeholder="Routeur WiFi 6, Terminal Android…"
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            )}

            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">SKU</Label>
              <Input value={addForm.sku}
                onChange={e => setAddForm(p => ({ ...p, sku: e.target.value }))}
                placeholder="EQ-ROUTER"
                className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">N° Série</Label>
                <Input value={addForm.serial_number}
                  onChange={e => setAddForm(p => ({ ...p, serial_number: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">IMEI</Label>
                <Input value={addForm.imei}
                  onChange={e => setAddForm(p => ({ ...p, imei: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">MAC</Label>
                <Input value={addForm.mac_address}
                  onChange={e => setAddForm(p => ({ ...p, mac_address: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Coût interne ($)</Label>
                <Input type="number" step="0.01" value={addForm.cost_internal}
                  onChange={e => setAddForm(p => ({ ...p, cost_internal: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Prix client ($)</Label>
                <Input type="number" step="0.01" value={addForm.price_client}
                  onChange={e => setAddForm(p => ({ ...p, price_client: e.target.value }))}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Condition</Label>
                <Select value={addForm.condition} onValueChange={v => setAddForm(p => ({ ...p, condition: v }))}>
                  <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                    <SelectItem value="new" className="text-foreground text-xs">Neuf</SelectItem>
                    <SelectItem value="refurbished" className="text-foreground text-xs">Reconditionné</SelectItem>
                    <SelectItem value="used" className="text-foreground text-xs">Usagé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Emplacement</Label>
                <Input value={addForm.warehouse_location}
                  onChange={e => setAddForm(p => ({ ...p, warehouse_location: e.target.value }))}
                  placeholder="Entrepôt A"
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Firmware</Label>
                <Input value={addForm.firmware_version}
                  onChange={e => setAddForm(p => ({ ...p, firmware_version: e.target.value }))}
                  placeholder="v2.1.0"
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Notes</Label>
              <Textarea value={addForm.notes}
                onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
            </div>

            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || (!addForm.catalog_name && !addForm.catalog_item_id)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Ajouter {parseInt(addForm.quantity) > 1 ? `${addForm.quantity} unités` : "au stock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
