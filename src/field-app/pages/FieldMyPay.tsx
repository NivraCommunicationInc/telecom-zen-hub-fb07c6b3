/**
 * FieldMyPay — Clear payout visibility for field reps.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Clock, DollarSign, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FieldBadge, FieldMetricCard, FieldPageHeader, FieldPanel } from "@/field-app/components/FieldUI";

const formatMoney = (value: number) => `${value.toFixed(2)} $`;

export default function FieldMyPay() {
  const { data, isLoading } = useQuery({
    queryKey: ["field-pay-summary"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const [commissionsRes, payrollRes] = await Promise.all([
        supabase.from("sales_commissions").select("commission_amount, status").eq("salesperson_id", user.id),
        supabase
          .from("payroll_entries")
          .select("net_pay, status, pay_period, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const commissions = commissionsRes.data || [];
      const payrollEntries = payrollRes.data || [];

      return {
        totalPending: commissions
          .filter((commission) => ["pending", "pending_activation"].includes(commission.status))
          .reduce((sum, commission) => sum + Number(commission.commission_amount || 0), 0),
        totalApproved: commissions
          .filter((commission) => ["validated", "approved"].includes(commission.status))
          .reduce((sum, commission) => sum + Number(commission.commission_amount || 0), 0),
        totalPaid: commissions
          .filter((commission) => commission.status === "paid")
          .reduce((sum, commission) => sum + Number(commission.commission_amount || 0), 0),
        payrollEntries,
      };
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const summary = data ?? { totalPending: 0, totalApproved: 0, totalPaid: 0, payrollEntries: [] };

  return (
    <div className="space-y-6">
      <FieldPageHeader
        eyebrow="Rémunération"
        title="Visibilité de paie"
        description="Cette page n'est plus un placeholder: elle vous dit clairement ce qui est dû, ce qui est approuvé et ce qui a déjà été payé."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <FieldMetricCard label="En attente" value={formatMoney(summary.totalPending)} hint="Commissions en cours de validation ou d'activation" icon={Clock} tone="warning" />
        <FieldMetricCard label="Approuvé" value={formatMoney(summary.totalApproved)} hint="Montants prêts à entrer dans le prochain cycle" icon={DollarSign} tone="info" />
        <FieldMetricCard label="Payé" value={formatMoney(summary.totalPaid)} hint="Commissions déjà versées" icon={Banknote} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <FieldPanel title="Lecture simple" description="L'agent doit toujours comprendre pourquoi un montant n'est pas encore payé.">
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p><span className="font-semibold text-foreground">En attente</span> — vente créée, mais l'activation ou la validation n'est pas encore finalisée.</p>
            <p><span className="font-semibold text-foreground">Approuvé</span> — le montant est reconnu et devrait entrer dans le prochain traitement.</p>
            <p><span className="font-semibold text-foreground">Payé</span> — le montant a déjà été intégré à une paie ou à un versement.</p>
          </div>
        </FieldPanel>

        <FieldPanel title="Dernières paies" description="Historique rapide des fiches de paie les plus récentes.">
          <div className="space-y-3">
            {summary.payrollEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune fiche de paie récente disponible ici.</p>
            ) : (
              summary.payrollEntries.map((entry: any) => (
                <div key={`${entry.pay_period}-${entry.created_at}`} className="rounded-[1.25rem] border border-border bg-card px-4 py-3 shadow-card">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entry.pay_period}</p>
                      <p className="text-sm text-muted-foreground">Net: {formatMoney(Number(entry.net_pay || 0))}</p>
                    </div>
                    <FieldBadge tone={entry.status === "paid" ? "success" : "warning"}>{entry.status}</FieldBadge>
                  </div>
                </div>
              ))
            )}
          </div>
        </FieldPanel>
      </div>

      <Link
        to="/rh/dashboard"
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
      >
        <ExternalLink className="h-4 w-4" />
        Accéder au portail RH complet
      </Link>
    </div>
  );
}
