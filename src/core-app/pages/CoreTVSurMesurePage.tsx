/**
 * CoreTVSurMesurePage — TV sur mesure management section in Nivra Core.
 * Manages simulator-eligible TV offers, streaming, equipment, and rules.
 */
import { useState, useMemo } from "react";
import { useCanonicalFees } from "@/hooks/useCanonicalFees";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Tv, MonitorPlay, Package, Star, Eye, EyeOff, Pencil,
  ArrowUpDown, Film, Wifi, Zap, Router, Monitor, Info
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function CoreTVSurMesurePage() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("plans");
  const [editPlan, setEditPlan] = useState<any>(null);
  const [editStreaming, setEditStreaming] = useState<any>(null);
  const canonicalFees = useCanonicalFees();

  /* ─── Fetch TV plans (simulator-eligible from services table) ─── */
  const { data: allServices = [] } = useQuery({
    queryKey: ["core-catalog-full"],
    queryFn: async () => {
      const { data } = await supabase.from("services" as any).select("*").order("category").order("display_order").order("price");
      return (data as any[]) || [];
    },
  });

  /* ─── Fetch streaming services ─── */
  const { data: streamingServices = [] } = useQuery({
    queryKey: ["core-streaming-services"],
    queryFn: async () => {
      const { data } = await supabase.from("streaming_services").select("*").order("name");
      return data || [];
    },
  });

  /* ─── Derived data ─── */
  const tvPlans = useMemo(() => allServices.filter((s: any) => s.category === "TV"), [allServices]);
  const simulatorPlans = useMemo(() => tvPlans.filter((s: any) => s.visible_simulator), [tvPlans]);
  const equipment = useMemo(() => allServices.filter((s: any) => s.category === "Équipement"), [allServices]);
  const terminal = equipment.find((e: any) => e.name?.toLowerCase().includes("terminal"));
  const router = equipment.find((e: any) => e.name?.toLowerCase().includes("router") || e.name?.toLowerCase().includes("borne"));

  /* ─── Toggle simulator visibility ─── */
  const toggleSimulator = useMutation({
    mutationFn: async ({ id, visible }: { id: string; visible: boolean }) => {
      const { error } = await supabase
        .from("services" as any)
        .update({ visible_simulator: visible, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      ["core-catalog-full", "public-services", "tv-configurator-services", "tv-configurator-equipment", "available-services"].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );
      toast.success("Visibility updated");
    },
  });

  const toggleFeatured = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => {
      const { error } = await supabase
        .from("services" as any)
        .update({ is_featured: featured, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      ["core-catalog-full", "public-services", "tv-configurator-services", "available-services"].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );
      toast.success("Featured status updated");
    },
  });

  const toggleStreamingActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("streaming_services").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-streaming-services"] });
      toast.success("Streaming status updated");
    },
  });

  const updateDisplayOrder = useMutation({
    mutationFn: async ({ id, order }: { id: string; order: number }) => {
      const { error } = await supabase
        .from("services" as any)
        .update({ display_order: order, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-catalog-full"] });
    },
  });

  const saveBadges = useMutation({
    mutationFn: async ({ id, badges }: { id: string; badges: string[] }) => {
      const { error } = await supabase
        .from("services" as any)
        .update({ badges, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-catalog-full"] });
      toast.success("Badges updated");
      setEditPlan(null);
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">TV sur mesure — Management</h1>
        <p className="text-sm text-[hsl(var(--core-text-secondary))]">
          Manage simulator offers, streaming, equipment & rules · {simulatorPlans.length} active in simulator
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "TV Plans (total)", value: tvPlans.length, color: "text-[hsl(var(--core-text-primary))]" },
          { label: "In Simulator", value: simulatorPlans.length, color: "text-violet-400" },
          { label: "Featured", value: tvPlans.filter((s: any) => s.is_featured).length, color: "text-amber-400" },
          { label: "Streaming Options", value: streamingServices.filter((s: any) => s.is_active).length, color: "text-sky-400" },
          { label: "Equipment Items", value: equipment.filter((e: any) => e.is_active).length, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="px-3 py-2.5 rounded-lg bg-[hsl(220,15%,11%)] border border-[hsl(220,15%,16%)]">
            <p className="text-[10px] text-[hsl(var(--core-text-label))]">{s.label}</p>
            <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="bg-[hsl(220,15%,12%)]">
          <TabsTrigger value="plans" className="gap-1.5"><Tv className="w-3.5 h-3.5" /> TV Plans</TabsTrigger>
          <TabsTrigger value="streaming" className="gap-1.5"><Film className="w-3.5 h-3.5" /> Streaming</TabsTrigger>
          <TabsTrigger value="equipment" className="gap-1.5"><Package className="w-3.5 h-3.5" /> Equipment</TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5"><Info className="w-3.5 h-3.5" /> Rules</TabsTrigger>
        </TabsList>

        {/* ─── TV Plans Tab ─── */}
        <TabsContent value="plans" className="mt-4">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,9%)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[hsl(220,15%,16%)] hover:bg-transparent">
                  <TableHead className="text-[hsl(var(--core-text-label))]">Plan</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-right">Price</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-center">Active</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-center">In Simulator</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-center">Featured</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-center">Promo</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))]">Order</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))]">Badges</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tvPlans.map((plan: any) => (
                  <TableRow key={plan.id} className="border-[hsl(220,15%,14%)] hover:bg-[hsl(220,15%,12%)]">
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{plan.name}</p>
                        <p className="text-xs text-[hsl(var(--core-text-secondary))] truncate max-w-[250px]">{plan.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold text-emerald-400">{Number(plan.price).toFixed(2)}$/mo</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("border-0 text-[10px]", plan.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400")}>
                        {plan.is_active ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={plan.visible_simulator}
                        onCheckedChange={(v) => toggleSimulator.mutate({ id: plan.id, visible: v })}
                        disabled={!plan.is_active}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={plan.is_featured}
                        onCheckedChange={(v) => toggleFeatured.mutate({ id: plan.id, featured: v })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("border-0 text-[10px]", plan.promo_eligible ? "bg-violet-500/15 text-violet-400" : "bg-zinc-500/15 text-zinc-400")}>
                        {plan.promo_eligible ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={plan.display_order || 0}
                        onChange={(e) => updateDisplayOrder.mutate({ id: plan.id, order: parseInt(e.target.value) || 0 })}
                        className="w-16 h-7 text-xs bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {(plan.badges || []).map((b: string, i: number) => (
                          <Badge key={i} className="bg-amber-500/15 text-amber-400 border-0 text-[9px]">{b}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditPlan(plan)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── Streaming Tab ─── */}
        <TabsContent value="streaming" className="mt-4">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,9%)] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[hsl(220,15%,16%)] hover:bg-transparent">
                  <TableHead className="text-[hsl(var(--core-text-label))]">Service</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))]">Category</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-right">Price</TableHead>
                  <TableHead className="text-[hsl(var(--core-text-label))] text-center">Active in Simulator</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streamingServices.map((ss: any) => (
                  <TableRow key={ss.id} className="border-[hsl(220,15%,14%)] hover:bg-[hsl(220,15%,12%)]">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-violet-400" />
                        <div>
                          <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{ss.name}</p>
                          <p className="text-xs text-[hsl(var(--core-text-secondary))]">{ss.description || "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0 text-[10px]">
                        {ss.category || "Streaming"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold text-emerald-400">{Number(ss.monthly_price).toFixed(2)}$/mo</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={ss.is_active}
                        onCheckedChange={(v) => toggleStreamingActive.mutate({ id: ss.id, active: v })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {streamingServices.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-[hsl(var(--core-text-label))]">No streaming services configured</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─── Equipment Tab ─── */}
        <TabsContent value="equipment" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Terminal */}
            <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-5 h-5 text-violet-400" />
                <h3 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Terminal TV (Décodeur)</h3>
              </div>
              {terminal ? (
                <div className="space-y-2">
                  <p className="text-xs text-[hsl(var(--core-text-secondary))]">{terminal.name}</p>
                  <p className="text-lg font-bold text-emerald-400">{Number(terminal.price).toFixed(2)}$ <span className="text-xs text-[hsl(var(--core-text-label))]">one-time</span></p>
                  <Separator className="bg-[hsl(220,15%,18%)]" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[hsl(var(--core-text-label))]">Rules:</p>
                    <p className="text-xs text-[hsl(var(--core-text-secondary))]">• Minimum 1 per address (required)</p>
                    <p className="text-xs text-[hsl(var(--core-text-secondary))]">• Maximum 4 per address</p>
                    <p className="text-xs text-[hsl(var(--core-text-secondary))]">• Same price regardless of quantity</p>
                  </div>
                  <p className="text-[10px] text-[hsl(var(--core-text-label))]">ID: {terminal.id}</p>
                </div>
              ) : (
                <p className="text-xs text-red-400">⚠ No terminal product found in catalog</p>
              )}
            </div>

            {/* Router / Borne */}
            <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Borne WiFi (Router)</h3>
              </div>
              {router ? (
                <div className="space-y-2">
                  <p className="text-xs text-[hsl(var(--core-text-secondary))]">{router.name}</p>
                  <p className="text-lg font-bold text-emerald-400">{Number(router.price).toFixed(2)}$ <span className="text-xs text-[hsl(var(--core-text-label))]">one-time</span></p>
                  <Separator className="bg-[hsl(220,15%,18%)]" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[hsl(var(--core-text-label))]">Rules:</p>
                    <p className="text-xs text-[hsl(var(--core-text-secondary))]">• Exactly 1 per address (required)</p>
                    <p className="text-xs text-[hsl(var(--core-text-secondary))]">• Cannot order without borne</p>
                    <p className="text-xs text-[hsl(var(--core-text-secondary))]">• Same price always</p>
                  </div>
                  <p className="text-[10px] text-[hsl(var(--core-text-label))]">ID: {router.id}</p>
                </div>
              ) : (
                <p className="text-xs text-red-400">⚠ No router/borne product found in catalog</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── Rules Tab ─── */}
        <TabsContent value="rules" className="mt-4 space-y-4">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-5 space-y-4">
            <h3 className="text-sm font-bold text-[hsl(var(--core-text-primary))]">Canonical Equipment Rules</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,18%)]">
                <p className="text-xs font-medium text-amber-400 mb-1">Terminal TV (Décodeur)</p>
                <ul className="text-xs text-[hsl(var(--core-text-secondary))] space-y-1">
                  <li>• Minimum: 1 per address</li>
                  <li>• Maximum: 4 per address</li>
                  <li>• Price: {terminal ? `${Number(terminal.price).toFixed(2)}$` : "N/A"} (one-time, same for all qty)</li>
                  <li>• Source: services table ID {terminal?.id?.slice(0, 8) || "N/A"}…</li>
                </ul>
              </div>
              <div className="p-3 rounded bg-[hsl(220,15%,14%)] border border-[hsl(220,15%,18%)]">
                <p className="text-xs font-medium text-sky-400 mb-1">Borne WiFi (Router)</p>
                <ul className="text-xs text-[hsl(var(--core-text-secondary))] space-y-1">
                  <li>• Exactly 1 per address (required)</li>
                  <li>• Cannot proceed without borne</li>
                  <li>• Price: {router ? `${Number(router.price).toFixed(2)}$` : "N/A"} (one-time)</li>
                  <li>• Source: services table ID {router?.id?.slice(0, 8) || "N/A"}…</li>
                </ul>
              </div>
            </div>
          </div>

          <CanonicalFeeRulesPanel />
        </TabsContent>
      </Tabs>

      {/* ─── Edit Plan Badges Drawer ─── */}
      <Sheet open={!!editPlan} onOpenChange={(open) => { if (!open) setEditPlan(null); }}>
        <SheetContent side="right" className="w-[400px] bg-[hsl(220,15%,10%)] border-l border-[hsl(220,15%,18%)] text-[hsl(var(--core-text-primary))]">
          <SheetHeader>
            <SheetTitle className="text-[hsl(var(--core-text-primary))]">Edit Plan — {editPlan?.name}</SheetTitle>
          </SheetHeader>
          {editPlan && (
            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-xs text-[hsl(var(--core-text-label))]">Badges (comma-separated)</Label>
                <Input
                  defaultValue={(editPlan.badges || []).join(", ")}
                  onBlur={(e) => {
                    const badges = e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean);
                    setEditPlan({ ...editPlan, badges });
                  }}
                  placeholder="Populaire, Meilleur prix, VIP"
                  className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded bg-[hsl(220,15%,12%)]">
                <span className="text-sm">Visible in Simulator</span>
                <Switch checked={editPlan.visible_simulator} onCheckedChange={(v) => setEditPlan({ ...editPlan, visible_simulator: v })} />
              </div>
              <div className="flex items-center justify-between p-3 rounded bg-[hsl(220,15%,12%)]">
                <span className="text-sm">Featured</span>
                <Switch checked={editPlan.is_featured} onCheckedChange={(v) => setEditPlan({ ...editPlan, is_featured: v })} />
              </div>
              <div className="flex items-center justify-between p-3 rounded bg-[hsl(220,15%,12%)]">
                <span className="text-sm">Promo Eligible</span>
                <Switch checked={editPlan.promo_eligible} onCheckedChange={(v) => setEditPlan({ ...editPlan, promo_eligible: v })} />
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setEditPlan(null)} className="border-[hsl(220,15%,20%)] bg-transparent">Cancel</Button>
                <Button
                  onClick={() => {
                    // Save all changed fields
                    supabase.from("services" as any).update({
                      badges: editPlan.badges || [],
                      visible_simulator: editPlan.visible_simulator,
                      is_featured: editPlan.is_featured,
                      promo_eligible: editPlan.promo_eligible,
                      updated_at: new Date().toISOString(),
                    }).eq("id", editPlan.id).then(({ error }) => {
                      if (error) { toast.error(error.message); return; }
                      queryClient.invalidateQueries({ queryKey: ["core-catalog-full"] });
                      toast.success("Plan updated");
                      setEditPlan(null);
                    });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >Save</Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
