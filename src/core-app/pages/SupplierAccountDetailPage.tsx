/**
 * SupplierAccountDetailPage — Edit a single supplier account.
 * Admin-only.
 */
import { useParams } from "react-router-dom";
import { useSupplierAccount } from "@/core-app/hooks/useSupplierAccounts";
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import SupplierAccountForm from "@/core-app/components/supplier-accounts/SupplierAccountForm";
import { ShieldOff } from "lucide-react";

const SupplierAccountDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, isLoading: loadingRole } = useIsCoreAdmin();
  const { data, isLoading } = useSupplierAccount(id);

  if (loadingRole || isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Chargement…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-lg border border-border bg-card p-6 text-center">
        <ShieldOff className="h-8 w-8 mx-auto text-destructive mb-3" />
        <h2 className="text-base font-semibold text-foreground">Accès refusé</h2>
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground p-6">Compte introuvable.</div>;
  }

  return <SupplierAccountForm initial={data} id={id} />;
};

export default SupplierAccountDetailPage;
