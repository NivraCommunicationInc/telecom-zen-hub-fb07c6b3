/**
 * AdminOrderDetail — Admin order detail page with Overview + Process Order modes
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, Wrench } from "lucide-react";
import { OrderProcessingWorkspace } from "@/components/admin/order-processing/OrderProcessingWorkspace";
import { OrderOverview } from "@/components/admin/order-processing/OrderOverview";

type ViewMode = "overview" | "process";

const AdminOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>("overview");

  if (!id) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-gray-500">Commande non trouvée.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Top nav: Back + mode toggle */}
        <div className="flex items-center justify-between">
          <Link to="/admin/orders">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-gray-300 text-gray-700 hover:bg-gray-50">
              <ArrowLeft className="h-3.5 w-3.5" /> Retour aux commandes
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "overview" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("overview")}
              className={`gap-1.5 h-8 text-xs ${viewMode === "overview" ? "bg-gray-900 text-white hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              <Eye className="h-3.5 w-3.5" /> Aperçu
            </Button>
            <Button
              variant={viewMode === "process" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("process")}
              className={`gap-1.5 h-8 text-xs ${viewMode === "process" ? "bg-gray-900 text-white hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              <Wrench className="h-3.5 w-3.5" /> Traiter la commande
            </Button>
          </div>
        </div>

        {/* Content */}
        {viewMode === "overview" ? (
          <OrderOverview orderId={id} onSwitchToProcess={() => setViewMode("process")} />
        ) : (
          <OrderProcessingWorkspace orderId={id} />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminOrderDetail;
