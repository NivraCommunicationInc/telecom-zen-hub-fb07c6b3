/**
 * AdminSubscriptions — List of all billing subscriptions.
 * Authoritative data from billing_subscriptions + billing_customers + profiles.
 */
import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { useAdminSubscriptions } from "@/hooks/admin/useAdminSubscriptions";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { ArrowRight, Search, ToggleRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const categoryLabels: Record<string, string> = {
  internet: "Internet",
  tv: "Télévision",
  mobile: "Mobile",
  streaming: "Streaming",
  combo: "Combo",
};

export default function AdminSubscriptions() {
  const { data: subscriptions, isLoading } = useAdminSubscriptions();
  const [search, setSearch] = useState("");

  const filtered = (subscriptions || []).filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.plan_name.toLowerCase().includes(q) ||
      s.plan_code.toLowerCase().includes(q) ||
      s.client_name?.toLowerCase().includes(q) ||
      s.client_email?.toLowerCase().includes(q) ||
      s.account_number?.includes(q) ||
      s.id.includes(q)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader
          title="Abonnements"
          subtitle={`${filtered.length} abonnement(s)`}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Abonnements" },
          ]}
        />

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, plan, compte..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground">Plan</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground">Client</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground">Compte</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground">Catégorie</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground text-right">Prix</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground">Début cycle</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground">Auto</th>
                  <th className="px-4 py-3 font-semibold text-xs text-muted-foreground">Commande</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-muted-foreground">
                      Aucun abonnement trouvé
                    </td>
                  </tr>
                ) : (
                  filtered.map(sub => (
                    <tr key={sub.id} className="border-b border-border/40 hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{sub.plan_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{sub.plan_code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={sub.status || "—"} variant={statusToVariant(sub.status || "")} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground truncate max-w-[180px]">{sub.client_name || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{sub.client_email || ""}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{sub.account_number || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {categoryLabels[sub.service_category || ""] || sub.service_category || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {sub.plan_price.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {sub.cycle_start_date ? format(new Date(sub.cycle_start_date), "d MMM yyyy", { locale: fr }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {sub.auto_billing_enabled ? (
                          <ToggleRight className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Non</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sub.order_id ? (
                          <Link to={`/admin/orders/${sub.order_id}`} className="text-xs text-primary hover:underline">
                            Voir
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/subscriptions/${sub.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
