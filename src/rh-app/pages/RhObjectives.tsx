/**
 * RhObjectives — Monthly objectives with progression and estimated commissions.
 * Reads from employee_objectives table.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Target, DollarSign, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

export default function RhObjectives() {
  // Realtime: refresh when targets/commissions change
  usePortalRealtime(
    ["sales_targets", "sales_commissions"],
    [["rh-objectives"]],
  );

  const { data: userId } = useQuery({
    queryKey: ["rh-user-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
  });

  const { data: objectives, isLoading } = useQuery({
    queryKey: ["rh-objectives", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("employee_objectives")
        .select("*")
        .eq("user_id", userId)
        .order("month", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const currentMonth = startOfMonth(new Date()).toISOString().slice(0, 10);
  const currentObj = objectives?.find((o: any) => o.month === currentMonth);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          Mes objectifs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Objectifs mensuels et progression des ventes</p>
      </div>

      {/* Current month spotlight */}
      {currentObj ? (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">
              {format(new Date(currentObj.month + "T00:00:00"), "MMMM yyyy", { locale: fr })} — Objectif en cours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Sales progress */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Ventes</span>
                <span className="font-bold text-foreground">
                  {currentObj.current_sales} / {currentObj.target_sales}
                </span>
              </div>
              <Progress
                value={currentObj.target_sales > 0 ? Math.min(100, (currentObj.current_sales / currentObj.target_sales) * 100) : 0}
                className="h-3"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {currentObj.target_sales > 0
                  ? `${Math.round((currentObj.current_sales / currentObj.target_sales) * 100)}% atteint`
                  : "Objectif non défini"}
              </p>
            </div>

            {/* Revenue progress */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Revenus</span>
                <span className="font-bold text-foreground">
                  {fmt(Number(currentObj.current_revenue))} / {fmt(Number(currentObj.target_revenue))}
                </span>
              </div>
              <Progress
                value={Number(currentObj.target_revenue) > 0 ? Math.min(100, (Number(currentObj.current_revenue) / Number(currentObj.target_revenue)) * 100) : 0}
                className="h-3"
              />
            </div>

            {/* Estimated commission */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="text-sm text-muted-foreground">Commission estimée</span>
              </div>
              <span className="text-lg font-bold text-emerald-600">{fmt(Number(currentObj.estimated_commission))}</span>
            </div>

            {currentObj.notes && (
              <p className="text-xs text-muted-foreground italic">{currentObj.notes}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p>Aucun objectif défini pour ce mois.</p>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {objectives && objectives.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3">Historique</h2>
          <div className="space-y-2">
            {objectives
              .filter((o: any) => o.month !== currentMonth)
              .map((o: any) => {
                const salesPct = o.target_sales > 0 ? Math.round((o.current_sales / o.target_sales) * 100) : 0;
                return (
                  <Card key={o.id}>
                    <CardContent className="flex items-center justify-between py-3 px-5">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {format(new Date(o.month + "T00:00:00"), "MMMM yyyy", { locale: fr })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {o.current_sales}/{o.target_sales} ventes · {salesPct}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-bold", salesPct >= 100 ? "text-emerald-600" : "text-foreground")}>
                          {fmt(Number(o.estimated_commission))}
                        </p>
                        <p className="text-[10px] text-muted-foreground">commission</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
