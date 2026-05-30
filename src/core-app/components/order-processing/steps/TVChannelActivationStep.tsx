/**
 * TVChannelActivationStep — workflow admin TV complet
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tv, CheckCircle2, Loader2, Save, Zap, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface Props { proc: any; }

interface ChannelOption {
  key: string;
  id: string | null;
  name: string;
  category: string;
  price: number;
  selected: boolean;
  fromCatalog: boolean;
}

function normalizeText(value: string): string {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function toMoney(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function normalizePersistedChannels(channels: ChannelOption[]) {
  return channels.map((ch) => ({
    id: ch.id || normalizeText(ch.name).replace(/\s+/g, "-"),
    name: ch.name,
    category: ch.category || "Autre",
    price: toMoney(ch.price),
  }));
}
function mergeChannels(source: any[], catalog: any[]): ChannelOption[] {
  const byKey = new Map<string, ChannelOption>();
  const catalogById = new Map<string, ChannelOption>();
  const catalogByName = new Map<string, ChannelOption>();

  for (const row of catalog) {
    const id = row?.id ? String(row.id) : null;
    if (!id) continue;
    const option: ChannelOption = {
      key: `id:${id}`, id,
      name: String(row?.name || "Canal inconnu"),
      category: String(row?.category || "Autre"),
      price: toMoney(row?.monthly_price),
      selected: false, fromCatalog: true,
    };
    byKey.set(option.key, option);
    catalogById.set(id, option);
    catalogByName.set(normalizeText(option.name), option);
  }

  for (let i = 0; i < source.length; i += 1) {
    const row = source[i] || {};
    const sourceId = row.id ? String(row.id) : null;
    const sourceName = String(row.name || row.channel_name || `Canal ${i + 1}`);
    const sourceNameKey = normalizeText(sourceName);
    const matched = (sourceId ? catalogById.get(sourceId) : undefined) || catalogByName.get(sourceNameKey);
    if (matched) { byKey.set(matched.key, { ...matched, selected: true }); continue; }
    const key = sourceId ? `id:${sourceId}` : `name:${sourceNameKey}`;
    byKey.set(key, {
      key, id: sourceId, name: sourceName,
      category: String(row.category || "Autre"),
      price: toMoney(row.price ?? row.monthly_price),
      selected: true, fromCatalog: false,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const cat = a.category.localeCompare(b.category, "fr", { sensitivity: "base" });
    if (cat !== 0) return cat;
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });
}

export function TVChannelActivationStep({ proc }: Props) {
  const { order, channelSelection } = proc;

  const [catalogChannels, setCatalogChannels] = useState<any[]>([]);
  const [channelOptions, setChannelOptions] = useState<ChannelOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<"save" | "activate" | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("tv_channels")
        .select("id, name, category, price")
        .eq("is_active", true)
        .order("category").order("name");
      if (error) {
        console.error("[TVChannels] Catalog load error:", error);
        toast.error("Impossible de charger le catalogue TV");
        return;
      }
      setCatalogChannels(data || []);
    })();
  }, []);

  useEffect(() => {
    const sourceChannels =
      (Array.isArray(channelSelection?.channels) && channelSelection.channels) ||
      (Array.isArray(order?.selected_channels) && order.selected_channels) || [];
    setChannelOptions(mergeChannels(sourceChannels, catalogChannels));
  }, [catalogChannels, channelSelection?.channels, order?.selected_channels]);

  const selectedChannels = useMemo(() => channelOptions.filter((c) => c.selected), [channelOptions]);

  const filteredCatalog = useMemo(() => {
    const needle = normalizeText(search);
    if (!needle) return channelOptions;
    return channelOptions.filter((channel) =>
      normalizeText(channel.name).includes(needle) || normalizeText(channel.category).includes(needle));
  }, [channelOptions, search]);

  const totalPrice = useMemo(
    () => selectedChannels.reduce((sum, ch) => sum + toMoney(ch.price), 0),
    [selectedChannels],
  );

  const toggleChannel = (key: string) => {
    setChannelOptions((prev) => prev.map((channel) =>
      channel.key === key ? { ...channel, selected: !channel.selected } : channel));
  };

  const persistSelection = async () => {
    if (!order?.id || !order?.user_id) throw new Error("Commande invalide");
    if (selectedChannels.length === 0) throw new Error("Sélectionnez au moins une chaîne");

    const nowIso = new Date().toISOString();
    const payload = {
      user_id: order.user_id, order_id: order.id,
      channels: normalizePersistedChannels(selectedChannels),
      total_price: totalPrice, status: "confirmed",
      confirmed_at: nowIso, confirmed_by: proc.currentUserId || null,
      updated_at: nowIso, created_at: nowIso,
    };
    const { error: upsertError } = await supabase.from("channel_selections").upsert(payload, { onConflict: "order_id" });
    if (upsertError) throw upsertError;

    await proc.updateOrder({
      selected_channels: normalizePersistedChannels(selectedChannels),
      channel_selection_locked: true,
      tv_channels_count: selectedChannels.length,
      channel_assigned_by: proc.currentUserId || order?.channel_assigned_by || null,
      updated_at: nowIso,
    });
    await proc.refetch();
  };

  const handleSaveSelection = async () => {
    setLoading("save");
    try { await persistSelection(); toast.success("Sélection TV confirmée"); }
    catch (error: any) {
      console.error("[TVChannels] Confirm error:", error);
      toast.error(error?.message || "Erreur lors de la confirmation");
    } finally { setLoading(null); }
  };

  const handleActivateChannels = async () => {
    setLoading("activate");
    try { await persistSelection(); toast.success("Chaînes activées sur le compte client"); }
    catch (error: any) {
      console.error("[TVChannels] Activate error:", error);
      toast.error(error?.message || "Erreur lors de l'activation");
    } finally { setLoading(null); }
  };

  const isActivated =
    ["activated", "completed", "delivered", "installation_completed"].includes(String(order?.status || "").toLowerCase()) &&
    channelSelection?.status === "confirmed";
  const isConfirmed = !isActivated && channelSelection?.status === "confirmed";

  const currentPackageBadge = order?.tv_package || order?.package_name || "Forfait actuel";

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Chaînes TV</div>

      {/* Current package badge */}
      <div className="mb-4 flex items-center gap-2">
        <span className="bg-blue-900/50 text-blue-300 text-[10px] font-medium px-2 py-1 rounded-full uppercase tracking-wider">
          {currentPackageBadge}
        </span>
        <span className="text-xs text-slate-500">{selectedChannels.length} chaîne(s) — {totalPrice.toFixed(2)} $/mois</span>
      </div>

      {isActivated && (
        <div className="bg-green-950/50 border border-green-700/50 text-green-300 rounded-lg px-3 py-2 text-sm mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Chaînes activées sur le compte client
        </div>
      )}
      {isConfirmed && (
        <div className="bg-blue-950/50 border border-blue-700/50 text-blue-300 rounded-lg px-3 py-2 text-sm mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Sélection confirmée (en attente d'activation)
        </div>
      )}

      {/* Catalog with search */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
          <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Catalogue</h4>
          <span className="text-[10px] text-slate-500">{filteredCatalog.length} affichée(s)</span>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une chaîne ou catégorie…"
              className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg pl-8"
            />
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg bg-[#0d1421] p-2 border border-slate-700/50">
            {filteredCatalog.length === 0 ? (
              <p className="px-1 py-2 text-sm text-slate-500">Aucun résultat.</p>
            ) : (
              filteredCatalog.map((channel) => (
                <label key={channel.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-800/50">
                  <Checkbox checked={channel.selected} onCheckedChange={() => toggleChannel(channel.key)} />
                  <Tv className="h-3.5 w-3.5 text-slate-500" />
                  <span className="flex-1 text-sm text-slate-100">{channel.name}</span>
                  <span className="text-xs text-slate-500">{channel.category}</span>
                  <span className="text-xs tabular-nums text-slate-400">{toMoney(channel.price).toFixed(2)} $</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-700/50">
        <Button size="sm" onClick={handleSaveSelection} disabled={loading !== null || selectedChannels.length === 0} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
          {loading === "save" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
          Confirmer ({selectedChannels.length})
        </Button>
        <Button size="sm" onClick={handleActivateChannels} disabled={loading !== null || selectedChannels.length === 0} className="text-sm bg-green-600 hover:bg-green-700 text-white">
          {loading === "activate" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
          Activer sur le compte
        </Button>
      </div>
    </div>
  );
}
