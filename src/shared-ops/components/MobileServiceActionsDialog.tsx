/**
 * MobileServiceActionsDialog — Manage mobile line operations for a client.
 * Used in Nivra Core (Account 360) and Nivra OneView CS (Client 360).
 *
 * Tabs:
 *   - Recharge (top-up)
 *   - Options (add / remove add-ons)
 *   - SIM (suspend / replace / swap-eSIM / block intl-roaming)
 *
 * Every action goes through the `mobile-account-actions` edge function
 * which enforces staff role (admin/employee/supervisor/support/billing_admin/sales),
 * writes the domain row, logs to admin_audit_log, and queues a branded
 * client email through email_queue (Violet Bold).
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
import { Loader2, Smartphone, CreditCard, Plus, Trash2, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServicePlans } from "@/shared-ops/hooks/useServiceCatalog";

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

const ADDON_TYPES = [
  { value: "data",          label: "Data" },
  { value: "international", label: "International" },
  { value: "long_distance", label: "Longue distance" },
  { value: "roaming",       label: "Itinérance" },
  { value: "voicemail",     label: "Boîte vocale" },
  { value: "other",         label: "Autre" },
] as const;

const SIM_ACTIONS: Array<{ value: string; label: string; danger?: boolean; needsIccid?: boolean }> = [
  { value: "suspend_lost",          label: "Suspendre — SIM perdue", danger: true },
  { value: "suspend_stolen",        label: "Suspendre — SIM volée",  danger: true },
  { value: "suspend_other",         label: "Suspendre — autre raison", danger: true },
  { value: "reactivate",            label: "Réactiver la ligne" },
  { value: "replace_sim",           label: "Remplacer la SIM physique", needsIccid: true },
  { value: "swap_to_esim",          label: "Convertir vers eSIM", needsIccid: true },
  { value: "swap_to_physical",      label: "Convertir vers SIM physique", needsIccid: true },
  { value: "block_international",   label: "Bloquer les appels internationaux" },
  { value: "unblock_international", label: "Débloquer les appels internationaux" },
  { value: "block_roaming",         label: "Bloquer l'itinérance" },
  { value: "unblock_roaming",       label: "Débloquer l'itinérance" },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

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
  const [addonName, setAddonName] = useState("");
  const [addonType, setAddonType] = useState<string>("data");
  const [addonPrice, setAddonPrice] = useState("");

  // SIM
  const [simAction, setSimAction] = useState<string>("");
  const [newIccid, setNewIccid] = useState("");
  const [simReason, setSimReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("topup");
    setAmount("25");
    setTopupRef("");
    setTopupReason("");
    setPickedAddon("");
    setSimAction("");
    setNewIccid("");
    setSimReason("");
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "addons" || !clientUserId) return;
    setLoadingAddons(true);
    supabase
      .from("mobile_addons")
      .select("id,addon_code,addon_name,addon_type,monthly_price,status,created_at")
      .eq("user_id", clientUserId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Erreur chargement options");
        setActiveAddons((data as Addon[]) || []);
        setLoadingAddons(false);
      });
  }, [open, tab, clientUserId, busy]);

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
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    } finally {
      setBusy(false);
    }
  };

  const doTopup = async () => {
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Montant invalide");
      return;
    }
    try {
      await invoke({
        action: "topup",
        amount: num,
        currency: "CAD",
        payment_method: method,
        payment_reference: topupRef || undefined,
        reason: topupReason || undefined,
        idempotency_key: `topup-${clientUserId}-${Date.now()}`,
      });
      toast.success(`Recharge ${fmt(num)} appliquée — courriel envoyé`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doAddAddon = async () => {
    const a = ADDON_CATALOG.find((x) => x.code === pickedAddon);
    if (!a) {
      toast.error("Choisissez une option");
      return;
    }
    try {
      await invoke({
        action: "add_addon",
        addon_code: a.code,
        addon_name: a.name,
        addon_type: a.type,
        monthly_price: a.price,
        idempotency_key: `addon-${clientUserId}-${a.code}-${Date.now()}`,
      });
      toast.success(`Option « ${a.name} » ajoutée`);
      setPickedAddon("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doRemoveAddon = async (addon: Addon) => {
    if (!confirm(`Retirer l'option « ${addon.addon_name} » ?`)) return;
    try {
      await invoke({
        action: "remove_addon",
        addon_id: addon.id,
      });
      toast.success("Option retirée");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doSimAction = async () => {
    if (!simAction) {
      toast.error("Choisissez une action SIM");
      return;
    }
    const meta = SIM_ACTIONS.find((s) => s.value === simAction);
    if (meta?.needsIccid && !newIccid) {
      toast.error("Nouvel ICCID requis pour cette action");
      return;
    }
    if (meta?.danger && !simReason) {
      toast.error("Raison obligatoire pour les actions sensibles");
      return;
    }
    try {
      await invoke({
        action: "sim_action",
        sim_action_type: simAction,
        new_iccid: newIccid || undefined,
        reason: simReason || undefined,
        idempotency_key: `sim-${clientUserId}-${simAction}-${Date.now()}`,
      });
      toast.success("Action SIM appliquée — courriel envoyé");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

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
                  type="number" min="1" step="1"
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
                    <SelectItem value="interac">Interac</SelectItem>
                    <SelectItem value="credit_card">Carte de crédit</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="cash">Comptant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="topup-ref">Référence paiement (optionnel)</Label>
              <Input
                id="topup-ref"
                value={topupRef}
                onChange={(e) => setTopupRef(e.target.value)}
                placeholder="ex: REF-12345"
                disabled={busy}
              />
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
            <div>
              <Label>Ajouter une option</Label>
              <div className="flex gap-2 mt-1">
                <Select value={pickedAddon} onValueChange={setPickedAddon} disabled={busy}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une option…" /></SelectTrigger>
                  <SelectContent>
                    {ADDON_CATALOG.map((a) => (
                      <SelectItem key={a.code} value={a.code}>
                        {a.name} — {fmt(a.price)}/mois
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={doAddAddon} disabled={busy || !pickedAddon}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
            {SIM_ACTIONS.find((s) => s.value === simAction)?.needsIccid && (
              <div>
                <Label htmlFor="new-iccid">Nouvel ICCID</Label>
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
                Raison {SIM_ACTIONS.find((s) => s.value === simAction)?.danger && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="sim-reason"
                rows={2}
                value={simReason}
                onChange={(e) => setSimReason(e.target.value)}
                placeholder="Obligatoire pour les actions sensibles"
                disabled={busy}
              />
            </div>
            <Button onClick={doSimAction} disabled={busy || !simAction} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Appliquer l'action
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
