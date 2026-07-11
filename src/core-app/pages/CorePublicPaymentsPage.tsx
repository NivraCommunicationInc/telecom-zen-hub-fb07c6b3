import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Loader2, CreditCard, ExternalLink, Copy, Mail, Search, Plus, Download, Check,
  TrendingUp, Clock, DollarSign, Calendar, Wallet, Send, Eye, Edit3, Ban, FileText,
  Receipt, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { exportToCSV } from "@/core-app/lib/exportUtils";
import { generateInvoicePDF, generateReceiptPDF, type InvoiceDataV2 } from "@/lib/pdf";
import { safePDFDownload, safePDFOpen } from "@/lib/pdfUtils";
import { CoreSquarePaymentDialog } from "@/core-app/components/account-360/CoreSquarePaymentDialog";

import { enqueueCommunication } from "@/lib/enqueueCommunication";
const fmt = (n: number) =>
  Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const shortDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) : "—";

const publicPayUrl = (token?: string | null) => `${window.location.origin}/payer/lien/${token || ""}`;

const copyText = async (value: string, label: string) => {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copié`);
};

function buildInvoicePdfData(detail: any): InvoiceDataV2 {
  const inv = detail.invoice;
  const customer = detail.customer || {};
  const lines = detail.lines || [];
  const payments = detail.payments || [];
  return {
    invoice_type: inv.type === "monthly" ? "MONTHLY" : "ONETIME",
    invoice_number: inv.invoice_number || inv.id,
    invoice_date: String(inv.created_at || new Date().toISOString()).slice(0, 10),
    due_date: String(inv.due_date || inv.created_at || new Date().toISOString()).slice(0, 10),
    account_number: inv.billing_snapshot_account_number || "N/A",
    billing_period_start: inv.cycle_start_date || undefined,
    billing_period_end: inv.cycle_end_date || undefined,
    currency: inv.currency || "CAD",
    status: inv.status || "pending",
    customer: {
      full_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client Nivra",
      email: customer.email || "support@nivra-telecom.ca",
      phone: customer.phone || undefined,
      address_line1: inv.address_snapshot?.line1 || inv.address_snapshot?.address || "Adresse au dossier",
      city: inv.address_snapshot?.city || "Québec",
      province: inv.address_snapshot?.province || "QC",
      postal_code: inv.address_snapshot?.postal_code || "",
    },
    items: lines.length
      ? lines.map((line: any) => ({
          category: "Other",
          description: line.description || line.line_type || "Ligne de facture",
          qty: Number(line.quantity || 1),
          unit_price: Number(line.unit_price || line.line_total || 0),
          amount: Number(line.line_total || 0),
        }))
      : [{ category: "Other", description: inv.notes || inv.invoice_number || "Facture Nivra", qty: 1, unit_price: Number(inv.subtotal || inv.total || 0), amount: Number(inv.subtotal || inv.total || 0) }],
    subtotal: Number(inv.subtotal || 0),
    taxes: {
      gst_rate: 0.05,
      gst_amount: Number(inv.tps_amount || 0),
      qst_rate: 0.09975,
      qst_amount: Number(inv.tvq_amount || 0),
    },
    total: Number(inv.total || 0),
    balance_due: Number(inv.balance_due || 0),
    payments_total: Number(inv.amount_paid || 0),
    payments: payments.map((p: any) => ({
      method: p.method || "card",
      status: p.status || "confirmed",
      paid_amount: Number(p.amount || 0),
      paid_at: p.received_at || p.created_at,
      payment_reference: p.nivra_reference || p.reference || p.square_payment_id || p.payment_number || p.id,
      processor_txn_id: p.square_payment_id || p.provider_payment_id || undefined,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// KPI Dashboard
// ─────────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  tone: "emerald" | "violet" | "amber" | "sky";
}) {
  const tones: Record<string, { bg: string; text: string; ring: string }> = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600", ring: "ring-emerald-500/20" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-600", ring: "ring-violet-500/20" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-600", ring: "ring-amber-500/20" },
    sky: { bg: "bg-sky-500/10", text: "text-sky-600", ring: "ring-sky-500/20" },
  };
  const t = tones[tone];
  return (
    <Card className={`p-4 ring-1 ${t.ring}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${t.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${t.text}`} />
        </div>
      </div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function DashboardKpis() {
  const { data } = useQuery({
    queryKey: ["core-public-kpis"],
    queryFn: async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 7);
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

      const [dayR, weekR, monthR, pendingR] = await Promise.all([
        supabase.from("billing_payments").select("amount")
          .eq("source", "public_pay").eq("status", "confirmed")
          .gte("created_at", startOfDay.toISOString()),
        supabase.from("billing_payments").select("amount")
          .eq("source", "public_pay").eq("status", "confirmed")
          .gte("created_at", startOfWeek.toISOString()),
        supabase.from("billing_payments").select("amount")
          .eq("source", "public_pay").eq("status", "confirmed")
          .gte("created_at", startOfMonth.toISOString()),
        supabase.from("public_payment_links").select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);

      const sum = (rows: any[] | null) =>
        (rows || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);

      return {
        day: sum(dayR.data),
        week: sum(weekR.data),
        month: sum(monthR.data),
        pending: pendingR.count || 0,
      };
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <KpiCard icon={DollarSign} tone="emerald" label="Aujourd'hui"
        value={fmt(data?.day || 0)} hint="Paiements publics reçus" />
      <KpiCard icon={TrendingUp} tone="violet" label="7 derniers jours"
        value={fmt(data?.week || 0)} hint="Total encaissé" />
      <KpiCard icon={Calendar} tone="sky" label="Ce mois"
        value={fmt(data?.month || 0)} hint="Total encaissé" />
      <KpiCard icon={Clock} tone="amber" label="Liens en attente"
        value={String(data?.pending || 0)} hint="Non encore payés" />
    </div>
  );
}

function PublicLinkDetailDialog({ row, open, onOpenChange }: { row: any | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["core-public-link-detail", row?.id, row?.nivra, row?.token],
    enabled: open && !!row?.id,
    queryFn: async () => {
      const attempts = await supabase
        .from("public_payment_attempts")
        .select("id, ip, identifier, success, user_agent, created_at")
        .or(`identifier.ilike.%${row.nivra}%,identifier.ilike.%${row.token || "__none__"}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      const payments = await supabase
        .from("billing_payments")
        .select("id, amount, status, method, received_at, created_at, square_payment_id, square_receipt_url, nivra_reference")
        .or(`nivra_reference.ilike.${row.nivra},id.eq.${row.payment_id || "00000000-0000-0000-0000-000000000000"}`)
        .order("created_at", { ascending: false })
        .limit(20);
      return { attempts: attempts.data || [], payments: payments.data || [] };
    },
  });

  if (!row) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lien public {row.nivra}</DialogTitle>
          <DialogDescription>Détails complets, statut et historique associé.</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Client</span><div className="font-medium">{row.client}</div></div>
          <div><span className="text-muted-foreground">Email</span><div className="font-medium break-all">{row.email || "—"}</div></div>
          <div><span className="text-muted-foreground">Montant</span><div className="font-semibold">{fmt(row.amount)}</div></div>
          <div><span className="text-muted-foreground">Statut</span><div className="font-medium">{row.kind}</div></div>
          <div><span className="text-muted-foreground">Créé le</span><div>{shortDateTime(row.created_at || row.date)}</div></div>
          <div><span className="text-muted-foreground">Expiration</span><div>{shortDateTime(row.expires_at)}</div></div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">Description</span><div>{row.invoice}</div></div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">Lien</span><div className="font-mono text-xs break-all">{publicPayUrl(row.token)}</div></div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <h3 className="font-semibold text-sm">Historique des tentatives de paiement</h3>
          {isLoading ? <div className="text-sm text-muted-foreground">Chargement…</div> : data?.attempts.length ? (
            <div className="rounded-md border overflow-hidden">
              {data.attempts.map((a: any) => (
                <div key={a.id} className="grid sm:grid-cols-[1fr_120px_160px] gap-2 p-2 border-b last:border-0 text-xs">
                  <div className="font-mono break-all">{a.identifier || "—"}</div>
                  <div>{a.success ? "Réussie" : "Échouée"}</div>
                  <div>{shortDateTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-muted-foreground">Aucune tentative enregistrée dans public_payment_attempts.</div>}
        </div>

        <div className="border-t pt-4 space-y-3">
          <h3 className="font-semibold text-sm">Paiements liés</h3>
          {data?.payments.length ? data.payments.map((p: any) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <div><span className="font-medium">{fmt(Number(p.amount))}</span> · {p.status} · {shortDateTime(p.received_at || p.created_at)}</div>
              <div className="font-mono text-xs">{p.square_payment_id || p.nivra_reference || p.id}</div>
            </div>
          )) : <div className="text-sm text-muted-foreground">Aucun paiement confirmé lié.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────
// History Tab — table with NVR
// ─────────────────────────────────────────────────────────────────────
function HistoryTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed" | "pending">("all");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<any | null>(null);

  const { data: successes, isLoading: loadingS } = useQuery({
    queryKey: ["core-public-payments-success"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_payments")
        .select("id, amount, created_at, received_at, nivra_reference, provider_payment_id, square_payment_id, square_receipt_url, payer_ip, invoice:billing_invoices(invoice_number, customer:billing_customers(first_name, last_name, email))")
        .eq("source", "public_pay")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pending } = useQuery({
    queryKey: ["core-public-payments-pending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("public_payment_links")
        .select("id, nivra_reference, recipient_name, recipient_email, amount_due, amount_paid, description, created_at, expires_at, status, token, paid_at, payment_id")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const { data: failures } = useQuery({
    queryKey: ["core-public-payments-failed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_system_alerts")
        .select("id, entity_id, entity_reference, details, created_at")
        .eq("alert_type", "square_charge_db_update_failed")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Realtime — new payments show instantly
  useEffect(() => {
    const ch = supabase
      .channel("public_pay_stream")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "billing_payments", filter: "source=eq.public_pay" },
        () => {
          qc.invalidateQueries({ queryKey: ["core-public-payments-success"] });
          qc.invalidateQueries({ queryKey: ["core-public-kpis"] });
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "public_payment_links" },
        () => {
          qc.invalidateQueries({ queryKey: ["core-public-payments-pending"] });
          qc.invalidateQueries({ queryKey: ["core-public-kpis"] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const rows = useMemo(() => {
    const success = (successes || []).map((r: any) => ({
      kind: "success" as const,
      id: r.id,
      date: r.received_at || r.created_at,
      client: r.invoice?.customer
        ? `${r.invoice.customer.first_name || ""} ${r.invoice.customer.last_name || ""}`.trim()
        : "—",
      email: r.invoice?.customer?.email || "",
      invoice: r.invoice?.invoice_number || "—",
      amount: Number(r.amount),
      nivra: r.nivra_reference || "—",
      sqRef: r.square_payment_id || r.provider_payment_id || "—",
      ip: r.payer_ip || "—",
      receipt: r.square_receipt_url || null,
    }));
    const pend = (pending || []).map((r: any) => ({
      kind: (r.status === "paid" || r.status === "completed" ? "success" : r.status === "cancelled" || r.status === "canceled" ? "failed" : "pending") as "success" | "failed" | "pending",
      sourceType: "link" as const,
      id: r.id,
      date: r.created_at,
      created_at: r.created_at,
      expires_at: r.expires_at,
      paid_at: r.paid_at,
      status: r.status,
      payment_id: r.payment_id,
      client: r.recipient_name || "—",
      email: r.recipient_email || "",
      invoice: r.description?.slice(0, 40) || "—",
      amount: Number(r.amount_paid || r.amount_due),
      amount_due: Number(r.amount_due),
      nivra: r.nivra_reference || "—",
      sqRef: "—",
      ip: "—",
      receipt: null,
      token: r.token,
    }));
    const failed = (failures || []).map((r: any) => ({
      kind: "failed" as const,
      id: r.id,
      date: r.created_at,
      client: "—",
      email: "",
      invoice: r.entity_id?.slice(0, 8) || "—",
      amount: Number(r.details?.amount || 0),
      nivra: "—",
      sqRef: r.entity_reference || "—",
      ip: "—",
      receipt: null,
    }));
    let all = [...pend, ...success, ...failed].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    if (statusFilter !== "all") all = all.filter((r) => r.kind === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      all = all.filter((r) =>
        r.client.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.invoice.toLowerCase().includes(q) ||
        r.nivra.toLowerCase().includes(q) ||
        r.sqRef.toLowerCase().includes(q),
      );
    }
    return all;
  }, [successes, pending, failures, search, statusFilter]);

  const doExport = () => {
    exportToCSV(
      rows.map((r) => ({
        date: new Date(r.date).toISOString(),
        statut: r.kind,
        client: r.client,
        email: r.email,
        nivra: r.nivra,
        facture: r.invoice,
        montant: r.amount.toFixed(2),
        ref_square: r.sqRef,
        ip: r.ip,
      })),
      "caisse-publique",
      [
        { key: "date", label: "Date" },
        { key: "statut", label: "Statut" },
        { key: "client", label: "Client" },
        { key: "email", label: "Email" },
        { key: "nivra", label: "Réf Nivra" },
        { key: "facture", label: "Facture" },
        { key: "montant", label: "Montant" },
        { key: "ref_square", label: "Réf Square" },
        { key: "ip", label: "IP" },
      ],
    );
  };

  const resendReceipt = async (row: any) => {
    if (!row.email) {
      toast.error("Aucun email disponible.");
      return;
    }
    setSendingId(row.id);
    try {
      let error: any = null;
      try { await enqueueCommunication({
        channel: "email",
        templateKey: "payment_receipt",
        recipient: row.email,
        idempotencyKey: `resend_receipt_${row.id}_${Date.now()}`,
        templateVars: {
          client_name: row.client || "Client",
          first_name: (row.client || "Client").split(" ")[0],
          invoice_number: row.invoice || row.nivra,
          amount: row.amount,
          amount_paid_today: row.amount,
          reference: row.nivra || row.sqRef,
          payment_method: "Carte de crédit — Square",
          payment_date: row.date,
          invoice_url: row.receipt || undefined,
          receipt_url: row.receipt || undefined,
        },
      }); } catch (__e) { error = __e; }
      if (error) throw error;
      toast.success("Reçu envoyé à " + row.email);
    } catch (e: any) {
      toast.error("Envoi échoué : " + (e?.message || String(e)));
    } finally {
      setSendingId(null);
    }
  };

  const sendPaymentLink = async (row: any) => {
    if (!row.email || !row.token) return toast.error("Email ou token manquant.");
    setSendingId(row.id);
    try {
      const url = publicPayUrl(row.token);
      let error: any = null;
      try { await enqueueCommunication({
        channel: "email",
        templateKey: "invoice_payment_link",
        recipient: row.email,
        idempotencyKey: `public_pay_resend_${row.id}_${Date.now()}`,
        templateVars: {
          client_name: row.client || "Client",
          first_name: (row.client || "Client").split(" ")[0],
          order_number: row.nivra,
          invoice_number: row.nivra,
          total: row.amount_due || row.amount,
          amount: row.amount_due || row.amount,
          approval_url: url,
          payment_url: url,
          summary: row.invoice || "Paiement Nivra Telecom",
          description: row.invoice || "Paiement Nivra Telecom",
          agent_name: "Nivra Telecom",
          valid_until: row.expires_at ? new Date(row.expires_at).toLocaleString("fr-CA") : "30 jours",
        },
      }); } catch (__e) { error = __e; }
      if (error) throw error;
      await supabase.from("public_payment_links").update({ sent_at: new Date().toISOString() }).eq("id", row.id);
      toast.success("Lien envoyé à " + row.email);
      qc.invalidateQueries({ queryKey: ["core-public-payments-pending"] });
    } catch (e: any) {
      toast.error("Envoi échoué : " + (e?.message || String(e)));
    } finally {
      setSendingId(null);
    }
  };

  const editLink = async (row: any) => {
    if (row.kind !== "pending") return toast.error("Modification bloquée : lien déjà payé ou annulé.");
    const amountRaw = window.prompt("Nouveau montant CAD", String(row.amount_due || row.amount));
    if (amountRaw === null) return;
    const amount = Number.parseFloat(amountRaw.replace(",", "."));
    if (!(amount >= 1)) return toast.error("Montant invalide.");
    const description = window.prompt("Description", row.invoice || "Paiement Nivra Telecom");
    if (description === null) return;
    const { error } = await supabase.from("public_payment_links").update({ amount_due: amount, description }).eq("id", row.id).eq("status", "pending");
    if (error) return toast.error(error.message);
    if (row.token) await supabase.from("field_payment_intents").update({ amount, description }).eq("public_token", row.token).neq("status", "completed");
    toast.success("Lien modifié");
    qc.invalidateQueries({ queryKey: ["core-public-payments-pending"] });
  };

  const extendLink = async (row: any) => {
    if (row.kind !== "pending") return toast.error("Prolongation bloquée : lien déjà payé ou annulé.");
    const daysRaw = window.prompt("Prolonger de combien de jours ?", "30");
    if (daysRaw === null) return;
    const days = Number.parseInt(daysRaw, 10);
    if (!(days > 0 && days <= 365)) return toast.error("Nombre de jours invalide.");
    const base = row.expires_at ? new Date(row.expires_at) : new Date();
    const next = new Date(Math.max(base.getTime(), Date.now()));
    next.setDate(next.getDate() + days);
    const { error } = await supabase.from("public_payment_links").update({ expires_at: next.toISOString() }).eq("id", row.id).eq("status", "pending");
    if (error) return toast.error(error.message);
    if (row.token) await supabase.from("field_payment_intents").update({ expires_at: next.toISOString() }).eq("public_token", row.token).neq("status", "completed");
    toast.success("Expiration prolongée");
    qc.invalidateQueries({ queryKey: ["core-public-payments-pending"] });
  };

  const cancelLink = async (row: any) => {
    if (row.kind !== "pending") return toast.error("Ce lien n'est plus annulable.");
    if (!window.confirm(`Annuler le lien ${row.nivra} ? Le paiement futur sera bloqué.`)) return;
    const { error } = await supabase.from("public_payment_links").update({ status: "cancelled" }).eq("id", row.id).eq("status", "pending");
    if (error) return toast.error(error.message);
    if (row.token) await supabase.from("field_payment_intents").update({ status: "cancelled" }).eq("public_token", row.token).neq("status", "completed");
    toast.success("Lien annulé");
    qc.invalidateQueries({ queryKey: ["core-public-payments-pending"] });
    qc.invalidateQueries({ queryKey: ["core-public-kpis"] });
  };

  const viewReceiptPdf = (row: any, open = true) => {
    const result = generateReceiptPDF({
      receipt_number: row.nivra || row.sqRef || row.id,
      payment_date: row.paid_at || row.date || new Date().toISOString(),
      payment_method: "card",
      amount_paid: Number(row.amount || row.amount_due || 0),
      invoice_number: row.invoice || row.nivra,
      invoice_total: Number(row.amount || row.amount_due || 0),
      client_name: row.client || "Client Nivra",
      client_email: row.email || "support@nivra-telecom.ca",
      account_number: row.nivra || "N/A",
      billed_items: [{ description: row.invoice || "Paiement Nivra Telecom", amount: Number(row.amount || row.amount_due || 0) }],
      transaction_reference: row.sqRef !== "—" ? row.sqRef : row.nivra,
      balance_remaining: 0,
      subtotal: Number(row.amount || row.amount_due || 0),
    });
    if (!result.success || !result.blob) return toast.error(result.error || "PDF indisponible");
    return open ? safePDFOpen(result.blob, `recu-${row.nivra || row.id}.pdf`) : safePDFDownload(result.blob, `recu-${row.nivra || row.id}.pdf`);
  };

  const isLoading = loadingS;

  const StatusBadge = ({ kind }: { kind: string }) => {
    if (kind === "success")
      return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-0">✓ Réussi</Badge>;
    if (kind === "pending")
      return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 border-0">⏳ En attente</Badge>;
    return <Badge className="bg-red-500/15 text-red-700 hover:bg-red-500/20 border-0">✕ Échec</Badge>;
  };

  return (
    <div className="space-y-4">
      <DashboardKpis />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche : client, email, facture, NVR, réf Square…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "success", "pending", "failed"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Tous" : s === "success" ? "Réussis" : s === "pending" ? "En attente" : "Échecs"}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={doExport} disabled={!rows.length}>
          <Download className="w-4 h-4 mr-1" /> CSV
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Aucune transaction à afficher.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Statut</th>
                  <th className="p-3 font-medium">Client</th>
                  <th className="p-3 font-medium">Réf. Nivra</th>
                  <th className="p-3 font-medium">Facture</th>
                  <th className="p-3 font-medium text-right">Montant</th>
                  <th className="p-3 font-medium">IP</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.kind}-${r.id}`} className="border-t hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap text-xs">
                      {new Date(r.date).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="p-3"><StatusBadge kind={r.kind} /></td>
                    <td className="p-3">
                      <div className="font-medium">{r.client}</div>
                      {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-xs font-semibold text-violet-700">{r.nivra}</div>
                      {r.sqRef !== "—" && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          SQ: {String(r.sqRef).slice(0, 12)}…
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{r.invoice}</td>
                    <td className="p-3 text-right font-semibold">{fmt(r.amount)}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{r.ip}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        {r.receipt && (
                          <Button asChild size="sm" variant="ghost" className="h-8">
                            <a href={r.receipt} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        )}
                        {(r as any).sourceType === "link" && (
                          <Button size="sm" variant="ghost" className="h-8" title="Voir les détails complets" onClick={() => setSelectedLink(r)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {(r as any).sourceType === "link" && (r as any).token && (
                          <Button size="sm" variant="ghost" className="h-8" title="Copier le lien" onClick={() => copyText(publicPayUrl((r as any).token), "Lien") }>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {(r as any).sourceType === "link" && r.email && (
                          <Button size="sm" variant="ghost" className="h-8" title="Envoyer/renvoyer le lien par email" disabled={sendingId === r.id} onClick={() => sendPaymentLink(r)}>
                            {sendingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        {(r as any).sourceType === "link" && r.kind === "pending" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-8" title="Modifier le montant" onClick={() => editLink(r)}><Edit3 className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-8" title="Prolonger l'expiration" onClick={() => extendLink(r)}><RefreshCw className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-8" title="Annuler le lien" onClick={() => cancelLink(r)}><Ban className="w-3.5 h-3.5" /></Button>
                          </>
                        )}
                        {r.kind === "success" && (
                          <Button size="sm" variant="ghost" className="h-8" title="Voir le reçu PDF" onClick={() => viewReceiptPdf(r)}>
                            <Receipt className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {r.kind === "success" && r.email && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            disabled={sendingId === r.id}
                            onClick={() => resendReceipt(r)}
                          >
                            {sendingId === r.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Send className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        {r.kind === "pending" && (r as any).token && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => {
                              const url = `${window.location.origin}/payer/lien/${(r as any).token}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Lien copié");
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <PublicLinkDetailDialog row={selectedLink} open={!!selectedLink} onOpenChange={(open) => !open && setSelectedLink(null)} />
    </div>
  );
}

function InvoiceDetailDialog({ invoiceId, open, onOpenChange }: { invoiceId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["core-public-invoice-detail", invoiceId],
    enabled: open && !!invoiceId,
    queryFn: async () => {
      const { data: invoice, error } = await supabase.from("billing_invoices").select("*").eq("id", invoiceId!).single();
      if (error) throw error;
      const [lines, payments, customer] = await Promise.all([
        supabase.from("billing_invoice_lines").select("*").eq("invoice_id", invoiceId!).order("created_at", { ascending: true }),
        supabase.from("billing_payments").select("id, payment_number, amount, method, status, received_at, reference, square_payment_id, square_receipt_url, nivra_reference, created_at").eq("invoice_id", invoiceId!).order("created_at", { ascending: false }),
        supabase.from("billing_customers").select("id, first_name, last_name, email, phone, user_id").eq("id", invoice.customer_id).maybeSingle(),
      ]);
      return { invoice, lines: lines.data || [], payments: payments.data || [], customer: customer.data };
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Facture {data?.invoice?.invoice_number || "Core"}</DialogTitle>
          <DialogDescription>Détail complet, lignes de facturation et paiements associés.</DialogDescription>
        </DialogHeader>
        {isLoading ? <div className="p-6 text-sm text-muted-foreground">Chargement…</div> : data && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div><span className="text-muted-foreground">Client</span><div className="font-medium">{`${data.customer?.first_name || ""} ${data.customer?.last_name || ""}`.trim() || "—"}</div></div>
              <div><span className="text-muted-foreground">Email</span><div className="font-medium break-all">{data.customer?.email || "—"}</div></div>
              <div><span className="text-muted-foreground">Statut</span><div className="font-medium">{data.invoice.status}</div></div>
              <div><span className="text-muted-foreground">Total</span><div className="font-semibold">{fmt(Number(data.invoice.total))}</div></div>
              <div><span className="text-muted-foreground">Payé</span><div>{fmt(Number(data.invoice.amount_paid || 0))}</div></div>
              <div><span className="text-muted-foreground">Solde</span><div>{fmt(Number(data.invoice.balance_due || 0))}</div></div>
              <div><span className="text-muted-foreground">Créée</span><div>{shortDateTime(data.invoice.created_at)}</div></div>
              <div><span className="text-muted-foreground">Échéance</span><div>{data.invoice.due_date || "—"}</div></div>
              <div><span className="text-muted-foreground">Méthode</span><div>{data.invoice.payment_method || "—"}</div></div>
              <div className="sm:col-span-3"><span className="text-muted-foreground">Description / notes</span><div>{data.invoice.notes || "—"}</div></div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Lignes de facture</h3>
              <div className="rounded-md border overflow-hidden">
                {data.lines.length ? data.lines.map((line: any) => (
                  <div key={line.id} className="grid sm:grid-cols-[1fr_80px_120px_120px] gap-2 p-2 border-b last:border-0 text-sm">
                    <div>{line.description || line.line_type || "—"}</div>
                    <div>Qté {line.quantity || 1}</div>
                    <div>{fmt(Number(line.unit_price || 0))}</div>
                    <div className="font-semibold text-right">{fmt(Number(line.line_total || 0))}</div>
                  </div>
                )) : <div className="p-3 text-sm text-muted-foreground">Aucune ligne enregistrée.</div>}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Historique des paiements</h3>
              <div className="rounded-md border overflow-hidden">
                {data.payments.length ? data.payments.map((p: any) => (
                  <div key={p.id} className="grid sm:grid-cols-[120px_100px_1fr_160px] gap-2 p-2 border-b last:border-0 text-sm">
                    <div className="font-semibold">{fmt(Number(p.amount || 0))}</div>
                    <div>{p.status}</div>
                    <div className="font-mono text-xs break-all">{p.nivra_reference || p.square_payment_id || p.reference || p.payment_number || p.id}</div>
                    <div>{shortDateTime(p.received_at || p.created_at)}</div>
                  </div>
                )) : <div className="p-3 text-sm text-muted-foreground">Aucun paiement sur cette facture.</div>}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CoreInvoicesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [payInvoice, setPayInvoice] = useState<any | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["core-public-billing-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total, subtotal, tps_amount, tvq_amount, balance_due, amount_paid, status, due_date, created_at, notes, customer_id, customer:billing_customers(id, first_name, last_name, email, phone)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (invoices || []).filter((r: any) => {
      if (!q) return true;
      const name = `${r.customer?.first_name || ""} ${r.customer?.last_name || ""}`.toLowerCase();
      return String(r.invoice_number || "").toLowerCase().includes(q) || name.includes(q) || String(r.customer?.email || "").toLowerCase().includes(q);
    });
  }, [invoices, search]);

  const fetchInvoiceDetail = async (invoiceId: string) => {
    const { data: invoice, error } = await supabase.from("billing_invoices").select("*").eq("id", invoiceId).single();
    if (error) throw error;
    const [lines, payments, customer] = await Promise.all([
      supabase.from("billing_invoice_lines").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: true }),
      supabase.from("billing_payments").select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false }),
      supabase.from("billing_customers").select("id, first_name, last_name, email, phone, user_id").eq("id", invoice.customer_id).maybeSingle(),
    ]);
    return { invoice, lines: lines.data || [], payments: payments.data || [], customer: customer.data };
  };

  const generatePdf = async (row: any, open = false) => {
    try {
      const detail = await fetchInvoiceDetail(row.id);
      const result = await generateInvoicePDF(buildInvoicePdfData(detail), { invoice_id: row.id });
      if (!result.success || !result.blob || !result.filename) throw new Error(result.error || "PDF indisponible");
      if (open) safePDFOpen(result.blob, result.filename);
      else safePDFDownload(result.blob, result.filename);
    } catch (e: any) {
      toast.error(e?.message || "Erreur PDF");
    }
  };

  const sendInvoiceEmail = async (row: any) => {
    const email = row.customer?.email;
    if (!email) return toast.error("Email client manquant.");
    setSendingId(row.id);
    try {
      let error: any = null;
      try { await enqueueCommunication({
        channel: "email",
        templateKey: "invoice_sent",
        recipient: email,
        idempotencyKey: `core_invoice_send_${row.id}_${Date.now()}`,
        templateVars: {
          client_name: `${row.customer?.first_name || ""} ${row.customer?.last_name || ""}`.trim() || "Client",
          first_name: row.customer?.first_name || "Client",
          invoice_number: row.invoice_number,
          period: row.due_date || "—",
          subtotal: Number(row.subtotal || 0),
          tps: Number(row.tps_amount || 0),
          tvq: Number(row.tvq_amount || 0),
          total: Number(row.total || 0),
          amount_due: Number(row.balance_due || 0),
          due_date: row.due_date,
          portal_url: window.location.origin,
          payment_url: `${window.location.origin}/payer`,
        },
      }); } catch (__e) { error = __e; }
      if (error) throw error;
      toast.success("Facture envoyée à " + email);
    } catch (e: any) {
      toast.error("Envoi échoué : " + (e?.message || String(e)));
    } finally {
      setSendingId(null);
    }
  };

  const editInvoice = async (row: any) => {
    if (row.status === "paid" || Number(row.balance_due || 0) <= 0) return toast.error("Facture déjà payée : modification bloquée.");
    const amountRaw = window.prompt("Nouveau total facture CAD", String(row.total || row.balance_due || 0));
    if (amountRaw === null) return;
    const total = Number.parseFloat(amountRaw.replace(",", "."));
    if (!(total >= 0)) return toast.error("Montant invalide.");
    const notes = window.prompt("Description / notes", row.notes || row.invoice_number || "");
    if (notes === null) return;
    const amountPaid = Number(row.amount_paid || 0);
    const balanceDue = Math.max(0, Math.round((total - amountPaid) * 100) / 100);
    const { error } = await supabase.from("billing_invoices").update({ total, balance_due: balanceDue, notes }).eq("id", row.id).neq("status", "paid");
    if (error) return toast.error(error.message);
    toast.success("Facture modifiée");
    qc.invalidateQueries({ queryKey: ["core-public-billing-invoices"] });
  };

  const cancelInvoice = async (row: any) => {
    if (row.status === "paid" || Number(row.amount_paid || 0) > 0) return toast.error("Facture payée ou partiellement payée : annulation bloquée.");
    if (!window.confirm(`Annuler la facture ${row.invoice_number} ?`)) return;
    const { error } = await supabase.from("billing_invoices").update({ status: "cancelled", balance_due: 0 }).eq("id", row.id).eq("amount_paid", 0);
    if (error) return toast.error(error.message);
    toast.success("Facture annulée");
    qc.invalidateQueries({ queryKey: ["core-public-billing-invoices"] });
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Recherche facture, client, email…" className="pl-9" />
      </div>
      <Card className="overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Chargement…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr><th className="p-3">Facture</th><th className="p-3">Client</th><th className="p-3">Statut</th><th className="p-3 text-right">Solde</th><th className="p-3">Échéance</th><th className="p-3 text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map((r: any) => {
                  const name = `${r.customer?.first_name || ""} ${r.customer?.last_name || ""}`.trim() || "—";
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{r.invoice_number}</td>
                      <td className="p-3"><div className="font-medium">{name}</div><div className="text-xs text-muted-foreground">{r.customer?.email || "—"}</div></td>
                      <td className="p-3"><Badge variant="outline">{r.status}</Badge></td>
                      <td className="p-3 text-right font-semibold">{fmt(Number(r.balance_due || 0))}</td>
                      <td className="p-3">{r.due_date || "—"}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8" title="Voir la facture complète" onClick={() => setSelectedInvoiceId(r.id)}><Eye className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-8" title="Modifier montant ou description" onClick={() => editInvoice(r)}><Edit3 className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-8" title="Annuler la facture" onClick={() => cancelInvoice(r)}><Ban className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-8" title="Envoyer la facture par email" disabled={sendingId === r.id} onClick={() => sendInvoiceEmail(r)}>{sendingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}</Button>
                          <Button size="sm" variant="ghost" className="h-8" title="Voir le PDF" onClick={() => generatePdf(r, true)}><FileText className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-8" title="Télécharger le PDF" onClick={() => generatePdf(r, false)}><Download className="w-3.5 h-3.5" /></Button>
                          {Number(r.balance_due || 0) > 0 && r.status !== "cancelled" && <Button size="sm" variant="ghost" className="h-8" title="Prendre un paiement Square" onClick={() => setPayInvoice(r)}><CreditCard className="w-3.5 h-3.5" /></Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <InvoiceDetailDialog invoiceId={selectedInvoiceId} open={!!selectedInvoiceId} onOpenChange={(open) => !open && setSelectedInvoiceId(null)} />
      <CoreSquarePaymentDialog
        open={!!payInvoice}
        onOpenChange={(open) => !open && setPayInvoice(null)}
        unpaidInvoices={payInvoice ? [{ id: payInvoice.id, invoice_number: payInvoice.invoice_number, balance_due: payInvoice.balance_due, total: payInvoice.total }] : []}
        customerName={payInvoice ? `${payInvoice.customer?.first_name || ""} ${payInvoice.customer?.last_name || ""}`.trim() : undefined}
        customerEmail={payInvoice?.customer?.email || undefined}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["core-public-billing-invoices"] });
          qc.invalidateQueries({ queryKey: ["core-public-payments-success"] });
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Create payment link
// ─────────────────────────────────────────────────────────────────────
async function createPaymentLink(params: {
  customer_name: string;
  customer_email: string;
  amount: number;
  description: string;
  agent_id: string;
  as_invoice?: boolean;
}) {
  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Insert into public_payment_links (with NVR auto)
  // We need a nivra_reference: generate via RPC (function is SECURITY DEFINER)
  const { data: nvr } = await supabase.rpc("generate_nivra_reference");
  const nivraRef: string = nvr || `NVR-${new Date().getFullYear()}-${Math.floor(Math.random() * 99999).toString().padStart(5, "0")}`;

  const { data: link, error: linkErr } = await supabase
    .from("public_payment_links")
    .insert({
      token,
      nivra_reference: nivraRef,
      recipient_name: params.customer_name,
      recipient_email: params.customer_email,
      amount_due: params.amount,
      description: params.description,
      created_by: params.agent_id,
      expires_at: expiresAt.toISOString(),
      status: "pending",
    })
    .select("id, token, nivra_reference")
    .single();

  if (linkErr) throw linkErr;

  // Also create legacy field_payment_intents entry so /payer/lien/:token keeps working
  const { data: intent, error } = await supabase
    .from("field_payment_intents")
    .insert({
      agent_id: params.agent_id,
      amount: params.amount,
      currency: "CAD",
      status: "pending",
      payment_method: "square",
      customer_name: params.customer_name,
      customer_email: params.customer_email,
      description: params.description,
      public_token: token,
      source: params.as_invoice ? "public_pay_admin_invoice" : "public_pay_admin",
      expires_at: expiresAt.toISOString(),
    })
    .select("id, public_token")
    .single();

  if (error) throw error;
  return { ...intent, nivra_reference: link.nivra_reference };
}

function CreateLinkForm({ withCustomerSearch }: { withCustomerSearch: boolean }) {
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; token: string; nvr: string } | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const { data: matches } = useQuery({
    queryKey: ["core-cashier-client-search", searchQ],
    enabled: withCustomerSearch && searchQ.trim().length >= 2,
    queryFn: async () => {
      const q = `%${searchQ.trim()}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, phone, client_number")
        .or(`email.ilike.${q},first_name.ilike.${q},last_name.ilike.${q},client_number.ilike.${q},phone.ilike.${q}`)
        .limit(6);
      return data || [];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!customerName.trim() || !customerEmail.trim() || !description.trim() || !(amt >= 1)) {
      toast.error("Nom, email, description et montant (≥1$) sont requis.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const agentId = u?.user?.id;
      if (!agentId) throw new Error("Session expirée");

      const link = await createPaymentLink({
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        amount: amt,
        description: description.trim(),
        agent_id: agentId,
        as_invoice: withCustomerSearch,
      });
      const url = `${window.location.origin}/payer/lien/${link.public_token}`;
      setResult({ url, token: link.public_token!, nvr: link.nivra_reference });
      toast.success(`Lien créé — ${link.nivra_reference}`);
      qc.invalidateQueries({ queryKey: ["core-public-payments-pending"] });
      qc.invalidateQueries({ queryKey: ["core-public-kpis"] });
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Copié");
  };

  const sendEmail = async () => {
    if (!result) return;
    setSending(true);
    try {
      const expiresIn24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString("fr-CA");
      let error: any = null;
      try { await enqueueCommunication({
        channel: "email",
        templateKey: "invoice_payment_link",
        recipient: customerEmail.trim(),
        idempotencyKey: `public_pay_link_${result.token}`,
        templateVars: {
          client_name: customerName.trim(),
          first_name: customerName.trim().split(" ")[0],
          order_number: result.nvr,
          invoice_number: result.nvr,
          total: parseFloat(amount),
          amount: parseFloat(amount),
          approval_url: result.url,
          payment_url: result.url,
          summary: description || "Paiement Nivra Telecom",
          description: description || "Paiement Nivra Telecom",
          agent_name: "Nivra Telecom",
          valid_until: expiresIn24h,
        },
      }); } catch (__e) { error = __e; }
      if (error) throw error;
      toast.success("Email envoyé à " + customerEmail);
    } catch (err: any) {
      toast.error("Envoi échoué : " + (err?.message || String(err)));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setResult(null);
    setCustomerName("");
    setCustomerEmail("");
    setAmount("");
    setDescription("");
    setSearchQ("");
  };

  if (result) {
    return (
      <Card className="p-6 space-y-5">
        <div className="text-center pb-4 border-b">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/15 mb-3">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="text-sm text-muted-foreground">Lien de paiement créé</div>
          <div className="text-3xl font-bold font-mono text-violet-700 mt-1 tracking-wide">
            {result.nvr}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Lien à envoyer au client</div>
          <div className="font-mono text-sm break-all p-3 rounded-lg bg-muted border">
            {result.url}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <Button onClick={() => copy(result.url, "url")} variant="outline">
            {copied === "url" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copier le lien
          </Button>
          <Button onClick={() => copy(result.nvr, "nvr")} variant="outline">
            {copied === "nvr" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copier NVR
          </Button>
          <Button onClick={sendEmail} disabled={sending} className="sm:col-span-2">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Envoyer par email au client
          </Button>
          <Button onClick={reset} variant="ghost" className="sm:col-span-2">
            Créer un autre lien
          </Button>
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">
          Le lien expire dans 30 jours. Le paiement crédite automatiquement la facture,
          crée une note interne, et envoie un reçu par courriel.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-4">
        {withCustomerSearch && (
          <div>
            <Label className="mb-1.5 block">Rechercher un client existant (optionnel)</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Nom, email, téléphone, n° compte…"
                className="pl-9"
              />
            </div>
            {matches && matches.length > 0 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-auto border rounded-lg">
                {matches.map((m: any) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setCustomerName(`${m.first_name || ""} ${m.last_name || ""}`.trim());
                      setCustomerEmail(m.email || "");
                      setSearchQ("");
                    }}
                    className="w-full text-left p-2.5 hover:bg-muted text-sm border-b last:border-0"
                  >
                    <div className="font-medium">
                      {`${m.first_name || ""} ${m.last_name || ""}`.trim() || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.email} · {m.client_number || m.phone || ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cname" className="mb-1.5 block">Nom du client *</Label>
            <Input id="cname" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="cemail" className="mb-1.5 block">Email *</Label>
            <Input id="cemail" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label htmlFor="cdesc" className="mb-1.5 block">Description *</Label>
          <Textarea
            id="cdesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={withCustomerSearch ? "ex : Facture #INV-2026-0123 — Internet Giga janvier 2026" : "ex : Rattrapage solde compte"}
            rows={2}
            required
          />
        </div>
        <div>
          <Label htmlFor="camt" className="mb-1.5 block">Montant (CAD) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="camt"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-7"
              placeholder="0,00"
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={submitting} size="lg" className="w-full">
          {submitting
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <Plus className="w-4 h-4 mr-2" />}
          Générer le lien de paiement
        </Button>
      </form>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────
export default function CorePublicPaymentsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Caisse publique</h1>
          <p className="text-sm text-muted-foreground">
            Encaissements via <span className="font-mono">/payer</span> — tableau de bord temps réel,
            création de liens et facturation rapide.
          </p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="invoices">Factures Core</TabsTrigger>
          <TabsTrigger value="new-link">Créer un lien</TabsTrigger>
          <TabsTrigger value="quick-invoice">Facture rapide</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <HistoryTab />
        </TabsContent>

        <TabsContent value="invoices">
          <CoreInvoicesTab />
        </TabsContent>

        <TabsContent value="new-link">
          <div className="mb-3 text-sm text-muted-foreground">
            Créer un lien pour un client non enregistré — nom et email suffisent.
          </div>
          <CreateLinkForm withCustomerSearch={false} />
        </TabsContent>

        <TabsContent value="quick-invoice">
          <div className="mb-3 text-sm text-muted-foreground">
            Créer un lien pour un client existant ou nouveau — recherche par nom, email, téléphone ou n° de compte.
          </div>
          <CreateLinkForm withCustomerSearch={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
