/**
 * CoreChannelsPage — TV Channel Management Console
 * Ported from AdminChannels with full features:
 * - 3 tabs: Chaînes TV, Forfaits, Sélections clients
 * - Channel catalog with status management (active/maintenance/shutdown/end_of_life)
 * - Channel packages CRUD
 * - Client channel selection confirm/cancel
 * - Activity logs per channel
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tv, Search, Plus, Edit, Trash2, Eye, CheckCircle, XCircle, AlertTriangle, History, Power, Wrench, Ban } from "lucide-react";
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

export default function CoreChannelsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"channels" | "packages" | "selections">("channels");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [editDialog, setEditDialog] = useState<"channel" | "package" | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  // Channel form state
  const [channelForm, setChannelForm] = useState({
    status: "active", incident_type: "", incident_reason: "", notify_clients: true,
  });

  // ═══ QUERIES ═══
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["core-tv-channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tv_channels").select("*").order("channel_number", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["core-channel-packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("channel_packages").select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: selections = [] } = useQuery({
    queryKey: ["core-channel-selections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("channel_selections").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      // Enrich with profiles
      const userIds = [...new Set((data || []).map((s: any) => s.user_id).filter(Boolean))];
      if (userIds.length === 0) return data || [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email, client_number").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((s: any) => ({ ...s, profile: profileMap.get(s.user_id) || null }));
    },
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ["core-channel-logs", selected?.id],
    enabled: !!selected?.id && activeTab === "channels",
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
      // Log activity
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

  const confirmSelectionMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("channel_selections").update({ status: "confirmed", confirmed_at: new Date().toISOString(), notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-channel-selections"] }); toast.success("Sélection confirmée"); setSelected(null); setActionNotes(""); },
  });

  const cancelSelectionMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("channel_selections").update({ status: "cancelled", notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-channel-selections"] }); toast.success("Sélection annulée"); setSelected(null); setActionNotes(""); },
  });

  // ═══ FILTERING ═══
  const filteredChannels = useMemo(() => {
    return channels.filter((c: any) => {
      const s = c.status || (c.is_active ? "active" : "shutdown");
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.name?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q) || String(c.channel_number).includes(q);
      }
      return true;
    });
  }, [channels, search, statusFilter]);

  const activeCount = channels.filter((c: any) => c.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Gestion TV</h1>
          <p className="text-xs text-[#94A3B8]">{activeCount} chaînes actives • {channels.length} total • {packages.length} forfaits • {selections.filter((s: any) => s.status === "pending").length} sélections en attente</p>
        </div>
        <Tv className="h-5 w-5 text-emerald-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-[hsl(220,15%,16%)] pb-0">
        {([
          { id: "channels" as const, label: "Chaînes TV" },
          { id: "packages" as const, label: "Forfaits" },
          { id: "selections" as const, label: "Sélections clients" },
        ]).map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(""); setStatusFilter("all"); }}
            className={`px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors ${
              activeTab === tab.id
                ? "bg-[hsl(220,20%,11%)] text-emerald-400 border border-[hsl(220,15%,16%)] border-b-transparent -mb-px"
                : "text-[#94A3B8] hover:text-[#CBD5E1]"
            }`}>
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
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, catégorie, numéro…"
                className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
            </div>
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
          </div>
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[hsl(220,15%,16%)]">
                    {["N°", "Nom", "Catégorie", "Langue", "HD", "4K", "Prix", "Statut", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                  {channelsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={9} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>)
                  ) : filteredChannels.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-12 text-[#64748B]">Aucune chaîne trouvée</td></tr>
                  ) : (
                    filteredChannels.map((c: any) => {
                      const s = c.status || (c.is_active ? "active" : "shutdown");
                      const st = CHANNEL_STATUS[s] || CHANNEL_STATUS.active;
                      return (
                        <tr key={c.id} className="hover:bg-[hsl(220,15%,13%)] transition-colors">
                          <td className="px-3 py-2.5 font-mono text-[#38BDF8]">{c.channel_number ?? "—"}</td>
                          <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{c.name}</td>
                          <td className="px-3 py-2.5 text-[#CBD5E1]">{c.category || "—"}</td>
                          <td className="px-3 py-2.5 text-[#CBD5E1]">{c.language || "—"}</td>
                          <td className="px-3 py-2.5">{c.is_hd ? <span className="text-emerald-400 text-[10px]">HD</span> : <span className="text-[#64748B]">—</span>}</td>
                          <td className="px-3 py-2.5">{c.is_4k ? <span className="text-blue-400 text-[10px]">4K</span> : <span className="text-[#64748B]">—</span>}</td>
                          <td className="px-3 py-2.5 text-[#CBD5E1]">{c.price != null ? `${Number(c.price).toFixed(2)} $` : "—"}</td>
                          <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              <button onClick={() => { setSelected(c); setChannelForm({ status: c.status || "active", incident_type: "", incident_reason: "", notify_clients: true }); setEditDialog("channel"); }}
                                className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-emerald-500/40 transition-colors" title="Gérer">
                                <Edit className="h-3 w-3" />
                              </button>
                              <button onClick={() => setSelected(c)}
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

      {/* ═══ PACKAGES TAB ═══ */}
      {activeTab === "packages" && (
        <div className="space-y-3">
          {packages.length === 0 ? (
            <div className="text-center py-12 text-[#64748B] rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]">Aucun forfait TV configuré</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {packages.map((pkg: any) => {
                const channelIds = Array.isArray(pkg.channels) ? pkg.channels : [];
                const pkgChannels = channels.filter((c: any) => channelIds.includes(c.id));
                return (
                  <div key={pkg.id} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[13px] font-semibold text-[#F8FAFC]">{pkg.name}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${pkg.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {pkg.is_active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                    {pkg.description && <p className="text-[11px] text-[#94A3B8] mb-2">{pkg.description}</p>}
                    <div className="flex items-center gap-3 text-[12px] mb-2">
                      <span className="text-[#94A3B8]">Original: <span className="line-through text-[#64748B]">{Number(pkg.original_price).toFixed(2)} $</span></span>
                      <span className="text-emerald-400 font-semibold">{Number(pkg.discounted_price).toFixed(2)} $</span>
                      {pkg.savings_percent && <span className="text-[10px] text-amber-400">-{pkg.savings_percent}%</span>}
                    </div>
                    <div className="text-[11px] text-[#94A3B8]">{pkgChannels.length} chaînes • {pkg.category}</div>
                    {pkgChannels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {pkgChannels.slice(0, 8).map((c: any) => (
                          <span key={c.id} className="px-1.5 py-0.5 rounded bg-[hsl(220,15%,14%)] text-[10px] text-[#CBD5E1]">{c.name}</span>
                        ))}
                        {pkgChannels.length > 8 && <span className="text-[10px] text-[#64748B]">+{pkgChannels.length - 8}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ SELECTIONS TAB ═══ */}
      {activeTab === "selections" && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["Client", "Chaînes", "Total", "Statut", "Date", ""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {selections.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-[#64748B]">Aucune sélection</td></tr>
                ) : (
                  selections.map((s: any) => {
                    const st = SELECTION_STATUS[s.status] || SELECTION_STATUS.pending;
                    const chCount = Array.isArray(s.channels) ? s.channels.length : 0;
                    return (
                      <tr key={s.id} className="hover:bg-[hsl(220,15%,13%)] transition-colors">
                        <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{s.profile?.full_name || "—"}</td>
                        <td className="px-3 py-2.5 text-[#CBD5E1]">{chCount} chaînes</td>
                        <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{s.total_price != null ? `${Number(s.total_price).toFixed(2)} $` : "—"}</td>
                        <td className="px-3 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}>{st.label}</span></td>
                        <td className="px-3 py-2.5 text-[#94A3B8]">{s.created_at ? format(new Date(s.created_at), "dd MMM yyyy", { locale: fr }) : "—"}</td>
                        <td className="px-3 py-2.5">
                          {s.status === "pending" && (
                            <div className="flex gap-1">
                              <button onClick={() => confirmSelectionMutation.mutate({ id: s.id, notes: "" })}
                                className="h-6 px-2 rounded text-[10px] font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors">
                                Confirmer
                              </button>
                              <button onClick={() => cancelSelectionMutation.mutate({ id: s.id, notes: "" })}
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
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Statut</label>
                <select value={channelForm.status} onChange={(e) => setChannelForm({ ...channelForm, status: e.target.value })}
                  className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                  {Object.entries(CHANNEL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              {(channelForm.status === "shutdown" || channelForm.status === "end_of_life" || channelForm.status === "maintenance") && (
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

      {/* ═══ ACTIVITY LOG DRAWER ═══ */}
      <Sheet open={!!selected && editDialog === null && activeTab === "channels"} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md bg-[hsl(220,20%,9%)] border-l border-[hsl(220,15%,16%)] text-[#F8FAFC] overflow-y-auto">
          <SheetHeader><SheetTitle className="text-[#F8FAFC]">Historique: {selected?.name}</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2">
                {[["Nom", selected.name], ["N°", selected.channel_number], ["Catégorie", selected.category], ["Langue", selected.language], ["Prix", selected.price != null ? `${Number(selected.price).toFixed(2)} $` : "—"]].map(([l, v]) => (
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
                        <p className="text-[#64748B]">{log.actor_name || log.actor_email || "Système"} ({log.actor_role || "—"})</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
