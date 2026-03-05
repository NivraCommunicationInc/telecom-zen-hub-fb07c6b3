/**
 * AdminOrderWorkbench - Carrier-grade order processing hub
 * Route: /admin/orders/:id
 */
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Package, Wifi, Truck, CreditCard, Shield, History, MessageSquare, ListChecks } from "lucide-react";
import { useWorkbenchData } from "@/hooks/useWorkbenchData";
import { useAuth } from "@/hooks/useAuth";
import { WorkbenchSummaryTab } from "@/components/workbench/WorkbenchSummaryTab";
import { WorkbenchItemsTab } from "@/components/workbench/WorkbenchItemsTab";
import { WorkbenchProvisioningTab } from "@/components/workbench/WorkbenchProvisioningTab";
import { WorkbenchFulfillmentTab } from "@/components/workbench/WorkbenchFulfillmentTab";
import { WorkbenchPaymentTab } from "@/components/workbench/WorkbenchPaymentTab";
import { WorkbenchKYCTab } from "@/components/workbench/WorkbenchKYCTab";
import { WorkbenchAuditTab } from "@/components/workbench/WorkbenchAuditTab";
import { WorkbenchNotesTab } from "@/components/workbench/WorkbenchNotesTab";
import { toast } from "sonner";

const AdminOrderWorkbench = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const data = useWorkbenchData(id);

  const handleAction = (action: string, payload?: any) => {
    // Tab navigation hint for now; specific actions handled in their tabs
    toast.info(`Action: ${action}`);
  };

  if (data.isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
        </div>
      </AdminLayout>
    );
  }

  if (!data.order) {
    return (
      <AdminLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Commande introuvable.</p>
          <Link to="/admin/orders">
            <Button variant="outline" className="mt-4">Retour aux commandes</Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/orders">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">
                Commande {data.order.order_number || data.order.id?.slice(0, 8)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {data.profile?.full_name || data.order.client_email || "Client inconnu"} — {data.order.service_type || "Service"}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="bg-slate-800/80 border border-slate-700/50 flex-wrap h-auto p-1 gap-1">
            <TabsTrigger value="summary" className="gap-1.5 data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
              <ListChecks className="h-3.5 w-3.5" /> Résumé
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-1.5 data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
              <Package className="h-3.5 w-3.5" /> Items ({data.orderItems.length})
            </TabsTrigger>
            <TabsTrigger value="provisioning" className="gap-1.5 data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
              <Wifi className="h-3.5 w-3.5" /> Provisioning ({data.provisioningJobs.length})
            </TabsTrigger>
            <TabsTrigger value="fulfillment" className="gap-1.5 data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
              <Truck className="h-3.5 w-3.5" /> Fulfillment
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-1.5 data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
              <CreditCard className="h-3.5 w-3.5" /> Paiement
            </TabsTrigger>
            <TabsTrigger value="kyc" className="gap-1.5 data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
              <Shield className="h-3.5 w-3.5" /> KYC
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
              <History className="h-3.5 w-3.5" /> Audit
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5 data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
              <MessageSquare className="h-3.5 w-3.5" /> Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <WorkbenchSummaryTab
              order={data.order}
              profile={data.profile}
              nextActions={data.nextActions}
              orderItems={data.orderItems}
              provisioningJobs={data.provisioningJobs}
              role={role}
              onAction={handleAction}
            />
          </TabsContent>

          <TabsContent value="items">
            <WorkbenchItemsTab orderItems={data.orderItems} provisioningJobs={data.provisioningJobs} />
          </TabsContent>

          <TabsContent value="provisioning">
            <WorkbenchProvisioningTab
              provisioningJobs={data.provisioningJobs}
              orderId={id!}
              role={role}
              onRefresh={data.refetchAll}
            />
          </TabsContent>

          <TabsContent value="fulfillment">
            <WorkbenchFulfillmentTab
              shipments={data.shipments}
              inventoryAssignments={data.inventoryAssignments}
              appointments={data.appointments}
            />
          </TabsContent>

          <TabsContent value="payment">
            <WorkbenchPaymentTab
              order={data.order}
              billing={data.billing}
              billingInvoices={data.billingInvoices}
              role={role}
            />
          </TabsContent>

          <TabsContent value="kyc">
            <WorkbenchKYCTab
              order={data.order}
              kycSession={data.kycSession}
              role={role}
              onAction={handleAction}
            />
          </TabsContent>

          <TabsContent value="audit">
            <WorkbenchAuditTab activityLogs={data.activityLogs} />
          </TabsContent>

          <TabsContent value="notes">
            <WorkbenchNotesTab orderId={id!} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminOrderWorkbench;
