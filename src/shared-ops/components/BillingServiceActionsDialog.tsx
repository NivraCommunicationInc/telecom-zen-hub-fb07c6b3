/**
 * BillingServiceActionsDialog — Manage billing for a client.
 * Used in Nivra Core (Account 360) and Nivra OneView CS (Client 360).
 *
 * Tabs:
 *   - Méthodes   (add/remove/default payment methods)
 *   - Auto-pay   (enable/disable + select method)
 *   - Plan       (installment payment plan — billing_admin/admin/supervisor)
 *   - Préfs      (cycle day, format, language, billing email)
 *   - Remb.      (direct refund — billing_admin/admin/supervisor)
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, CreditCard, RefreshCw, CalendarClock, Settings2, Wallet, Plus, Trash2, Star, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CoreAutopayPanel } from "@/core-app/components/account-360/CoreAutopayPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  accountId?: string | null;
  /** Square billing customer ID — enables the "Square PPA" tab. */
  customerId?: string | null;
}

interface PaymentMethod {
  id: string;
  method_type: string;
  brand: string | null;
  last4: string | null;
  paypal_email: string | null;
  is_default: boolean;
  status: string;
  created_at: string;
}

const METHOD_TYPES = [
  { value: "paypal",      label: "PayPal" },
  { value: "visa",        label: "Carte Visa" },
  { value: "mastercard",  label: "Carte Mastercard" },
  { value: "interac",     label: "Débit Interac" },
  { value: "bank_account", label: "Compte bancaire" },
] as const;

const REFUND_METHODS = [
  { value: "paypal",         label: "PayPal" },
  { value: "interac",        label: "Virement Interac" },
  { value: "credit_balance", label: "Crédit sur compte" },
  { value: "cheque",         label: "Chèque" },
  { value: "bank_transfer",  label: "Virement bancaire" },
] as const;

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

export function BillingServiceActionsDialog({
  open, onClose, clientUserId, clientName, accountId, customerId,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"square" | "methods" | "autopay" | "plan" | "prefs" | "refund">(customerId ? "square" : "methods");

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);

  // Add method
  const [newType, setNewType] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newLast4, setNewLast4] = useState("");
  const [newPaypalEmail, setNewPaypalEmail] = useState("");
  const [newHolder, setNewHolder] = useState("");
  const [newDefault, setNewDefault] = useState(false);

  // Autopay
  const [autopayOn, setAutopayOn] = useState(false);
  const [autopayMethod, setAutopayMethod] = useState("");
  const [autopayOffset, setAutopayOffset] = useState("0");
  const [autopayReason, setAutopayReason] = useState("");

  // Plan
  const [planTotal, setPlanTotal] = useState("");
  const [planCount, setPlanCount] = useState("3");
  const [planFreq, setPlanFreq] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [planFirst, setPlanFirst] = useState(() => new Date().toISOString().slice(0, 10));
  const [planReason, setPlanReason] = useState("");

  // Prefs
  const [prefDay, setPrefDay] = useState("1");
  const [prefFormat, setPrefFormat] = useState<"electronic" | "paper">("electronic");
  const [prefLang, setPrefLang] = useState<"fr" | "en">("fr");
  const [prefEmail, setPrefEmail] = useState("");
  const [prefAddr, setPrefAddr] = useState("");

  // Refund
  const [refAmount, setRefAmount] = useState("");
  const [refMethod, setRefMethod] = useState("");
  const [refExt, setRefExt] = useState("");
  const [refReason, setRefReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab(customerId ? "square" : "methods");
    setNewType(""); setNewBrand(""); setNewLast4(""); setNewPaypalEmail("");
    setNewHolder(""); setNewDefault(false);
    setAutopayReason("");
    setPlanTotal(""); setPlanCount("3"); setPlanFreq("monthly");
    setPlanFirst(new Date().toISOString().slice(0, 10)); setPlanReason("");
    setPrefEmail(""); setPrefAddr("");
    setRefAmount(""); setRefMethod(""); setRefExt(""); setRefReason("");
  }, [open]);

  // Load methods
  useEffect(() => {
    if (!open || !clientUserId) return;
    setLoadingMethods(true);
    supabase
      .from("client_payment_methods")
      .select("id,method_type,brand,last4,paypal_email,is_default,status,created_at")
      .eq("user_id", clientUserId)
      .eq("status", "active")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Erreur chargement méthodes");
        setMethods((data as PaymentMethod[]) || []);
        setLoadingMethods(false);
      });
  }, [open, clientUserId, busy]);

  // Load autopay
  useEffect(() => {
    if (!open || tab !== "autopay" || !clientUserId) return;
    supabase.from("client_autopay_settings")
      .select("enabled,payment_method_id,charge_day_offset")
      .eq("user_id", clientUserId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setAutopayOn(!!data.enabled);
        setAutopayMethod(data.payment_method_id || "");
        setAutopayOffset(String(data.charge_day_offset ?? 0));
      });
  }, [open, tab, clientUserId]);

  // Load prefs
  useEffect(() => {
    if (!open || tab !== "prefs" || !clientUserId) return;
    supabase.from("client_billing_settings")
      .select("billing_day_of_month,delivery_format,language,email_for_billing,paper_mailing_address")
      .eq("user_id", clientUserId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPrefDay(String(data.billing_day_of_month ?? 1));
        setPrefFormat((data.delivery_format as "electronic" | "paper") || "electronic");
        setPrefLang((data.language as "fr" | "en") || "fr");
        setPrefEmail(data.email_for_billing || "");
        setPrefAddr(data.paper_mailing_address || "");
      });
  }, [open, tab, clientUserId]);

  const invoke = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-account-actions", {
        body: { client_user_id: clientUserId, account_id: accountId ?? null, ...body },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    } finally { setBusy(false); }
  };

  const doAddMethod = async () => {
    if (!newType) { toast.error("Type de méthode requis"); return; }
    if (newType === "paypal" && !newPaypalEmail) { toast.error("Courriel PayPal requis"); return; }
    if (newType !== "paypal" && newType !== "bank_account" && !newLast4) {
      toast.error("4 derniers chiffres requis"); return;
    }
    if (newLast4 && !/^\d{4}$/.test(newLast4)) { toast.error("4 derniers chiffres : exactement 4 chiffres"); return; }
    try {
      await invoke({
        action: "add_payment_method",
        method_type: newType,
        brand: newBrand || undefined,
        last4: newLast4 || undefined,
        paypal_email: newPaypalEmail || undefined,
        holder_name: newHolder || undefined,
        is_default: newDefault,
        idempotency_key: `pm-${clientUserId}-${Date.now()}`,
      });
      toast.success("Méthode ajoutée — courriel envoyé");
      setNewType(""); setNewBrand(""); setNewLast4(""); setNewPaypalEmail("");
      setNewHolder(""); setNewDefault(false);
    } catch (e) { toast.error((e as Error).message); }
  };

  const doRemoveMethod = async (m: PaymentMethod) => {
    if (!confirm(`Retirer cette méthode (${m.method_type}${m.last4 ? " •••• " + m.last4 : ""}) ?`)) return;
    try {
      await invoke({ action: "remove_payment_method", method_id: m.id });
      toast.success("Méthode retirée — courriel envoyé");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doSetDefault = async (m: PaymentMethod) => {
    try {
      await invoke({ action: "set_default_method", method_id: m.id });
      toast.success("Méthode par défaut mise à jour — courriel envoyé");
    } catch (e) { toast.error((e as Error).message); }
  };

  const doAutopay = async () => {
    if (autopayOn && !autopayMethod) { toast.error("Choisissez une méthode pour l'auto-pay"); return; }
    try {
      await invoke({
        action: "toggle_autopay",
        enabled: autopayOn,
        payment_method_id: autopayOn ? autopayMethod : null,
        charge_day_offset: parseInt(autopayOffset, 10) || 0,
        reason: autopayReason || undefined,
      });
      toast.success(autopayOn ? "Auto-pay activé — courriel envoyé" : "Auto-pay désactivé — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doPlan = async () => {
    const total = parseFloat(planTotal);
    const count = parseInt(planCount, 10);
    if (!Number.isFinite(total) || total <= 0) { toast.error("Montant total invalide"); return; }
    if (!Number.isInteger(count) || count < 2 || count > 24) { toast.error("Versements : 2-24"); return; }
    if (!planReason.trim()) { toast.error("Raison obligatoire"); return; }
    try {
      await invoke({
        action: "create_payment_plan",
        total_amount: total,
        installment_count: count,
        frequency: planFreq,
        first_due_date: planFirst,
        reason: planReason.trim(),
        idempotency_key: `plan-${clientUserId}-${Date.now()}`,
      });
      toast.success("Plan de paiement créé — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doPrefs = async () => {
    const day = parseInt(prefDay, 10);
    if (!Number.isInteger(day) || day < 1 || day > 28) { toast.error("Jour : 1-28"); return; }
    try {
      await invoke({
        action: "update_billing_settings",
        billing_day_of_month: day,
        delivery_format: prefFormat,
        language: prefLang,
        email_for_billing: prefEmail || undefined,
        paper_mailing_address: prefFormat === "paper" ? (prefAddr || undefined) : undefined,
      });
      toast.success("Préférences enregistrées — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doRefund = async () => {
    const amount = parseFloat(refAmount);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Montant invalide"); return; }
    if (!refMethod) { toast.error("Méthode de remboursement requise"); return; }
    if (!refReason.trim() || refReason.trim().length < 5) { toast.error("Raison détaillée requise (min 5 car.)"); return; }
    if (!confirm(`Confirmer le remboursement direct de ${fmt(amount)} ?`)) return;
    try {
      await invoke({
        action: "create_direct_refund",
        amount,
        refund_method: refMethod,
        external_reference: refExt || undefined,
        reason: refReason.trim(),
        idempotency_key: `refund-${clientUserId}-${Date.now()}`,
      });
      toast.success("Remboursement enregistré — courriel envoyé");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
  };

  const methodLabel = (m: PaymentMethod) => {
    const base = METHOD_TYPES.find((t) => t.value === m.method_type)?.label || m.method_type;
    if (m.method_type === "paypal") return `${base} — ${m.paypal_email || "—"}`;
    return `${base}${m.last4 ? " •••• " + m.last4 : ""}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Gestion facturation
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Client : ${clientName}` : "Actions facturation"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="methods"><CreditCard className="h-4 w-4 mr-1" />Méthodes</TabsTrigger>
            <TabsTrigger value="autopay"><RefreshCw className="h-4 w-4 mr-1" />Auto-pay</TabsTrigger>
            <TabsTrigger value="plan"><CalendarClock className="h-4 w-4 mr-1" />Plan</TabsTrigger>
            <TabsTrigger value="prefs"><Settings2 className="h-4 w-4 mr-1" />Préfs</TabsTrigger>
            <TabsTrigger value="refund"><Wallet className="h-4 w-4 mr-1" />Remb.</TabsTrigger>
          </TabsList>

          {/* ===== METHODS ===== */}
          <TabsContent value="methods" className="space-y-4 pt-4">
            <div>
              <Label className="mb-2 block">Méthodes actives</Label>
              {loadingMethods ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : methods.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">Aucune méthode enregistrée.</p>
              ) : (
                <ul className="space-y-2">
                  {methods.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate flex items-center gap-2">
                          {methodLabel(m)}
                          {m.is_default && <Badge variant="default" className="text-[10px]">Défaut</Badge>}
                        </div>
                      </div>
                      {!m.is_default && (
                        <Button size="sm" variant="ghost" onClick={() => doSetDefault(m)} disabled={busy} title="Définir par défaut">
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => doRemoveMethod(m)} disabled={busy}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Separator />
            <div className="space-y-3">
              <Label>Ajouter une méthode</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select value={newType} onValueChange={setNewType} disabled={busy}>
                  <SelectTrigger><SelectValue placeholder="Type de méthode…" /></SelectTrigger>
                  <SelectContent>
                    {METHOD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={newHolder} onChange={(e) => setNewHolder(e.target.value)}
                  placeholder="Nom du titulaire" disabled={busy} />
              </div>
              {newType === "paypal" ? (
                <Input value={newPaypalEmail} onChange={(e) => setNewPaypalEmail(e.target.value)}
                  placeholder="Courriel PayPal" type="email" disabled={busy} />
              ) : newType && newType !== "bank_account" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="Marque (ex: Visa)" disabled={busy} />
                  <Input value={newLast4} onChange={(e) => setNewLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="4 derniers chiffres" maxLength={4} disabled={busy} />
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded border p-2">
                <span className="text-sm">Définir par défaut</span>
                <Switch checked={newDefault} onCheckedChange={setNewDefault} disabled={busy} />
              </div>
              <Button onClick={doAddMethod} disabled={busy || !newType} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Ajouter la méthode
              </Button>
            </div>
          </TabsContent>

          {/* ===== AUTOPAY ===== */}
          <TabsContent value="autopay" className="space-y-4 pt-4">
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="text-sm font-medium">Paiement automatique</p>
                <p className="text-xs text-muted-foreground">Prélèvement à l'échéance de chaque facture</p>
              </div>
              <Switch checked={autopayOn} onCheckedChange={setAutopayOn} disabled={busy} />
            </div>
            {autopayOn && (
              <>
                <div>
                  <Label>Méthode de paiement</Label>
                  <Select value={autopayMethod} onValueChange={setAutopayMethod} disabled={busy}>
                    <SelectTrigger><SelectValue placeholder="Choisir une méthode active…" /></SelectTrigger>
                    <SelectContent>
                      {methods.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{methodLabel(m)}{m.is_default ? " (défaut)" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Décalage du jour de prélèvement (-15 à +15)</Label>
                  <Input type="number" min="-15" max="15" step="1" value={autopayOffset}
                    onChange={(e) => setAutopayOffset(e.target.value)} disabled={busy} />
                </div>
              </>
            )}
            {!autopayOn && (
              <div>
                <Label htmlFor="autopay-reason">Raison de désactivation</Label>
                <Textarea id="autopay-reason" rows={2} value={autopayReason}
                  onChange={(e) => setAutopayReason(e.target.value)} disabled={busy} />
              </div>
            )}
            <Button onClick={doAutopay} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </TabsContent>

          {/* ===== PLAN ===== */}
          <TabsContent value="plan" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">
              Réservé à billing_admin / supervisor / admin.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="plan-total">Montant total</Label>
                <Input id="plan-total" type="number" min="0.01" step="0.01" value={planTotal}
                  onChange={(e) => setPlanTotal(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label htmlFor="plan-count">Nombre de versements (2-24)</Label>
                <Input id="plan-count" type="number" min="2" max="24" step="1" value={planCount}
                  onChange={(e) => setPlanCount(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label>Fréquence</Label>
                <Select value={planFreq} onValueChange={(v) => setPlanFreq(v as typeof planFreq)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Hebdomadaire</SelectItem>
                    <SelectItem value="biweekly">Aux deux semaines</SelectItem>
                    <SelectItem value="monthly">Mensuelle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plan-first">Premier versement</Label>
                <Input id="plan-first" type="date" value={planFirst}
                  onChange={(e) => setPlanFirst(e.target.value)} disabled={busy} />
              </div>
            </div>
            <div>
              <Label htmlFor="plan-reason">Raison / contexte (obligatoire)</Label>
              <Textarea id="plan-reason" rows={2} value={planReason}
                onChange={(e) => setPlanReason(e.target.value)} disabled={busy} />
            </div>
            <Button onClick={doPlan} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
              Créer le plan de paiement
            </Button>
          </TabsContent>

          {/* ===== PREFS ===== */}
          <TabsContent value="prefs" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Jour de facturation (1-28)</Label>
                <Input type="number" min="1" max="28" step="1" value={prefDay}
                  onChange={(e) => setPrefDay(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label>Format</Label>
                <Select value={prefFormat} onValueChange={(v) => setPrefFormat(v as typeof prefFormat)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electronic">Électronique (courriel)</SelectItem>
                    <SelectItem value="paper">Papier (poste)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Langue</Label>
                <Select value={prefLang} onValueChange={(v) => setPrefLang(v as typeof prefLang)} disabled={busy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Courriel de facturation</Label>
                <Input type="email" value={prefEmail}
                  onChange={(e) => setPrefEmail(e.target.value)} disabled={busy}
                  placeholder="(par défaut : courriel du compte)" />
              </div>
            </div>
            {prefFormat === "paper" && (
              <div>
                <Label>Adresse postale</Label>
                <Textarea rows={2} value={prefAddr}
                  onChange={(e) => setPrefAddr(e.target.value)} disabled={busy} />
              </div>
            )}
            <Button onClick={doPrefs} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings2 className="h-4 w-4 mr-2" />}
              Enregistrer les préférences
            </Button>
          </TabsContent>

          {/* ===== REFUND ===== */}
          <TabsContent value="refund" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">
              Réservé à billing_admin / supervisor / admin. Plafond : 10 000 $.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ref-amount">Montant</Label>
                <Input id="ref-amount" type="number" min="0.01" max="10000" step="0.01"
                  value={refAmount} onChange={(e) => setRefAmount(e.target.value)} disabled={busy} />
              </div>
              <div>
                <Label>Méthode</Label>
                <Select value={refMethod} onValueChange={setRefMethod} disabled={busy}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {REFUND_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="ref-ext">Référence externe (n° transaction, chèque, etc.)</Label>
              <Input id="ref-ext" value={refExt} onChange={(e) => setRefExt(e.target.value)} disabled={busy} />
            </div>
            <div>
              <Label htmlFor="ref-reason">Raison (min. 5 caractères)</Label>
              <Textarea id="ref-reason" rows={3} value={refReason}
                onChange={(e) => setRefReason(e.target.value)} disabled={busy} />
            </div>
            <Button onClick={doRefund} disabled={busy} className="w-full" variant="destructive">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
              Traiter le remboursement
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
