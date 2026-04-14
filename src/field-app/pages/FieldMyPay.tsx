/**
 * FieldMyPay — Clear payout visibility for field reps.
 * Uses backend commission engine only.
 */
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Clock, DollarSign, ExternalLink, Loader2 } from "lucide-react";
import { fetchPaySummary } from "@/field-app/lib/fieldServices";
import { FieldBadge, FieldMetricCard, FieldPageHeader, FieldPanel } from "@/field-app/components/FieldUI";

const formatMoney = (value: number) => `${value.toFixed(2)} $`;

export default function FieldMyPay() {
  const { data, isLoading } = useQuery({
    queryKey: ["field-pay-summary"],
    queryFn: fetchPaySummary,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const summary = data?.summary ?? { pending: 0, approved: 0, paid: 0 };
  const payrollEntries = data?.payroll_entries || [];

  return (
    <div className="space-y-6">
      <FieldPageHeader
        eyebrow="Rémunération"
        title="Visibilité de paie"
        description="Montants dus, approuvés et payés — directement depuis le moteur de commissions."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <FieldMetricCard label="En attente" value={formatMoney(summary.pending)} hint="Commissions en cours de validation ou d'activation" icon={Clock} tone="warning" />
        <FieldMetricCard label="Approuvé" value={formatMoney(summary.approved)} hint="Montants prêts à entrer dans le prochain cycle" icon={DollarSign} tone="info" />
        <FieldMetricCard label="Payé" value={formatMoney(summary.paid)} hint="Commissions déjà versées" icon={Banknote} tone="success" />
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
            {payrollEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune fiche de paie récente disponible ici.</p>
            ) : (
              payrollEntries.map((entry: any) => (
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
