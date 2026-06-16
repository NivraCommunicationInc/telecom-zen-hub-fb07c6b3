/**
 * TVChannelActivationStep — workflow admin TV complet
 * - Affiche la sélection client
 * - Affiche tout le catalogue actif
 * - Permet correction, confirmation et activation
 */
import { useEffect, useMemo, useState } from "react";
import { adminClient as supabase } from "@/integrations/backend";
import { toast } from "sonner";

async function queueChannelConfirmedEmail(order: any, channels: { name: string; category: string }[], premiumTotal: number) {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("user_id", order.user_id)
      .maybeSingle();

    const email = order.client_email || profile?.email;
    if (!email) return;

    await supabase.from("email_queue").insert({
      to_email: email,
      template_key: "client_tv_channels_confirmed",
      template_vars: {
        first_name: profile?.first_name || order.client_first_name || "",
        order_number: order.order_number || order.id?.slice(0, 8),
        channel_count: channels.length,
        channels: channels.slice(0, 30),
        premium_total: premiumTotal > 0 ? `${premiumTotal.toFixed(2)} $` : "0,00 $",
      },
      status: "pending",
    });
  } catch (e) {
    console.error("[TVChannels] email queue error:", e);
  }
}

async function createChannelConfirmedTicket(order: any, channels: { name: string }[]) {
  try {
    if (!order.user_id) return;
    const list = channels.slice(0, 10).map(c => c.name).join(", ") + (channels.length > 10 ? ` … +${channels.length - 10}` : "");
    await supabase.from("support_tickets").insert({
      user_id: order.user_id,
      order_id: order.id,
      subject: "Chaînes TV",
      message: `Sélection de ${channels.length} chaîne(s) confirmée et activée : ${list}`,
      status: "closed",
      priority: "low",
      category: "tv",
      source: "system",
    });
  } catch (e) {
    console.error("[TVChannels] ticket create error:", e);
  }
}
import { Tv, CheckCircle2, Loader2, Save, Zap, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface Props {
  proc: any;
}

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
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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
      key: `id:${id}`,
      id,
      name: String(row?.name || "Canal inconnu"),
      category: String(row?.category || "Autre"),
      price: toMoney(row?.monthly_price),
      selected: false,
      fromCatalog: true,
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

    const matched =
      (sourceId ? catalogById.get(sourceId) : undefined) ||
      catalogByName.get(sourceNameKey);

    if (matched) {
      byKey.set(matched.key, { ...matched, selected: true });
      continue;
    }

    const key = sourceId ? `id:${sourceId}` : `name:${sourceNameKey}`;
    byKey.set(key, {
      key,
      id: sourceId,
      name: sourceName,
      category: String(row.category || "Autre"),
      price: toMoney(row.price ?? row.monthly_price),
      selected: true,
      fromCatalog: false,
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
        .order("category")
        .order("name");

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
      (Array.isArray(order?.selected_channels) && order.selected_channels) ||
      [];

    setChannelOptions(mergeChannels(sourceChannels, catalogChannels));
  }, [catalogChannels, channelSelection?.channels, order?.selected_channels]);

  const selectedChannels = useMemo(
    () => channelOptions.filter((c) => c.selected),
    [channelOptions],
  );

  const groupedSelected = useMemo(() => {
    return selectedChannels.reduce<Record<string, ChannelOption[]>>((acc, channel) => {
      if (!acc[channel.category]) acc[channel.category] = [];
      acc[channel.category].push(channel);
      return acc;
    }, {});
  }, [selectedChannels]);

  const filteredCatalog = useMemo(() => {
    const needle = normalizeText(search);
    if (!needle) return channelOptions;

    return channelOptions.filter((channel) => {
      return (
        normalizeText(channel.name).includes(needle) ||
        normalizeText(channel.category).includes(needle)
      );
    });
  }, [channelOptions, search]);

  const totalPrice = useMemo(
    () => selectedChannels.reduce((sum, ch) => sum + toMoney(ch.price), 0),
    [selectedChannels],
  );

  const toggleChannel = (key: string) => {
    setChannelOptions((prev) =>
      prev.map((channel) =>
        channel.key === key ? { ...channel, selected: !channel.selected } : channel,
      ),
    );
  };

  const persistSelection = async () => {
    if (!order?.id || !order?.user_id) {
      throw new Error("Commande invalide");
    }

    if (selectedChannels.length === 0) {
      throw new Error("Sélectionnez au moins une chaîne");
    }

    const nowIso = new Date().toISOString();

    const payload = {
      user_id: order.user_id,
      order_id: order.id,
      channels: normalizePersistedChannels(selectedChannels),
      total_price: totalPrice,
      status: "confirmed", // valeur valide selon channel_selections_status_check
      confirmed_at: nowIso,
      confirmed_by: proc.currentUserId || null,
      updated_at: nowIso,
      created_at: nowIso,
    };

    const { error: upsertError } = await supabase
      .from("channel_selections")
      .upsert(payload, { onConflict: "order_id" });

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
    try {
      await persistSelection();
      toast.success("Sélection TV confirmée");
    } catch (error: any) {
      console.error("[TVChannels] Confirm error:", error);
      toast.error(error?.message || "Erreur lors de la confirmation");
    } finally {
      setLoading(null);
    }
  };

  const handleActivateChannels = async () => {
    setLoading("activate");
    try {
      await persistSelection();
      // Send confirmation email + create closed ticket
      const confirmed = channelOptions.filter(c => c.selected).map(c => ({ name: c.name, category: c.category }));
      await Promise.allSettled([
        queueChannelConfirmedEmail(order, confirmed, totalPrice),
        createChannelConfirmedTicket(order, confirmed),
      ]);
      toast.success("Chaînes activées sur le compte client");
    } catch (error: any) {
      console.error("[TVChannels] Activate error:", error);
      toast.error(error?.message || "Erreur lors de l'activation");
    } finally {
      setLoading(null);
    }
  };

  const isActivated =
    ["activated", "completed", "delivered", "installation_completed"].includes(String(order?.status || "").toLowerCase()) &&
    channelSelection?.status === "confirmed";
  const isConfirmed = !isActivated && channelSelection?.status === "confirmed";

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">Chaînes TV — Révision, confirmation et activation</h3>

      {isActivated && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4" /> Chaînes activées sur le compte client
          </p>
        </div>
      )}

      {isConfirmed && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4" /> Sélection confirmée (en attente d'activation)
          </p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sélection actuelle du client
          </h4>
          <span className="text-xs text-muted-foreground">
            {selectedChannels.length} chaîne(s) — {totalPrice.toFixed(2)} $/mois
          </span>
        </div>

        {selectedChannels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune chaîne sélectionnée pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedSelected).map(([category, channels]) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{category}</p>
                <div className="space-y-1">
                  {channels.map((channel) => (
                    <label
                      key={channel.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                    >
                      <Checkbox
                        checked={channel.selected}
                        onCheckedChange={() => toggleChannel(channel.key)}
                      />
                      <span className="flex-1 text-sm text-foreground">{channel.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{toMoney(channel.price).toFixed(2)} $</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Catalogue complet (sélection + autres chaînes disponibles)
          </h4>
          <span className="text-xs text-muted-foreground">{filteredCatalog.length} affichée(s)</span>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une chaîne ou catégorie…"
            className="pl-8"
          />
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2">
          {filteredCatalog.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">Aucun résultat.</p>
          ) : (
            filteredCatalog.map((channel) => (
              <label
                key={channel.key}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <Checkbox
                  checked={channel.selected}
                  onCheckedChange={() => toggleChannel(channel.key)}
                />
                <Tv className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 text-sm text-foreground">{channel.name}</span>
                <span className="text-xs text-muted-foreground">{channel.category}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{toMoney(channel.price).toFixed(2)} $</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button size="sm" onClick={handleSaveSelection} disabled={loading !== null || selectedChannels.length === 0}>
          {loading === "save" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
          Confirmer la sélection
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleActivateChannels}
          disabled={loading !== null || selectedChannels.length === 0}
        >
          {loading === "activate" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
          Activer sur le compte
        </Button>
      </div>
    </div>
  );
}
