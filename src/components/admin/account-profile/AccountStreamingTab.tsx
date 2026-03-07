/**
 * AccountStreamingTab — Streaming subscriptions and TV channel packages
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Tv } from "lucide-react";

interface AccountStreamingTabProps {
  subscriptions: any[];
}

export function AccountStreamingTab({ subscriptions }: AccountStreamingTabProps) {
  const streamingSubs = subscriptions.filter((s: any) => s.service_category === "streaming");
  const tvSubs = subscriptions.filter((s: any) => s.service_category === "tv");

  return (
    <div className="space-y-6">
      {/* Streaming */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Streaming ({streamingSubs.length})
        </h4>
        {streamingSubs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun abonnement streaming</p>
        ) : (
          streamingSubs.map((sub: any) => (
            <div key={sub.id} className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3">
                <Play className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{sub.plan_name}</p>
                  <p className="text-xs text-muted-foreground">{sub.plan_code}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{sub.plan_price?.toFixed(2)} $/mois</span>
                <Badge variant={sub.status === "active" ? "default" : "secondary"} className="text-[10px]">
                  {sub.status === "active" ? "Actif" : sub.status}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>

      {/* TV Packages */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Tv className="h-3.5 w-3.5" />
          Chaînes TV ({tvSubs.length})
        </h4>
        {tvSubs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun forfait TV</p>
        ) : (
          tvSubs.map((sub: any) => (
            <div key={sub.id} className="flex items-center justify-between p-3 rounded-md border">
              <div className="flex items-center gap-3">
                <Tv className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{sub.plan_name}</p>
                  <p className="text-xs text-muted-foreground">{sub.plan_code}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{sub.plan_price?.toFixed(2)} $/mois</span>
                <Badge variant={sub.status === "active" ? "default" : "secondary"} className="text-[10px]">
                  {sub.status === "active" ? "Actif" : sub.status}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
