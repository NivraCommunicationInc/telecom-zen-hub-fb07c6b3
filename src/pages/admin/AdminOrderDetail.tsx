/**
 * AdminOrderDetail — Placeholder page for /admin/orders/:id
 * The previous order processing workspace was removed.
 * This page will be rebuilt from scratch.
 */
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const AdminOrderDetail = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Link to="/admin/orders">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Retour aux commandes
          </Button>
        </Link>
        <div className="border border-border rounded-lg bg-card p-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Commande <span className="font-mono font-bold text-foreground">{id}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Cette page sera reconstruite prochainement.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOrderDetail;
