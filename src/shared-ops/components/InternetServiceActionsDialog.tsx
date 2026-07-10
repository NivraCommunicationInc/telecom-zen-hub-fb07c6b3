/**
 * InternetServiceActionsDialog — Manage Internet service for a client.
 * Used in Nivra Core (Account 360) and Nivra OneView CS (Client 360).
 *
 * Tabs:
 *   - Forfait     (change Internet plan)
 *   - Modem       (reboot / identify / factory reset / firmware push / deactivate)
 *   - Diagnostic  (run line diagnostic, record results)
 *   - WiFi        (manage SSID, band, guest network)
 *   - IP statique (assign / release a static IP)
 *
 * Every action goes through the `internet-account-actions` edge function which
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
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Wifi, Router, Activity, Globe, Network,
} from "lucide-react";
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
  currentPlanName?: string | null;
  currentMonthlyPrice?: number | null;
  currentSpeedMbps?: number | null;
}

const MODEM_ACTIONS: Array<{ value: string; label: string; danger?: boolean }> = [
  { value: "reboot",         label: "Redémarrer à distance" },
  { value: "identify",       label: "Identifier (clignoter LED)" },
  { value: "firmware_push",  label: "Forcer mise à jour micrologiciel" },
  { value: "factory_reset",  label: "Réinitialisation usine", danger: true },
  { value: "deactivate",     label: "Désactiver le modem",     danger: true },
  { value: "reactivate",     label: "Réactiver le modem" },
];

const LINK_STATUSES = ["ok", "degraded", "down"] as const;

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

interface StaticIp {
  id: string;
  ip_address: string | null;
  monthly_price: number;
  status: string;
  created_at: string;
}

export function InternetServiceActionsDialog({
  open, onClose, clientUserId, clientName, accountId, subscriptionId,
  currentPlanName, currentMonthlyPrice, currentSpeedMbps,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"plan" | "modem" | "diag" | "wifi" | "ip">("plan");
  const { plans: internetPlans, loading: loadingPlans } = useServicePlans("Internet", open);

  // Plan
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [planSpeed, setPlanSpeed] = useState("");
  const [planChangeType, setPlanChangeType] = useState<"upgrade" | "downgrade" | "lateral">("upgrade");
  const [planReason, setPlanReason] = useState(""); // F28-1 / F27 motif

  // Modem
  const [modemAction, setModemAction] = useState("");
  const [modemSerial, setModemSerial] = useState("");
  const [modemMac, setModemMac] = useState("");
  const [modemReason, setModemReason] = useState("");

  // Diagnostic
  const [diagType, setDiagType] = useState<"full" | "link" | "speedtest" | "latency">("full");
  const [linkStatus, setLinkStatus] = useState<typeof LINK_STATUSES[number]>("ok");
  const [download, setDownload] = useState("");
  const [upload, setUpload] = useState("");
  const [latency, setLatency] = useState("");
  const [loss, setLoss] = useState("");
  const [diagNotes, setDiagNotes] = useState("");

  // WiFi
  const [ssid24, setSsid24] = useState("");
  const [ssid5, setSsid5] = useState("");
  const [bandMode, setBandMode] = useState<"2.4" | "5" | "dual">("dual");
  const [guestEnabled, setGuestEnabled] = useState(false);
  const [guestSsid, setGuestSsid] = useState("");
  const [guestPwd, setGuestPwd] = useState("");

  // Static IP
  const [ipMode, setIpMode] = useState<"assign" | "release">("assign");
  const [ipAddr, setIpAddr] = useState("");
  const [ipPrice, setIpPrice] = useState("9.99");
  const [ipReason, setIpReason] = useState("");
  const [activeIp, setActiveIp] = useState<StaticIp | null>(null);

  // F28-15 — stable idempotency keys per dialog open
  const [idemPlan, setIdemPlan] = useState("");
  const [idemModem, setIdemModem] = useState("");
  const [idemDiag, setIdemDiag] = useState("");
  const [idemWifi, setIdemWifi] = useState("");
  const [idemIp, setIdemIp] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("plan");
    setPlanName(""); setPlanPrice(""); setPlanSpeed(""); setPlanChangeType("upgrade"); setPlanReason("");
    setModemAction(""); setModemSerial(""); setModemMac(""); setModemReason("");
    setDiagType("full"); setLinkStatus("ok"); setDownload(""); setUpload("");
    setLatency(""); setLoss(""); setDiagNotes("");
    setIpAddr(""); setIpPrice("9.99"); setIpReason(""); setIpMode("assign");
    setIdemPlan(`inetplan-${crypto.randomUUID()}`);
    setIdemModem(`inetmodem-${crypto.randomUUID()}`);
    setIdemDiag(`inetdiag-${crypto.randomUUID()}`);
    setIdemWifi(`inetwifi-${crypto.randomUUID()}`);
    setIdemIp(`inetip-${crypto.randomUUID()}`);
  }, [open]);

  // Load WiFi current
  useEffect(() => {
    if (!open || tab !== "wifi" || !clientUserId) return;
    // F28-11 — scope by (user_id, account_id) so multi-compte ne bavent pas
    let q = supabase
      .from("internet_wifi_settings")
      .select("ssid_24,ssid_5,band_mode,guest_enabled,guest_ssid")
      .eq("user_id", clientUserId);
    q = accountId ? q.eq("account_id", accountId) : q.is("account_id", null);
    q.maybeSingle().then(({ data }) => {
      if (!data) return;
      setSsid24(data.ssid_24 || "");
      setSsid5(data.ssid_5 || "");
      setBandMode((data.band_mode as "2.4" | "5" | "dual") || "dual");
      setGuestEnabled(!!data.guest_enabled);
      setGuestSsid(data.guest_ssid || "");
    });
  }, [open, tab, clientUserId, accountId]);

  // Load static IP (scoped by account_id)
  useEffect(() => {
    if (!open || tab !== "ip" || !clientUserId) return;
    let q = supabase
      .from("internet_static_ip_assignments")
      .select("id,ip_address,monthly_price,status,created_at")
      .eq("user_id", clientUserId)
      .eq("status", "active");
    q = accountId ? q.eq("account_id", accountId) : q.is("account_id", null);
    q.order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setActiveIp((data as StaticIp) || null);
        if (data) setIpMode("release");
      });
  }, [open, tab, clientUserId, accountId, busy]);

  const invoke = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("internet-account-actions", {
        body: {
          client_user_id: clientUserId,
          account_id: accountId ?? null,
          subscription_id: subscriptionId ?? null,
          ...body,
        },
      });
      if (error) throw error;
      const anyData = data as { error?: string; error_code?: string };
      if (anyData?.error) throw new Error(anyData.error);
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
    const speed = parseInt(planSpeed || "0", 10) || undefined;
    try {
      await invoke({
        action: "change_plan",
        previous_plan_name: currentPlanName ?? undefined,
        previous_monthly_price: currentMonthlyPrice ?? undefined,
        previous_speed_mbps: currentSpeedMbps ?? undefined,
        new_plan_name: planName,
        new_monthly_price: price,
        new_speed_mbps: speed,
        change_type: planChangeType,
        reason: planReason.trim(),
        idempotency_key: idemPlan,
      });
      toast.success("Forfait Internet mis à jour — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doModem = async () => {
    if (!modemAction) { toast.error("Choisissez une action"); return; }
    const meta = MODEM_ACTIONS.find((m) => m.value === modemAction);
    // F28-9 — critical actions require 10 chars, others (reboot) 5
    const minChars = meta?.danger ? 10 : (modemAction === "reboot" ? 5 : 0);
    if (minChars > 0 && modemReason.trim().length < minChars) {
      toast.error(`Motif requis (min. ${minChars} caractères)`);
      return;
    }
    try {
      await invoke({
        action: "modem_action",
        action_type: modemAction,
        modem_serial: modemSerial || undefined,
        modem_mac: modemMac || undefined,
        reason: modemReason || undefined,
        idempotency_key: idemModem,
      });
      toast.success("Action modem appliquée — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doDiag = async () => {
    const num = (s: string) => (s === "" ? undefined : Number(s));
    try {
      await invoke({
        action: "run_diagnostic",
        diagnostic_type: diagType,
        link_status: linkStatus,
        download_mbps: num(download),
        upload_mbps: num(upload),
        latency_ms: num(latency),
        packet_loss_pct: num(loss),
        notes: diagNotes || undefined,
        idempotency_key: idemDiag,
      });
      toast.success("Diagnostic enregistré — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doWifi = async () => {
    try {
      await invoke({
        action: "set_wifi",
        ssid_24: ssid24 || undefined,
        ssid_5: ssid5 || undefined,
        band_mode: bandMode,
        guest_enabled: guestEnabled,
        guest_ssid: guestEnabled ? (guestSsid || undefined) : undefined,
        guest_password_hint: guestEnabled ? (guestPwd || undefined) : undefined,
        idempotency_key: idemWifi,
      });
      toast.success("Configuration WiFi enregistrée — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doStaticIp = async () => {
    if (ipReason.trim().length < 5) { toast.error("Motif requis (min. 5 caractères)"); return; }
    try {
      if (ipMode === "release") {
        if (!activeIp) { toast.error("Aucune IP active à libérer"); return; }
        await invoke({
          action: "set_static_ip",
          static_ip_mode: "release",
          assignment_id: activeIp.id,
          reason: ipReason.trim(),
          idempotency_key: idemIp,
        });
        toast.success("IP statique libérée — courriel envoyé");
      } else {
        const price = parseFloat(ipPrice);
        if (!Number.isFinite(price) || price < 0) { toast.error("Prix invalide"); return; }
        await invoke({
          action: "set_static_ip",
          static_ip_mode: "assign",
          ip_address: ipAddr.trim(),
          monthly_price: price,
          reason: ipReason.trim(),
          idempotency_key: idemIp,
        });
        toast.success("IP statique attribuée — courriel envoyé");
      }
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Gestion service Internet
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Client : ${clientName}` : "Actions Internet"}
            {currentPlanName ? ` · Forfait actuel : ${currentPlanName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="plan"><Wifi className="h-4 w-4 mr-1" />Forfait</TabsTrigger>
            <TabsTrigger value="modem"><Router className="h-4 w-4 mr-1" />Modem</TabsTrigger>
            <TabsTrigger value="diag"><Activity className="h-4 w-4 mr-1" />Diagnostic</TabsTrigger>
            <TabsTrigger value="wifi"><Network className="h-4 w-4 mr-1" />WiFi</TabsTrigger>
            <TabsTrigger value="ip"><Globe className="h-4 w-4 mr-1" />IP statique</TabsTrigger>
          </TabsList>

          {/* ============ PLAN ============ */}
          <TabsContent value="plan" className="space-y-4 pt-4">
            <div>
              <Label>Nouveau forfait (catalogue Nivra)</Label>
              <Select
                value={planName}
                onValueChange={(v) => {
                  setPlanName(v);
                  const found = internetPlans.find((p) => p.name === v);
                  if (found) {
                    setPlanPrice(String(found.price));
                    // Extract Mbps from plan name when available (eg "Internet 500 Mbps")
                    const m = found.name.match(/(\d+)\s*(Mbps|Gbps|Giga|G)/i);
                    if (m) {
                      const n = parseInt(m[1], 10);
                      const unit = (m[2] || "").toLowerCase();
                      setPlanSpeed(String(unit.startsWith("g") ? n * 1000 : n));
                    }
                  }
                }}
                disabled={busy || loadingPlans}
              >
                <SelectTrigger><SelectValue placeholder={loadingPlans ? "Chargement…" : "Sélectionner un forfait…"} /></SelectTrigger>
                <SelectContent>
                  {internetPlans.length === 0 && !loadingPlans && (
                    <SelectItem value="__none" disabled>Aucun forfait Internet actif</SelectItem>
                  )}
                  {internetPlans.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name} — {fmt(p.price)}/mois
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="plan-price">Tarif mensuel</Label>
                <Input id="plan-price" type="number" min="0" step="0.01"
                  value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label htmlFor="plan-speed">Vitesse (Mbps)</Label>
                <Input id="plan-speed" type="number" min="0" step="1"
                  value={planSpeed} onChange={(e) => setPlanSpeed(e.target.value)} disabled={busy} />
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
              <Label htmlFor="plan-reason">Motif (obligatoire, min. 5 caractères)</Label>
              <Textarea id="plan-reason" rows={2} value={planReason} onChange={(e) => setPlanReason(e.target.value)} disabled={busy} placeholder="Ex: demande client, upsell, correction contractuelle…" />
            </div>
            <Button onClick={doChangePlan} disabled={busy || planReason.trim().length < 5} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wifi className="h-4 w-4 mr-2" />}
              Appliquer le changement
            </Button>
          </TabsContent>

          {/* ============ MODEM ============ */}
          <TabsContent value="modem" className="space-y-4 pt-4">
            <div>
              <Label>Action</Label>
              <Select value={modemAction} onValueChange={setModemAction} disabled={busy}>
                <SelectTrigger><SelectValue placeholder="Choisir une action…" /></SelectTrigger>
                <SelectContent>
                  {MODEM_ACTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}{a.danger ? " ⚠️" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="modem-serial">N° de série</Label>
                <Input id="modem-serial" value={modemSerial} onChange={(e) => setModemSerial(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label htmlFor="modem-mac">Adresse MAC</Label>
                <Input id="modem-mac" value={modemMac} onChange={(e) => setModemMac(e.target.value)} disabled={busy} placeholder="AA:BB:CC:DD:EE:FF" />
              </div>
            </div>
            <div>
              <Label htmlFor="modem-reason">Raison (obligatoire si action sensible)</Label>
              <Textarea id="modem-reason" rows={2} value={modemReason} onChange={(e) => setModemReason(e.target.value)} disabled={busy} />
            </div>
            <Button onClick={doModem} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Router className="h-4 w-4 mr-2" />}
              Appliquer l'action
            </Button>
          </TabsContent>

          {/* ============ DIAGNOSTIC ============ */}
          <TabsContent value="diag" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={diagType} onValueChange={(v) => setDiagType(v as typeof diagType)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Complet</SelectItem>
                    <SelectItem value="link">Lien</SelectItem>
                    <SelectItem value="speedtest">Test de vitesse</SelectItem>
                    <SelectItem value="latency">Latence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>État du lien</Label>
                <Select value={linkStatus} onValueChange={(v) => setLinkStatus(v as typeof linkStatus)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LINK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Téléchargement (Mbps)</Label>
                <Input type="number" min="0" step="0.01" value={download} onChange={(e) => setDownload(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label>Téléversement (Mbps)</Label>
                <Input type="number" min="0" step="0.01" value={upload} onChange={(e) => setUpload(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label>Latence (ms)</Label>
                <Input type="number" min="0" step="0.1" value={latency} onChange={(e) => setLatency(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label>Perte de paquets (%)</Label>
                <Input type="number" min="0" max="100" step="0.1" value={loss} onChange={(e) => setLoss(e.target.value)} disabled={busy} />
              </div>
            </div>
            <div>
              <Label htmlFor="diag-notes">Notes</Label>
              <Textarea id="diag-notes" rows={2} value={diagNotes} onChange={(e) => setDiagNotes(e.target.value)} disabled={busy} />
            </div>
            <Button onClick={doDiag} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
              Enregistrer le diagnostic
            </Button>
          </TabsContent>

          {/* ============ WIFI ============ */}
          <TabsContent value="wifi" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>SSID 2,4 GHz</Label>
                <Input value={ssid24} onChange={(e) => setSsid24(e.target.value)} disabled={busy} placeholder="Nivra-Maison" />
              </div>
              <div>
                <Label>SSID 5 GHz</Label>
                <Input value={ssid5} onChange={(e) => setSsid5(e.target.value)} disabled={busy} placeholder="Nivra-Maison-5G" />
              </div>
            </div>
            <div>
              <Label>Bande</Label>
              <Select value={bandMode} onValueChange={(v) => setBandMode(v as typeof bandMode)} disabled={busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dual">Double bande</SelectItem>
                  <SelectItem value="2.4">2,4 GHz seulement</SelectItem>
                  <SelectItem value="5">5 GHz seulement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="text-sm font-medium">Réseau invité</p>
                <p className="text-xs text-muted-foreground">SSID séparé pour les invités</p>
              </div>
              <Switch checked={guestEnabled} onCheckedChange={setGuestEnabled} disabled={busy} />
            </div>
            {guestEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SSID invité</Label>
                  <Input value={guestSsid} onChange={(e) => setGuestSsid(e.target.value)} disabled={busy} />
                </div>
                <div>
                  <Label>Indice mot de passe</Label>
                  <Input value={guestPwd} onChange={(e) => setGuestPwd(e.target.value)} disabled={busy} />
                </div>
              </div>
            )}
            <Button onClick={doWifi} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Network className="h-4 w-4 mr-2" />}
              Enregistrer la configuration
            </Button>
          </TabsContent>

          {/* ============ STATIC IP ============ */}
          <TabsContent value="ip" className="space-y-4 pt-4">
            {activeIp ? (
              <div className="rounded border bg-muted/30 p-3 text-sm">
                <div className="font-medium">IP statique active</div>
                <div className="text-muted-foreground">
                  {activeIp.ip_address} · {fmt(Number(activeIp.monthly_price ?? 0))}/mois
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune IP statique active.</p>
            )}

            <div>
              <Label>Action</Label>
              <Select value={ipMode} onValueChange={(v) => setIpMode(v as typeof ipMode)} disabled={busy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assign">Attribuer une IP statique</SelectItem>
                  <SelectItem value="release" disabled={!activeIp}>Libérer l'IP active</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {ipMode === "assign" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ip-addr">Adresse IPv4</Label>
                  <Input id="ip-addr" value={ipAddr} onChange={(e) => setIpAddr(e.target.value)}
                    placeholder="203.0.113.42" disabled={busy} />
                </div>
                <div>
                  <Label htmlFor="ip-price">Tarif mensuel</Label>
                  <Input id="ip-price" type="number" min="0" step="0.01"
                    value={ipPrice} onChange={(e) => setIpPrice(e.target.value)} disabled={busy} />
                </div>
              </div>
            ) : null}

            <div>
              <Label htmlFor="ip-reason">Motif (obligatoire, min. 5 caractères)</Label>
              <Textarea id="ip-reason" rows={2} value={ipReason} onChange={(e) => setIpReason(e.target.value)} disabled={busy} placeholder="Ex: demande client, activation service pro…" />
            </div>

            <Button onClick={doStaticIp} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
              {ipMode === "assign" ? "Attribuer l'IP statique" : "Libérer l'IP active"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
