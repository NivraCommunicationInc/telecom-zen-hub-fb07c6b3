/**
 * CorePDFTemplatesPage — PDF template preview and generation from real invoices
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Database, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

type SendResult = { type: string; status: "ok" | "skipped" | "error"; detail?: string };

export default function CorePDFTemplatesPage() {
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [sentOrder, setSentOrder] = useState("");

  const { data: invoices = [] } = useQuery({
    queryKey: ["core-pdf-invoices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total, status, order_id, billing_customers(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const handleSendEmail = async () => {
    const dest = prompt("Envoyer les PDFs à :", "support@nivra-telecom.ca");
    if (!dest) return;

    setLoading(true);
    setResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Session expirée — reconnectez-vous");

      const selectedInv = invoices.find((inv: any) => inv.id === selectedInvoice);
      const orderId = (selectedInv as any)?.order_id ?? undefined;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-test-pdf-email`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: dest, ...(orderId ? { orderId } : {}) }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      setResults(json.results ?? []);
      setSentTo(json.to ?? dest);
      setSentOrder(json.order_number ?? "—");
      toast.success(`PDFs envoyés à ${dest}`);
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Templates PDF</h1>
        <p className="text-sm text-[hsl(var(--core-text-secondary))]">Génération et envoi des documents depuis les données réelles</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice selector + action */}
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Source de données</h2>
          </div>
          <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
            <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]">
              <SelectValue placeholder="Sélectionner une facture (optionnel)" />
            </SelectTrigger>
            <SelectContent>
              {invoices.map((inv: any) => (
                <SelectItem key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {inv.billing_customers?.first_name} {inv.billing_customers?.last_name} ({inv.total?.toFixed(2)}$)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-[hsl(var(--core-text-secondary))]">
            Si aucune facture sélectionnée, la dernière commande en base sera utilisée.
          </p>
          <Button
            onClick={handleSendEmail}
            disabled={loading}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white w-full"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Génération en cours…</>
              : <><Send className="w-4 h-4" />Envoyer les 4 PDFs par email</>}
          </Button>
        </div>

        {/* Template list */}
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Templates envoyés</h2>
          </div>
          {["Facture", "Reçu de paiement", "Contrat de service V3", "Sommaire de commande"].map((t) => (
            <div key={t} className="flex items-center justify-between py-2 border-b border-[hsl(220,15%,16%)] last:border-0">
              <span className="text-sm text-[hsl(var(--core-text-secondary))]">{t}</span>
              <Badge className="bg-emerald-600/15 text-emerald-400 border-0 text-[10px]">Actif</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] overflow-hidden">
          <div className="px-4 py-2 bg-[hsl(220,15%,14%)] text-[11px] text-[hsl(var(--core-text-secondary))]">
            Envoyé à <strong className="text-[hsl(var(--core-text-primary))]">{sentTo}</strong>
            {" "}— commande <strong className="text-[hsl(var(--core-text-primary))]">{sentOrder}</strong>
          </div>
          <div className="divide-y divide-[hsl(220,15%,14%)]">
            {results.map((r, i) => (
              <div key={i} className="px-4 py-2 flex items-center gap-3 text-[12px]">
                {r.status === "ok"
                  ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  : r.status === "skipped"
                  ? <XCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                <span className="text-[hsl(var(--core-text-primary))] font-medium w-24 flex-shrink-0">{r.type}</span>
                <span className="text-[hsl(var(--core-text-secondary))]">{r.detail ?? r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
