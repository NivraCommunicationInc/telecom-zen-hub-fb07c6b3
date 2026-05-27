/**
 * ActiveServicesBanner — Shown at the top of "Mes offres" to give the
 * client an immediate read on whether they currently have any active
 * services. Distinct from the phone CTA so both can coexist.
 */
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

interface Props {
  userId?: string | null;
}

export function ActiveServicesBanner({ userId }: Props) {
  const { data: canonicalData, isLoading } = useCanonicalClientData(userId);
  const data = (canonicalData?.subscriptions || []).filter((subscription: any) =>
    ["active", "trialing", "past_due"].includes(String(subscription.status || "").toLowerCase())
  ).length;

  if (!userId || isLoading) return null;

  const hasActive = (data ?? 0) > 0;

  if (hasActive) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-50">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">
              {data} service{data > 1 ? "s" : ""} actif{data > 1 ? "s" : ""}
            </p>
            <p className="text-emerald-700">
              Vous pouvez ajouter de nouveaux forfaits ou commander un appareil ci-dessous.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-50">
      <CardContent className="p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900">Aucun service actif</p>
          <p className="text-amber-700">
            Vous n'avez aucun forfait Internet, TV, Mobile ou Sécurité en cours.
            Choisissez un forfait ci-dessous ou commandez un téléphone.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
