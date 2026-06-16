/**
 * OrderFraudScoreCard — FEATURE 2: Displays anti-fraud score 0-100 for an order.
 * Shown in order processing workspace. Blocks auto-processing when score > 80.
 */
import { Shield, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const LEVEL_CONFIG = {
  none:    { label: "Faible risque",   color: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: ShieldCheck },
  low:     { label: "Risque bas",      color: "bg-blue-50 border-blue-200",       textColor: "text-blue-700",    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",           Icon: Shield },
  medium:  { label: "Risque moyen",    color: "bg-amber-50 border-amber-200",     textColor: "text-amber-700",   badgeClass: "bg-amber-100 text-amber-700 border-amber-200",         Icon: ShieldAlert },
  high:    { label: "Risque élevé",    color: "bg-orange-50 border-orange-200",   textColor: "text-orange-700",  badgeClass: "bg-orange-100 text-orange-700 border-orange-200",      Icon: ShieldAlert },
  blocked: { label: "BLOQUÉ AUTO",     color: "bg-red-50 border-red-300",         textColor: "text-red-700",     badgeClass: "bg-red-100 text-red-700 border-red-300",               Icon: ShieldX },
};

const FLAG_LABELS: Record<string, string> = {
  email_jetable:      "Email jetable / temporaire",
  commandes_recentes: "Plusieurs commandes récentes (7j)",
  adresse_incomplete: "Adresse incomplète",
  telephone_manquant: "Téléphone manquant",
  nom_suspect:        "Nom suspect (test/fake/admin)",
};

interface Props {
  fraudScore?: number;
  fraudLevel?: string;
  fraudFlags?: Record<string, number>;
  fraudBlocked?: boolean;
  compact?: boolean;
}

export function OrderFraudScoreCard({
  fraudScore = 0,
  fraudLevel = "none",
  fraudFlags = {},
  fraudBlocked = false,
  compact = false,
}: Props) {
  const level = (fraudLevel as keyof typeof LEVEL_CONFIG) in LEVEL_CONFIG ? (fraudLevel as keyof typeof LEVEL_CONFIG) : "none";
  const cfg = LEVEL_CONFIG[level];
  const { Icon } = cfg;
  const flagEntries = Object.entries(fraudFlags);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`cursor-default ${cfg.badgeClass}`}>
              <Icon className="w-3 h-3 mr-1" />
              {fraudScore} · {cfg.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-xs space-y-1 py-1">
              {flagEntries.length === 0
                ? <p>Aucun facteur de risque</p>
                : flagEntries.map(([k, v]) => (
                  <p key={k}>+{v} — {FLAG_LABELS[k] || k.replace(/_/g, " ")}</p>
                ))
              }
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className={`border ${cfg.color}`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className={`flex items-center gap-2 text-sm font-semibold ${cfg.textColor}`}>
          <Icon className="w-4 h-4" />
          Score anti-fraude
          <span className="ml-auto font-mono text-base">{fraudScore}/100</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        <Badge variant="outline" className={cfg.badgeClass}>
          {cfg.label}
        </Badge>

        {fraudBlocked && (
          <div className="rounded-md bg-red-100 border border-red-300 px-3 py-2 text-xs text-red-700 font-medium">
            Cette commande a été bloquée automatiquement (score &gt; 80). Vérification manuelle requise avant traitement.
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
          <p className="text-xs text-muted-foreground">Aucun facteur de risque détecté.</p>
        )}
      </CardContent>
    </Card>
  );
}
