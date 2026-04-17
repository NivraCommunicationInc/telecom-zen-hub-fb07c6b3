/**
 * ClientSupplierAccountSection — Read-only block displayed at the bottom of CoreClientProfile.
 * Visible only to admins. Shows linked supplier accounts (no password / no sensitive fields).
 */
import { Link } from "react-router-dom";
import { ExternalLink, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { corePath } from "@/core-app/lib/corePaths";
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import { useSupplierAccountByClient, STATUS_LABEL, type SupplierAccountStatus } from "@/core-app/hooks/useSupplierAccounts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const variant = (s: SupplierAccountStatus) =>
  s === "active" ? "default" : s === "suspended" ? "secondary" : "destructive";

export function ClientSupplierAccountSection({ clientId }: { clientId?: string }) {
  const { isAdmin } = useIsCoreAdmin();
  const { data: accounts = [], isLoading } = useSupplierAccountByClient(isAdmin ? clientId : undefined);

  if (!isAdmin) return null;
  if (isLoading) return null;
  if (accounts.length === 0) return null;

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lock className="h-4 w-4 text-emerald-400" />
        <h3 className="text-[13px] font-semibold text-white flex-1">Compte Fournisseur</h3>
        <span className="text-[10px] uppercase tracking-wider text-emerald-400">Admin uniquement</span>
      </div>

      <div className="space-y-2">
        {accounts.map((a) => (
          <div
            key={a.id}
            className="rounded border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-white">{a.service_name}</div>
                <div className="text-[11px] text-[hsl(220,10%,55%)] mt-0.5">
                  {a.monthly_price.toFixed(2)} $/mois · activé le{" "}
                  {format(new Date(a.activation_date), "d MMM yyyy", { locale: fr })}
                </div>
              </div>
              <Badge variant={variant(a.status)}>{STATUS_LABEL[a.status]}</Badge>
            </div>
            <div className="mt-2">
              <Link
                to={corePath(`/supplier-accounts/${a.id}`)}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
              >
                Voir le compte complet
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
