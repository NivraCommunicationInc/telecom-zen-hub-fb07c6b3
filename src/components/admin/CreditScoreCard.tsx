/**
 * CreditScoreCard — Score de crédit interne Nivra (0-100, 100 = excellent)
 * Basé sur historique facturation, ancienneté, chargebacks.
 * Nouveau client sans historique = 50/100 neutre.
 */
import { CreditCard, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GRADE_CONFIG = {
  A: { label: "Excellent",   color: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" },
  B: { label: "Bon",         color: "bg-blue-50 border-blue-200",       textColor: "text-blue-700",    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",           bar: "bg-blue-500" },
  C: { label: "Moyen",       color: "bg-amber-50 border-amber-200",     textColor: "text-amber-700",   badgeClass: "bg-amber-100 text-amber-700 border-amber-200",         bar: "bg-amber-500" },
  D: { label: "Faible",      color: "bg-orange-50 border-orange-200",   textColor: "text-orange-700",  badgeClass: "bg-orange-100 text-orange-700 border-orange-200",      bar: "bg-orange-500" },
  F: { label: "Très faible", color: "bg-red-50 border-red-300",         textColor: "text-red-700",     badgeClass: "bg-red-100 text-red-700 border-red-300",               bar: "bg-red-500" },
};

const FACTOR_LABELS: Record<string, string> = {
  anciennete_2ans:                "Ancienneté 2+ ans",
  anciennete_1an:                 "Ancienneté 1+ an",
  anciennete_6mois:               "Ancienneté 6+ mois",
  paiements_ponctuels:            "Factures payées",
  comptes_bon_standing:           "Compte en bon standing",
  factures_overdue:               "Factures impayées actuelles",
  factures_serieusement_overdue:  "Factures > 90 jours",
  factures_non_payees:            "Créances irrécouvrables",
  comptes_annules:                "Compte annulé précédent",
  chargebacks:                    "Rétrofacturations",
};

interface Props {
  creditScore: number;
  creditGrade: string;
  creditGradeLabel: string;
  creditFactors: Record<string, number>;
  hasHistory: boolean;
  invoicesPaid?: number;
  invoicesOverdue?: number;
  invoicesBadDebt?: number;
  chargebacks?: number;
  accountAgeDays?: number;
  compact?: boolean;
  assessedAt?: string;
}

export function CreditScoreCard({
  creditScore,
  creditGrade,
  creditGradeLabel,
  creditFactors,
  hasHistory,
  invoicesPaid = 0,
  invoicesOverdue = 0,
  invoicesBadDebt = 0,
  chargebacks = 0,
  accountAgeDays = 0,
  compact = false,
  assessedAt,
}: Props) {
  const grade = (creditGrade as keyof typeof GRADE_CONFIG) in GRADE_CONFIG
    ? (creditGrade as keyof typeof GRADE_CONFIG)
    : "C";
  const cfg = GRADE_CONFIG[grade];
  const positive = Object.entries(creditFactors).filter(([, v]) => v > 0);
  const negative = Object.entries(creditFactors).filter(([, v]) => v < 0);

  const summaryParts = [
    invoicesPaid > 0 && `${invoicesPaid} facture${invoicesPaid > 1 ? "s" : ""} payée${invoicesPaid > 1 ? "s" : ""}`,
    invoicesOverdue > 0 && `${invoicesOverdue} en retard`,
    invoicesBadDebt > 0 && `${invoicesBadDebt} à perte`,
    chargebacks > 0 && `${chargebacks} chargeback${chargebacks > 1 ? "s" : ""}`,
    accountAgeDays > 0 && `${Math.floor(accountAgeDays / 30)} mois d'ancienneté`,
  ].filter(Boolean).join(" · ");

  if (compact) {
    return (
      <Badge variant="outline" className={`cursor-default text-[10px] gap-1 ${cfg.badgeClass}`}>
        <CreditCard className="w-3 h-3" />
        {grade} · {creditScore}
      </Badge>
    );
  }

  return (
    <Card className={`border ${cfg.color}`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className={`flex items-center gap-2 text-sm font-semibold ${cfg.textColor}`}>
          <CreditCard className="w-4 h-4" />
          Score de crédit interne
          <span className="ml-auto flex items-baseline gap-1">
            <span className={`text-2xl font-bold font-mono leading-none ${cfg.textColor}`}>{creditGrade}</span>
            <span className="text-xs font-normal text-muted-foreground">({creditScore}/100)</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${creditScore}%` }} />
        </div>

        <Badge variant="outline" className={cfg.badgeClass}>{creditGradeLabel}</Badge>

        {!hasHistory && (
          <p className="text-xs text-muted-foreground italic">
            Nouveau client — score neutre (50/100) par défaut, aucun historique chez Nivra.
          </p>
        )}

        {hasHistory && summaryParts && (
          <p className="text-xs text-muted-foreground">{summaryParts}</p>
        )}

        {hasHistory && positive.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">
              <TrendingUp className="w-3 h-3" /> Positif
            </div>
            {positive.map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs text-emerald-700">
                <span>{FACTOR_LABELS[k] || k.replace(/_/g, " ")}</span>
                <span className="font-semibold tabular-nums">+{v} pts</span>
              </div>
            ))}
          </div>
        )}

        {hasHistory && negative.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-red-600 uppercase tracking-wide">
              <TrendingDown className="w-3 h-3" /> Négatif
            </div>
            {negative.map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs text-red-600">
                <span>{FACTOR_LABELS[k] || k.replace(/_/g, " ")}</span>
                <span className="font-semibold tabular-nums">{v} pts</span>
              </div>
            ))}
          </div>
        )}

        {assessedAt && (
          <p className="text-[10px] text-muted-foreground">
            Calculé le {new Date(assessedAt).toLocaleDateString("fr-CA")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
