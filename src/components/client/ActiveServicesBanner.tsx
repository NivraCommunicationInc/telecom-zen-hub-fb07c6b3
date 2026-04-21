/**
 * ActiveServicesBanner — Shown at the top of "Mes offres" to give the
 * client an immediate read on whether they currently have any active
 * services. Distinct from the phone CTA so both can coexist.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  userId?: string | null;
}

export function ActiveServicesBanner({ userId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-active-subscriptions-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!customer?.id) return 0;
      const { count } = await supabase
        .from("billing_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", customer.id)
        .in("status", ["active", "trialing", "past_due"]);
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  if (!userId || isLoading) return null;

  const hasActive = (data ?? 0) > 0;

  if (hasActive) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-50">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-900">
              {data} service{data! > 1 ? "s" : ""} actif{data! > 1 ? "s" : ""}
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
