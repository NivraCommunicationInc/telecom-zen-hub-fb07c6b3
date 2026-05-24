/**
 * BillingDisputesDialog — Staff management of payment_disputes for an Account 360.
 * Lists existing disputes for the client and lets staff transition statuses or
 * open a new one on behalf of the client through `disputes-account-actions`.
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
  Loader2, DollarSign, Search, CheckCircle2, XCircle, FileQuestion, FilePlus2, StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName?: string;
  payments?: any[];
}

interface Dispute {
  id: string;
  dispute_number: string | null;
  payment_id: string;
  reason_code: string;
  status: string;
  client_message: string | null;
  public_message: string | null;
  staff_notes: string | null;
  resolution_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  processed_by_name: string | null;
  processed_at: string | null;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  invoice_number: string | null;
  created_at: string;
}

const REASONS = [
  { value: "duplicate_charge",     label: "Double facturation" },
  { value: "incorrect_amount",     label: "Montant incorrect" },
  { value: "service_not_received", label: "Service non reçu" },
  { value: "unauthorized",         label: "Transaction non autorisée" },
  { value: "fraud",                label: "Fraude présumée" },
  { value: "other",                label: "Autre" },
];

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  submitted:         { label: "Soumis",            variant: "secondary" },
  under_review:      { label: "En analyse",        variant: "default"   },
  awaiting_client:   { label: "Attente client",    variant: "outline"   },
  resolved_approved: { label: "Approuvé",          variant: "default"   },
  resolved_rejected: { label: "Refusé",            variant: "destructive" },
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n || 0));

export function BillingDisputesDialog({ open, onClose, clientUserId, clientName = "Client", payments: canonicalPayments = [] }: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);

  // open form
  const [newPaymentId, setNewPaymentId] = useState("");
  const [newReason, setNewReason] = useState("incorrect_amount");
  const [newMessage, setNewMessage] = useState("");

  // action form
  const [publicMessage, setPublicMessage] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [staffNote, setStaffNote] = useState("");

  const selected = useMemo(
    () => disputes.find((d) => d.id === selectedDisputeId) || null,
    [disputes, selectedDisputeId],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [dRes, pRes] = await Promise.all([
        supabase
          .from("payment_disputes")
          .select("id, dispute_number, payment_id, reason_code, status, client_message, public_message, staff_notes, resolution_notes, rejection_reason, created_at, processed_by_name, processed_at")
          .eq("user_id", clientUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("billing")
          .select("id, amount, status, invoice_number, created_at")
          .eq("user_id", clientUserId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      const list = (dRes.data as Dispute[]) || [];
      setDisputes(list);
      const legacyPayments = (pRes.data as Payment[]) || [];
      const canonical = canonicalPayments.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount || 0),
        status: p.status,
        invoice_number: p.invoice_number || p.payment_number || p.reference || null,
        created_at: p.created_at || p.received_at,
      }));
      const merged = [...legacyPayments, ...canonical];
      setPayments(Array.from(new Map(merged.filter((p) => p.id).map((p) => [p.id, p])).values()));
      if (!selectedDisputeId && list.length) setSelectedDisputeId(list[0].id);
    } catch (e) {
      toast.error((e as Error).message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSelectedDisputeId(null);
    setNewPaymentId(""); setNewReason("incorrect_amount"); setNewMessage("");
    setPublicMessage(""); setResolutionNotes(""); setRejectionReason(""); setStaffNote("");
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientUserId]);

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("disputes-account-actions", {
        body: { action, client_user_id: clientUserId, ...extra },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Litige mis à jour");
      setPublicMessage(""); setResolutionNotes(""); setRejectionReason(""); setStaffNote("");
      setNewPaymentId(""); setNewMessage("");
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
            <DollarSign className="h-5 w-5 text-amber-500" />
            Litiges de facturation — {clientName}
          </DialogTitle>
          <DialogDescription>
            Gérer les litiges existants ou en ouvrir un nouveau au nom du client.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue={disputes.length ? "manage" : "open"} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="manage">Litiges actifs ({disputes.length})</TabsTrigger>
              <TabsTrigger value="open">Ouvrir un litige</TabsTrigger>
            </TabsList>

            {/* MANAGE */}
            <TabsContent value="manage" className="space-y-3 pt-3">
              {disputes.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Aucun litige enregistré.
                </div>
              ) : (
                <>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto rounded border p-2">
                    {disputes.map((d) => {
                      const s = STATUS[d.status] ?? { label: d.status, variant: "outline" as const };
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setSelectedDisputeId(d.id)}
                          className={`w-full text-left px-3 py-2 rounded text-xs border transition-colors
                            ${selectedDisputeId === d.id ? "border-violet-500 bg-violet-500/10" : "border-transparent hover:border-border bg-muted/40"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono">#{d.dispute_number || d.id.slice(0, 8)}</span>
                            <Badge variant={s.variant} className="text-[9px] h-4">{s.label}</Badge>
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {REASONS.find((r) => r.value === d.reason_code)?.label || d.reason_code} —{" "}
                            {new Date(d.created_at).toLocaleDateString("fr-CA")}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selected && (
                    <div className="rounded border p-3 space-y-3 text-xs bg-muted/30">
                      <div>
                        <div className="font-semibold mb-1">Message client</div>
                        <div className="whitespace-pre-wrap text-muted-foreground">{selected.client_message || "—"}</div>
                      </div>
                      {selected.public_message && (
                        <div>
                          <div className="font-semibold mb-1">Dernier message public</div>
                          <div className="whitespace-pre-wrap">{selected.public_message}</div>
                        </div>
                      )}
                      {selected.staff_notes && (
                        <div>
                          <div className="font-semibold mb-1">Notes internes</div>
                          <div className="whitespace-pre-wrap text-muted-foreground">{selected.staff_notes}</div>
                        </div>
                      )}
                      {(selected.resolution_notes || selected.rejection_reason) && (
                        <div>
                          <div className="font-semibold mb-1">Résolution</div>
                          <div className="whitespace-pre-wrap">{selected.resolution_notes || selected.rejection_reason}</div>
                        </div>
                      )}

                      {selected.status !== "resolved_approved" && selected.status !== "resolved_rejected" && (
                        <div className="space-y-2 pt-2 border-t">
                          <div>
                            <Label className="text-xs">Message public (visible par le client)</Label>
                            <Textarea rows={2} value={publicMessage} onChange={(e) => setPublicMessage(e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Notes de résolution</Label>
                            <Textarea rows={2} value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Motif de refus</Label>
                            <Input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Note interne (facultatif)</Label>
                            <Input value={staffNote} onChange={(e) => setStaffNote(e.target.value)} />
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {selected.status === "submitted" && (
                              <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => invoke("set_under_review", { dispute_id: selected.id, staff_note: staffNote })}>
                                <Search className="h-4 w-4 mr-2" />Mettre en analyse
                              </Button>
                            )}
                            <Button size="sm" variant="outline" disabled={busy || !publicMessage.trim()}
                              onClick={() => invoke("request_client_info", { dispute_id: selected.id, public_message: publicMessage, staff_note: staffNote })}>
                              <FileQuestion className="h-4 w-4 mr-2" />Demander info client
                            </Button>
                            <Button size="sm" variant="default" disabled={busy || !resolutionNotes.trim()}
                              onClick={() => invoke("resolve_approved", { dispute_id: selected.id, resolution_notes: resolutionNotes, public_message: publicMessage || null, staff_note: staffNote })}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />Approuver
                            </Button>
                            <Button size="sm" variant="destructive" disabled={busy || !rejectionReason.trim()}
                              onClick={() => invoke("resolve_rejected", { dispute_id: selected.id, rejection_reason: rejectionReason, public_message: publicMessage || null, staff_note: staffNote })}>
                              <XCircle className="h-4 w-4 mr-2" />Refuser
                            </Button>
                            <Button size="sm" variant="secondary" disabled={busy || !staffNote.trim()}
                              onClick={() => invoke("add_staff_note", { dispute_id: selected.id, staff_note: staffNote })}>
                              <StickyNote className="h-4 w-4 mr-2" />Ajouter note interne
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* OPEN */}
            <TabsContent value="open" className="space-y-3 pt-3">
              <div>
                <Label className="text-xs">Paiement concerné</Label>
                <Select value={newPaymentId} onValueChange={setNewPaymentId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un paiement" /></SelectTrigger>
                  <SelectContent>
                    {payments.length === 0 && (
                      <SelectItem value="__none" disabled>Aucun paiement trouvé</SelectItem>
                    )}
                    {payments.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {fmtMoney(p.amount)} — {p.invoice_number || p.id.slice(0, 8)} — {new Date(p.created_at).toLocaleDateString("fr-CA")} ({p.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Motif</Label>
                <Select value={newReason} onValueChange={setNewReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Description / message client</Label>
                <Textarea rows={3} value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Description détaillée du litige, contexte, références" />
              </div>
              <Button disabled={busy || !newPaymentId || newPaymentId === "__none"}
                onClick={() => invoke("open_on_behalf", {
                  payment_id: newPaymentId, reason_code: newReason, client_message: newMessage,
                })}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FilePlus2 className="h-4 w-4 mr-2" />}
                Ouvrir le litige
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
