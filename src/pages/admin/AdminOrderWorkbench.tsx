/**
 * AdminOrderWorkbench V5 — Complete Order Processing Workspace
 * Carrier-grade, fully operational with dispatch routing and communications.
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, Wifi, Truck, CreditCard, Shield, History, MessageSquare, FileText, Loader2, ArrowRight, Mail } from "lucide-react";
import { useWorkbenchData } from "@/hooks/useWorkbenchData";
import { useWorkbenchActions } from "@/hooks/useWorkbenchActions";
import { useAuth } from "@/hooks/useAuth";
import { WorkbenchHeaderPanel } from "@/components/workbench/WorkbenchHeaderPanel";
import { WorkbenchNBAPanel } from "@/components/workbench/WorkbenchNBAPanel";
import { WorkbenchItemsTab } from "@/components/workbench/WorkbenchItemsTab";
import { WorkbenchProvisioningTab } from "@/components/workbench/WorkbenchProvisioningTab";
import { WorkbenchFulfillmentTab } from "@/components/workbench/WorkbenchFulfillmentTab";
import { WorkbenchPaymentTab } from "@/components/workbench/WorkbenchPaymentTab";
import { WorkbenchKYCTab } from "@/components/workbench/WorkbenchKYCTab";
import { WorkbenchAuditTab } from "@/components/workbench/WorkbenchAuditTab";
import { WorkbenchNotesTab } from "@/components/workbench/WorkbenchNotesTab";
import { WorkbenchDispatchPanel } from "@/components/workbench/WorkbenchDispatchPanel";
import { WorkbenchCommunicationsTab } from "@/components/workbench/WorkbenchCommunicationsTab";
import { OrderDocumentsPanel } from "@/components/admin/OrderDocumentsPanel";

const TABS = [
  { value: "items", label: "Services", icon: Package },
  { value: "payment", label: "Paiement", icon: CreditCard },
  { value: "kyc", label: "KYC", icon: Shield },
  { value: "fulfillment", label: "Logistique", icon: Truck },
  { value: "provisioning", label: "Activation", icon: Wifi },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "communications", label: "Comms", icon: Mail },
  { value: "notes", label: "Notes", icon: MessageSquare },
  { value: "audit", label: "Audit", icon: History },
] as const;

const AdminOrderWorkbench = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const data = useWorkbenchData(id);
  const [activeTab, setActiveTab] = useState("items");

  const actions = useWorkbenchActions(id!, data.refetchAll);

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

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* ── HEADER: Order + Customer + Status Controls ──────── */}
        <WorkbenchHeaderPanel
          order={data.order}
          profile={data.profile}
          role={role}
          onStatusChange={actions.updateOrderStatus}
        />

        {/* ── NBA: Next Best Action (always visible) ─────────── */}
        <WorkbenchNBAPanel
          order={data.order}
          nextActions={data.nextActions}
          orderItems={data.orderItems}
          provisioningJobs={data.provisioningJobs}
          role={role}
          onNavigateTab={setActiveTab}
        />

        {/* ── DISPATCH: Routing to shipping or technician ────── */}
        <WorkbenchDispatchPanel
          order={data.order}
          role={role}
          onAssignToShipping={actions.assignToShipping}
          onAssignToTechnician={actions.assignToTechnician}
        />

        {/* ── TABS: All operational areas ─────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-secondary border border-border p-0.5 h-auto flex-wrap gap-0.5">
            {TABS.map((tab) => {
              const count = tab.value === "items" ? data.orderItems.length
                : tab.value === "provisioning" ? data.provisioningJobs.length
                : tab.value === "fulfillment" ? data.shipments.length + data.appointments.length
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
            {/* Services / Items */}
            <TabsContent value="items" className="mt-0">
              <WorkbenchItemsTab orderItems={data.orderItems} provisioningJobs={data.provisioningJobs} />
            </TabsContent>

            {/* Payment & Billing */}
            <TabsContent value="payment" className="mt-0">
              <WorkbenchPaymentTab
                order={data.order}
                billing={data.billing}
                billingInvoices={data.billingInvoices}
                role={role}
                onConfirmPayment={actions.confirmPayment}
                onFailPayment={actions.failPayment}
              />
            </TabsContent>

            {/* KYC / Identity */}
            <TabsContent value="kyc" className="mt-0">
              <WorkbenchKYCTab
                order={data.order}
                kycSession={data.kycSession}
                role={role}
                onAction={() => data.refetchAll()}
              />
            </TabsContent>

            {/* Fulfillment: Shipments + Equipment + Appointments */}
            <TabsContent value="fulfillment" className="mt-0">
              <WorkbenchFulfillmentTab
                shipments={data.shipments}
                inventoryAssignments={data.inventoryAssignments}
                appointments={data.appointments}
                orderId={id!}
                role={role}
                onUpdateShipment={actions.updateShipment}
                onAssignEquipment={actions.assignEquipment}
                onUpdateAppointment={actions.updateAppointment}
              />
            </TabsContent>

            {/* Provisioning / Activation */}
            <TabsContent value="provisioning" className="mt-0">
              <WorkbenchProvisioningTab
                provisioningJobs={data.provisioningJobs}
                orderId={id!}
                role={role}
                onRetry={actions.retryProvisioning}
                onOverride={actions.overrideProvisioning}
                onComplete={actions.completeProvisioning}
              />
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents" className="mt-0">
              <OrderDocumentsPanel
                orderId={id!}
                orderNumber={data.order.order_number}
                orderStatus={data.order.status}
                kycSessionId={data.kycSession?.id}
              />
            </TabsContent>

            {/* Communications */}
            <TabsContent value="communications" className="mt-0">
              <WorkbenchCommunicationsTab
                orderId={id!}
                orderNumber={data.order.order_number}
                clientEmail={data.profile?.email || data.order?.client_email}
              />
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes" className="mt-0">
              <WorkbenchNotesTab orderId={id!} />
            </TabsContent>

            {/* Audit */}
            <TabsContent value="audit" className="mt-0">
              <WorkbenchAuditTab activityLogs={data.activityLogs} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminOrderWorkbench;
