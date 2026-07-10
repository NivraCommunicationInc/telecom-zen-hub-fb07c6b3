/**
 * MobileServiceActionsDialog — Manage mobile line operations for a client.
 * Used in Nivra Core (Account 360) and Nivra OneView CS (Client 360).
 *
 * Module 30 hardened (F30-1 → F30-23):
 *   - All mutations go through `mobile-account-actions` (no direct writes).
 *   - Reads are scoped by (user_id, account_id).
 *   - Add-ons resolved from `mobile_addons_catalog` (server truth).
 *   - PayPal removed from payment methods.
 *   - Motifs mandatory (5/10 chars) — enforced client- and server-side.
 *   - Stable idempotency keys per intent (survive double-clicks).
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
import { Loader2, Smartphone, CreditCard, Plus, Trash2, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  accountId?: string | null;
  subscriptionId?: string | null;
  msisdn?: string | null;
}

interface Addon {
  id: string;
  addon_code: string;
  addon_name: string;
  addon_type: string;
  monthly_price: number;
  status: string;
  created_at: string;
}

interface CatalogEntry {
  id: string;
  addon_code: string;
  addon_name: string;
  addon_type: string;
  monthly_price: number;
  one_time_price: number;
  is_active: boolean;
  sort_order: number;
}

// F30-22 — mirrors server SIM_ACTION_LABELS
const SIM_ACTIONS: Array<{
  value: string; label: string; danger?: boolean; needsIccid?: boolean; critical?: boolean;
}> = [
  { value: "suspend_lost",          label: "Suspendre — SIM perdue", danger: true, critical: true },
  { value: "suspend_stolen",        label: "Suspendre — SIM volée",  danger: true, critical: true },
  { value: "suspend_other",         label: "Suspendre — autre raison", danger: true, critical: true },
  { value: "reactivate",            label: "Réactiver la ligne" },
  { value: "replace_sim",           label: "Remplacer la SIM physique", needsIccid: true, critical: true },
  { value: "swap_to_esim",          label: "Convertir vers eSIM", needsIccid: true },
  { value: "swap_to_physical",      label: "Convertir vers SIM physique", needsIccid: true },
  { value: "block_international",   label: "Bloquer les appels internationaux" },
  { value: "unblock_international", label: "Débloquer les appels internationaux" },
  { value: "block_roaming",         label: "Bloquer l'itinérance" },
  { value: "unblock_roaming",       label: "Débloquer l'itinérance" },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

// Stable intent hash for idempotency keys
const stableHash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

export function MobileServiceActionsDialog({
  open, onClose, clientUserId, clientName, accountId, subscriptionId, msisdn,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"topup" | "addons" | "sim">("topup");

  // Top-up
  const [amount, setAmount] = useState("25");
  const [method, setMethod] = useState("manual");
  const [topupRef, setTopupRef] = useState("");
  const [topupReason, setTopupReason] = useState("");

  // Add-ons
  const [activeAddons, setActiveAddons] = useState<Addon[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");

  // SIM
  const [simAction, setSimAction] = useState<string>("");
  const [newIccid, setNewIccid] = useState("");
  const [simReason, setSimReason] = useState("");

  const simMeta = useMemo(() => SIM_ACTIONS.find((s) => s.value === simAction), [simAction]);

  useEffect(() => {
    if (!open) return;
    setTab("topup");
    setAmount("25");
    setMethod("manual");
    setTopupRef("");
    setTopupReason("");
    setSelectedCatalogId("");
    setSimAction("");
    setNewIccid("");
    setSimReason("");
  }, [open]);

  // F30-4 — active add-ons scoped by (user_id, account_id)
  useEffect(() => {
    if (!open || tab !== "addons" || !clientUserId) return;
    setLoadingAddons(true);
    let q = supabase
      .from("mobile_addons")
      .select("id,addon_code,addon_name,addon_type,monthly_price,status,created_at")
      .eq("user_id", clientUserId)
      .eq("status", "active");
    if (accountId) q = q.eq("account_id", accountId);
    q.order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Erreur chargement options");
        setActiveAddons((data as Addon[]) || []);
        setLoadingAddons(false);
      });
  }, [open, tab, clientUserId, accountId, busy]);

  // F30-3 — catalogue serveur
  useEffect(() => {
    if (!open || tab !== "addons") return;
    setLoadingCatalog(true);
    supabase
      .from("mobile_addons_catalog")
      .select("id,addon_code,addon_name,addon_type,monthly_price,one_time_price,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("Erreur chargement catalogue");
        setCatalog((data as CatalogEntry[]) || []);
        setLoadingCatalog(false);
      });
  }, [open, tab]);

  const invoke = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("mobile-account-actions", {
        body: {
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          subscription_id: subscriptionId ?? null,
          msisdn: msisdn ?? null,
          ...body,
        },
      });
      if (error) throw error;
      const payload = data as { error?: string; error_code?: string };
      if (payload?.error) {
        const e: any = new Error(payload.error);
        e.code = payload.error_code;
        throw e;
      }
      return data;
    } finally {
      setBusy(false);
    }
  };

  const showErr = async (e: any) => {
    let msg = e?.message || "Erreur";
    try { const b = await (e?.context as Response)?.json?.(); if (b?.error) msg = b.error; } catch {}
    toast.error(msg);
  };

  const doTopup = async () => {
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) { toast.error("Montant invalide"); return; }
    try {
      await invoke({
        action: "topup",
        amount: num,
        currency: "CAD",
        payment_method: method,
        payment_reference: topupRef || undefined,
        reason: topupReason || undefined,
        idempotency_key: `topup:${clientUserId}:${accountId ?? "-"}:${num}:${method}:${stableHash(topupRef + "|" + topupReason)}`,
      });
      toast.success(`Recharge ${fmt(num)} appliquée — courriel envoyé`);
      onClose();
    } catch (e: any) { await showErr(e); }
  };

  const doAddAddon = async () => {
    if (!selectedCatalogId) { toast.error("Choisissez une option au catalogue"); return; }
    try {
      const res = await invoke({
        action: "add_addon",
        catalog_id: selectedCatalogId,
        idempotency_key: `addon-add:${clientUserId}:${accountId ?? "-"}:${selectedCatalogId}`,
      });
      const entry = catalog.find((c) => c.id === selectedCatalogId);
      toast.success(`Option « ${entry?.addon_name ?? "ajoutée"} »`);
      setSelectedCatalogId("");
      void res;
    } catch (e: any) { await showErr(e); }
  };

  const doRemoveAddon = async (addon: Addon) => {
    const reason = window.prompt(`Motif (min. 5 caractères) pour retirer « ${addon.addon_name} » ?`, "");
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) toast.error("Motif requis (min. 5 caractères)");
      return;
    }
    try {
      await invoke({
        action: "remove_addon",
        addon_id: addon.id,
        reason: reason.trim(),
        idempotency_key: `addon-remove:${clientUserId}:${addon.id}`,
      });
      toast.success("Option retirée");
    } catch (e: any) { await showErr(e); }
  };

  const doSimAction = async () => {
    if (!simAction) { toast.error("Choisissez une action SIM"); return; }
    if (!subscriptionId) { toast.error("Abonnement mobile requis"); return; }
    if (simMeta?.needsIccid && !/^\d{19,20}$/.test(newIccid.trim())) {
      toast.error("ICCID requis (19-20 chiffres)"); return;
    }
    const minMotif = simMeta?.critical ? 10 : (simMeta?.danger ? 10 : 5);
    if (!simReason || simReason.trim().length < minMotif) {
      toast.error(`Motif requis (min. ${minMotif} caractères)`); return;
    }
    try {
      await invoke({
        action: "sim_action",
        sim_action_type: simAction,
        new_iccid: newIccid ? newIccid.trim() : undefined,
        reason: simReason.trim(),
        idempotency_key: `sim:${clientUserId}:${subscriptionId}:${simAction}:${stableHash(newIccid + "|" + simReason)}`,
      });
      toast.success("Action SIM appliquée — courriel envoyé");
      onClose();
    } catch (e: any) { await showErr(e); }
  };

  const selectedEntry = catalog.find((c) => c.id === selectedCatalogId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Gestion ligne mobile
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Client : ${clientName}` : "Actions mobiles"}
            {msisdn ? ` · ${msisdn}` : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="topup"><CreditCard className="h-4 w-4 mr-1" />Recharge</TabsTrigger>
            <TabsTrigger value="addons"><Plus className="h-4 w-4 mr-1" />Options</TabsTrigger>
            <TabsTrigger value="sim"><ShieldAlert className="h-4 w-4 mr-1" />SIM</TabsTrigger>
          </TabsList>

          {/* ============ TOP-UP ============ */}
          <TabsContent value="topup" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="topup-amount">Montant (CAD)</Label>
                <Input
                  id="topup-amount"
                  type="number" min="1" max="500" step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <Label htmlFor="topup-method">Méthode</Label>
                <Select value={method} onValueChange={setMethod} disabled={busy}>
                  <SelectTrigger id="topup-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manuel (caisse / agent)</SelectItem>
                    <SelectItem value="cash">Comptant</SelectItem>
                    <SelectItem value="interac">Interac</SelectItem>
                    <SelectItem value="credit_card">Carte de crédit</SelectItem>
                    <SelectItem value="debit_card">Carte débit</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="adjustment">Ajustement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="topup-ref">
                Référence paiement {(method === "manual" || method === "cash") ? "(optionnel)" : ""}
              </Label>
              <Input
                id="topup-ref"
                value={topupRef}
                onChange={(e) => setTopupRef(e.target.value)}
                placeholder={(method === "manual" || method === "cash") ? "ex: REF-12345 (facultatif)" : "Généré automatiquement"}
                disabled={busy || !(method === "manual" || method === "cash")}
              />
              {!(method === "manual" || method === "cash") && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  La référence de paiement est générée par le serveur pour cette méthode.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="topup-reason">Note (optionnel)</Label>
              <Textarea
                id="topup-reason"
                rows={2}
                value={topupReason}
                onChange={(e) => setTopupReason(e.target.value)}
                disabled={busy}
              />
            </div>
            <Button onClick={doTopup} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Appliquer la recharge
            </Button>
          </TabsContent>

          {/* ============ ADD-ONS ============ */}
          <TabsContent value="addons" className="space-y-4 pt-4">
            {catalog.length === 0 && !loadingCatalog && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-300">
                Aucune option au catalogue serveur. Un administrateur doit d'abord peupler
                <code className="mx-1">mobile_addons_catalog</code>.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <div>
                <Label>Option au catalogue</Label>
                <Select
                  value={selectedCatalogId}
                  onValueChange={setSelectedCatalogId}
                  disabled={busy || loadingCatalog || catalog.length === 0}
                >
                  <SelectTrigger><SelectValue placeholder={loadingCatalog ? "Chargement…" : "Choisir une option…"} /></SelectTrigger>
                  <SelectContent>
                    {catalog.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.addon_name} — {fmt(Number(c.monthly_price))}/mois
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedEntry && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Type : <Badge variant="outline" className="text-[10px]">{selectedEntry.addon_type}</Badge>
                    {" "}· Code : <code>{selectedEntry.addon_code}</code>
                    {Number(selectedEntry.one_time_price) > 0 ? ` · Frais initial : ${fmt(Number(selectedEntry.one_time_price))}` : ""}
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <Button onClick={doAddAddon} disabled={busy || !selectedCatalogId}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Ajouter
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="mb-2 block">Options actives</Label>
              {loadingAddons ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : activeAddons.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">
                  Aucune option active.
                </p>
              ) : (
                <ul className="space-y-2">
                  {activeAddons.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{a.addon_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmt(Number(a.monthly_price))} / mois · <Badge variant="outline" className="text-[10px]">{a.addon_type}</Badge>
                        </div>
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => doRemoveAddon(a)}
                        disabled={busy}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* ============ SIM ============ */}
          <TabsContent value="sim" className="space-y-4 pt-4">
            <div>
              <Label htmlFor="sim-action">Action SIM</Label>
              <Select value={simAction} onValueChange={setSimAction} disabled={busy}>
                <SelectTrigger id="sim-action"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {SIM_ACTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.danger ? "⚠ " : ""}{s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {simMeta?.needsIccid && (
              <div>
                <Label htmlFor="new-iccid">Nouvel ICCID <span className="text-destructive">*</span></Label>
                <Input
                  id="new-iccid"
                  value={newIccid}
                  onChange={(e) => setNewIccid(e.target.value)}
                  placeholder="89… (19 ou 20 chiffres)"
                  disabled={busy}
                />
              </div>
            )}
            <div>
              <Label htmlFor="sim-reason">
                Motif <span className="text-destructive">*</span>
                {" "}
                <span className="text-[11px] text-muted-foreground">
                  (min. {simMeta?.critical || simMeta?.danger ? 10 : 5} caractères)
                </span>
              </Label>
              <Textarea
                id="sim-reason"
                rows={2}
                value={simReason}
                onChange={(e) => setSimReason(e.target.value)}
                placeholder="Motif obligatoire — journalisé dans l'audit"
                disabled={busy}
              />
            </div>
            <Button
              onClick={doSimAction}
              disabled={busy || !simAction || !subscriptionId}
              className="w-full"
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Appliquer l'action
            </Button>
            {!subscriptionId && (
              <p className="text-[11px] text-amber-400 text-center">
                Abonnement mobile requis pour les actions SIM.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
