/**
 * TVServiceActionsDialog — Manage TV service for a client.
 * Used in Nivra Core (Account 360) and Nivra OneView CS (Client 360).
 *
 * Tabs:
 *   - Forfait    (change TV plan)
 *   - Bouquets   (add/remove themed bouquets: Sports, Cinéma, International, …)
 *   - VOD/PPV    (record a pay-per-view / video-on-demand purchase)
 *   - Terminal   (reboot / identify / factory reset / firmware push / deactivate)
 *   - Parental   (parental controls: rating / blocked channels / PIN)
 *
 * Every action goes through the `tv-account-actions` edge function which
 * enforces staff role, writes the domain row, logs to admin_audit_log, and
 * queues a branded client email through email_queue (Violet Bold).
 */
import { useEffect, useState } from "react";
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
  Loader2, Tv, Layers, Film, MonitorSmartphone, ShieldCheck, Plus, Trash2, RefreshCw,
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

const TERMINAL_ACTIONS: Array<{ value: string; label: string; danger?: boolean }> = [
  { value: "reboot",         label: "Redémarrer à distance" },
  { value: "identify",       label: "Identifier (clignoter LED)" },
  { value: "firmware_push",  label: "Forcer mise à jour micrologiciel" },
  { value: "factory_reset",  label: "Réinitialisation usine", danger: true },
  { value: "deactivate",     label: "Désactiver le terminal",  danger: true },
  { value: "reactivate",     label: "Réactiver le terminal" },
];

const RATINGS = ["G", "PG", "PG-13", "R", "NC-17", "adult_blocked"] as const;

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

export function TVServiceActionsDialog({
  open, onClose, clientUserId, clientName, accountId, subscriptionId,
  currentPlanName, currentMonthlyPrice,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"plan" | "packs" | "vod" | "terminal" | "parental">("plan");
  const { plans: tvPlans, loading: loadingPlans } = useServicePlans("TV", open);
  const { packs: bouquetCatalog, loading: loadingBouquets } = useChannelPackages(open);

  // Plan change
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planChangeType, setPlanChangeType] = useState<"upgrade" | "downgrade" | "lateral">("upgrade");

  // Packs
  const [activePacks, setActivePacks] = useState<TvAddon[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [pickedPack, setPickedPack] = useState("");

  // VOD
  const [vodTitle, setVodTitle] = useState("");
  const [vodType, setVodType] = useState<"movie" | "event" | "ppv" | "series" | "rental">("movie");
  const [vodAmount, setVodAmount] = useState("");

  // Terminal
  const [terminalAction, setTerminalAction] = useState("");
  const [terminalSerial, setTerminalSerial] = useState("");
  const [terminalReason, setTerminalReason] = useState("");

  // Parental
  const [parentalEnabled, setParentalEnabled] = useState(false);
  const [maxRating, setMaxRating] = useState<typeof RATINGS[number]>("PG-13");
  const [parentalPin, setParentalPin] = useState("");
  const [blockedRaw, setBlockedRaw] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("plan");
    setPlanName("");
    setPlanPrice("");
    setPlanChangeType("upgrade");
    setPickedPack("");
    setVodTitle("");
    setVodType("movie");
    setVodAmount("");
    setTerminalAction("");
    setTerminalSerial("");
    setTerminalReason("");
    setParentalPin("");
    setBlockedRaw("");
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "packs" || !clientUserId) return;
    setLoadingPacks(true);
    supabase
      .from("tv_addon_subscriptions")
      .select("id,addon_code,addon_name,addon_type,monthly_price,status,created_at")
      .eq("user_id", clientUserId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Erreur chargement bouquets");
        setActivePacks((data as TvAddon[]) || []);
        setLoadingPacks(false);
      });
  }, [open, tab, clientUserId, busy]);

  useEffect(() => {
    if (!open || tab !== "parental" || !clientUserId) return;
    supabase
      .from("tv_parental_controls")
      .select("enabled,max_rating,blocked_channels")
      .eq("user_id", clientUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setParentalEnabled(!!data.enabled);
        setMaxRating((data.max_rating as typeof RATINGS[number]) || "PG-13");
        const list = Array.isArray(data.blocked_channels) ? data.blocked_channels : [];
        setBlockedRaw(list.join(", "));
      });
  }, [open, tab, clientUserId]);

  const invoke = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("tv-account-actions", {
        body: {
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          subscription_id: subscriptionId ?? null,
          ...body,
        },
      });
      if (error) throw error;
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
    try {
      await invoke({
        action: "change_plan",
        previous_plan_name: currentPlanName ?? undefined,
        previous_monthly_price: currentMonthlyPrice ?? undefined,
        new_plan_name: planName,
        new_monthly_price: price,
        change_type: planChangeType,
        idempotency_key: `tvplan-${clientUserId}-${Date.now()}`,
      });
      toast.success("Forfait TV mis à jour — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doAddPack = async () => {
    const p = bouquetCatalog.find((x) => x.id === pickedPack);
    if (!p) { toast.error("Choisissez un bouquet"); return; }
    try {
      await invoke({
        action: "add_themed_pack",
        addon_code: `PACK_${p.category.toUpperCase()}_${p.id.slice(0, 8)}`,
        addon_name: p.name,
        addon_type: p.category,
        monthly_price: p.price,
        idempotency_key: `tvpack-${clientUserId}-${p.id}-${Date.now()}`,
      });
      toast.success(`Bouquet « ${p.name} » ajouté`);
      setPickedPack("");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doRemovePack = async (a: TvAddon) => {
    if (!confirm(`Retirer le bouquet « ${a.addon_name} » ?`)) return;
    try {
      await invoke({ action: "remove_themed_pack", addon_id: a.id });
      toast.success("Bouquet retiré");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doVod = async () => {
    if (!vodTitle.trim()) { toast.error("Titre requis"); return; }
    const amt = parseFloat(vodAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Montant invalide"); return; }
    try {
      await invoke({
        action: "purchase_vod",
        title: vodTitle.trim(),
        content_type: vodType,
        amount: amt,
        currency: "CAD",
        payment_method: "on_invoice",
        idempotency_key: `vod-${clientUserId}-${Date.now()}`,
      });
      toast.success(`Achat « ${vodTitle} » enregistré — courriel envoyé`);
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doTerminal = async () => {
    if (!terminalAction) { toast.error("Choisissez une action"); return; }
    const meta = TERMINAL_ACTIONS.find((t) => t.value === terminalAction);
    if (meta?.danger && !terminalReason) {
      toast.error("Raison obligatoire pour les actions sensibles");
      return;
    }
    try {
      await invoke({
        action: "terminal_action",
        action_type: terminalAction,
        terminal_serial: terminalSerial || undefined,
        reason: terminalReason || undefined,
        idempotency_key: `tvterm-${clientUserId}-${terminalAction}-${Date.now()}`,
      });
      toast.success("Action terminal appliquée — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doParental = async () => {
    const blocked = blockedRaw
      .split(",").map((s) => s.trim()).filter(Boolean);
    if (parentalPin && !/^\d{4,8}$/.test(parentalPin)) {
      toast.error("NIP : 4 à 8 chiffres"); return;
    }
    try {
      await invoke({
        action: "set_parental",
        enabled: parentalEnabled,
        max_rating: maxRating,
        pin: parentalPin || undefined,
        blocked_channels: blocked,
        idempotency_key: `tvparental-${clientUserId}-${Date.now()}`,
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="plan"><Tv className="h-4 w-4 mr-1" />Forfait</TabsTrigger>
            <TabsTrigger value="packs"><Layers className="h-4 w-4 mr-1" />Bouquets</TabsTrigger>
            <TabsTrigger value="vod"><Film className="h-4 w-4 mr-1" />VOD</TabsTrigger>
            <TabsTrigger value="terminal"><MonitorSmartphone className="h-4 w-4 mr-1" />Terminal</TabsTrigger>
            <TabsTrigger value="parental"><ShieldCheck className="h-4 w-4 mr-1" />Parental</TabsTrigger>
          </TabsList>

          {/* ============ PLAN ============ */}
          <TabsContent value="plan" className="space-y-4 pt-4">
            <div>
              <Label>Nouveau forfait</Label>
              <Select
                value={planName}
                onValueChange={(v) => {
                  setPlanName(v);
                  const found = PLAN_CATALOG.find((p) => p.name === v);
                  if (found) setPlanPrice(String(found.price));
                }}
                disabled={busy}
              >
                <SelectTrigger><SelectValue placeholder="Sélectionner un forfait…" /></SelectTrigger>
                <SelectContent>
                  {PLAN_CATALOG.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
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
            <Button onClick={doChangePlan} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Tv className="h-4 w-4 mr-2" />}
              Appliquer le changement
            </Button>
          </TabsContent>

          {/* ============ PACKS ============ */}
          <TabsContent value="packs" className="space-y-4 pt-4">
            <div>
              <Label>Ajouter un bouquet</Label>
              <div className="flex gap-2 mt-1">
                <Select value={pickedPack} onValueChange={setPickedPack} disabled={busy}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un bouquet…" /></SelectTrigger>
                  <SelectContent>
                    {PACK_CATALOG.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
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
            <p className="text-xs text-muted-foreground">
              Facturé sur la prochaine facture du client.
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
                      {a.danger ? "⚠ " : ""}{a.label}
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
                Raison{" "}
                {TERMINAL_ACTIONS.find((a) => a.value === terminalAction)?.danger && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Textarea
                id="term-reason" rows={2}
                value={terminalReason}
                onChange={(e) => setTerminalReason(e.target.value)}
                placeholder="Obligatoire pour les actions sensibles"
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
