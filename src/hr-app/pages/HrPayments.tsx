/**
 * HrPayments — Mirror page for the HR portal (employee self-view).
 * Same data, scoped to current user by RLS.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, FileText, CheckCircle2, Clock, XCircle, Send, AlertTriangle, Ban, RotateCcw, ShieldCheck, Loader2, Mail } from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-gray-500/20 text-gray-300 border-gray-500/40", icon: FileText },
  scheduled: { label: "Programmé", color: "bg-blue-500/20 text-blue-300 border-blue-500/40", icon: Clock },
  pending_approval: { label: "Approbation requise", color: "bg-amber-500/20 text-amber-300 border-amber-500/40", icon: ShieldCheck },
  approved: { label: "Approuvé", color: "bg-violet-500/20 text-violet-300 border-violet-500/40", icon: CheckCircle2 },
  processing: { label: "En traitement", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40", icon: Loader2 },
  sent: { label: "Envoyé", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: Send },
  confirmed: { label: "Confirmé", color: "bg-emerald-600/30 text-emerald-200 border-emerald-600/60", icon: CheckCircle2 },
  failed: { label: "Échoué", color: "bg-red-500/20 text-red-300 border-red-500/40", icon: XCircle },
  bounced: { label: "Retourné", color: "bg-orange-500/20 text-orange-300 border-orange-500/40", icon: AlertTriangle },
  cancelled: { label: "Annulé", color: "bg-gray-600/30 text-gray-300 border-gray-600/60", icon: Ban },
  reversed: { label: "Renversé", color: "bg-pink-500/20 text-pink-300 border-pink-500/40", icon: RotateCcw },
  disputed: { label: "En litige", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40", icon: AlertTriangle },
  on_hold: { label: "En attente", color: "bg-slate-500/20 text-slate-300 border-slate-500/40", icon: Clock },
};
const METHOD_LABEL: Record<string, string> = {
  interac: "Interac e-Transfer", direct_deposit: "Dépôt direct", cheque: "Chèque",
  cash: "Comptant", wire_transfer: "Virement bancaire", paypal: "PayPal", other: "Autre",
};
const fmtMoney = (n: any) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n) || 0);
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("fr-CA") : "—";

export default function HrPayments() {
  const qc = useQueryClient();
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["my-payroll-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_payments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase.channel("my_payroll_payments_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_payments" }, () => {
        qc.invalidateQueries({ queryKey: ["my-payroll-payments"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Banknote className="w-6 h-6 text-violet-500" /> Mes paiements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Historique complet et statut en temps réel de vos paiements de paie</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement…
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Aucun paiement pour le moment</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Documents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p: any) => {
                  const meta = STATUS_META[p.payment_status] || STATUS_META.draft;
                  const Icon = meta.icon;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.payment_number}</TableCell>
                      <TableCell className="text-xs">{fmtDate(p.sent_date || p.scheduled_date || p.created_at)}</TableCell>
                      <TableCell className="text-xs">{METHOD_LABEL[p.payment_method] || p.payment_method}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmtMoney(p.net_amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.color}>
                          <Icon className="w-3 h-3 mr-1" />{meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{p.bank_reference || p.transaction_id || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.pdf_avis_url && <a href={p.pdf_avis_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">Avis</a>}
                          {p.pdf_paystub_url && <a href={p.pdf_paystub_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline ml-2">Talon</a>}
                          {p.email_sent_at && <Mail className="w-3 h-3 text-emerald-400" />}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
