/**
 * CoreChannelsPage — TV Channel & Pack Management Console
 * Day 4: Real canonical TV catalog with relational packs and channel management.
 * 
 * Tabs: Channels | Packs | Plans (from services) | Client Selections
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tv, Search, Plus, Edit, CheckCircle, XCircle, History, Power, Package, Users, Link2, Eye, EyeOff, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { StatusBadge, type StatusVariant } from "@/core-app/components/ui/StatusBadge";

// ── Constants ──
const CHANNEL_STATUS: Record<string, { label: string; variant: StatusVariant }> = {
  active: { label: "Actif", variant: "success" },
  maintenance: { label: "Maintenance", variant: "warning" },
  shutdown: { label: "Arrêté", variant: "danger" },
  end_of_life: { label: "Fin de vie", variant: "neutral" },
};

const CATEGORY_LABELS: Record<string, string> = {
  base: "Base (obligatoire)", free_choice: "Choix libre", premium: "Premium",
  general: "Généraliste", news: "Nouvelles", sports: "Sports", movies: "Films",
  kids: "Enfants", music: "Musique", lifestyle: "Style de vie",
  documentary: "Documentaire", entertainment: "Divertissement",
  international: "International", specialty: "Spécialité",
};

const PACK_CATEGORIES = [
  { value: "thematic", label: "Thématique" },
  { value: "sports", label: "Sports" },
  { value: "movies", label: "Films & séries" },
  { value: "international", label: "International" },
  { value: "premium", label: "Premium" },
  { value: "bundle", label: "Ensemble" },
];

const SELECTION_STATUS: Record<string, { label: string; variant: StatusVariant }> = {
  pending: { label: "En attente", variant: "warning" },
  confirmed: { label: "Confirmée", variant: "success" },
  cancelled: { label: "Annulée", variant: "danger" },
};

interface TvChannel {
  id: string;
  name: string;
  category: string;
  base_pack: string | null;
  is_hd: boolean;
  is_4k: boolean;
  price: number;
  status: string;
  is_active: boolean;
  visible_website: boolean;
  visible_simulator: boolean;
  display_order: number;
  genre: string | null;
  logo_url: string | null;
  description: string | null;
  created_at: string;
}

interface TvPack {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  category: string;
  original_price: number;
  discounted_price: number;
  savings_percent: number | null;
  is_active: boolean;
  visible_website: boolean;
  visible_simulator: boolean;
  visible_checkout: boolean;
  display_order: number;
  badge: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

interface PackChannel {
  id: string;
  pack_id: string;
  channel_id: string;
  is_optional: boolean;
  display_order: number;
}

export default function CoreChannelsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"channels" | "packs" | "plans" | "selections">("channels");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Channel state
  const [editChannelDialog, setEditChannelDialog] = useState<TvChannel | null>(null);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [channelForm, setChannelForm] = useState({ status: "active", incident_type: "", incident_reason: "" });
  const [newChannel, setNewChannel] = useState({
    name: "", category: "base", is_hd: true, is_4k: false, price: "0", is_active: true, base_pack: "",
    visible_website: true, visible_simulator: true, genre: "",
  });

  // Pack state
  const [selectedPack, setSelectedPack] = useState<TvPack | null>(null);
  const [createPackOpen, setCreatePackOpen] = useState(false);
  const [linkChannelsOpen, setLinkChannelsOpen] = useState<TvPack | null>(null);
  const [newPack, setNewPack] = useState({
    name: "", slug: "", description: "", category: "thematic",
    original_price: "0", discounted_price: "0", badge: "",
    visible_website: true, visible_simulator: true, visible_checkout: true,
  });

  // Detail drawer
  const [detailItem, setDetailItem] = useState<any>(null);

  // ═══ QUERIES ═══
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["core-tv-channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tv_channels").select("*").order("display_order").order("name");
      if (error) throw error;
      return (data || []) as TvChannel[];
    },
  });

  const { data: packs = [], isLoading: packsLoading } = useQuery({
    queryKey: ["core-tv-packs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("tv_packs").select("*").order("display_order").order("name");
      if (error) throw error;
      return (data || []) as TvPack[];
    },
  });

  const { data: packChannels = [] } = useQuery({
    queryKey: ["core-tv-pack-channels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("tv_pack_channels").select("*");
      if (error) throw error;
      return (data || []) as PackChannel[];
    },
  });

  const { data: dbTvPlans = [] } = useQuery({
    queryKey: ["core-catalog-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services" as any).select("*").eq("category", "TV").order("display_order").order("price");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: selections = [] } = useQuery({
    queryKey: ["core-channel-selections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("channel_selections").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((data || []).map((s: any) => s.user_id).filter(Boolean))];
      if (userIds.length === 0) return data || [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email, client_number").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((s: any) => ({ ...s, profile: profileMap.get(s.user_id) || null }));
    },
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ["core-channel-logs", detailItem?.id],
    enabled: !!detailItem?.id && activeTab === "channels",
    queryFn: async () => {
      const { data } = await supabase.from("channel_activity_logs").select("*").eq("channel_id", detailItem.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  // ═══ CHANNEL MUTATIONS ═══
  const updateChannelMutation = useMutation({
    mutationFn: async ({ channelId, status, incidentType, incidentReason }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updateData: any = { status, is_active: status === "active", updated_by: user?.id };
      if (incidentType) { updateData.incident_type = incidentType; updateData.incident_reason = incidentReason; updateData.incident_at = new Date().toISOString(); }
      const { error } = await supabase.from("tv_channels").update(updateData).eq("id", channelId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-tv-channels"] }); toast.success("Chaîne mise à jour"); setEditChannelDialog(null); },
    onError: (err: any) => toast.error(err?.message || "Échec de la mise à jour de la chaîne"),
  });

  const createChannelMutation = useMutation({
    mutationFn: async (ch: typeof newChannel) => {
      const { error } = await supabase.from("tv_channels").insert({
        name: ch.name, category: ch.category, is_hd: ch.is_hd, is_4k: ch.is_4k,
        price: parseFloat(ch.price) || 0, is_active: ch.is_active,
        status: ch.is_active ? "active" : "shutdown", base_pack: ch.base_pack || null,
        visible_website: ch.visible_website, visible_simulator: ch.visible_simulator,
        genre: ch.genre || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-tv-channels"] });
      toast.success("Chaîne ajoutée");
      setCreateChannelOpen(false);
      setNewChannel({ name: "", category: "base", is_hd: true, is_4k: false, price: "0", is_active: true, base_pack: "", visible_website: true, visible_simulator: true, genre: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ═══ PACK MUTATIONS ═══
  const createPackMutation = useMutation({
    mutationFn: async (p: typeof newPack) => {
      const origPrice = parseFloat(p.original_price) || 0;
      const discPrice = parseFloat(p.discounted_price) || 0;
      const savings = origPrice > 0 ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0;
      const { error } = await (supabase as any).from("tv_packs").insert({
        name: p.name, slug: p.slug || p.name.toLowerCase().replace(/\s+/g, "-"),
        description: p.description || null, category: p.category,
        original_price: origPrice, discounted_price: discPrice,
        savings_percent: savings, badge: p.badge || null,
        visible_website: p.visible_website, visible_simulator: p.visible_simulator,
        visible_checkout: p.visible_checkout, is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-tv-packs"] });
      toast.success("Pack créé");
      setCreatePackOpen(false);
      setNewPack({ name: "", slug: "", description: "", category: "thematic", original_price: "0", discounted_price: "0", badge: "", visible_website: true, visible_simulator: true, visible_checkout: true });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePackActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await (supabase as any).from("tv_packs").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-tv-packs"] }); toast.success("Pack mis à jour"); },
  });

  // ═══ PACK-CHANNEL LINK MUTATIONS ═══
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());

  const initLinkChannels = (pack: TvPack) => {
    const linked = packChannels.filter(pc => pc.pack_id === pack.id).map(pc => pc.channel_id);
    setSelectedChannelIds(new Set(linked));
    setLinkChannelsOpen(pack);
  };

  const saveLinksMutation = useMutation({
    mutationFn: async ({ packId, channelIds }: { packId: string; channelIds: string[] }) => {
      // Delete existing links
      await (supabase as any).from("tv_pack_channels").delete().eq("pack_id", packId);
      // Insert new links
      if (channelIds.length > 0) {
        const rows = channelIds.map((cid, idx) => ({ pack_id: packId, channel_id: cid, display_order: idx }));
        const { error } = await (supabase as any).from("tv_pack_channels").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-tv-pack-channels"] });
      toast.success("Chaînes du pack mises à jour");
      setLinkChannelsOpen(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // F29-3 — Route through tv-account-actions (no direct writes)
  const invokeSelectionAction = async (
    action: "approve_channel_selection" | "reject_channel_selection",
    row: any,
  ) => {
    const min = action === "approve_channel_selection" ? 5 : 10;
    const reason = window.prompt(
      `Motif (min. ${min} caractères) pour ${action === "approve_channel_selection" ? "confirmer" : "refuser"} cette sélection :`,
      "",
    );
    if (!reason || reason.trim().length < min) {
      toast.error(`Motif requis (min. ${min} caractères)`);
      return;
    }
    const sessionId =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const { data, error } = await supabase.functions.invoke("tv-account-actions", {
      body: {
        action,
        client_user_id: row.user_id,
        account_id: row.account_id ?? null,
        selection_id: row.id,
        reason: reason.trim(),
        idempotency_key: `tv-${action}-${row.id}-${sessionId}`,
      },
    });
    if (error) throw new Error((error as any)?.message || "Échec appel");
    if ((data as any)?.error) throw new Error((data as any).error);
  };

  const confirmSelectionMutation = useMutation({
    mutationFn: async ({ row }: { row: any }) => {
      await invokeSelectionAction("approve_channel_selection", row);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-channel-selections"] }); toast.success("Sélection confirmée"); },
    onError: (e: any) => toast.error(e?.message ?? "Échec"),
  });

  const cancelSelectionMutation = useMutation({
    mutationFn: async ({ row }: { row: any }) => {
      await invokeSelectionAction("reject_channel_selection", row);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-channel-selections"] }); toast.success("Sélection refusée"); },
    onError: (e: any) => toast.error(e?.message ?? "Échec"),
  });

  // ═══ DERIVED DATA ═══
  const baseChannels = channels.filter(c => c.category === "base");
  const freeChoiceChannels = channels.filter(c => c.category === "free_choice");
  const premiumChannels = channels.filter(c => c.category === "premium");
  const base26 = channels.filter(c => c.base_pack === "LA_BASE_26");
  const activeCount = channels.filter(c => c.is_active).length;
  const uniqueCategories = [...new Set(channels.map(c => c.category).filter(Boolean))];

  const filteredChannels = useMemo(() => {
    return channels.filter(c => {
      const s = c.status || (c.is_active ? "active" : "shutdown");
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (search) return c.name?.toLowerCase().includes(search.toLowerCase());
      return true;
    });
  }, [channels, search, statusFilter, categoryFilter]);

  const filteredPacks = useMemo(() => {
    if (!search.trim()) return packs;
    const q = search.toLowerCase();
    return packs.filter(p => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
  }, [packs, search]);

  // Pack channel counts
  const packChannelCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pc of packChannels) {
      map[pc.pack_id] = (map[pc.pack_id] || 0) + 1;
    }
    return map;
  }, [packChannels]);

  // Plans mapped
  const tvPlansForCards = useMemo(() => dbTvPlans.map((p: any) => {
    const name = p.name || "";
    const desc = p.description || "";
    const isGiga = name.toLowerCase().includes("giga");
    const choixMatch = name.match(/(\d+)\s*choix/i);
    const choix = choixMatch ? parseInt(choixMatch[1]) : 0;
    const channelMatch = desc.match(/(\d+)\s*chaîne/i);
    const channelCount = channelMatch ? parseInt(channelMatch[1]) : 26;
    const speed = isGiga ? "1 Gbps" : name.includes("500") ? "500 Mbps" : "100 Mbps";
    const features = (p.features_json?.length ? p.features_json : desc.split("•").map((s: string) => s.trim()).filter(Boolean)).slice(0, 5);
    const badge = (p.badges?.[0]) || (isGiga ? "GIGA" : choix > 15 ? "PREMIUM" : choix > 0 ? "POPULAIRE" : "ÉCONOMIQUE");
    return { id: p.id, name, badge, price: Number(p.price), internet: speed, baseChannels: channelCount, freeChoices: choix, features };
  }), [dbTvPlans]);

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Gestion TV — Catalogue Nivra</h1>
          <p className="text-xs text-muted-foreground">
            {activeCount} chaînes actives • {packs.filter(p => p.is_active).length} packs actifs • {base26.length} base LA_BASE_26
          </p>
        </div>
        <Tv className="h-5 w-5 text-emerald-400" />
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1.5 border-b border-[hsl(220,15%,16%)] pb-0">
        {([
          { id: "channels" as const, label: `Chaînes (${channels.length})`, icon: Tv },
          { id: "packs" as const, label: `Packs (${packs.length})`, icon: Package },
          { id: "plans" as const, label: `Forfaits TV (${tvPlansForCards.length})`, icon: Power },
          { id: "selections" as const, label: `Sélections (${selections.length})`, icon: Users },
        ]).map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); }}
            className={cn(
              "px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors flex items-center gap-1.5",
              activeTab === tab.id
                ? "bg-[hsl(220,20%,11%)] text-emerald-400 border border-[hsl(220,15%,16%)] border-b-transparent -mb-px"
                : "text-muted-foreground hover:text-foreground"
            )}>
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════ CHANNELS TAB ═══════════════════ */}
      {activeTab === "channels" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom de chaîne…"
                className="pl-8 h-8 bg-[hsl(220,20%,9%)] border-[hsl(220,15%,18%)] text-foreground text-xs" />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-muted-foreground">
              <option value="all">Toutes catégories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
            </select>
            <div className="flex gap-1.5">
              {[{ key: "all", label: "Toutes" }, ...Object.entries(CHANNEL_STATUS).map(([k, v]) => ({ key: k, label: v.label }))].map(s => (
                <button key={s.key} onClick={() => setStatusFilter(s.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border",
                    statusFilter === s.key ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30" : "text-muted-foreground border-[hsl(220,15%,18%)]"
                  )}>
                  {s.label}
                </button>
              ))}
            </div>
            <Button onClick={() => setCreateChannelOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs ml-auto">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Ajouter chaîne
            </Button>
          </div>

          {/* Category summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Base (LA_BASE_26)", count: base26.length, color: "text-sky-400" },
              { label: "Choix libres", count: freeChoiceChannels.length, color: "text-emerald-400" },
              { label: "Premium", count: premiumChannels.length, color: "text-amber-400" },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 text-center">
                <div className={cn("text-lg font-bold", s.color)}>{s.count}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Channels table */}
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[hsl(220,15%,16%)]">
                    {["Nom", "Catégorie", "Pack", "HD", "4K", "Prix", "Site", "Simulateur", "Statut", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                  {channelsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={10} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>)
                  ) : filteredChannels.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Aucune chaîne trouvée</td></tr>
                  ) : (
                    filteredChannels.map(c => {
                      const st = CHANNEL_STATUS[c.status || "active"] || CHANNEL_STATUS.active;
                      return (
                        <tr key={c.id} onClick={() => setDetailItem(c)} className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors">
                          <td className="px-3 py-2.5 text-foreground font-medium">{c.name}</td>
                          <td className="px-3 py-2.5"><StatusBadge label={CATEGORY_LABELS[c.category] || c.category} variant={c.category === "base" ? "info" : c.category === "premium" ? "warning" : "success"} size="sm" dot={false} /></td>
                          <td className="px-3 py-2.5 text-muted-foreground font-mono text-[11px]">{c.base_pack || "—"}</td>
                          <td className="px-3 py-2.5">{c.is_hd ? <span className="text-emerald-400 text-[10px] font-medium">HD</span> : "—"}</td>
                          <td className="px-3 py-2.5">{c.is_4k ? <span className="text-sky-400 text-[10px] font-medium">4K</span> : "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{Number(c.price) > 0 ? `${Number(c.price).toFixed(2)} $` : "Inclus"}</td>
                          <td className="px-3 py-2.5">{c.visible_website ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}</td>
                          <td className="px-3 py-2.5">{c.visible_simulator ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}</td>
                          <td className="px-3 py-2.5"><StatusBadge label={st.label} variant={st.variant} size="sm" /></td>
                          <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setEditChannelDialog(c); setChannelForm({ status: c.status || "active", incident_type: "", incident_reason: "" }); }}
                              className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-muted-foreground hover:text-foreground" title="Gérer">
                              <Edit className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════ PACKS TAB ═══════════════════ */}
      {activeTab === "packs" && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom du pack…"
                className="pl-8 h-8 bg-[hsl(220,20%,9%)] border-[hsl(220,15%,18%)] text-foreground text-xs" />
            </div>
            <Button onClick={() => setCreatePackOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs ml-auto">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Créer un pack
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">{packs.filter(p => p.is_active).length}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Packs actifs</div>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 text-center">
              <div className="text-lg font-bold text-sky-400">{packChannels.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Liaisons chaîne-pack</div>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 text-center">
              <div className="text-lg font-bold text-amber-400">{packs.filter(p => p.visible_simulator).length}</div>
              <div className="text-[10px] text-muted-foreground uppercase">Visibles simulateur</div>
            </div>
          </div>

          {/* Packs table */}
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[hsl(220,15%,16%)]">
                    {["Pack", "Catégorie", "Chaînes", "Prix original", "Prix réduit", "Économie", "Site", "Simulateur", "Checkout", "Actif", "Actions"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                  {packsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={11} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>)
                  ) : filteredPacks.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Aucun pack trouvé
                    </td></tr>
                  ) : (
                    filteredPacks.map(pack => (
                      <tr key={pack.id} onClick={() => setSelectedPack(pack)} className="hover:bg-[hsl(220,15%,13%)] cursor-pointer transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="text-foreground font-medium">{pack.name}</div>
                          {pack.badge && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">{pack.badge}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground capitalize">{PACK_CATEGORIES.find(c => c.value === pack.category)?.label || pack.category}</td>
                        <td className="px-3 py-2.5 text-sky-400 font-medium">{packChannelCounts[pack.id] || 0}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{Number(pack.original_price).toFixed(2)} $</td>
                        <td className="px-3 py-2.5 text-emerald-400 font-medium">{Number(pack.discounted_price).toFixed(2)} $</td>
                        <td className="px-3 py-2.5 text-amber-400">{pack.savings_percent ? `${pack.savings_percent}%` : "—"}</td>
                        <td className="px-3 py-2.5">{pack.visible_website ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}</td>
                        <td className="px-3 py-2.5">{pack.visible_simulator ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}</td>
                        <td className="px-3 py-2.5">{pack.visible_checkout ? <Eye className="h-3 w-3 text-emerald-400" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}</td>
                        <td className="px-3 py-2.5">
                          <StatusBadge label={pack.is_active ? "Actif" : "Inactif"} variant={pack.is_active ? "success" : "neutral"} size="sm" />
                        </td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button onClick={() => initLinkChannels(pack)}
                              className="h-6 px-2 rounded border border-sky-500/30 text-[10px] text-sky-400 hover:bg-sky-500/10" title="Gérer chaînes">
                              <Link2 className="h-3 w-3" />
                            </button>
                            <button onClick={() => togglePackActiveMutation.mutate({ id: pack.id, isActive: !pack.is_active })}
                              className={cn("h-6 px-2 rounded border text-[10px]", pack.is_active ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10")}
                              title={pack.is_active ? "Désactiver" : "Activer"}>
                              <Power className="h-3 w-3" />
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
        </>
      )}

      {/* ═══════════════════ PLANS TAB ═══════════════════ */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <p className="text-[12px] text-muted-foreground">
              <span className="text-emerald-400 font-medium">Source:</span> Forfaits TV + Internet gérés depuis le catalogue canonical (/core/catalog).
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {tvPlansForCards.map(plan => (
              <div key={plan.id} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4 flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400">{plan.badge}</span>
                  <span className="text-lg font-bold text-emerald-400">{plan.price}$<span className="text-[10px] text-muted-foreground font-normal">/mois</span></span>
                </div>
                <h3 className="text-[13px] font-semibold text-foreground mb-1">{plan.name}</h3>
                <p className="text-[11px] text-muted-foreground mb-3">
                  {plan.baseChannels} chaînes{plan.freeChoices > 0 ? ` + ${plan.freeChoices} au choix` : ""} • {plan.internet}
                </p>
                <ul className="space-y-1 flex-1">
                  {plan.features.map((f: string, i: number) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════ SELECTIONS TAB ═══════════════════ */}
      {activeTab === "selections" && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["Client", "N° client", "Chaînes", "Total", "Statut", "Date", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {selections.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Aucune sélection client</td></tr>
                ) : (
                  selections.map((s: any) => {
                    const st = SELECTION_STATUS[s.status] || SELECTION_STATUS.pending;
                    const chList = Array.isArray(s.channels) ? s.channels : [];
                    return (
                      <tr key={s.id} className="hover:bg-[hsl(220,15%,13%)] transition-colors cursor-pointer" onClick={() => setDetailItem(s)}>
                        <td className="px-3 py-2.5 text-foreground font-medium">{s.profile?.full_name || "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-sky-400">{s.profile?.client_number || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{chList.length} chaînes</td>
                        <td className="px-3 py-2.5 text-emerald-400 font-medium">{s.total_price != null ? `${Number(s.total_price).toFixed(2)} $` : "—"}</td>
                        <td className="px-3 py-2.5"><StatusBadge label={st.label} variant={st.variant} size="sm" /></td>
                        <td className="px-3 py-2.5 text-muted-foreground">{s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: fr }) : "—"}</td>
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          {s.status === "pending" && (
                            <div className="flex gap-1">
                              <button onClick={() => confirmSelectionMutation.mutate({ row: s })}
                                className="h-6 px-2 rounded text-[10px] font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">Confirmer</button>
                              <button onClick={() => cancelSelectionMutation.mutate({ row: s })}
                                className="h-6 px-2 rounded text-[10px] font-medium bg-red-600/20 text-red-400 border border-red-500/30">Annuler</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ CHANNEL MANAGE DIALOG ═══ */}
      {editChannelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditChannelDialog(null)}>
          <div className="w-full max-w-md rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-[14px] font-semibold text-foreground">Gérer: {editChannelDialog.name}</h2>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Statut</Label>
              <select value={channelForm.status} onChange={e => setChannelForm({ ...channelForm, status: e.target.value })}
                className="w-full h-8 px-2 mt-1 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-foreground">
                {Object.entries(CHANNEL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {channelForm.status !== "active" && (
              <>
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase">Type d'incident</Label>
                  <select value={channelForm.incident_type} onChange={e => setChannelForm({ ...channelForm, incident_type: e.target.value })}
                    className="w-full h-8 px-2 mt-1 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-foreground">
                    <option value="">Aucun</option>
                    <option value="service_interruption">Interruption</option>
                    <option value="permanently_closed">Fermée définitivement</option>
                    <option value="discontinued">Discontinuée</option>
                    <option value="legal_removal">Retrait légal</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase">Raison</Label>
                  <Textarea value={channelForm.incident_reason} onChange={e => setChannelForm({ ...channelForm, incident_reason: e.target.value })}
                    rows={2} className="mt-1 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,18%)] text-foreground text-xs" />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditChannelDialog(null)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-muted-foreground text-[12px] font-medium">Annuler</button>
              <button onClick={() => updateChannelMutation.mutate({ channelId: editChannelDialog.id, status: channelForm.status, incidentType: channelForm.incident_type, incidentReason: channelForm.incident_reason })}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500">
                Mettre à jour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE CHANNEL DIALOG ═══ */}
      <Dialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,16%)] text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une chaîne TV</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Nom *</Label>
              <Input value={newChannel.name} onChange={e => setNewChannel({ ...newChannel, name: e.target.value })}
                placeholder="TVA, RDS, CNN…" className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Catégorie</Label>
                <Select value={newChannel.category} onValueChange={v => setNewChannel({ ...newChannel, category: v })}>
                  <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                    <SelectItem value="base" className="text-foreground text-xs">Base</SelectItem>
                    <SelectItem value="free_choice" className="text-foreground text-xs">Choix libre</SelectItem>
                    <SelectItem value="premium" className="text-foreground text-xs">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Pack base</Label>
                <Select value={newChannel.base_pack} onValueChange={v => setNewChannel({ ...newChannel, base_pack: v })}>
                  <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs"><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                    <SelectItem value="" className="text-foreground text-xs">Aucun</SelectItem>
                    <SelectItem value="LA_BASE_26" className="text-foreground text-xs">LA_BASE_26</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Prix ($)</Label>
                <Input type="number" step="0.01" value={newChannel.price} onChange={e => setNewChannel({ ...newChannel, price: e.target.value })}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Genre</Label>
                <Input value={newChannel.genre} onChange={e => setNewChannel({ ...newChannel, genre: e.target.value })}
                  placeholder="Sports, News…" className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div className="flex items-end gap-3 pb-0.5">
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={newChannel.is_hd} onChange={e => setNewChannel({ ...newChannel, is_hd: e.target.checked })} /> HD
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={newChannel.is_4k} onChange={e => setNewChannel({ ...newChannel, is_4k: e.target.checked })} /> 4K
                </label>
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={newChannel.visible_website} onChange={e => setNewChannel({ ...newChannel, visible_website: e.target.checked })} /> Visible site
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={newChannel.visible_simulator} onChange={e => setNewChannel({ ...newChannel, visible_simulator: e.target.checked })} /> Visible simulateur
              </label>
            </div>
            <Button onClick={() => createChannelMutation.mutate(newChannel)} disabled={!newChannel.name || createChannelMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
              {createChannelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ CREATE PACK DIALOG ═══ */}
      <Dialog open={createPackOpen} onOpenChange={setCreatePackOpen}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,16%)] text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer un pack TV</DialogTitle>
            <DialogDescription className="text-muted-foreground">Créez un pack, puis liez-y des chaînes</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Nom du pack *</Label>
              <Input value={newPack.name} onChange={e => setNewPack({ ...newPack, name: e.target.value })}
                placeholder="Pack Sports, Pack Cinéma…" className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Catégorie</Label>
                <Select value={newPack.category} onValueChange={v => setNewPack({ ...newPack, category: v })}>
                  <SelectTrigger className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)]">
                    {PACK_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-foreground text-xs">{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Badge</Label>
                <Input value={newPack.badge} onChange={e => setNewPack({ ...newPack, badge: e.target.value })}
                  placeholder="POPULAIRE, NOUVEAU…" className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase">Description</Label>
              <Textarea value={newPack.description} onChange={e => setNewPack({ ...newPack, description: e.target.value })}
                rows={2} className="mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Prix original ($)</Label>
                <Input type="number" step="0.01" value={newPack.original_price} onChange={e => setNewPack({ ...newPack, original_price: e.target.value })}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground uppercase">Prix réduit ($)</Label>
                <Input type="number" step="0.01" value={newPack.discounted_price} onChange={e => setNewPack({ ...newPack, discounted_price: e.target.value })}
                  className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-foreground text-xs" />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={newPack.visible_website} onChange={e => setNewPack({ ...newPack, visible_website: e.target.checked })} /> Site
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={newPack.visible_simulator} onChange={e => setNewPack({ ...newPack, visible_simulator: e.target.checked })} /> Simulateur
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={newPack.visible_checkout} onChange={e => setNewPack({ ...newPack, visible_checkout: e.target.checked })} /> Checkout
              </label>
            </div>
            <Button onClick={() => createPackMutation.mutate(newPack)} disabled={!newPack.name || createPackMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
              {createPackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Créer le pack
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ LINK CHANNELS TO PACK DIALOG ═══ */}
      {linkChannelsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setLinkChannelsOpen(null)}>
          <div className="w-full max-w-lg rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h2 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4 text-sky-400" />
              Chaînes du pack: {linkChannelsOpen.name}
            </h2>
            <p className="text-[11px] text-muted-foreground">{selectedChannelIds.size} chaînes sélectionnées</p>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {channels.filter(c => c.is_active).map(ch => {
                const isSelected = selectedChannelIds.has(ch.id);
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      const next = new Set(selectedChannelIds);
                      if (isSelected) next.delete(ch.id); else next.add(ch.id);
                      setSelectedChannelIds(next);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-md border transition-colors text-left",
                      isSelected
                        ? "border-emerald-500/30 bg-emerald-600/10"
                        : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] hover:bg-[hsl(220,15%,13%)]"
                    )}
                  >
                    <div>
                      <span className="text-[12px] text-foreground font-medium">{ch.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{CATEGORY_LABELS[ch.category] || ch.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {Number(ch.price) > 0 && <span className="text-[10px] text-muted-foreground">{Number(ch.price).toFixed(2)}$</span>}
                      {isSelected && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[hsl(220,15%,16%)]">
              <button onClick={() => setLinkChannelsOpen(null)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-muted-foreground text-[12px] font-medium">
                Annuler
              </button>
              <button
                onClick={() => saveLinksMutation.mutate({ packId: linkChannelsOpen.id, channelIds: [...selectedChannelIds] })}
                disabled={saveLinksMutation.isPending}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 disabled:opacity-50"
              >
                {saveLinksMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Sauvegarder (${selectedChannelIds.size} chaînes)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PACK DETAIL DRAWER ═══ */}
      <Sheet open={!!selectedPack && !linkChannelsOpen} onOpenChange={() => setSelectedPack(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-foreground overflow-y-auto">
          <SheetHeader><SheetTitle className="text-foreground flex items-center gap-2"><Package className="h-4 w-4 text-emerald-400" /> {selectedPack?.name}</SheetTitle></SheetHeader>
          {selectedPack && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                {[
                  ["Catégorie", PACK_CATEGORIES.find(c => c.value === selectedPack.category)?.label],
                  ["Prix original", `${Number(selectedPack.original_price).toFixed(2)} $`],
                  ["Prix réduit", `${Number(selectedPack.discounted_price).toFixed(2)} $`],
                  ["Économie", selectedPack.savings_percent ? `${selectedPack.savings_percent}%` : "—"],
                  ["Badge", selectedPack.badge],
                  ["Actif", selectedPack.is_active ? "Oui" : "Non"],
                  ["Site", selectedPack.visible_website ? "✓" : "✗"],
                  ["Simulateur", selectedPack.visible_simulator ? "✓" : "✗"],
                  ["Checkout", selectedPack.visible_checkout ? "✓" : "✗"],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">{l}</span>
                    <span className="text-foreground font-medium">{(v as string) || "—"}</span>
                  </div>
                ))}
              </div>

              {/* Linked channels */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Chaînes liées ({packChannelCounts[selectedPack.id] || 0})</h3>
                  <button onClick={() => initLinkChannels(selectedPack)}
                    className="text-[10px] text-sky-400 hover:underline">Modifier</button>
                </div>
                {(() => {
                  const linked = packChannels.filter(pc => pc.pack_id === selectedPack.id);
                  if (linked.length === 0) return <p className="text-[11px] text-muted-foreground italic">Aucune chaîne liée</p>;
                  return (
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {linked.map(pc => {
                        const ch = channels.find(c => c.id === pc.channel_id);
                        return ch ? (
                          <div key={pc.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-[hsl(220,15%,14%)] text-[11px]">
                            <span className="text-foreground">{ch.name}</span>
                            <StatusBadge label={CATEGORY_LABELS[ch.category] || ch.category} variant={ch.category === "base" ? "info" : ch.category === "premium" ? "warning" : "success"} size="sm" dot={false} />
                          </div>
                        ) : null;
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ CHANNEL DETAIL / SELECTION DETAIL DRAWER ═══ */}
      <Sheet open={!!detailItem && !editChannelDialog} onOpenChange={() => setDetailItem(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-foreground overflow-y-auto">
          <SheetHeader><SheetTitle className="text-foreground">{activeTab === "selections" ? "Détail sélection" : `Chaîne: ${detailItem?.name}`}</SheetTitle></SheetHeader>
          {detailItem && activeTab === "channels" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                {[
                  ["Nom", detailItem.name], ["Catégorie", CATEGORY_LABELS[detailItem.category]], ["Pack", detailItem.base_pack],
                  ["Prix", Number(detailItem.price) > 0 ? `${Number(detailItem.price).toFixed(2)} $` : "Inclus"],
                  ["HD", detailItem.is_hd ? "Oui" : "Non"], ["4K", detailItem.is_4k ? "Oui" : "Non"],
                  ["Genre", detailItem.genre], ["Site", detailItem.visible_website ? "✓" : "✗"], ["Simulateur", detailItem.visible_simulator ? "✓" : "✗"],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]">
                    <span className="text-muted-foreground">{l}</span><span className="text-foreground font-medium">{(v as string) || "—"}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Historique</h3>
                {activityLogs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Aucune activité</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {activityLogs.map((log: any) => (
                      <div key={log.id} className="p-2 rounded bg-[hsl(220,15%,14%)] text-[11px]">
                        <div className="flex justify-between"><span className="text-foreground font-medium">{log.action}</span><span className="text-muted-foreground">{log.created_at ? format(new Date(log.created_at), "dd MMM HH:mm", { locale: fr }) : ""}</span></div>
                        {log.reason && <p className="text-muted-foreground">Raison: {log.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {detailItem && activeTab === "selections" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2 text-[12px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span className="text-foreground">{detailItem.profile?.full_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="text-emerald-400 font-medium">{detailItem.total_price != null ? `${Number(detailItem.total_price).toFixed(2)} $` : "—"}</span></div>
              </div>
              {Array.isArray(detailItem.channels) && detailItem.channels.length > 0 && (
                <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Chaînes ({detailItem.channels.length})</h3>
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {detailItem.channels.map((ch: any, i: number) => (
                      <div key={ch.id || i} className="flex items-center justify-between px-2 py-1.5 rounded bg-[hsl(220,15%,14%)] text-[11px]">
                        <span className="text-foreground">{ch.name}</span>
                        {Number(ch.price) > 0 && <span className="text-muted-foreground">{Number(ch.price).toFixed(2)} $</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
