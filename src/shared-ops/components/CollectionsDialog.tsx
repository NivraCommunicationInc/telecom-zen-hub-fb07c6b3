/**
 * CollectionsDialog — Recouvrement panel for an Account 360.
 * Lists the client's unpaid invoices (canonical view `client_unpaid_invoices`)
 * and lets authorized staff log collection actions through
 * `collections-account-actions`. Branded emails fire from the edge function.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, AlertTriangle, PhoneCall, Mail, MessageSquare,
  Calendar, CalendarClock, ShieldAlert, XOctagon, CheckCircle2, StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  accountId?: string | null;
}

interface UnpaidInvoice {
  id: string;
  invoice_number: string | null;
  total: number;
  amount_due: number;
  due_date: string | null;
  status: string | null;
  source_table: string | null;
}

interface CollectionAction {
  id: string;
  action_type: string;
  notes: string | null;
  amount_promised: number | null;
  promise_date: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  contact_email: "Courriel envoyé",
  contact_phone: "Appel téléphonique",
  contact_sms: "SMS envoyé",
  promise_to_pay: "Engagement de paiement",
  payment_plan: "Plan de paiement",
  escalation: "Escalade",
  writeoff: "Radiation",
  resolved: "Résolu",
  note: "Note interne",
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n || 0));
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("fr-CA"); }
  catch { return d; }
};

export function CollectionsDialog({
  open, onClose, clientUserId, clientName = "Client",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invoices, setInvoices] = useState<UnpaidInvoice[]>([]);
  const [history, setHistory] = useState<CollectionAction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // form state
  const [channel, setChannel] = useState<"email" | "phone" | "sms">("email");
  const [notes, setNotes] = useState("");
  const [amountPromised, setAmountPromised] = useState<string>("");
  const [promiseDate, setPromiseDate] = useState<string>("");
  const [installments, setInstallments] = useState<string>("3");
  const [installmentAmount, setInstallmentAmount] = useState<string>("");
  const [reason, setReason] = useState("");

  const selected = useMemo(
    () => invoices.find((i) => i.id === selectedId) || null,
    [invoices, selectedId],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: invs }, { data: actions }] = await Promise.all([
        supabase
          .from("client_unpaid_invoices")
          .select("id, invoice_number, total, amount_due, due_date, status, source_table")
          .eq("client_id", clientUserId)
          .order("due_date", { ascending: true }),
        supabase
          .from("collections_actions")
          .select("id, action_type, notes, amount_promised, promise_date, created_at, invoice_id")
          .eq("customer_id", clientUserId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      const list = (invs as UnpaidInvoice[]) || [];
      setInvoices(list);
      setHistory((actions as any) || []);
      if (!selectedId && list.length) setSelectedId(list[0].id);
    } catch (e) {
      toast.error((e as Error).message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setNotes(""); setAmountPromised(""); setPromiseDate("");
    setInstallments("3"); setInstallmentAmount(""); setReason("");
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const invokeAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!selectedId) { toast.error("Sélectionnez une facture"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("collections-account-actions", {
        body: { action, client_user_id: clientUserId, invoice_id: selectedId, ...extra },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Action enregistrée");
      setNotes(""); setAmountPromised(""); setPromiseDate(""); setReason("");
      await loadData();
    } catch (e) {
      toast.error((e as Error).message || "Échec de l'action");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Recouvrement — {clientName}
          </DialogTitle>
          <DialogDescription>
            Suivi des factures impayées, contacts, engagements et plans de paiement.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Aucune facture impayée pour ce client. 🎉
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Facture concernée</Label>
              <div className="mt-1 space-y-1.5 max-h-48 overflow-y-auto rounded border p-2">
                {invoices.map((inv) => {
                  const overdue = inv.due_date && new Date(inv.due_date) < new Date();
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => setSelectedId(inv.id)}
                      className={`w-full text-left px-3 py-2 rounded text-xs border transition-colors
                        ${selectedId === inv.id ? "border-violet-500 bg-violet-500/10" : "border-transparent hover:border-border bg-muted/40"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono">#{inv.invoice_number || inv.id.slice(0, 8)}</span>
                        <span className="font-semibold">{fmtMoney(inv.amount_due || inv.total)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>Échéance: {fmtDate(inv.due_date)}</span>
                        {overdue && <Badge variant="destructive" className="text-[9px] h-4">EN RETARD</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Tabs defaultValue="contact" className="w-full">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="promise">Engagement</TabsTrigger>
                <TabsTrigger value="plan">Plan</TabsTrigger>
                <TabsTrigger value="escalate">Escalade</TabsTrigger>
                <TabsTrigger value="history">Historique</TabsTrigger>
              </TabsList>

              {/* CONTACT */}
              <TabsContent value="contact" className="space-y-3 pt-3">
                <div>
                  <Label className="text-xs">Canal</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email"><Mail className="inline h-3 w-3 mr-2" />Courriel (envoi automatique)</SelectItem>
                      <SelectItem value="phone"><PhoneCall className="inline h-3 w-3 mr-2" />Appel téléphonique</SelectItem>
                      <SelectItem value="sms"><MessageSquare className="inline h-3 w-3 mr-2" />SMS / Texto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Notes (facultatif)</Label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Résumé de l'appel, message envoyé, etc." />
                </div>
                <Button disabled={busy || !selectedId} onClick={() => invokeAction("log_contact", { channel, notes })}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Enregistrer le contact
                </Button>
              </TabsContent>

              {/* PROMISE */}
              <TabsContent value="promise" className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Montant promis (CAD)</Label>
                    <Input type="number" min="0" step="0.01" value={amountPromised}
                      onChange={(e) => setAmountPromised(e.target.value)}
                      placeholder={selected ? String(selected.amount_due || selected.total) : "0.00"} />
                  </div>
                  <div>
                    <Label className="text-xs">Date promise</Label>
                    <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Note</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button disabled={busy || !amountPromised || !promiseDate}
                  onClick={() => invokeAction("create_promise", {
                    amount_promised: Number(amountPromised), promise_date: promiseDate, notes,
                  })}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarClock className="h-4 w-4 mr-2" />}
                  Enregistrer l'engagement
                </Button>
              </TabsContent>

              {/* PAYMENT PLAN */}
              <TabsContent value="plan" className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nombre de versements (2-12)</Label>
                    <Input type="number" min="2" max="12" value={installments}
                      onChange={(e) => setInstallments(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Montant par versement (CAD)</Label>
                    <Input type="number" min="0" step="0.01" value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Note</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <Button disabled={busy || !installments || !installmentAmount}
                  onClick={() => invokeAction("create_payment_plan", {
                    installments: Number(installments),
                    installment_amount: Number(installmentAmount),
                    notes,
                  })}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                  Créer le plan
                </Button>
              </TabsContent>

              {/* ESCALATE / WRITEOFF / RESOLVE */}
              <TabsContent value="escalate" className="space-y-3 pt-3">
                <div>
                  <Label className="text-xs">Motif / Raison</Label>
                  <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Motif d'escalade ou de radiation, contexte, références…" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={busy || !reason.trim()}
                    onClick={() => invokeAction("escalate", { reason })}>
                    <ShieldAlert className="h-4 w-4 mr-2" />Escalader
                  </Button>
                  <Button variant="destructive" disabled={busy || !reason.trim()}
                    onClick={() => invokeAction("writeoff", { reason })}>
                    <XOctagon className="h-4 w-4 mr-2" />Radier la facture
                  </Button>
                  <Button variant="default" disabled={busy}
                    onClick={() => invokeAction("mark_resolved", { notes: reason })}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />Marquer résolu
                  </Button>
                  <Button variant="secondary" disabled={busy || !reason.trim()}
                    onClick={() => invokeAction("add_note", { notes: reason })}>
                    <StickyNote className="h-4 w-4 mr-2" />Note interne
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  La radiation est réservée aux rôles <strong>admin / billing_admin</strong>.
                </p>
              </TabsContent>

              {/* HISTORY */}
              <TabsContent value="history" className="pt-3">
                {history.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">Aucune action enregistrée.</div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {history.map((h) => (
                      <div key={h.id} className="rounded border bg-muted/40 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{ACTION_LABEL[h.action_type] || h.action_type}</Badge>
                          <span className="text-muted-foreground text-[10px]">
                            {new Date(h.created_at).toLocaleString("fr-CA")}
                          </span>
                        </div>
                        {h.amount_promised != null && (
                          <div className="mt-1">
                            Promesse: <strong>{fmtMoney(h.amount_promised)}</strong> pour le {fmtDate(h.promise_date)}
                          </div>
                        )}
                        {h.notes && <div className="mt-1 whitespace-pre-wrap">{h.notes}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
