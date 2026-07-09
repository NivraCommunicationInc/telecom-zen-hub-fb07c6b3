/**
 * CollectionsDisputeModule — Client 360 unified "Recouvrement & Litige" center.
 *
 * Orchestre les 2 workflows canoniques Nivra existants (aucune logique parallèle):
 *   - Recouvrement : collections-account-actions → collections_actions
 *   - Litige       : disputes-account-actions   → payment_disputes
 *
 * Un seul module, un seul motif audité, un seul endroit pour :
 *   - voir la situation complète (factures impayées, dossiers, litiges)
 *   - contacter, engager, planifier, escalader, radier, résoudre une facture
 *   - ouvrir, arbitrer, demander info, approuver, refuser un litige
 *
 * Audit + emails brandés sont livrés par les Edge Functions existantes.
 * Standard identique à PlanChange / RecordPayment / Refund / Autopay / Adjustments.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientModuleShell, ImpactRow, ImpactedTable, PlannedEmail } from "./ClientModuleShell";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Mail, PhoneCall, MessageSquare, CalendarClock,
  Calendar as CalendarIcon, ShieldAlert, XOctagon, CheckCircle2, StickyNote,
  Scale, FileWarning, Info, Send, Search,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type ColAction =
  | "log_contact" | "create_promise" | "create_payment_plan"
  | "escalate" | "writeoff" | "mark_resolved" | "add_note";
type DisAction =
  | "open_on_behalf" | "set_under_review" | "request_client_info"
  | "resolve_approved" | "resolve_rejected" | "add_staff_note";
type Mode = "collections" | "disputes";

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;         // auth user id (= client_user_id)
  accountId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  canonicalData?: any;
}

const CLOSED = ["paid", "paid_by_promo", "void", "cancelled", "refunded", "written_off", "bad_debt"];

const COL_LABEL: Record<string, string> = {
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

const DIS_STATUS: Record<string, { label: string; variant: any }> = {
  submitted:         { label: "Soumis",           variant: "secondary" },
  under_review:      { label: "En analyse",       variant: "default" },
  awaiting_client:   { label: "Attend le client", variant: "outline" },
  resolved_approved: { label: "Approuvé",         variant: "default" },
  resolved_rejected: { label: "Refusé",           variant: "destructive" },
};

const REASON_CODES = [
  { value: "duplicate_charge",     label: "Double facturation" },
  { value: "incorrect_amount",     label: "Montant incorrect" },
  { value: "service_not_received", label: "Service non reçu" },
  { value: "unauthorized",         label: "Transaction non autorisée" },
  { value: "fraud",                label: "Fraude présumée" },
  { value: "other",                label: "Autre" },
];

const fmtCAD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n));
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("fr-CA"); }
  catch { return d as string; }
};

export function CollectionsDisputeModule({
  open, onClose, clientId, clientName, clientEmail, canonicalData,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("collections");

  // ── Collections state ────────────────────────────────────────────────────
  const [colAction, setColAction] = useState<ColAction>("log_contact");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [channel, setChannel] = useState<"email" | "phone" | "sms">("email");
  const [notes, setNotes] = useState("");
  const [amountPromised, setAmountPromised] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [installments, setInstallments] = useState("3");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [colReason, setColReason] = useState("");

  // ── Disputes state ───────────────────────────────────────────────────────
  const [disAction, setDisAction] = useState<DisAction>("set_under_review");
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>("");
  const [reasonCode, setReasonCode] = useState("other");
  const [clientMessage, setClientMessage] = useState("");
  const [publicMessage, setPublicMessage] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [staffNote, setStaffNote] = useState("");

  const [loading, setLoading] = useState(false);

  // ── Fetch context ────────────────────────────────────────────────────────
  const ctxQ = useQuery({
    queryKey: ["core-collections-dispute-ctx", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const [{ data: unpaid }, { data: colActions }, { data: disputes }, { data: payments }] = await Promise.all([
        supabase.from("client_unpaid_invoices")
          .select("id, invoice_number, total, amount_due, due_date, status")
          .eq("client_id", clientId)
          .order("due_date", { ascending: true }),
        supabase.from("collections_actions")
          .select("id, invoice_id, action_type, notes, amount_promised, promise_date, created_at")
          .eq("customer_id", clientId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("payment_disputes")
          .select("id, dispute_number, status, reason_code, client_message, public_message, resolution_notes, rejection_reason, payment_id, created_at, updated_at")
          .eq("user_id", clientId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("billing_payments")
          .select("id, payment_number, amount, method, status, created_at")
          .eq("customer_id", clientId)
          .eq("status", "confirmed")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      return {
        unpaid: unpaid ?? [],
        colActions: colActions ?? [],
        disputes: disputes ?? [],
        payments: payments ?? [],
      };
    },
  });

  const unpaid: any[] = ctxQ.data?.unpaid ?? [];
  const colActions: any[] = ctxQ.data?.colActions ?? [];
  const disputes: any[] = ctxQ.data?.disputes ?? [];
  const payments: any[] = ctxQ.data?.payments ?? [];

  const openInvoices = useMemo(
    () => unpaid.filter((i) => !CLOSED.includes(String(i.status)) && Number(i.amount_due ?? i.total ?? 0) > 0),
    [unpaid],
  );
  const overdueInvoices = useMemo(
    () => openInvoices.filter((i) => i.due_date && new Date(i.due_date) < new Date()),
    [openInvoices],
  );
  const totalOverdue = overdueInvoices.reduce((s, i) => s + Number(i.amount_due ?? i.total ?? 0), 0);
  const openDisputes = disputes.filter((d) => d.status && !["resolved_approved", "resolved_rejected"].includes(d.status));

  useEffect(() => {
    if (open) {
      setMode("collections");
      setColAction("log_contact");
      setSelectedInvoiceId(openInvoices[0]?.id ?? "");
      setChannel("email"); setNotes(""); setAmountPromised(""); setPromiseDate("");
      setInstallments("3"); setInstallmentAmount(""); setColReason("");
      setDisAction(openDisputes[0] ? "set_under_review" : "open_on_behalf");
      setSelectedDisputeId(openDisputes[0]?.id ?? "");
      setSelectedPaymentId(payments[0]?.id ?? "");
      setReasonCode("other"); setClientMessage(""); setPublicMessage("");
      setResolutionNotes(""); setRejectionReason(""); setStaffNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ctxQ.data]);

  const selectedInvoice = openInvoices.find((i) => i.id === selectedInvoiceId);
  const selectedDispute = disputes.find((d) => d.id === selectedDisputeId);

  // ── Impact preview ───────────────────────────────────────────────────────
  const impact: ImpactRow[] = useMemo(() => {
    if (mode === "collections") {
      const inv = selectedInvoice;
      const bal = fmtCAD(Number(inv?.amount_due ?? inv?.total ?? 0));
      switch (colAction) {
        case "log_contact":
          return [
            { label: "Facture",    before: inv?.invoice_number ?? "—", after: inv?.invoice_number ?? "—" },
            { label: "Solde",      before: bal, after: bal, delta: "inchangé" },
            { label: "Contact",    before: "—", after: channel === "email" ? "Courriel" : channel === "phone" ? "Appel" : "SMS", delta: channel === "email" ? "email brandé envoyé" : "log interne" },
          ];
        case "create_promise":
          return [
            { label: "Facture",         before: inv?.invoice_number ?? "—", after: inv?.invoice_number ?? "—" },
            { label: "Solde",           before: bal, after: bal, delta: "inchangé" },
            { label: "Montant promis",  before: "—", after: fmtCAD(Number(amountPromised || 0)) },
            { label: "Date d'engagement", before: "—", after: promiseDate || "—" },
          ];
        case "create_payment_plan": {
          const inst = Number(installments || 0);
          const each = Number(installmentAmount || 0);
          return [
            { label: "Facture",   before: inv?.invoice_number ?? "—", after: inv?.invoice_number ?? "—" },
            { label: "Plan",      before: "—", after: `${inst} × ${fmtCAD(each)}`, delta: `total ${fmtCAD(inst * each)}` },
          ];
        }
        case "escalate":
          return [
            { label: "Facture", before: inv?.invoice_number ?? "—", after: inv?.invoice_number ?? "—" },
            { label: "Statut dossier", before: "actif", after: "escaladé", delta: "email + PDF client" },
          ];
        case "writeoff":
          return [
            { label: "Facture", before: inv?.invoice_number ?? "—", after: inv?.invoice_number ?? "—" },
            { label: "Solde",   before: bal, after: bal, delta: "inchangé" },
            { label: "Statut",  before: String(inv?.status ?? "—"), after: "radiée (collections)", delta: "→ bad debt" },
          ];
        case "mark_resolved":
          return [
            { label: "Facture", before: inv?.invoice_number ?? "—", after: inv?.invoice_number ?? "—" },
            { label: "Dossier", before: "en cours", after: "résolu" },
          ];
        case "add_note":
          return [{ label: "Note interne", before: "—", after: notes.length > 40 ? notes.slice(0, 40) + "…" : notes }];
      }
    } else {
      const d = selectedDispute;
      const cur = d ? (DIS_STATUS[d.status]?.label ?? d.status) : "—";
      switch (disAction) {
        case "open_on_behalf": {
          const pay = payments.find((p) => p.id === selectedPaymentId);
          return [
            { label: "Paiement",        before: "—", after: pay ? `${pay.payment_number ?? pay.id.slice(0, 8)} · ${fmtCAD(pay.amount)}` : "—" },
            { label: "Nouveau litige",  before: "—", after: "soumis", delta: "email brandé au client" },
            { label: "Motif",           before: "—", after: REASON_CODES.find(r => r.value === reasonCode)?.label ?? reasonCode },
          ];
        }
        case "set_under_review":
          return [
            { label: "Litige", before: d?.dispute_number ?? "—", after: d?.dispute_number ?? "—" },
            { label: "Statut", before: cur, after: DIS_STATUS.under_review.label, delta: "email brandé" },
          ];
        case "request_client_info":
          return [
            { label: "Litige", before: d?.dispute_number ?? "—", after: d?.dispute_number ?? "—" },
            { label: "Statut", before: cur, after: DIS_STATUS.awaiting_client.label, delta: "email + message public" },
          ];
        case "resolve_approved":
          return [
            { label: "Litige", before: d?.dispute_number ?? "—", after: d?.dispute_number ?? "—" },
            { label: "Statut", before: cur, after: DIS_STATUS.resolved_approved.label, delta: "email de résolution" },
          ];
        case "resolve_rejected":
          return [
            { label: "Litige", before: d?.dispute_number ?? "—", after: d?.dispute_number ?? "—" },
            { label: "Statut", before: cur, after: DIS_STATUS.resolved_rejected.label, delta: "email de refus" },
          ];
        case "add_staff_note":
          return [
            { label: "Litige", before: d?.dispute_number ?? "—", after: d?.dispute_number ?? "—" },
            { label: "Note staff", before: "—", after: staffNote.length > 40 ? staffNote.slice(0, 40) + "…" : staffNote },
          ];
      }
    }
    return [];
  }, [mode, colAction, disAction, selectedInvoice, selectedDispute, selectedPaymentId, payments, channel, amountPromised, promiseDate, installments, installmentAmount, notes, reasonCode, staffNote]);

  const impactedTables: ImpactedTable[] = useMemo(() => {
    if (mode === "collections") {
      const rows: ImpactedTable[] = [
        { table: "collections_actions", rows: 1, note: `action=${colAction}` },
        { table: "admin_audit_log", rows: 1, note: `account_ops.collections_*` },
      ];
      return rows;
    }
    if (disAction === "open_on_behalf") {
      return [
        { table: "payment_disputes", rows: 1, note: "insert (status=submitted)" },
        { table: "admin_audit_log", rows: 1, note: "account_ops.dispute_open_on_behalf" },
      ];
    }
    return [
      { table: "payment_disputes", rows: 1, note: `update (status transition)` },
      { table: "admin_audit_log", rows: 1, note: `account_ops.dispute_${disAction}` },
    ];
  }, [mode, colAction, disAction]);

  const plannedEmails: PlannedEmail[] = useMemo(() => {
    if (!clientEmail) return [];
    if (mode === "collections") {
      switch (colAction) {
        case "log_contact":
          return channel === "email" ? [{ template: "client_collections_reminder", recipient: clientEmail }] : [];
        case "create_promise":
          return [{ template: "client_collections_promise", recipient: clientEmail }];
        case "create_payment_plan":
          return [{ template: "client_collections_payment_plan", recipient: clientEmail }];
        case "escalate":
          return [{ template: "client_collections_transfer", recipient: clientEmail, note: "avec PDF de transfert" }];
        default:
          return [];
      }
    }
    if (["set_under_review", "request_client_info", "resolve_approved", "resolve_rejected"].includes(disAction)) {
      return [{ template: "client_dispute_status_update", recipient: clientEmail }];
    }
    return [];
  }, [mode, colAction, disAction, channel, clientEmail]);

  // ── Guards ───────────────────────────────────────────────────────────────
  const disabled = useMemo(() => {
    if (loading) return true;
    if (mode === "collections") {
      if (!selectedInvoiceId) return true;
      switch (colAction) {
        case "create_promise":
          return !(Number(amountPromised) > 0) || !promiseDate;
        case "create_payment_plan":
          return !(Number(installments) >= 2 && Number(installments) <= 12) || !(Number(installmentAmount) > 0);
        case "escalate":
        case "writeoff":
          return colReason.trim().length < 4;
        case "add_note":
          return notes.trim().length < 3;
        default:
          return false;
      }
    }
    switch (disAction) {
      case "open_on_behalf":
        return !selectedPaymentId || !reasonCode;
      case "set_under_review":
        return !selectedDisputeId;
      case "request_client_info":
        return !selectedDisputeId || publicMessage.trim().length < 3;
      case "resolve_approved":
        return !selectedDisputeId || resolutionNotes.trim().length < 3;
      case "resolve_rejected":
        return !selectedDisputeId || rejectionReason.trim().length < 3;
      case "add_staff_note":
        return !selectedDisputeId || staffNote.trim().length < 3;
    }
  }, [loading, mode, colAction, disAction, selectedInvoiceId, selectedDisputeId, selectedPaymentId, amountPromised, promiseDate, installments, installmentAmount, colReason, notes, reasonCode, publicMessage, resolutionNotes, rejectionReason, staffNote]);

  // ── Confirm ──────────────────────────────────────────────────────────────
  const onConfirm = async (reason: string) => {
    if (disabled) return;
    setLoading(true);
    try {
      let edgeFn = "";
      const payload: Record<string, unknown> = { client_user_id: clientId };
      if (mode === "collections") {
        edgeFn = "collections-account-actions";
        payload.action = colAction;
        payload.invoice_id = selectedInvoiceId;
        if (colAction === "log_contact") { payload.channel = channel; payload.notes = notes || null; }
        if (colAction === "create_promise") {
          payload.amount_promised = Number(amountPromised);
          payload.promise_date = promiseDate;
          payload.notes = notes || null;
        }
        if (colAction === "create_payment_plan") {
          payload.installments = Number(installments);
          payload.installment_amount = Number(installmentAmount);
          payload.notes = notes || null;
        }
        if (colAction === "escalate" || colAction === "writeoff") payload.reason = colReason;
        if (colAction === "mark_resolved") payload.notes = notes || null;
        if (colAction === "add_note") payload.notes = notes;
      } else {
        edgeFn = "disputes-account-actions";
        payload.action = disAction;
        if (disAction === "open_on_behalf") {
          payload.payment_id = selectedPaymentId;
          payload.reason_code = reasonCode;
          payload.client_message = clientMessage || undefined;
          payload.staff_note = staffNote || undefined;
        } else {
          payload.dispute_id = selectedDisputeId;
          if (disAction === "request_client_info") payload.public_message = publicMessage;
          if (disAction === "resolve_approved") {
            payload.resolution_notes = resolutionNotes;
            payload.public_message = publicMessage || undefined;
          }
          if (disAction === "resolve_rejected") {
            payload.rejection_reason = rejectionReason;
            payload.public_message = publicMessage || undefined;
          }
          if (disAction === "add_staff_note") payload.staff_note = staffNote;
          if (["set_under_review", "resolve_approved", "resolve_rejected", "request_client_info"].includes(disAction) && staffNote.trim()) {
            payload.staff_note = staffNote;
          }
        }
      }
      const res = await callCoreAction(edgeFn, payload, {
        reason,
        queryClient: qc,
        successMessage: mode === "collections" ? "Action recouvrement enregistrée" : "Litige mis à jour",
      });
      if (res.ok) {
        await ctxQ.refetch();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Bandeau contexte client ─────────────────────────────────────────────
  const clientContext = (
    <div className="grid md:grid-cols-4 gap-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Client</div>
        <div className="font-medium">{clientName}</div>
        <div className="text-muted-foreground">{clientEmail ?? "—"}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Factures impayées</div>
        <div className="font-semibold text-lg">{openInvoices.length}</div>
        <div className="text-muted-foreground">{overdueInvoices.length} en retard</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Total en retard</div>
        <div className="font-semibold text-lg text-amber-500">{fmtCAD(totalOverdue)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Litiges</div>
        <div className="font-semibold text-lg">{disputes.length}</div>
        <div className="text-muted-foreground">{openDisputes.length} ouvert(s)</div>
      </div>
    </div>
  );

  // ── État actuel ─────────────────────────────────────────────────────────
  const state = (
    <div className="space-y-3">
      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2"><FileWarning className="h-3 w-3" /> Factures impayées</div>
        {openInvoices.length === 0 && <p className="text-xs text-muted-foreground">Aucune facture impayée. 🎉</p>}
        <div className="space-y-1">
          {openInvoices.map((i) => {
            const overdue = i.due_date && new Date(i.due_date) < new Date();
            return (
              <div key={i.id} className="flex justify-between text-xs border-b last:border-0 py-1">
                <div>
                  <div className="font-medium">#{i.invoice_number ?? i.id.slice(0, 8)}</div>
                  <div className="text-muted-foreground">
                    Échéance {fmtDate(i.due_date)} · {i.status}
                    {overdue && <Badge variant="destructive" className="ml-2 text-[9px] h-4">EN RETARD</Badge>}
                  </div>
                </div>
                <div className="font-semibold">{fmtCAD(Number(i.amount_due ?? i.total ?? 0))}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2"><Scale className="h-3 w-3" /> Litiges</div>
        {disputes.length === 0 && <p className="text-xs text-muted-foreground">Aucun litige enregistré.</p>}
        <div className="space-y-1">
          {disputes.map((d) => (
            <div key={d.id} className="flex justify-between text-xs border-b last:border-0 py-1">
              <div>
                <div className="font-medium">
                  {d.dispute_number} <Badge variant={DIS_STATUS[d.status]?.variant ?? "outline"} className="ml-1">{DIS_STATUS[d.status]?.label ?? d.status}</Badge>
                </div>
                <div className="text-muted-foreground">
                  {REASON_CODES.find(r => r.value === d.reason_code)?.label ?? d.reason_code} · {fmtDate(d.created_at)}
                </div>
              </div>
              <div className="text-muted-foreground text-[10px] max-w-[40%] truncate">
                {d.public_message ?? d.client_message ?? ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Historique ──────────────────────────────────────────────────────────
  const history = (
    <div className="space-y-2">
      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2">Actions recouvrement récentes</div>
        {colActions.length === 0 && <p className="text-xs text-muted-foreground">Aucune action.</p>}
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {colActions.map((h) => (
            <div key={h.id} className="text-xs border-b last:border-0 py-1">
              <div className="flex justify-between">
                <Badge variant="outline">{COL_LABEL[h.action_type] ?? h.action_type}</Badge>
                <span className="text-muted-foreground text-[10px]">{new Date(h.created_at).toLocaleString("fr-CA")}</span>
              </div>
              {h.amount_promised != null && (
                <div className="mt-1">Promesse: <strong>{fmtCAD(h.amount_promised)}</strong> pour le {fmtDate(h.promise_date)}</div>
              )}
              {h.notes && <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{h.notes}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2">Litiges (historique complet)</div>
        {disputes.length === 0 && <p className="text-xs text-muted-foreground">Aucun litige.</p>}
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {disputes.map((d) => (
            <div key={d.id} className="text-xs border-b last:border-0 py-1">
              <div className="flex justify-between">
                <span className="font-medium">{d.dispute_number}</span>
                <Badge variant={DIS_STATUS[d.status]?.variant ?? "outline"}>{DIS_STATUS[d.status]?.label ?? d.status}</Badge>
              </div>
              <div className="text-muted-foreground text-[10px]">
                {fmtDate(d.created_at)} · maj {fmtDate(d.updated_at)}
              </div>
              {d.resolution_notes && <div className="mt-1 text-muted-foreground">Résolution: {d.resolution_notes}</div>}
              {d.rejection_reason && <div className="mt-1 text-muted-foreground">Refus: {d.rejection_reason}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Actions form ─────────────────────────────────────────────────────────
  const collectionsForm = (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Facture concernée</Label>
        {openInvoices.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-1">Aucune facture impayée.</p>
        ) : (
          <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
            <SelectTrigger><SelectValue placeholder="Choisir une facture" /></SelectTrigger>
            <SelectContent>
              {openInvoices.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  #{i.invoice_number ?? i.id.slice(0, 8)} — {fmtCAD(Number(i.amount_due ?? i.total ?? 0))} — échéance {fmtDate(i.due_date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div>
        <Label className="text-xs">Action</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
          {([
            ["log_contact", "Contact", Mail],
            ["create_promise", "Engagement", CalendarClock],
            ["create_payment_plan", "Plan paiement", CalendarIcon],
            ["escalate", "Escalade", ShieldAlert],
            ["writeoff", "Radiation", XOctagon],
            ["mark_resolved", "Marquer résolu", CheckCircle2],
            ["add_note", "Note interne", StickyNote],
          ] as const).map(([k, lbl, Ic]) => {
            const active = colAction === k;
            return (
              <button key={k} type="button" onClick={() => setColAction(k as ColAction)}
                className={`text-left border rounded-md p-2 transition-all ${active ? "border-primary bg-muted/40" : "hover:border-muted-foreground/40"}`}>
                <div className="flex items-center gap-2 text-xs font-medium"><Ic className="h-3 w-3" />{lbl}</div>
              </button>
            );
          })}
        </div>
      </div>

      {colAction === "log_contact" && (
        <>
          <div>
            <Label className="text-xs">Canal</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email"><Mail className="inline h-3 w-3 mr-2" />Courriel brandé (envoi auto)</SelectItem>
                <SelectItem value="phone"><PhoneCall className="inline h-3 w-3 mr-2" />Appel téléphonique</SelectItem>
                <SelectItem value="sms"><MessageSquare className="inline h-3 w-3 mr-2" />SMS / Texto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notes (facultatif)</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Résumé de l'appel, message envoyé, etc." />
          </div>
        </>
      )}

      {colAction === "create_promise" && (
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Montant promis (CAD)</Label>
            <Input type="number" min="0" step="0.01" value={amountPromised} onChange={(e) => setAmountPromised(e.target.value)}
              placeholder={selectedInvoice ? String(selectedInvoice.amount_due ?? selectedInvoice.total ?? 0) : "0.00"} />
          </div>
          <div>
            <Label className="text-xs">Date promise</Label>
            <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Note</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      {colAction === "create_payment_plan" && (
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nombre de versements (2-12)</Label>
            <Input type="number" min="2" max="12" value={installments} onChange={(e) => setInstallments(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Montant / versement (CAD)</Label>
            <Input type="number" min="0" step="0.01" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Note</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      {(colAction === "escalate" || colAction === "writeoff") && (
        <>
          <div>
            <Label className="text-xs">Motif (obligatoire, min. 4 caractères)</Label>
            <Textarea rows={3} value={colReason} onChange={(e) => setColReason(e.target.value)}
              placeholder={colAction === "writeoff" ? "Motif de radiation (bad debt)" : "Motif d'escalade"} />
          </div>
          {colAction === "writeoff" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Radiation réservée aux rôles <strong>admin / billing_admin</strong>. La facture reste au dossier
                mais l'action <code>writeoff</code> est journalisée dans <code>collections_actions</code>.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {colAction === "mark_resolved" && (
        <div>
          <Label className="text-xs">Note (facultatif)</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Facture payée, entente honorée, etc." />
        </div>
      )}

      {colAction === "add_note" && (
        <div>
          <Label className="text-xs">Note interne (min. 3 caractères)</Label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}
    </div>
  );

  const disputesForm = (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Action</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
          {([
            ["open_on_behalf", "Ouvrir litige", Send],
            ["set_under_review", "En analyse", Search],
            ["request_client_info", "Demander info", MessageSquare],
            ["resolve_approved", "Approuver", CheckCircle2],
            ["resolve_rejected", "Refuser", XOctagon],
            ["add_staff_note", "Note staff", StickyNote],
          ] as const).map(([k, lbl, Ic]) => {
            const active = disAction === k;
            return (
              <button key={k} type="button" onClick={() => setDisAction(k as DisAction)}
                className={`text-left border rounded-md p-2 transition-all ${active ? "border-primary bg-muted/40" : "hover:border-muted-foreground/40"}`}>
                <div className="flex items-center gap-2 text-xs font-medium"><Ic className="h-3 w-3" />{lbl}</div>
              </button>
            );
          })}
        </div>
      </div>

      {disAction === "open_on_behalf" ? (
        <>
          <div>
            <Label className="text-xs">Paiement à contester</Label>
            {payments.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">Aucun paiement confirmé sur ce compte.</p>
            ) : (
              <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                <SelectTrigger><SelectValue placeholder="Choisir un paiement" /></SelectTrigger>
                <SelectContent>
                  {payments.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.payment_number ?? p.id.slice(0, 8)} — {fmtCAD(p.amount)} — {fmtDate(p.created_at)} ({p.method})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-xs">Motif</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASON_CODES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Message client (facultatif)</Label>
            <Textarea rows={3} value={clientMessage} onChange={(e) => setClientMessage(e.target.value)}
              placeholder={`Litige ouvert au nom du client par le personnel Nivra.`} />
          </div>
          <div>
            <Label className="text-xs">Note interne (facultatif)</Label>
            <Textarea rows={2} value={staffNote} onChange={(e) => setStaffNote(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label className="text-xs">Litige</Label>
            {disputes.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">Aucun litige existant — passer par « Ouvrir litige ».</p>
            ) : (
              <Select value={selectedDisputeId} onValueChange={setSelectedDisputeId}>
                <SelectTrigger><SelectValue placeholder="Choisir un litige" /></SelectTrigger>
                <SelectContent>
                  {disputes.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.dispute_number} · {DIS_STATUS[d.status]?.label ?? d.status} · {REASON_CODES.find(r => r.value === d.reason_code)?.label ?? d.reason_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {disAction === "request_client_info" && (
            <div>
              <Label className="text-xs">Message au client (public, obligatoire)</Label>
              <Textarea rows={3} value={publicMessage} onChange={(e) => setPublicMessage(e.target.value)}
                placeholder="Ex. Merci de nous transmettre la copie de votre relevé bancaire du 4 avril." />
            </div>
          )}

          {(disAction === "resolve_approved" || disAction === "resolve_rejected") && (
            <>
              <div>
                <Label className="text-xs">
                  {disAction === "resolve_approved" ? "Notes de résolution (obligatoire)" : "Motif de refus (obligatoire)"}
                </Label>
                <Textarea rows={3}
                  value={disAction === "resolve_approved" ? resolutionNotes : rejectionReason}
                  onChange={(e) => disAction === "resolve_approved" ? setResolutionNotes(e.target.value) : setRejectionReason(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Message public au client (facultatif)</Label>
                <Textarea rows={2} value={publicMessage} onChange={(e) => setPublicMessage(e.target.value)} />
              </div>
            </>
          )}

          {disAction === "add_staff_note" && (
            <div>
              <Label className="text-xs">Note staff (interne)</Label>
              <Textarea rows={3} value={staffNote} onChange={(e) => setStaffNote(e.target.value)} />
            </div>
          )}

          {["set_under_review", "request_client_info", "resolve_approved", "resolve_rejected"].includes(disAction) && (
            <div>
              <Label className="text-xs">Note interne (facultatif)</Label>
              <Textarea rows={2} value={staffNote} onChange={(e) => setStaffNote(e.target.value)} />
            </div>
          )}
        </>
      )}
    </div>
  );

  const actions = (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Centre unifié — un seul module orchestre les 2 workflows Nivra existants
          (<code>collections-account-actions</code> · <code>disputes-account-actions</code>).
          Emails brandés et audit livrés par les Edge Functions ; aucune écriture parallèle.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-2">
        {(["collections", "disputes"] as Mode[]).map((m) => {
          const active = mode === m;
          const Ic = m === "collections" ? FileWarning : Scale;
          return (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`text-left border rounded-md p-3 transition-all ${active ? "border-primary bg-muted/40" : "hover:border-muted-foreground/40"}`}>
              <div className="flex items-center gap-2 font-medium"><Ic className="h-4 w-4" />{m === "collections" ? "Recouvrement" : "Litige facturation"}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {m === "collections"
                  ? `${openInvoices.length} facture(s) impayée(s) · ${overdueInvoices.length} en retard`
                  : `${openDisputes.length} litige(s) ouvert(s) sur ${disputes.length}`}
              </div>
            </button>
          );
        })}
      </div>

      {mode === "collections" ? collectionsForm : disputesForm}
    </div>
  );

  return (
    <ClientModuleShell
      open={open}
      onClose={onClose}
      title="Recouvrement & Litige"
      subtitle={`${clientName} · ${openInvoices.length} impayée(s) · ${overdueInvoices.length} en retard · ${openDisputes.length} litige(s) ouvert(s)`}
      clientId={clientId}
      moduleTag="collections_dispute"
      badges={[
        { label: mode === "collections" ? "Recouvrement" : "Litige" },
        ...(overdueInvoices.length > 0 ? [{ label: `${overdueInvoices.length} en retard`, variant: "destructive" as const }] : []),
        ...(openDisputes.length > 0 ? [{ label: `${openDisputes.length} litige(s) ouvert(s)`, variant: "outline" as const }] : []),
      ]}
      clientContext={clientContext}
      state={state}
      history={history}
      actions={actions}
      impact={impact}
      impactedTables={impactedTables}
      plannedEmails={plannedEmails}
      requireReason
      disabled={disabled}
      loading={loading}
      confirmLabel={
        mode === "collections"
          ? colAction === "writeoff" ? "Confirmer la radiation"
            : colAction === "escalate" ? "Escalader"
            : colAction === "create_promise" ? "Enregistrer l'engagement"
            : colAction === "create_payment_plan" ? "Créer le plan"
            : colAction === "log_contact" ? "Enregistrer le contact"
            : colAction === "mark_resolved" ? "Marquer résolu"
            : "Ajouter la note"
          : disAction === "open_on_behalf" ? "Ouvrir le litige"
            : disAction === "resolve_approved" ? "Approuver le litige"
            : disAction === "resolve_rejected" ? "Refuser le litige"
            : disAction === "request_client_info" ? "Demander info au client"
            : disAction === "set_under_review" ? "Passer en analyse"
            : "Ajouter la note"
      }
      onConfirm={onConfirm}
    />
  );
}
