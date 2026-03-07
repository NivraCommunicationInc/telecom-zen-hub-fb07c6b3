/**
 * TVChannelActivationStep — TV channel selection review, adjustment & activation
 * Shows customer's selected channels, allows admin to confirm/adjust, and activate on account.
 */
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tv, CheckCircle2, Loader2, Save, Zap } from "lucide-react";
import { toast } from "sonner";
import { adminClient as supabase } from "@/integrations/backend";

interface Props { proc: any; }

interface ChannelItem {
  id: string;
  name: string;
  category: string;
  price: number;
  selected: boolean;
}

interface PersistedChannel {
  id: string;
  name: string;
  category: string;
  price: number;
}

function normalizeChannelPayload(channels: ChannelItem[]): PersistedChannel[] {
  return channels.map((ch) => ({
    id: ch.id,
    name: ch.name,
    category: ch.category || "Autre",
    price: Number(ch.price || 0),
  }));
}

export function TVChannelActivationStep({ proc }: Props) {
  const { order, channelSelection } = proc;
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [allChannels, setAllChannels] = useState<any[]>([]);

  // Load selected channels from channel_selections, fallback to order.selected_channels
  useEffect(() => {
    const sourceChannels =
      (Array.isArray(channelSelection?.channels) && channelSelection.channels) ||
      (Array.isArray(order?.selected_channels) && order.selected_channels) ||
      [];

    const items: ChannelItem[] = sourceChannels.map((ch: any, index: number) => ({
      id: String(ch.id || ch.channel_id || ch.channelId || `${ch.name || "channel"}-${index}`),
      name: ch.name || ch.channel_name || "Canal inconnu",
      category: ch.category || "Autre",
      price: Number(ch.price || ch.monthly_price || 0),
      selected: true,
    }));

    setChannels(items);
  }, [channelSelection, order?.selected_channels]);

  // Fetch available TV channels for adding
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tv_channels")
        .select("id, name, category, monthly_price")
        .eq("is_active", true)
        .order("category")
        .order("name");
      setAllChannels(data || []);
    })();
  }, []);

  const toggleChannel = (id: string) => {
    setChannels(prev => prev.map(ch =>
      ch.id === id ? { ...ch, selected: !ch.selected } : ch
    ));
  };

  const addChannel = (ch: any) => {
    if (channels.find(c => c.id === ch.id)) return;
    setChannels(prev => [...prev, {
      id: ch.id,
      name: ch.name,
      category: ch.category || "Autre",
      price: ch.monthly_price || 0,
      selected: true,
    }]);
  };

  const selectedChannels = channels.filter(c => c.selected);
  const totalPrice = selectedChannels.reduce((sum, ch) => sum + ch.price, 0);

  const handleSaveSelection = async () => {
    setLoading("save");
    try {
      if (!order?.id || !order?.user_id) {
        throw new Error("Commande invalide");
      }

      if (selectedChannels.length === 0) {
        throw new Error("Sélectionnez au moins une chaîne");
      }

      const payload = {
        user_id: order.user_id,
        order_id: order.id,
        channels: normalizeChannelPayload(selectedChannels),
        total_price: totalPrice,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: proc.currentUserId || null,
        updated_at: new Date().toISOString(),
      };

      if (channelSelection?.id) {
        const { error } = await supabase
          .from("channel_selections")
          .update(payload)
          .eq("id", channelSelection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("channel_selections")
          .insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
      }

      await proc.updateOrder({
        selected_channels: normalizeChannelPayload(selectedChannels),
        channel_selection_locked: true,
        tv_channels_count: selectedChannels.length,
        tv_total_price: totalPrice,
        updated_at: new Date().toISOString(),
      });

      toast.success("Sélection de chaînes sauvegardée");
      await proc.refetch();
    } catch (err: any) {
      console.error("[TVChannels] Save error:", err);
      toast.error(err?.message || "Erreur lors de la sauvegarde");
    } finally {
      setLoading(null);
    }
  };

  const handleActivateChannels = async () => {
    setLoading("activate");
    try {
      if (!order?.id || !order?.user_id) {
        throw new Error("Commande invalide");
      }

      if (selectedChannels.length === 0) {
        throw new Error("Sélectionnez au moins une chaîne avant activation");
      }

      const payload = {
        user_id: order.user_id,
        order_id: order.id,
        channels: normalizeChannelPayload(selectedChannels),
        total_price: totalPrice,
        status: "activated",
        confirmed_at: new Date().toISOString(),
        confirmed_by: proc.currentUserId || null,
        updated_at: new Date().toISOString(),
      };

      if (channelSelection?.id) {
        const { error } = await supabase
          .from("channel_selections")
          .update(payload)
          .eq("id", channelSelection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("channel_selections")
          .insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
      }

      await proc.updateOrder({
        selected_channels: normalizeChannelPayload(selectedChannels),
        channel_selection_locked: true,
        tv_channels_activated: true,
        tv_channels_count: selectedChannels.length,
        tv_total_price: totalPrice,
        updated_at: new Date().toISOString(),
      });

      toast.success(`${selectedChannels.length} chaîne(s) activée(s) sur le compte client`);
      await proc.refetch();
    } catch (err: any) {
      console.error("[TVChannels] Activate error:", err);
      toast.error(err?.message || "Erreur lors de l'activation");
    } finally {
      setLoading(null);
    }
  };

  const isActivated = channelSelection?.status === "activated";
  const isConfirmed = channelSelection?.status === "confirmed";

  // Group channels by category
  const grouped = selectedChannels.reduce<Record<string, ChannelItem[]>>((acc, ch) => {
    if (!acc[ch.category]) acc[ch.category] = [];
    acc[ch.category].push(ch);
    return acc;
  }, {});

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Chaînes TV — Sélection & Activation</h3>

      {/* Status badge */}
      {isActivated && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-4">
          <p className="text-sm text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Chaînes activées sur le compte client
          </p>
        </div>
      )}
      {isConfirmed && !isActivated && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Sélection confirmée — en attente d'activation
          </p>
        </div>
      )}

      {!channelSelection && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-800">Aucune sélection de chaînes trouvée pour cette commande.</p>
        </div>
      )}

      {/* Customer's selected channels */}
      {channels.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase">Chaînes sélectionnées par le client</h4>
            <span className="text-xs text-gray-500">{selectedChannels.length} chaîne(s) — {totalPrice.toFixed(2)} $/mois</span>
          </div>
          {Object.entries(grouped).map(([cat, chs]) => (
            <div key={cat} className="mb-3">
              <p className="text-xs font-semibold text-gray-600 mb-1">{cat}</p>
              <div className="space-y-1">
                {chs.map(ch => (
                  <label key={ch.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-100 rounded px-2 py-1">
                    <Checkbox
                      checked={ch.selected}
                      onCheckedChange={() => toggleChannel(ch.id)}
                    />
                    <span className="flex-1 text-gray-900">{ch.name}</span>
                    <span className="text-xs text-gray-500 tabular-nums">{ch.price.toFixed(2)} $</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add more channels from catalog */}
      {allChannels.length > 0 && !isActivated && (
        <details className="mb-4">
          <summary className="text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 uppercase">
            + Ajouter des chaînes du catalogue
          </summary>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1 bg-white rounded border border-gray-200 p-2">
            {allChannels
              .filter(ch => !channels.find(c => c.id === ch.id))
              .map(ch => (
                <button
                  key={ch.id}
                  onClick={() => addChannel(ch)}
                  className="flex items-center gap-2 w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-50"
                >
                  <Tv className="w-3 h-3 text-gray-400" />
                  <span className="flex-1 text-gray-700">{ch.name}</span>
                  <span className="text-xs text-gray-500">{ch.category}</span>
                  <span className="text-xs text-gray-500 tabular-nums">{(ch.monthly_price || 0).toFixed(2)} $</span>
                </button>
              ))}
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
        <Button
          size="sm"
          onClick={handleSaveSelection}
          disabled={loading === "save" || isActivated}
          className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800"
        >
          {loading === "save" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          Confirmer la sélection
        </Button>
        <Button
          size="sm"
          onClick={handleActivateChannels}
          disabled={loading === "activate" || isActivated || selectedChannels.length === 0}
          className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {loading === "activate" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
          Activer sur le compte
        </Button>
      </div>
    </div>
  );
}
