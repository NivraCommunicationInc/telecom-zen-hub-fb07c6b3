import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, ExternalLink, Copy, Mail, Search, Plus, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV } from "@/core-app/lib/exportUtils";

const fmt = (n: number) => Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

// ────────────────────────────────────────────────────────────────────────
// Tab A — History
// ────────────────────────────────────────────────────────────────────────
function HistoryTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");

  const { data: successes, isLoading: loadingS } = useQuery({
    queryKey: ["core-public-payments-success"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_payments")
        .select("id, amount, created_at, received_at, provider_payment_id, square_payment_id, square_receipt_url, payer_ip, invoice:billing_invoices(invoice_number, customer:billing_customers(first_name, last_name, email))")
        .eq("source", "public_pay")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: failures, isLoading: loadingF } = useQuery({
    queryKey: ["core-public-payments-failed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_system_alerts")
        .select("id, entity_id, entity_reference, details, created_at")
        .eq("alert_type", "square_charge_db_update_failed")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

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
      ref: r.square_payment_id || r.provider_payment_id || "—",
      ip: r.payer_ip || "—",
      receipt: r.square_receipt_url || null,
    }));
    const failed = (failures || []).map((r: any) => ({
      kind: "failed" as const,
      id: r.id,
      date: r.created_at,
      client: "—",
      email: "",
      invoice: r.entity_id?.slice(0, 8) || "—",
      amount: Number(r.details?.amount || 0),
      ref: r.entity_reference || "—",
      ip: "—",
      receipt: null,
    }));
    let all = [...success, ...failed].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    if (statusFilter !== "all") all = all.filter((r) => r.kind === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      all = all.filter(
        (r) =>
          r.client.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.invoice.toLowerCase().includes(q) ||
          r.ref.toLowerCase().includes(q),
      );
    }
    return all;
  }, [successes, failures, search, statusFilter]);

  const isLoading = loadingS || loadingF;

  const doExport = () => {
    exportToCSV(
      rows.map((r) => ({
        date: new Date(r.date).toISOString(),
        statut: r.kind === "success" ? "Succès" : "Échec",
        client: r.client,
        email: r.email,
        facture: r.invoice,
        montant: r.amount.toFixed(2),
        reference_square: r.ref,
        ip: r.ip,
      })),
      "caisse-publique",
      [
        { key: "date", label: "Date" },
        { key: "statut", label: "Statut" },
        { key: "client", label: "Client" },
        { key: "email", label: "Email" },
        { key: "facture", label: "Facture" },
        { key: "montant", label: "Montant" },
        { key: "reference_square", label: "Réf Square" },
        { key: "ip", label: "IP" },
      ],
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche : client, email, facture, réf…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "success", "failed"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Tous" : s === "success" ? "Succès" : "Échecs"}
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
                  <th className="p-3 font-medium">Facture</th>
                  <th className="p-3 font-medium text-right">Montant</th>
                  <th className="p-3 font-medium">Réf Square</th>
                  <th className="p-3 font-medium">IP</th>
                  <th className="p-3 font-medium">Reçu</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap">{new Date(r.date).toLocaleString("fr-CA")}</td>
                    <td className="p-3">
                      {r.kind === "success" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">Succès</Badge>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-600 hover:bg-red-500/20">Échec</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div>{r.client}</div>
                      {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                    </td>
                    <td className="p-3 font-mono text-xs">{r.invoice}</td>
                    <td className="p-3 text-right font-medium">{fmt(r.amount)}</td>
                    <td className="p-3 font-mono text-xs">{String(r.ref).slice(0, 20)}…</td>
                    <td className="p-3 font-mono text-xs">{r.ip}</td>
                    <td className="p-3">
                      {r.receipt ? (
                        <a href={r.receipt} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          Voir <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Shared: create a payment link (used by Tab B and Tab C)
// ────────────────────────────────────────────────────────────────────────
async function createPaymentLink(params: {
  customer_name: string;
  customer_email: string;
  amount: number;
  description: string;
  agent_id: string;
  as_invoice?: boolean;
}) {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data, error } = await supabase
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
  return data;
}

function CreateLinkForm({ withCustomerSearch }: { withCustomerSearch: boolean }) {
  const qc = useQueryClient();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ url: string; token: string } | null>(null);

  // Optional existing-client search
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
      setResult({ url, token: link.public_token! });
      toast.success("Lien créé");
      qc.invalidateQueries({ queryKey: ["core-public-payments-success"] });
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Lien copié");
  };

  const sendEmail = async () => {
    if (!result) return;
    setSending(true);
    try {
      const { error } = await supabase.from("email_queue").insert({
        event_key: `public_pay_link_${result.token}`,
        to_email: customerEmail.trim(),
        template_key: "generic_notification",
        template_vars: {
          client_name: customerName.trim(),
          first_name: customerName.trim().split(" ")[0],
          subject: "Lien de paiement Nivra Telecom",
          heading: "Un paiement est en attente",
          body_text: `${description}\n\nMontant : ${fmt(parseFloat(amount))}\n\nCliquez sur le lien ci-dessous pour payer en ligne par carte de crédit :`,
          cta_label: "Payer maintenant",
          cta_url: result.url,
        },
        status: "queued",
        attempts: 0,
        max_attempts: 5,
      });
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
      <Card className="p-6 space-y-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">Lien de paiement généré</div>
          <div className="font-mono text-sm break-all p-3 rounded bg-muted">{result.url}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copyLink} variant="outline">
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            Copier le lien
          </Button>
          <Button onClick={sendEmail} disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
            Envoyer par email
          </Button>
          <Button onClick={reset} variant="ghost">Nouveau lien</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Le lien expire dans 30 jours. Une fois payé, la note et l'email de confirmation sont créés automatiquement.
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
              <div className="mt-2 space-y-1 max-h-40 overflow-auto border rounded">
                {matches.map((m: any) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setCustomerName(`${m.first_name || ""} ${m.last_name || ""}`.trim());
                      setCustomerEmail(m.email || "");
                      setSearchQ("");
                    }}
                    className="w-full text-left p-2 hover:bg-muted text-sm"
                  >
                    <div className="font-medium">{`${m.first_name || ""} ${m.last_name || ""}`.trim() || "—"}</div>
                    <div className="text-xs text-muted-foreground">{m.email} · {m.client_number || m.phone || ""}</div>
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
            placeholder={withCustomerSearch ? "ex : Facture #1234 — Internet Giga janvier 2026" : "ex : Rattrapage solde compte"}
            rows={2}
            required
          />
        </div>
        <div>
          <Label htmlFor="camt" className="mb-1.5 block">Montant (CAD) *</Label>
          <Input
            id="camt"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={submitting} size="lg" className="w-full">
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Générer le lien de paiement
        </Button>
      </form>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────
export default function CorePublicPaymentsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Caisse publique</h1>
          <p className="text-sm text-muted-foreground">
            Historique des paiements reçus via /payer, création de liens de paiement à envoyer aux clients.
          </p>
        </div>
      </div>

      <Tabs defaultValue="history" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="new-link">Nouveau lien</TabsTrigger>
          <TabsTrigger value="quick-invoice">Facture rapide</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>

        <TabsContent value="new-link">
          <div className="mb-3 text-sm text-muted-foreground">
            Créer un lien de paiement rapide pour un client non enregistré (nom + email suffisent).
          </div>
          <CreateLinkForm withCustomerSearch={false} />
        </TabsContent>

        <TabsContent value="quick-invoice">
          <div className="mb-3 text-sm text-muted-foreground">
            Créer un lien de paiement pour un client existant (recherche par nom/email/n° compte) ou pour un nouveau client.
          </div>
          <CreateLinkForm withCustomerSearch={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
