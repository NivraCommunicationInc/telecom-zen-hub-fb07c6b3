/**
 * AdminOrderWorkbench V3 — Carrier-grade order processing hub
 * TELUS-grade design with semantic tokens
 */
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, Wifi, Truck, CreditCard, Shield, History, MessageSquare, ListChecks, FileText, ExternalLink, Loader2 } from "lucide-react";
import { useWorkbenchData } from "@/hooks/useWorkbenchData";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { WorkbenchSummaryTab } from "@/components/workbench/WorkbenchSummaryTab";
import { WorkbenchItemsTab } from "@/components/workbench/WorkbenchItemsTab";
import { WorkbenchProvisioningTab } from "@/components/workbench/WorkbenchProvisioningTab";
import { WorkbenchFulfillmentTab } from "@/components/workbench/WorkbenchFulfillmentTab";
import { WorkbenchPaymentTab } from "@/components/workbench/WorkbenchPaymentTab";
import { WorkbenchKYCTab } from "@/components/workbench/WorkbenchKYCTab";
import { WorkbenchAuditTab } from "@/components/workbench/WorkbenchAuditTab";
import { WorkbenchNotesTab } from "@/components/workbench/WorkbenchNotesTab";
import { OrderDocumentsPanel } from "@/components/admin/OrderDocumentsPanel";
import { toast } from "sonner";

const TABS = [
  { value: "summary", label: "Résumé", icon: ListChecks },
  { value: "items", label: "Items", icon: Package, count: true },
  { value: "provisioning", label: "Provisioning", icon: Wifi, count: true },
  { value: "fulfillment", label: "Fulfillment", icon: Truck },
  { value: "payment", label: "Paiement", icon: CreditCard },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "kyc", label: "KYC", icon: Shield },
  { value: "audit", label: "Audit", icon: History },
  { value: "notes", label: "Notes", icon: MessageSquare },
] as const;

const AdminOrderWorkbench = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const data = useWorkbenchData(id);

  const handleAction = async (action: string, payload?: any) => {
    // Dispatch real actions based on NBA action type
    switch (action) {
      case "approve_kyc":
      case "reject_kyc":
        // KYC decisions are handled directly in WorkbenchKYCTab via RPC
        // Refresh workbench data after decision
        data.refetchAll();
        toast.success(action === "approve_kyc" ? "KYC approuvé — données actualisées" : "KYC rejeté — données actualisées");
        break;

      case "capture_payment":
        // Navigate to payment tab for manual processing
        toast.info("Consultez l'onglet Paiement pour capturer le paiement");
        break;

      case "retry_provisioning":
        toast.info("Consultez l'onglet Provisioning pour relancer les jobs");
        break;

      case "assign_inventory":
      case "manage_shipment":
        toast.info("Consultez l'onglet Fulfillment pour gérer l'expédition");
        break;

      case "create_ticket":
        toast.info("Consultez l'onglet Notes pour créer un ticket");
        break;

      default:
        toast.info(`Action: ${action}`);
    }
  };

  if (data.isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!data.order) {
    return (
      <AdminLayout>
        <div className="text-center py-20 space-y-4">
          <p className="text-muted-foreground text-sm">Commande introuvable.</p>
          <Link to="/admin/orders">
            <Button variant="outline" size="sm">Retour aux commandes</Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const orderNumber = data.order.order_number || data.order.id?.slice(0, 8);
  const orderStatus = data.order.status || "pending";

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Page Header — tight operational */}
        <PageHeader
          title={`Commande #${orderNumber}`}
          subtitle={`${data.profile?.full_name || data.order.client_email || "Client"} — ${data.order.service_type || "Service"}`}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Commandes", href: "/admin/orders" },
            { label: `#${orderNumber}` },
          ]}
          badge={
            <StatusBadge
              label={orderStatus}
              variant={statusToVariant(orderStatus)}
              size="sm"
            />
          }
          actions={
            data.order.user_id ? (
              <Link to={`/admin/clients`}>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                  <ExternalLink className="h-3 w-3" /> Client
                </Button>
              </Link>
            ) : undefined
          }
        />

        {/* Tabs */}
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="bg-secondary border border-border p-0.5 h-auto flex-wrap gap-0.5">
            {TABS.map((tab) => {
              const count = tab.value === "items" ? data.orderItems.length
                : tab.value === "provisioning" ? data.provisioningJobs.length
                : null;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-1.5 text-xs px-3 py-2 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {count !== null && count > 0 && (
                    <span className="ml-0.5 text-[10px] opacity-70">({count})</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-3">
            <TabsContent value="summary" className="mt-0">
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

            <TabsContent value="items" className="mt-0">
              <WorkbenchItemsTab orderItems={data.orderItems} provisioningJobs={data.provisioningJobs} />
            </TabsContent>

            <TabsContent value="provisioning" className="mt-0">
              <WorkbenchProvisioningTab
                provisioningJobs={data.provisioningJobs}
                orderId={id!}
                role={role}
                onRefresh={data.refetchAll}
              />
            </TabsContent>

            <TabsContent value="fulfillment" className="mt-0">
              <WorkbenchFulfillmentTab
                shipments={data.shipments}
                inventoryAssignments={data.inventoryAssignments}
                appointments={data.appointments}
              />
            </TabsContent>

            <TabsContent value="payment" className="mt-0">
              <WorkbenchPaymentTab
                order={data.order}
                billing={data.billing}
                billingInvoices={data.billingInvoices}
                role={role}
              />
            </TabsContent>

            <TabsContent value="documents" className="mt-0">
              <OrderDocumentsPanel
                orderId={id!}
                orderNumber={data.order.order_number}
                orderStatus={data.order.status}
                kycSessionId={data.kycSession?.id}
              />
            </TabsContent>

            <TabsContent value="kyc" className="mt-0">
              <WorkbenchKYCTab
                order={data.order}
                kycSession={data.kycSession}
                role={role}
                onAction={handleAction}
              />
            </TabsContent>

            <TabsContent value="audit" className="mt-0">
              <WorkbenchAuditTab activityLogs={data.activityLogs} />
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <WorkbenchNotesTab orderId={id!} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminOrderWorkbench;
