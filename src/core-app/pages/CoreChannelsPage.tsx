/**
 * CoreChannelsPage — TV Channel Management Console
 * Real Nivra TV catalog, real plans from website, real client selections
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tv, Search, Plus, Edit, Eye, CheckCircle, XCircle, History, Power, Package, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const CHANNEL_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: "bg-emerald-500/15 text-emerald-400" },
  maintenance: { label: "Maintenance", color: "bg-amber-500/15 text-amber-400" },
  shutdown: { label: "Arrêté", color: "bg-red-500/15 text-red-400" },
  end_of_life: { label: "Fin de vie", color: "bg-[#64748B]/20 text-[#64748B]" },
};

const INCIDENT_TYPES: Record<string, string> = {
  service_interruption: "Interruption de service",
  permanently_closed: "Chaîne fermée définitivement",
  discontinued: "Chaîne discontinuée",
  legal_removal: "Retrait légal/réglementaire",
};

const SELECTION_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-500/15 text-amber-400" },
  confirmed: { label: "Confirmée", color: "bg-emerald-500/15 text-emerald-400" },
  cancelled: { label: "Annulée", color: "bg-red-500/15 text-red-400" },
};

const CATEGORY_LABELS: Record<string, string> = {
  base: "Base (obligatoire)",
  free_choice: "Choix libre",
  premium: "Premium",
  general: "Généraliste",
  news: "Nouvelles",
  sports: "Sports",
  movies: "Films",
  kids: "Enfants",
  music: "Musique",
  lifestyle: "Style de vie",
  documentary: "Documentaire",
  entertainment: "Divertissement",
  international: "International",
  specialty: "Spécialité",
};

const LANGUAGE_MAP: Record<string, string> = { fr: "Français", en: "Anglais", es: "Espagnol", multi: "Multilingue" };

// TV Plans now loaded from canonical DB (services table) — no more hardcoded array

export default function CoreChannelsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"channels" | "plans" | "selections">("channels");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [editDialog, setEditDialog] = useState<"channel" | null>(null);
  const [channelForm, setChannelForm] = useState({ status: "active", incident_type: "", incident_reason: "", notify_clients: true });
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: "", category: "base", is_hd: true, is_4k: false, price: "0", is_active: true, base_pack: "",
  });

  // ═══ QUERIES ═══
  // Canonical TV plans from DB
  const { data: dbTvPlans = [] } = useQuery({
    queryKey: ["core-catalog-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services" as any).select("*").eq("category", "TV").order("display_order").order("price");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Map DB plans to display shape
  const tvPlansForCards = useMemo(() => dbTvPlans.map((p: any) => {
    const name = p.name || "";
    const desc = p.description || "";
    const isGiga = name.toLowerCase().includes("giga");
    const choixMatch = name.match(/(\d+)\s*choix/i);
    const choix = choixMatch ? parseInt(choixMatch[1]) : 0;
    const channelMatch = desc.match(/(\d+)\s*chaîne/i);
    const channels = channelMatch ? parseInt(channelMatch[1]) : 26;
    const speed = isGiga ? "1 Gbps" : name.includes("500") ? "500 Mbps" : "100 Mbps";
    const tier = isGiga ? "GIGA" : name.includes("500") ? "Internet 500" : "Internet 100";
    const features = (p.features_json?.length ? p.features_json : desc.split("•").map((s: string) => s.trim()).filter(Boolean)).slice(0, 5);
    const badge = (p.badges?.[0]) || (isGiga ? "GIGA" : choix > 15 ? "PREMIUM" : choix > 0 ? "POPULAIRE" : "ÉCONOMIQUE");
    return { id: p.id, tier, name, badge, price: Number(p.price), internet: speed, baseChannels: channels, freeChoices: choix, features };
  }), [dbTvPlans]);

  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["core-tv-channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tv_channels").select("*").order("category").order("name");
      if (error) throw error;
      return data || [];
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
    queryKey: ["core-channel-logs", selected?.id],
    enabled: !!selected?.id && activeTab === "channels" && editDialog === null,
    queryFn: async () => {
      const { data, error } = await supabase.from("channel_activity_logs").select("*").eq("channel_id", selected.id).order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  // ═══ MUTATIONS ═══
  const updateChannelMutation = useMutation({
    mutationFn: async ({ channelId, status, incidentType, incidentReason }: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updateData: any = { status, is_active: status === "active", updated_by: user?.id };
      if (incidentType) { updateData.incident_type = incidentType; updateData.incident_reason = incidentReason; updateData.incident_at = new Date().toISOString(); }
      const { error } = await supabase.from("tv_channels").update(updateData).eq("id", channelId);
      if (error) throw error;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("user_id", user.id).maybeSingle();
        await supabase.from("channel_activity_logs").insert({
          channel_id: channelId, action: `channel_status_${status}`, field_changed: "status",
          old_value: selected?.status || "active", new_value: status, reason: incidentReason || null,
          actor_id: user.id, actor_name: profile?.full_name, actor_email: profile?.email, notified_client: false,
        });
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-tv-channels"] }); toast.success("Chaîne mise à jour"); setEditDialog(null); },
    onError: () => toast.error("Erreur"),
  });

  const createChannelMutation = useMutation({
    mutationFn: async (ch: typeof newChannel) => {
      const { error } = await supabase.from("tv_channels").insert({
        name: ch.name,
        category: ch.category,
        is_hd: ch.is_hd,
        is_4k: ch.is_4k,
        price: ch.price ? parseFloat(ch.price) : 0,
        is_active: ch.is_active,
        status: ch.is_active ? "active" : "shutdown",
        base_pack: ch.base_pack || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-tv-channels"] });
      toast.success("Chaîne ajoutée");
      setCreateChannelOpen(false);
      setNewChannel({ name: "", category: "base", is_hd: true, is_4k: false, price: "0", is_active: true, base_pack: "" });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const confirmSelectionMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("channel_selections").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-channel-selections"] }); toast.success("Sélection confirmée"); },
  });

  const cancelSelectionMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("channel_selections").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-channel-selections"] }); toast.success("Sélection annulée"); },
  });

  // ═══ DERIVED DATA ═══
  const baseChannels = useMemo(() => channels.filter((c: any) => c.category === "base"), [channels]);
  const freeChoiceChannels = useMemo(() => channels.filter((c: any) => c.category === "free_choice"), [channels]);
  const premiumChannels = useMemo(() => channels.filter((c: any) => c.category === "premium"), [channels]);
  const base26 = useMemo(() => channels.filter((c: any) => c.base_pack === "LA_BASE_26"), [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter((c: any) => {
      const s = c.status || (c.is_active ? "active" : "shutdown");
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.name?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [channels, search, statusFilter, categoryFilter]);

  const activeCount = channels.filter((c: any) => c.is_active).length;
  const uniqueCategories = [...new Set(channels.map((c: any) => c.category).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Gestion TV — Catalogue Nivra</h1>
          <p className="text-xs text-[#94A3B8]">
            {activeCount} chaînes actives • {base26.length} base (LA_BASE_26) • {freeChoiceChannels.length} choix libres • {premiumChannels.length} premium • {selections.filter((s: any) => s.status === "pending").length} sélections en attente
          </p>
        </div>
        <Tv className="h-5 w-5 text-emerald-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-[hsl(220,15%,16%)] pb-0">
        {([
          { id: "channels" as const, label: `Chaînes TV (${channels.length})`, icon: Tv },
          { id: "plans" as const, label: `Forfaits TV (${tvPlansForCards.length})`, icon: Package },
          { id: "selections" as const, label: `Sélections clients (${selections.length})`, icon: Users },
        ]).map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); }}
            className={`px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id ? "bg-[hsl(220,20%,11%)] text-emerald-400 border border-[hsl(220,15%,16%)] border-b-transparent -mb-px" : "text-[#94A3B8] hover:text-[#CBD5E1]"
            }`}>
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ CHANNELS TAB ═══ */}
      {activeTab === "channels" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, catégorie…"
                className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[12px] text-[#CBD5E1] focus:outline-none">
              <option value="all">Toutes catégories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
            </select>
            <div className="flex gap-1.5">
              {[{ key: "all", label: "Toutes" }, ...Object.entries(CHANNEL_STATUS).map(([k, v]) => ({ key: k, label: v.label }))].map((s) => (
                <button key={s.key} onClick={() => setStatusFilter(s.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    statusFilter === s.key ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
            <button onClick={() => setCreateChannelOpen(true)} className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors flex items-center gap-1.5 ml-auto">
              <Plus className="h-3.5 w-3.5" /> Ajouter chaîne
            </button>
          </div>

          {/* Category summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Base (LA_BASE_26)", count: base26.length, color: "text-[#38BDF8]" },
              { label: "Choix libres", count: freeChoiceChannels.length, color: "text-emerald-400" },
              { label: "Premium", count: premiumChannels.length, color: "text-amber-400" },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
                <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[hsl(220,15%,16%)]">
                    {["Nom", "Catégorie", "Pack base", "HD", "4K", "Prix", "Statut", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                  {channelsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>)
                  ) : filteredChannels.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-[#64748B]">Aucune chaîne trouvée</td></tr>
                  ) : (
                    filteredChannels.map((c: any) => {
                      const s = c.status || (c.is_active ? "active" : "shutdown");
                      const st = CHANNEL_STATUS[s] || CHANNEL_STATUS.active;
                      const catLabel = CATEGORY_LABELS[c.category] || c.category || "—";
                      return (
                        <tr key={c.id} className="hover:bg-[hsl(220,15%,13%)] transition-colors">
                          <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{c.name}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              c.category === "base" ? "bg-[#38BDF8]/15 text-[#38BDF8]" :
                              c.category === "free_choice" ? "bg-emerald-500/15 text-emerald-400" :
                              c.category === "premium" ? "bg-amber-500/15 text-amber-400" :
                              "bg-[#64748B]/20 text-[#94A3B8]"
                            }`}>{catLabel}</span>
                          </td>
                          <td className="px-3 py-2.5 text-[11px] text-[#94A3B8] font-mono">{c.base_pack || "—"}</td>
                          <td className="px-3 py-2.5">{c.is_hd ? <span className="text-emerald-400 text-[10px] font-medium">HD</span> : <span className="text-[#64748B]">—</span>}</td>
                          <td className="px-3 py-2.5">{c.is_4k ? <span className="text-[#38BDF8] text-[10px] font-medium">4K</span> : <span className="text-[#64748B]">—</span>}</td>
                          <td className="px-3 py-2.5 text-[#CBD5E1]">{Number(c.price) > 0 ? `${Number(c.price).toFixed(2)} $` : "Inclus"}</td>
                          <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              <button onClick={() => { setSelected(c); setChannelForm({ status: c.status || "active", incident_type: "", incident_reason: "", notify_clients: true }); setEditDialog("channel"); }}
                                className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors" title="Gérer">
                                <Edit className="h-3 w-3" />
                              </button>
                              <button onClick={() => { setSelected(c); setEditDialog(null); }}
                                className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors" title="Historique">
                                <History className="h-3 w-3" />
                              </button>
                            </div>
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

      {/* ═══ PLANS TAB (Real Nivra TV Plans from website) ═══ */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
            <p className="text-[12px] text-[#94A3B8]">
              <span className="text-emerald-400 font-medium">Source:</span> Forfaits TV + Internet tels qu'affichés sur <span className="text-[#38BDF8]">nivra-telecom.ca/tv</span>. 
              Tous les forfaits incluent Internet + Nivra 4K Smart Terminal. Les chaînes de base (LA_BASE_26) sont obligatoires dans tous les forfaits.
            </p>
          </div>

          {/* Internet 500 Plans */}
          <div>
            <h3 className="text-[13px] font-semibold text-[#F8FAFC] mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-400" /> Forfaits Internet 100 / 500
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {tvPlansForCards.filter(p => p.tier !== "GIGA").map((plan) => (
                <PlanCard key={plan.id} plan={plan} baseCount={base26.length} freeChoiceCount={freeChoiceChannels.length} />
              ))}
            </div>
          </div>

          {/* GIGA Plans */}
          <div>
            <h3 className="text-[13px] font-semibold text-[#F8FAFC] mb-2 flex items-center gap-2">
              <Power className="h-4 w-4 text-[#38BDF8]" /> Forfaits GIGA (1 Gbps)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {tvPlansForCards.filter(p => p.tier === "GIGA").map((plan) => (
                <PlanCard key={plan.id} plan={plan} baseCount={base26.length} freeChoiceCount={freeChoiceChannels.length} />
              ))}
            </div>
          </div>

          {/* Pricing notes */}
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-[#94A3B8] space-y-1">
            <p className="text-amber-400 font-medium text-[12px]">À savoir — TV</p>
            <p>• Tous les plans incluent 25 ou 26 chaînes de base obligatoires.</p>
            <p>• Chaînes Free-Choice selon le plan; Premium facturées en supplément.</p>
            <p>• Nivra 4K Smart Terminal: 50$/terminal (max 4). Nivra Born Wifi Router: 60$ (frais uniques).</p>
          </div>
        </div>
      )}

      {/* ═══ SELECTIONS TAB ═══ */}
      {activeTab === "selections" && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["Client", "N° client", "Commande", "Chaînes", "Total", "Statut", "Date", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {selections.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-[#64748B]">Aucune sélection client</td></tr>
                ) : (
                  selections.map((s: any) => {
                    const st = SELECTION_STATUS[s.status] || SELECTION_STATUS.pending;
                    const chList = Array.isArray(s.channels) ? s.channels : [];
                    const baseCount = chList.filter((c: any) => c.type === "base_included" || c.category === "base").length;
                    const choiceCount = chList.filter((c: any) => c.type === "free_choice" || c.category === "free_choice").length;
                    const premCount = chList.filter((c: any) => c.type === "premium" || c.category === "premium").length;
                    return (
                      <tr key={s.id} className="hover:bg-[hsl(220,15%,13%)] transition-colors cursor-pointer" onClick={() => setSelected(s)}>
                        <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{s.profile?.full_name || "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-[#38BDF8]">{s.profile?.client_number || "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-[#94A3B8]">{s.order_id ? s.order_id.slice(0, 8) : "—"}</td>
                        <td className="px-3 py-2.5 text-[#CBD5E1]">
                          <span className="text-[#38BDF8]">{baseCount}</span> base
                          {choiceCount > 0 && <span> + <span className="text-emerald-400">{choiceCount}</span> choix</span>}
                          {premCount > 0 && <span> + <span className="text-amber-400">{premCount}</span> premium</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{s.total_price != null ? `${Number(s.total_price).toFixed(2)} $` : "—"}</td>
                        <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                        <td className="px-3 py-2.5 text-[#94A3B8]">{s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: fr }) : "—"}</td>
                        <td className="px-3 py-2.5">
                          {s.status === "pending" && (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => confirmSelectionMutation.mutate({ id: s.id })}
                                className="h-6 px-2 rounded text-[10px] font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors">
                                Confirmer
                              </button>
                              <button onClick={() => cancelSelectionMutation.mutate({ id: s.id })}
                                className="h-6 px-2 rounded text-[10px] font-medium bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors">
                                Annuler
                              </button>
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

      {/* ═══ CHANNEL MANAGEMENT DIALOG ═══ */}
      {editDialog === "channel" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#F8FAFC]">Gérer: {selected.name}</h2>
              <button onClick={() => setEditDialog(null)} className="text-[#64748B] hover:text-[#F8FAFC]"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 text-[11px] space-y-1">
              <div className="flex justify-between"><span className="text-[#94A3B8]">Catégorie</span><span className="text-[#F8FAFC]">{CATEGORY_LABELS[selected.category] || selected.category}</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">Pack</span><span className="text-[#F8FAFC]">{selected.base_pack || "Aucun"}</span></div>
              <div className="flex justify-between"><span className="text-[#94A3B8]">HD/4K</span><span className="text-[#F8FAFC]">{selected.is_hd ? "HD" : ""} {selected.is_4k ? "4K" : ""}</span></div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Statut</label>
                <select value={channelForm.status} onChange={(e) => setChannelForm({ ...channelForm, status: e.target.value })}
                  className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                  {Object.entries(CHANNEL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              {(channelForm.status !== "active") && (
                <>
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Type d'incident</label>
                    <select value={channelForm.incident_type} onChange={(e) => setChannelForm({ ...channelForm, incident_type: e.target.value })}
                      className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                      <option value="">Aucun</option>
                      {Object.entries(INCIDENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Raison</label>
                    <textarea value={channelForm.incident_reason} onChange={(e) => setChannelForm({ ...channelForm, incident_reason: e.target.value })}
                      rows={2} placeholder="Raison de l'incident…"
                      className="w-full rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] p-3 focus:outline-none resize-none" />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditDialog(null)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] text-[12px] font-medium">Annuler</button>
              <button onClick={() => updateChannelMutation.mutate({ channelId: selected.id, status: channelForm.status, incidentType: channelForm.incident_type, incidentReason: channelForm.incident_reason })}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors">
                Mettre à jour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE CHANNEL DIALOG ═══ */}
      {createChannelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#F8FAFC]">Ajouter une chaîne TV</h2>
              <button onClick={() => setCreateChannelOpen(false)} className="text-[#64748B] hover:text-[#F8FAFC]"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Nom de la chaîne *</label>
                <input value={newChannel.name} onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })} placeholder="TVA, RDS, CNN…"
                  className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Catégorie</label>
                  <select value={newChannel.category} onChange={(e) => setNewChannel({ ...newChannel, category: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                    <option value="base">Base (obligatoire)</option>
                    <option value="free_choice">Choix libre</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Pack base</label>
                  <select value={newChannel.base_pack} onChange={(e) => setNewChannel({ ...newChannel, base_pack: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                    <option value="">Aucun</option>
                    <option value="LA_BASE_26">LA_BASE_26</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Prix ($)</label>
                  <input type="number" step="0.01" value={newChannel.price} onChange={(e) => setNewChannel({ ...newChannel, price: e.target.value })} placeholder="0.00"
                    className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
                </div>
                <label className="flex items-center gap-2 mt-5">
                  <input type="checkbox" checked={newChannel.is_hd} onChange={(e) => setNewChannel({ ...newChannel, is_hd: e.target.checked })}
                    className="rounded border-[hsl(220,15%,18%)]" />
                  <span className="text-[12px] text-[#CBD5E1]">HD</span>
                </label>
                <label className="flex items-center gap-2 mt-5">
                  <input type="checkbox" checked={newChannel.is_4k} onChange={(e) => setNewChannel({ ...newChannel, is_4k: e.target.checked })}
                    className="rounded border-[hsl(220,15%,18%)]" />
                  <span className="text-[12px] text-[#CBD5E1]">4K</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCreateChannelOpen(false)} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] text-[12px] font-medium">Annuler</button>
              <button onClick={() => createChannelMutation.mutate(newChannel)} disabled={!newChannel.name || createChannelMutation.isPending}
                className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ACTIVITY LOG / SELECTION DETAIL DRAWER ═══ */}
      <Sheet open={!!selected && editDialog === null} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-[#F8FAFC] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[#F8FAFC]">
              {activeTab === "selections" ? "Détail sélection" : `Historique: ${selected?.name}`}
            </SheetTitle>
          </SheetHeader>
          {selected && activeTab === "channels" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                {[["Nom", selected.name], ["Catégorie", CATEGORY_LABELS[selected.category] || selected.category], ["Pack", selected.base_pack || "—"], ["Prix", Number(selected.price) > 0 ? `${Number(selected.price).toFixed(2)} $` : "Inclus"], ["HD", selected.is_hd ? "Oui" : "Non"], ["4K", selected.is_4k ? "Oui" : "Non"]].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-[12px]"><span className="text-[#94A3B8]">{l}</span><span className="text-[#F8FAFC] font-medium">{v || "—"}</span></div>
                ))}
              </div>
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Journal d'activité</h3>
                {activityLogs.length === 0 ? (
                  <p className="text-[12px] text-[#64748B]">Aucune activité enregistrée</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {activityLogs.map((log: any) => (
                      <div key={log.id} className="p-2 rounded bg-[hsl(220,15%,14%)] text-[11px]">
                        <div className="flex justify-between mb-1">
                          <span className="text-[#CBD5E1] font-medium">{log.action}</span>
                          <span className="text-[#64748B]">{log.created_at ? format(new Date(log.created_at), "dd MMM HH:mm", { locale: fr }) : ""}</span>
                        </div>
                        {log.reason && <p className="text-[#94A3B8]">Raison: {log.reason}</p>}
                        <p className="text-[#64748B]">{log.actor_name || log.actor_email || "Système"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {selected && activeTab === "selections" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2 text-[12px]">
                <div className="flex justify-between"><span className="text-[#94A3B8]">Client</span><span className="text-[#F8FAFC]">{selected.profile?.full_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-[#94A3B8]">Email</span><span className="text-[#38BDF8]">{selected.profile?.email || "—"}</span></div>
                <div className="flex justify-between"><span className="text-[#94A3B8]">Total</span><span className="text-emerald-400 font-medium">{selected.total_price != null ? `${Number(selected.total_price).toFixed(2)} $` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-[#94A3B8]">Statut</span><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(SELECTION_STATUS[selected.status] || SELECTION_STATUS.pending).color}`}>{(SELECTION_STATUS[selected.status] || SELECTION_STATUS.pending).label}</span></div>
              </div>
              {Array.isArray(selected.channels) && selected.channels.length > 0 && (
                <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
                  <h3 className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Chaînes sélectionnées ({selected.channels.length})</h3>
                  <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {selected.channels.map((ch: any, i: number) => (
                      <div key={ch.id || i} className="flex items-center justify-between px-2 py-1.5 rounded bg-[hsl(220,15%,14%)] text-[11px]">
                        <span className="text-[#F8FAFC]">{ch.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            ch.category === "base" || ch.type === "base_included" ? "bg-[#38BDF8]/15 text-[#38BDF8]" :
                            ch.category === "free_choice" || ch.type === "free_choice" ? "bg-emerald-500/15 text-emerald-400" :
                            "bg-amber-500/15 text-amber-400"
                          }`}>{ch.category === "base" || ch.type === "base_included" ? "Base" : ch.category === "free_choice" || ch.type === "free_choice" ? "Choix" : "Premium"}</span>
                          {Number(ch.price) > 0 && <span className="text-[#94A3B8]">{Number(ch.price).toFixed(2)} $</span>}
                        </div>
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

// ═══ Plan Card Component ═══
function PlanCard({ plan, baseCount, freeChoiceCount }: { plan: typeof NIVRA_TV_PLANS[0]; baseCount: number; freeChoiceCount: number }) {
  const badgeColor = plan.badge.includes("GIGA") ? "bg-[#38BDF8]/15 text-[#38BDF8]" :
    plan.badge === "MEILLEUR VENDEUR" ? "bg-emerald-500/15 text-emerald-400" :
    plan.badge === "PREMIUM" ? "bg-amber-500/15 text-amber-400" :
    "bg-[#64748B]/15 text-[#94A3B8]";

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4 flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${badgeColor}`}>{plan.badge}</span>
        <span className="text-lg font-bold text-emerald-400">{plan.price}$<span className="text-[10px] text-[#94A3B8] font-normal">/mois</span></span>
      </div>
      <h3 className="text-[13px] font-semibold text-[#F8FAFC] mb-1">{plan.name}</h3>
      <p className="text-[11px] text-[#94A3B8] mb-3">
        {plan.baseChannels} chaînes{plan.freeChoices > 0 ? ` + ${plan.freeChoices} au choix` : ""} • {plan.internet}
      </p>
      <ul className="space-y-1 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="text-[11px] text-[#CBD5E1] flex items-start gap-1.5">
            <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-3 pt-3 border-t border-[hsl(220,15%,14%)] text-[10px] text-[#64748B]">
        Disponible: {baseCount} chaînes base • {freeChoiceCount} choix libres
      </div>
    </div>
  );
}
