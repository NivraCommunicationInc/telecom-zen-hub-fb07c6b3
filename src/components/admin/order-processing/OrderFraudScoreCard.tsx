/**
 * OrderFraudScoreCard — Score anti-fraude + score de crédit d'une commande.
 * fraud score 0-100 (100 = très dangereux), credit score 0-100 (100 = excellent).
 */
import { Shield, ShieldAlert, ShieldCheck, ShieldX, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const FRAUD_LEVEL_CONFIG = {
  none:    { label: "Faible risque",   color: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: ShieldCheck },
  low:     { label: "Risque bas",      color: "bg-blue-50 border-blue-200",       textColor: "text-blue-700",    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",           Icon: Shield },
  medium:  { label: "Risque moyen",    color: "bg-amber-50 border-amber-200",     textColor: "text-amber-700",   badgeClass: "bg-amber-100 text-amber-700 border-amber-200",         Icon: ShieldAlert },
  high:    { label: "Risque élevé",    color: "bg-orange-50 border-orange-200",   textColor: "text-orange-700",  badgeClass: "bg-orange-100 text-orange-700 border-orange-200",      Icon: ShieldAlert },
  blocked: { label: "BLOQUÉ AUTO",     color: "bg-red-50 border-red-300",         textColor: "text-red-700",     badgeClass: "bg-red-100 text-red-700 border-red-300",               Icon: ShieldX },
};

const CREDIT_GRADE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  A: { label: "Excellent",   badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  B: { label: "Bon",         badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
  C: { label: "Moyen",       badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
  D: { label: "Faible",      badgeClass: "bg-orange-100 text-orange-700 border-orange-200" },
  F: { label: "Très faible", badgeClass: "bg-red-100 text-red-700 border-red-300" },
};

const FLAG_LABELS: Record<string, string> = {
  email_jetable:          "Email jetable / temporaire",
  commandes_recentes:     "Plusieurs commandes récentes (7j)",
  commandes_multiples_24h:"Plusieurs commandes en 24h",
  adresse_incomplete:     "Adresse incomplète",
  telephone_manquant:     "Téléphone manquant",
  telephone_invalide:     "Format téléphone invalide",
  nom_suspect:            "Nom suspect (test/fake/admin)",
  compte_moins_1h:        "Compte créé < 1h avant la commande",
  compte_meme_jour:       "Compte créé le même jour",
  incidents_fraude:       "Incidents de fraude antérieurs",
  heure_suspecte:         "Heure inhabituelle (3h–5h)",
  province_hors_qc:       "Province hors Québec",
};

interface CreditInfo {
  score: number;
  grade: string;
  grade_label: string;
  has_history: boolean;
  factors?: Record<string, number>;
}

interface Props {
  fraudScore?: number;
  fraudLevel?: string;
  fraudFlags?: Record<string, number>;
  fraudBlocked?: boolean;
  combinedDecision?: string;
  combinedBlocked?: boolean;
  credit?: CreditInfo | null;
  compact?: boolean;
}

export function OrderFraudScoreCard({
  fraudScore = 0,
  fraudLevel = "none",
  fraudFlags = {},
  fraudBlocked = false,
  combinedDecision,
  combinedBlocked,
  credit,
  compact = false,
}: Props) {
  const isBlocked = combinedBlocked ?? fraudBlocked;
  const effectiveLevel = isBlocked && fraudLevel !== "blocked" ? "blocked" : fraudLevel;
  const level = (effectiveLevel as keyof typeof FRAUD_LEVEL_CONFIG) in FRAUD_LEVEL_CONFIG
    ? (effectiveLevel as keyof typeof FRAUD_LEVEL_CONFIG)
    : "none";
  const cfg = FRAUD_LEVEL_CONFIG[level];
  const { Icon } = cfg;
  const flagEntries = Object.entries(fraudFlags);
  const creditGrade = credit?.grade ?? "C";
  const creditCfg = CREDIT_GRADE_CONFIG[creditGrade] ?? CREDIT_GRADE_CONFIG["C"];

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className={`cursor-default ${cfg.badgeClass}`}>
                <Icon className="w-3 h-3 mr-1" />
                {fraudScore}
              </Badge>
              {credit && (
                <Badge variant="outline" className={`cursor-default text-[10px] gap-1 ${creditCfg.badgeClass}`}>
                  <CreditCard className="w-3 h-3" />
                  {creditGrade}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-xs space-y-1 py-1">
              <p className="font-semibold">Fraude: {fraudScore}/100 — {cfg.label}</p>
              {credit && <p className="font-semibold">Crédit: {credit.score}/100 — {credit.grade_label}</p>}
              {combinedDecision === "flag_manual" && (
                <p className="text-amber-600">Vérification manuelle recommandée (crédit faible)</p>
              )}
              {isBlocked && <p className="text-red-600">Commande bloquée automatiquement</p>}
              {flagEntries.length > 0 && <div className="border-t pt-1 mt-1">
                {flagEntries.map(([k, v]) => (
                  <p key={k}>+{v} — {FLAG_LABELS[k] || k.replace(/_/g, " ")}</p>
                ))}
              </div>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-3">
      {/* Fraude */}
      <Card className={`border ${cfg.color}`}>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className={`flex items-center gap-2 text-sm font-semibold ${cfg.textColor}`}>
            <Icon className="w-4 h-4" />
            Score anti-fraude
            <span className="ml-auto font-mono text-base">{fraudScore}/100</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          <Badge variant="outline" className={cfg.badgeClass}>{cfg.label}</Badge>

          {isBlocked && (
            <div className="rounded-md bg-red-100 border border-red-300 px-3 py-2 text-xs text-red-700 font-medium">
              {combinedDecision === "blocked" && !fraudBlocked
                ? "Bloqué: crédit insuffisant + risque fraude. Vérification manuelle requise."
                : "Bloqué automatiquement (fraude ≥ 80). Vérification manuelle requise."}
            </div>
          )}

          {combinedDecision === "flag_manual" && !isBlocked && (
            <div className="rounded-md bg-amber-100 border border-amber-300 px-3 py-2 text-xs text-amber-700 font-medium">
              Vérification manuelle recommandée — score de crédit faible (&lt; 30/100).
            </div>
          )}

          {flagEntries.length > 0 && (
            <ul className="text-xs space-y-1 mt-2">
              {flagEntries.map(([k, v]) => (
                <li key={k} className={`flex items-center justify-between ${cfg.textColor} opacity-80`}>
                  <span>{FLAG_LABELS[k] || k.replace(/_/g, " ")}</span>
                  <span className="font-semibold ml-2">+{v} pts</span>
                </li>
              ))}
            </ul>
          )}
          {flagEntries.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucun facteur de risque fraude détecté.</p>
          )}
        </CardContent>
      </Card>

      {/* Crédit (si disponible dans risk_flags) */}
      {credit && (
        <Card className={`border ${creditGrade === "A" || creditGrade === "B" ? "bg-emerald-50 border-emerald-200" : creditGrade === "C" ? "bg-amber-50 border-amber-200" : "bg-orange-50 border-orange-200"}`}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className={`flex items-center gap-2 text-sm font-semibold ${creditGrade === "A" || creditGrade === "B" ? "text-emerald-700" : creditGrade === "C" ? "text-amber-700" : "text-orange-700"}`}>
              <CreditCard className="w-4 h-4" />
              Score crédit (à la commande)
              <span className="ml-auto flex items-baseline gap-1">
                <span className="text-xl font-bold font-mono">{creditGrade}</span>
                <span className="text-xs font-normal text-muted-foreground">({credit.score}/100)</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <Badge variant="outline" className={creditCfg.badgeClass}>{credit.grade_label}</Badge>
            {!credit.has_history && (
              <p className="text-xs text-muted-foreground italic mt-1">Nouveau client — score neutre.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
