/**
 * TVServiceActionsDialog — Manage TV service for a client.
 * Used in Nivra Core (Account 360) and Nivra OneView CS (Client 360).
 *
 * Module 29 hardening (F29-1 → F29-19):
 *  - Motifs obligatoires (≥ 5 chars, ≥ 10 pour actions terminal critiques)
 *  - Idempotency key stable par ouverture du dialog (UUID)
 *  - `pack_id` envoyé au serveur pour validation catalogue
 *  - Toutes les mutations transitent par `tv-account-actions` (aucune écriture directe)
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Tv, Layers, Film, MonitorSmartphone, ShieldCheck, Plus, Trash2, RefreshCw, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServicePlans, useChannelPackages } from "@/shared-ops/hooks/useServiceCatalog";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  accountId?: string | null;
  subscriptionId?: string | null;
  currentPlanName?: string | null;
  currentMonthlyPrice?: number | null;
}

interface TvAddon {
  id: string;
  addon_code: string;
  addon_name: string;
  addon_type: string;
  monthly_price: number;
  status: string;
  created_at: string;
}

const TERMINAL_ACTIONS: Array<{ value: string; label: string; critical?: boolean }> = [
  { value: "reboot",         label: "Redémarrer à distance" },
  { value: "identify",       label: "Identifier (clignoter LED)" },
  { value: "firmware_push",  label: "Forcer mise à jour micrologiciel" },
  { value: "factory_reset",  label: "Réinitialisation usine", critical: true },
  { value: "deactivate",     label: "Désactiver le terminal",  critical: true },
  { value: "reactivate",     label: "Réactiver le terminal" },
];

const RATINGS = ["G", "PG", "PG-13", "R", "NC-17", "adult_blocked"] as const;

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

// F29-11 — stable idempotency key per dialog open
const makeSessionKey = () =>
  (globalThis.crypto?.randomUUID?.() ?? `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

export function TVServiceActionsDialog({
  open, onClose, clientUserId, clientName, accountId, subscriptionId,
  currentPlanName, currentMonthlyPrice,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"plan" | "packs" | "channels" | "vod" | "terminal" | "parental">("plan");
  const { plans: tvPlans, loading: loadingPlans } = useServicePlans("TV", open);
  const { packs: bouquetCatalog, loading: loadingBouquets } = useChannelPackages(open);

  // Session id (stable while dialog stays open) — feeds idempotency keys
  const sessionId = useMemo(() => makeSessionKey(), [open]);

  // Channels (à la carte)
  type Ch = { id: string; name: string; category: string; price: number; is_hd: boolean | null };
  const [catalogChannels, setCatalogChannels] = useState<Ch[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedChannelIds, setSelectedChannelIds] = useState<Set<string>>(new Set());
  const [channelFilter, setChannelFilter] = useState("");
  const [channelNotes, setChannelNotes] = useState("");
  const [channelReason, setChannelReason] = useState("");

  // Plan change
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planChangeType, setPlanChangeType] = useState<"upgrade" | "downgrade" | "lateral">("upgrade");
  const [planReason, setPlanReason] = useState("");

  // Packs
  const [activePacks, setActivePacks] = useState<TvAddon[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [pickedPack, setPickedPack] = useState("");
  const [packReason, setPackReason] = useState("");

  // VOD
  const [vodTitle, setVodTitle] = useState("");
  const [vodType, setVodType] = useState<"movie" | "event" | "ppv" | "series" | "rental">("movie");
  const [vodAmount, setVodAmount] = useState("");
  const [vodReason, setVodReason] = useState("");

  // Terminal
  const [terminalAction, setTerminalAction] = useState("");
  const [terminalSerial, setTerminalSerial] = useState("");
  const [terminalReason, setTerminalReason] = useState("");

  // Parental
  const [parentalEnabled, setParentalEnabled] = useState(false);
  const [maxRating, setMaxRating] = useState<typeof RATINGS[number]>("PG-13");
  const [parentalPin, setParentalPin] = useState("");
  const [blockedRaw, setBlockedRaw] = useState("");
  const [parentalReason, setParentalReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("plan");
    setPlanName(""); setPlanPrice(""); setPlanChangeType("upgrade"); setPlanReason("");
    setPickedPack(""); setPackReason("");
    setVodTitle(""); setVodType("movie"); setVodAmount(""); setVodReason("");
    setTerminalAction(""); setTerminalSerial(""); setTerminalReason("");
    setParentalPin(""); setBlockedRaw(""); setParentalReason("");
    setChannelNotes(""); setChannelReason("");
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "packs" || !clientUserId) return;
    setLoadingPacks(true);
    // F29-15 — scope reads by account when provided
    let q = supabase
      .from("tv_addon_subscriptions")
      .select("id,addon_code,addon_name,addon_type,monthly_price,status,created_at")
      .eq("user_id", clientUserId)
      .eq("status", "active");
    if (accountId) q = q.eq("account_id", accountId);
    q.order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Erreur chargement bouquets");
        setActivePacks((data as TvAddon[]) || []);
        setLoadingPacks(false);
      });
  }, [open, tab, clientUserId, accountId, busy]);

  useEffect(() => {
    if (!open || tab !== "channels" || !clientUserId) return;
    setLoadingChannels(true);
    (async () => {
      let selQ = supabase
        .from("channel_selections")
        .select("channels,status,created_at,account_id")
        .eq("user_id", clientUserId);
      if (accountId) selQ = selQ.eq("account_id", accountId);
      const [{ data: chans }, { data: sel }] = await Promise.all([
        supabase
          .from("tv_channels")
          .select("id,name,category,price,is_hd")
          .eq("is_active", true)
          .order("category", { ascending: true })
          .order("name", { ascending: true }),
        selQ.order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setCatalogChannels((chans as Ch[]) || []);
      const currentIds = new Set<string>();
      const list = Array.isArray(sel?.channels) ? sel!.channels as Array<{ id?: string }> : [];
      list.forEach((c) => { if (c.id) currentIds.add(c.id); });
      setSelectedChannelIds(currentIds);
      setLoadingChannels(false);
    })();
  }, [open, tab, clientUserId, accountId, busy]);

  useEffect(() => {
    if (!open || tab !== "parental" || !clientUserId) return;
    let q = supabase
      .from("tv_parental_controls")
      .select("enabled,max_rating,blocked_channels,account_id")
      .eq("user_id", clientUserId);
    if (accountId) q = q.eq("account_id", accountId);
    else q = q.is("account_id", null);
    q.maybeSingle().then(({ data }) => {
      if (!data) return;
      setParentalEnabled(!!data.enabled);
      setMaxRating((data.max_rating as typeof RATINGS[number]) || "PG-13");
      const list = Array.isArray(data.blocked_channels) ? data.blocked_channels : [];
      setBlockedRaw(list.join(", "));
    });
  }, [open, tab, clientUserId, accountId]);

  const invoke = async (action: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("tv-account-actions", {
        body: {
          action,
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          subscription_id: subscriptionId ?? null,
          idempotency_key: `tv-${action}-${clientUserId}-${sessionId}`,
          ...body,
        },
      });
      if (error) {
        const ctx = (error as any)?.context;
        let detail: string | undefined;
        try { detail = ctx ? await ctx.text() : undefined; } catch { /* */ }
        throw new Error(detail || error.message);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    } finally {
      setBusy(false);
    }
  };

  const doChangePlan = async () => {
    if (!planName) { toast.error("Choisissez un forfait"); return; }
    const price = parseFloat(planPrice);
    if (!Number.isFinite(price) || price < 0) { toast.error("Prix invalide"); return; }
    if (planReason.trim().length < 5) { toast.error("Motif requis (min. 5 caractères)"); return; }
    try {
      await invoke("change_plan", {
        previous_plan_name: currentPlanName ?? undefined,
        previous_monthly_price: currentMonthlyPrice ?? undefined,
        new_plan_name: planName,
        new_monthly_price: price,
        change_type: planChangeType,
        reason: planReason.trim(),
      });
      toast.success("Forfait TV mis à jour — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doAddPack = async () => {
    const p = bouquetCatalog.find((x) => x.id === pickedPack);
    if (!p) { toast.error("Choisissez un bouquet"); return; }
    if (packReason.trim().length < 5) { toast.error("Motif requis (min. 5 caractères)"); return; }
    try {
      await invoke("add_themed_pack", {
        pack_id: p.id,           // F29-9 canonical
        addon_name: p.name,      // fallback identification
        addon_type: p.category,
        monthly_price: p.price,
        reason: packReason.trim(),
      });
      toast.success(`Bouquet « ${p.name} » ajouté`);
      setPickedPack(""); setPackReason("");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doRemovePack = async (a: TvAddon) => {
    const reason = prompt(`Motif pour retirer « ${a.addon_name} » (min. 5 caractères) :`, "");
    if (!reason || reason.trim().length < 5) { toast.error("Motif requis (min. 5 caractères)"); return; }
    try {
      await invoke("remove_themed_pack", { addon_id: a.id, reason: reason.trim() });
      toast.success("Bouquet retiré");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doVod = async () => {
    if (!vodTitle.trim()) { toast.error("Titre requis"); return; }
    const amt = parseFloat(vodAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Montant invalide"); return; }
    if (vodReason.trim().length < 5) { toast.error("Motif requis (min. 5 caractères)"); return; }
    try {
      await invoke("purchase_vod", {
        title: vodTitle.trim(),
        content_type: vodType,
        amount: amt,
        currency: "CAD",
        payment_method: "on_invoice",
        reason: vodReason.trim(),
      });
      toast.success(`Achat « ${vodTitle} » enregistré — courriel envoyé`);
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doTerminal = async () => {
    if (!terminalAction) { toast.error("Choisissez une action"); return; }
    const meta = TERMINAL_ACTIONS.find((t) => t.value === terminalAction);
    const min = meta?.critical ? 10 : 5;
    if (terminalReason.trim().length < min) {
      toast.error(`Motif requis (min. ${min} caractères)`); return;
    }
    try {
      await invoke("terminal_action", {
        action_type: terminalAction,
        terminal_serial: terminalSerial || undefined,
        reason: terminalReason.trim(),
      });
      toast.success("Action terminal appliquée — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doSetChannels = async () => {
    const ids = Array.from(selectedChannelIds);
    if (ids.length === 0) { toast.error("Sélectionnez au moins une chaîne"); return; }
    if (channelReason.trim().length < 5) { toast.error("Motif requis (min. 5 caractères)"); return; }
    try {
      await invoke("set_channels", {
        channel_ids: ids,
        notes: channelNotes || undefined,
        reason: channelReason.trim(),
      });
      toast.success("Sélection de chaînes enregistrée — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doParental = async () => {
    const blocked = blockedRaw
      .split(",").map((s) => s.trim()).filter(Boolean);
    if (parentalPin && !/^\d{4,8}$/.test(parentalPin)) {
      toast.error("NIP : 4 à 8 chiffres"); return;
    }
    if (parentalReason.trim().length < 5) { toast.error("Motif requis (min. 5 caractères)"); return; }
    try {
      await invoke("set_parental", {
        enabled: parentalEnabled,
        max_rating: maxRating,
        pin: parentalPin || undefined,
        blocked_channels: blocked,
        reason: parentalReason.trim(),
      });
      toast.success("Contrôle parental mis à jour — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tv className="h-5 w-5 text-primary" />
            Gestion service TV
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Client : ${clientName}` : "Actions TV"}
            {currentPlanName ? ` · Forfait actuel : ${currentPlanName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="plan"><Tv className="h-4 w-4 mr-1" />Forfait</TabsTrigger>
            <TabsTrigger value="packs"><Layers className="h-4 w-4 mr-1" />Bouquets</TabsTrigger>
            <TabsTrigger value="channels"><ListChecks className="h-4 w-4 mr-1" />Chaînes</TabsTrigger>
            <TabsTrigger value="vod"><Film className="h-4 w-4 mr-1" />VOD</TabsTrigger>
            <TabsTrigger value="terminal"><MonitorSmartphone className="h-4 w-4 mr-1" />Terminal</TabsTrigger>
            <TabsTrigger value="parental"><ShieldCheck className="h-4 w-4 mr-1" />Parental</TabsTrigger>
          </TabsList>

          {/* ============ PLAN ============ */}
          <TabsContent value="plan" className="space-y-4 pt-4">
            <div>
              <Label>Nouveau forfait (catalogue Nivra)</Label>
              <Select
                value={planName}
                onValueChange={(v) => {
                  setPlanName(v);
                  const found = tvPlans.find((p) => p.name === v);
                  if (found) setPlanPrice(String(found.price));
                }}
                disabled={busy || loadingPlans}
              >
                <SelectTrigger><SelectValue placeholder={loadingPlans ? "Chargement…" : "Sélectionner un forfait…"} /></SelectTrigger>
                <SelectContent>
                  {tvPlans.length === 0 && !loadingPlans && (
                    <SelectItem value="__none" disabled>Aucun forfait TV actif dans le catalogue</SelectItem>
                  )}
                  {tvPlans.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name} — {fmt(p.price)}/mois
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan-price">Tarif mensuel</Label>
                <Input
                  id="plan-price"
                  type="number" min="0" step="0.01"
                  value={planPrice}
                  onChange={(e) => setPlanPrice(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={planChangeType} onValueChange={(v) => setPlanChangeType(v as typeof planChangeType)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upgrade">Mise à niveau</SelectItem>
                    <SelectItem value="downgrade">Rétrogradation</SelectItem>
                    <SelectItem value="lateral">Latéral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="plan-reason">Motif <span className="text-destructive">*</span></Label>
              <Textarea id="plan-reason" rows={2} value={planReason} onChange={(e) => setPlanReason(e.target.value)}
                placeholder="Min. 5 caractères" disabled={busy} />
            </div>
            <Button onClick={doChangePlan} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Tv className="h-4 w-4 mr-2" />}
              Appliquer le changement
            </Button>
          </TabsContent>

          {/* ============ PACKS ============ */}
          <TabsContent value="packs" className="space-y-4 pt-4">
            <div>
              <Label>Ajouter un bouquet (catalogue channel_packages)</Label>
              <div className="flex gap-2 mt-1">
                <Select value={pickedPack} onValueChange={setPickedPack} disabled={busy || loadingBouquets}>
                  <SelectTrigger><SelectValue placeholder={loadingBouquets ? "Chargement…" : "Sélectionner un bouquet…"} /></SelectTrigger>
                  <SelectContent>
                    {bouquetCatalog.length === 0 && !loadingBouquets && (
                      <SelectItem value="__none" disabled>Aucun bouquet actif</SelectItem>
                    )}
                    {bouquetCatalog.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {fmt(p.price)}/mois
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={doAddPack} disabled={busy || !pickedPack}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="pack-reason">Motif <span className="text-destructive">*</span></Label>
              <Textarea id="pack-reason" rows={2} value={packReason} onChange={(e) => setPackReason(e.target.value)}
                placeholder="Min. 5 caractères" disabled={busy} />
            </div>
            <Separator />
            <div>
              <Label className="mb-2 block">Bouquets actifs</Label>
              {loadingPacks ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : activePacks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  Aucun bouquet actif.
                </p>
              ) : (
                <ul className="space-y-2">
                  {activePacks.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{a.addon_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmt(Number(a.monthly_price))} / mois ·{" "}
                          <Badge variant="outline" className="text-[10px]">{a.addon_type}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => doRemovePack(a)} disabled={busy}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* ============ CHANNELS ============ */}
          <TabsContent value="channels" className="space-y-3 pt-4">
            <div className="flex items-center justify-between gap-2">
              <Input
                placeholder="Filtrer (nom ou catégorie)…"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                disabled={busy || loadingChannels}
                className="max-w-xs"
              />
              <div className="text-xs text-muted-foreground">
                {selectedChannelIds.size} sélectionnée(s) ·{" "}
                {fmt(
                  catalogChannels
                    .filter((c) => selectedChannelIds.has(c.id))
                    .reduce((s, c) => s + Number(c.price || 0), 0)
                )}{" "}
                / mois
              </div>
            </div>
            <div className="border rounded max-h-72 overflow-y-auto divide-y">
              {loadingChannels ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : catalogChannels.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Catalogue de chaînes vide.
                </p>
              ) : (
                catalogChannels
                  .filter((c) => {
                    const q = channelFilter.toLowerCase().trim();
                    if (!q) return true;
                    return c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
                  })
                  .map((c) => {
                    const checked = selectedChannelIds.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedChannelIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(c.id);
                                else next.delete(c.id);
                                return next;
                              });
                            }}
                            disabled={busy}
                          />
                          <span className="text-sm truncate">{c.name}</span>
                          {c.is_hd && <Badge variant="outline" className="text-[10px]">HD</Badge>}
                          <Badge variant="secondary" className="text-[10px]">{c.category}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Number(c.price) > 0 ? `${fmt(Number(c.price))} /mois` : "incluse"}
                        </span>
                      </label>
                    );
                  })
              )}
            </div>
            <div>
              <Label htmlFor="ch-notes">Note interne (optionnel)</Label>
              <Textarea
                id="ch-notes" rows={2}
                value={channelNotes}
                onChange={(e) => setChannelNotes(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="ch-reason">Motif <span className="text-destructive">*</span></Label>
              <Textarea id="ch-reason" rows={2} value={channelReason} onChange={(e) => setChannelReason(e.target.value)}
                placeholder="Min. 5 caractères" disabled={busy} />
            </div>
            <Button onClick={doSetChannels} disabled={busy || selectedChannelIds.size === 0} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ListChecks className="h-4 w-4 mr-2" />}
              Enregistrer la sélection
            </Button>
          </TabsContent>

          {/* ============ VOD ============ */}
          <TabsContent value="vod" className="space-y-4 pt-4">
            <div>
              <Label htmlFor="vod-title">Titre</Label>
              <Input
                id="vod-title" value={vodTitle}
                onChange={(e) => setVodTitle(e.target.value)}
                placeholder="ex: UFC 312 / Dune 2 / …"
                disabled={busy}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type de contenu</Label>
                <Select value={vodType} onValueChange={(v) => setVodType(v as typeof vodType)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="movie">Film</SelectItem>
                    <SelectItem value="event">Événement</SelectItem>
                    <SelectItem value="ppv">PPV</SelectItem>
                    <SelectItem value="series">Série</SelectItem>
                    <SelectItem value="rental">Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="vod-amount">Montant (CAD)</Label>
                <Input
                  id="vod-amount" type="number" min="0" step="0.01"
                  value={vodAmount} onChange={(e) => setVodAmount(e.target.value)}
                  placeholder="9.99"
                  disabled={busy}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="vod-reason">Motif <span className="text-destructive">*</span></Label>
              <Textarea id="vod-reason" rows={2} value={vodReason} onChange={(e) => setVodReason(e.target.value)}
                placeholder="Min. 5 caractères" disabled={busy} />
            </div>
            <p className="text-xs text-muted-foreground">
              Facturé sur la prochaine facture du client. Référence de paiement générée par le serveur.
            </p>
            <Button onClick={doVod} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Film className="h-4 w-4 mr-2" />}
              Enregistrer l'achat
            </Button>
          </TabsContent>

          {/* ============ TERMINAL ============ */}
          <TabsContent value="terminal" className="space-y-4 pt-4">
            <div>
              <Label>Action</Label>
              <Select value={terminalAction} onValueChange={setTerminalAction} disabled={busy}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {TERMINAL_ACTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.critical ? "⚠ " : ""}{a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="term-serial">Numéro de série (optionnel)</Label>
              <Input
                id="term-serial" value={terminalSerial}
                onChange={(e) => setTerminalSerial(e.target.value)}
                placeholder="ex: NIVRA-TV-…"
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="term-reason">
                Motif <span className="text-destructive">*</span>
                {" "}
                <span className="text-xs text-muted-foreground">
                  ({TERMINAL_ACTIONS.find((a) => a.value === terminalAction)?.critical ? "min. 10" : "min. 5"} caractères)
                </span>
              </Label>
              <Textarea
                id="term-reason" rows={2}
                value={terminalReason}
                onChange={(e) => setTerminalReason(e.target.value)}
                placeholder="Motif obligatoire"
                disabled={busy}
              />
            </div>
            <Button onClick={doTerminal} disabled={busy || !terminalAction} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Exécuter
            </Button>
          </TabsContent>

          {/* ============ PARENTAL ============ */}
          <TabsContent value="parental" className="space-y-4 pt-4">
            <div className="flex items-center justify-between p-3 rounded border bg-muted/30">
              <div>
                <Label className="block">Contrôle parental activé</Label>
                <p className="text-xs text-muted-foreground">
                  Bloque les contenus dépassant la classification.
                </p>
              </div>
              <Switch
                checked={parentalEnabled}
                onCheckedChange={setParentalEnabled}
                disabled={busy}
              />
            </div>
            <div>
              <Label>Classification maximale</Label>
              <Select value={maxRating} onValueChange={(v) => setMaxRating(v as typeof RATINGS[number])} disabled={busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RATINGS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="parental-pin">Nouveau NIP (4–8 chiffres, optionnel)</Label>
              <Input
                id="parental-pin" type="password" inputMode="numeric"
                value={parentalPin}
                onChange={(e) => setParentalPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Laisser vide pour ne pas changer"
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="parental-blocked">Chaînes bloquées (séparées par virgule)</Label>
              <Textarea
                id="parental-blocked" rows={2}
                value={blockedRaw}
                onChange={(e) => setBlockedRaw(e.target.value)}
                placeholder="ex: 301, 410, 555"
                disabled={busy}
              />
            </div>
            <div>
              <Label htmlFor="parental-reason">Motif <span className="text-destructive">*</span></Label>
              <Textarea id="parental-reason" rows={2} value={parentalReason} onChange={(e) => setParentalReason(e.target.value)}
                placeholder="Min. 5 caractères" disabled={busy} />
            </div>
            <Button onClick={doParental} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
