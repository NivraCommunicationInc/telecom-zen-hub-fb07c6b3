/**
 * CoreCatalogPage — Unified canonical catalog management for Nivra Core.
 * Full CRUD on `services` table + `streaming_services` table.
 * Every edit here propagates to: website, simulator, checkout, portal, invoices.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Settings, Plus, Pencil, Wifi, Tv, Smartphone, Package, Search,
  MoreHorizontal, Copy, Archive, Eye, EyeOff, Monitor, Star,
  ArrowUpDown, Filter, Layers, ChevronRight, Globe, ShoppingCart,
  User, MonitorPlay, Zap
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface CatalogService {
  id: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category: string;
  price: number;
  billing_type: string;
  display_order: number;
  tags: string[];
  badges: string[];
  features_json: any[];
  is_active: boolean;
  is_featured: boolean;
  is_recommended: boolean;
  promo_eligible: boolean;
  visible_website: boolean;
  visible_simulator: boolean;
  visible_checkout: boolean;
  visible_portal: boolean;
  status: string;
  equipment_rules: any;
  activation_fee_rule: string;
  installation_fee_rule: string;
  shipping_fee_rule: string;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM: Partial<CatalogService> = {
  name: "", short_description: "", description: "", category: "Internet",
  price: 0, billing_type: "monthly", display_order: 0, tags: [], badges: [],
  features_json: [], is_active: true, is_featured: false, is_recommended: false,
  promo_eligible: false, visible_website: true, visible_simulator: false,
  visible_checkout: true, visible_portal: true, status: "active",
  equipment_rules: {}, activation_fee_rule: "standard",
  installation_fee_rule: "none", shipping_fee_rule: "standard",
};

const CATEGORIES = ["Internet", "TV", "Mobile", "Équipement", "Combo", "Sécurité", "Fee"];
const STATUSES = ["active", "inactive", "hidden", "archived"];
const CATEGORY_ICONS: Record<string, any> = {
  Internet: Wifi, TV: Tv, Mobile: Smartphone, "Équipement": Package,
  Combo: Layers, Sécurité: Settings, Fee: Zap,
};

export default function CoreCatalogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [simulatorFilter, setSimulatorFilter] = useState("all");
  const [editItem, setEditItem] = useState<CatalogService | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<Partial<CatalogService>>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState("general");

  /* ─── Fetch all services (including inactive) ─── */
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["core-catalog-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services" as any)
        .select("*")
        .order("category")
        .order("display_order")
        .order("price");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  /* ─── Mutations ─── */
  const saveMutation = useMutation({
    mutationFn: async (item: Partial<CatalogService> & { id?: string }) => {
      const payload = {
        name: item.name,
        short_description: item.short_description || null,
        description: item.description || null,
        category: item.category,
        price: Number(item.price),
        billing_type: item.billing_type || "monthly",
        display_order: item.display_order || 0,
        tags: item.tags || [],
        badges: item.badges || [],
        features_json: item.features_json || [],
        is_active: item.is_active ?? true,
        is_featured: item.is_featured ?? false,
        is_recommended: item.is_recommended ?? false,
        promo_eligible: item.promo_eligible ?? false,
        visible_website: item.visible_website ?? true,
        visible_simulator: item.visible_simulator ?? false,
        visible_checkout: item.visible_checkout ?? true,
        visible_portal: item.visible_portal ?? true,
        status: item.status || "active",
        equipment_rules: item.equipment_rules || {},
        activation_fee_rule: item.activation_fee_rule || "standard",
        installation_fee_rule: item.installation_fee_rule || "none",
        shipping_fee_rule: item.shipping_fee_rule || "standard",
        updated_at: new Date().toISOString(),
      };

      if (item.id) {
        const { error } = await supabase.from("services" as any).update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAllCatalogQueries();
      toast.success(editItem ? "Service mis à jour" : "Service créé");
      closeDrawer();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("services" as any)
        .update({ is_active: false, status: "archived", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-catalog-full"] });
      queryClient.invalidateQueries({ queryKey: ["public-services"] });
      toast.success("Service archivé");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (source: CatalogService) => {
      const { id, created_at, updated_at, ...rest } = source;
      const { error } = await supabase
        .from("services" as any)
        .insert({ ...rest, name: `${rest.name} (copie)`, is_active: false, status: "inactive" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-catalog-full"] });
      toast.success("Service dupliqué");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("services" as any)
        .update({ is_active: active, status: active ? "active" : "inactive", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-catalog-full"] });
      queryClient.invalidateQueries({ queryKey: ["public-services"] });
      toast.success("Statut mis à jour");
    },
  });

  /* ─── Helpers ─── */
  const closeDrawer = () => {
    setEditItem(null);
    setIsCreating(false);
    setForm(EMPTY_FORM);
    setActiveTab("general");
  };

  const openEdit = (s: CatalogService) => {
    setEditItem(s);
    setForm({ ...s });
    setIsCreating(false);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setIsCreating(true);
  };

  const openDuplicate = (s: CatalogService) => {
    const { id, created_at, updated_at, ...rest } = s;
    setEditItem(null);
    setForm({ ...rest, name: `${rest.name} (copie)`, is_active: false, status: "inactive" });
    setIsCreating(true);
  };

  /* ─── Filters ─── */
  const filtered = useMemo(() => {
    return services.filter((s: any) => {
      if (catFilter !== "all" && s.category !== catFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "active" && !s.is_active) return false;
        if (statusFilter === "inactive" && s.is_active) return false;
        if (statusFilter === "archived" && s.status !== "archived") return false;
      }
      if (simulatorFilter === "simulator" && !s.visible_simulator) return false;
      if (simulatorFilter === "website" && !s.visible_website) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [services, catFilter, statusFilter, simulatorFilter, search]);

  const categories = [...new Set(services.map((s: any) => s.category))];

  const stats = useMemo(() => ({
    total: services.length,
    active: services.filter((s: any) => s.is_active).length,
    simulator: services.filter((s: any) => s.visible_simulator).length,
    featured: services.filter((s: any) => s.is_featured).length,
  }), [services]);

  const drawerOpen = !!editItem || isCreating;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Catalog Management</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">
            Canonical service catalog · {stats.total} items · {stats.active} active · {stats.simulator} simulator
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" /> New Service
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-[hsl(var(--core-text-primary))]" },
          { label: "Active", value: stats.active, color: "text-emerald-400" },
          { label: "Simulator", value: stats.simulator, color: "text-sky-400" },
          { label: "Featured", value: stats.featured, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="px-4 py-3 rounded-lg bg-[hsl(220,15%,11%)] border border-[hsl(220,15%,16%)]">
            <p className="text-xs text-[hsl(var(--core-text-label))]">{s.label}</p>
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
          <Input placeholder="Search catalog…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-36 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={simulatorFilter} onValueChange={setSimulatorFilter}>
          <SelectTrigger className="w-36 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]"><SelectValue placeholder="Visibility" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Visibility</SelectItem>
            <SelectItem value="simulator">Simulator Only</SelectItem>
            <SelectItem value="website">Website Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,9%)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[hsl(220,15%,16%)] hover:bg-transparent">
              <TableHead className="text-[hsl(var(--core-text-label))] w-[50px]">#</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Service</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Category</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))] text-right">Price</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Status</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Visibility</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))]">Flags</TableHead>
              <TableHead className="text-[hsl(var(--core-text-label))] w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s: any, idx: number) => {
              const Icon = CATEGORY_ICONS[s.category] || Settings;
              return (
                <TableRow key={s.id}
                  className="border-[hsl(220,15%,14%)] hover:bg-[hsl(220,15%,12%)] cursor-pointer"
                  onClick={() => openEdit(s)}>
                  <TableCell className="text-[hsl(var(--core-text-label))] text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{s.name}</p>
                        {s.short_description && (
                          <p className="text-xs text-[hsl(var(--core-text-secondary))] truncate max-w-[300px]">{s.short_description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0 text-[10px]">
                      {s.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-semibold text-emerald-400">
                      {Number(s.price).toFixed(2)}$
                    </span>
                    <span className="text-[10px] text-[hsl(var(--core-text-label))] ml-1">
                      /{s.billing_type === "yearly" ? "an" : "mo"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("border-0 text-[10px]",
                      s.is_active ? "bg-emerald-500/15 text-emerald-400" :
                      s.status === "archived" ? "bg-red-500/15 text-red-400" :
                      "bg-zinc-500/15 text-zinc-400"
                    )}>
                      {s.is_active ? "Active" : s.status === "archived" ? "Archived" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {s.visible_website && <span title="Website"><Globe className="w-3 h-3 text-sky-400" /></span>}
                      {s.visible_simulator && <span title="Simulator"><MonitorPlay className="w-3 h-3 text-violet-400" /></span>}
                      {s.visible_checkout && <span title="Checkout"><ShoppingCart className="w-3 h-3 text-amber-400" /></span>}
                      {s.visible_portal && <span title="Portal"><User className="w-3 h-3 text-emerald-400" /></span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {s.is_featured && <span title="Featured"><Star className="w-3 h-3 text-amber-400 fill-amber-400" /></span>}
                      {s.promo_eligible && <span title="Promo Eligible"><Zap className="w-3 h-3 text-violet-400" /></span>}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[hsl(220,15%,13%)] border-[hsl(220,15%,20%)]">
                        <DropdownMenuItem onClick={() => openEdit(s)} className="gap-2"><Pencil className="w-3.5 h-3.5" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDuplicate(s)} className="gap-2"><Copy className="w-3.5 h-3.5" /> Duplicate</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[hsl(220,15%,20%)]" />
                        <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: s.id, active: !s.is_active })} className="gap-2">
                          {s.is_active ? <><EyeOff className="w-3.5 h-3.5" /> Deactivate</> : <><Eye className="w-3.5 h-3.5" /> Activate</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => archiveMutation.mutate(s.id)} className="gap-2 text-red-400">
                          <Archive className="w-3.5 h-3.5" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-[hsl(var(--core-text-label))]">
                  {isLoading ? "Loading…" : "No services match filters"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit/Create Drawer */}
      <Sheet open={drawerOpen} onOpenChange={(open) => { if (!open) closeDrawer(); }}>
        <SheetContent side="right" className="w-[520px] sm:max-w-[520px] bg-[hsl(220,15%,10%)] border-l border-[hsl(220,15%,18%)] text-[hsl(var(--core-text-primary))] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[hsl(var(--core-text-primary))]">
              {isCreating ? "New Service" : `Edit: ${editItem?.name}`}
            </SheetTitle>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="bg-[hsl(220,15%,14%)] w-full grid grid-cols-4">
              <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
              <TabsTrigger value="visibility" className="text-xs">Visibility</TabsTrigger>
              <TabsTrigger value="fees" className="text-xs">Fees</TabsTrigger>
              <TabsTrigger value="display" className="text-xs">Display</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Name</Label>
                <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Short Description</Label>
                <Input value={form.short_description || ""} onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                  className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Full Description</Label>
                <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] min-h-[80px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[hsl(var(--core-text-label))]">Category</Label>
                  <Select value={form.category || "Internet"} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-[hsl(var(--core-text-label))]">Status</Label>
                  <Select value={form.status || "active"} onValueChange={(v) => setForm({ ...form, status: v, is_active: v === "active" })}>
                    <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[hsl(var(--core-text-label))]">Price ($)</Label>
                  <Input type="number" step="0.01" value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                    className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" />
                </div>
                <div>
                  <Label className="text-xs text-[hsl(var(--core-text-label))]">Billing Type</Label>
                  <Select value={form.billing_type || "monthly"} onValueChange={(v) => setForm({ ...form, billing_type: v })}>
                    <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="one_time">One-time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="visibility" className="space-y-4 mt-4">
              <p className="text-xs text-[hsl(var(--core-text-label))]">Control where this service appears across the platform.</p>
              {[
                { key: "visible_website", label: "Website (public pages)", icon: Globe },
                { key: "visible_simulator", label: "TV sur mesure Simulator", icon: MonitorPlay },
                { key: "visible_checkout", label: "Checkout / Order Wizard", icon: ShoppingCart },
                { key: "visible_portal", label: "Client Portal", icon: User },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,18%)]">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[hsl(var(--core-text-label))]" />
                    <span className="text-sm">{label}</span>
                  </div>
                  <Switch
                    checked={(form as any)[key] ?? false}
                    onCheckedChange={(v) => setForm({ ...form, [key]: v })}
                  />
                </div>
              ))}
              <div className="border-t border-[hsl(220,15%,18%)] pt-4 space-y-3">
                <p className="text-xs text-[hsl(var(--core-text-label))]">Flags</p>
                {[
                  { key: "is_featured", label: "Featured (highlighted in listings)" },
                  { key: "is_recommended", label: "Recommended (badge displayed)" },
                  { key: "promo_eligible", label: "Promo Eligible (can receive discounts)" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,18%)]">
                    <span className="text-sm">{label}</span>
                    <Switch checked={(form as any)[key] ?? false} onCheckedChange={(v) => setForm({ ...form, [key]: v })} />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="fees" className="space-y-4 mt-4">
              <p className="text-xs text-[hsl(var(--core-text-label))]">Fee rules applied when this service is ordered.</p>
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Activation Fee Rule</Label>
                <Select value={form.activation_fee_rule || "standard"} onValueChange={(v) => setForm({ ...form, activation_fee_rule: v })}>
                  <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard ($25 single / $45 multi)</SelectItem>
                    <SelectItem value="none">No activation fee</SelectItem>
                    <SelectItem value="included">Included in price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Installation Fee Rule</Label>
                <Select value={form.installation_fee_rule || "none"} onValueChange={(v) => setForm({ ...form, installation_fee_rule: v })}>
                  <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No installation fee</SelectItem>
                    <SelectItem value="technician">Technician ($50)</SelectItem>
                    <SelectItem value="optional">Optional (client chooses)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Shipping / Delivery Rule</Label>
                <Select value={form.shipping_fee_rule || "standard"} onValueChange={(v) => setForm({ ...form, shipping_fee_rule: v })}>
                  <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Delivery ($30)</SelectItem>
                    <SelectItem value="none">No shipping</SelectItem>
                    <SelectItem value="included">Included</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="display" className="space-y-4 mt-4">
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Display Order</Label>
                <Input type="number" value={form.display_order ?? 0} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                  className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Tags (comma-separated)</Label>
                <Input
                  value={(form.tags || []).join(", ")}
                  onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  placeholder="giga, premium, promo"
                  className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Badges (comma-separated)</Label>
                <Input
                  value={(form.badges || []).join(", ")}
                  onChange={(e) => setForm({ ...form, badges: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  placeholder="Populaire, Meilleur prix"
                  className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Features (JSON array)</Label>
                <Textarea
                  value={JSON.stringify(form.features_json || [], null, 2)}
                  onChange={(e) => {
                    try { setForm({ ...form, features_json: JSON.parse(e.target.value) }); } catch {}
                  }}
                  placeholder='["WiFi 6", "Unlimited data"]'
                  className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] min-h-[100px] font-mono text-xs" />
              </div>
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={closeDrawer} className="border-[hsl(220,15%,20%)] bg-transparent">Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate({ ...form, id: editItem?.id })}
              disabled={saveMutation.isPending || !form.name}
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saveMutation.isPending ? "Saving…" : isCreating ? "Create" : "Save Changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
