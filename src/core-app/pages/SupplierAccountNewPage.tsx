/**
 * SupplierAccountNewPage — Create a new supplier account. Admin-only.
 */
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import SupplierAccountForm from "@/core-app/components/supplier-accounts/SupplierAccountForm";
import { ShieldOff } from "lucide-react";

const SupplierAccountNewPage = () => {
  const { isAdmin, isLoading } = useIsCoreAdmin();

  if (isLoading) return <div className="text-sm text-muted-foreground p-6">Vérification…</div>;
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-lg border border-border bg-card p-6 text-center">
        <ShieldOff className="h-8 w-8 mx-auto text-destructive mb-3" />
        <h2 className="text-base font-semibold text-foreground">Accès refusé</h2>
      </div>
    );
  }
  return <SupplierAccountForm />;
};

export default SupplierAccountNewPage;
