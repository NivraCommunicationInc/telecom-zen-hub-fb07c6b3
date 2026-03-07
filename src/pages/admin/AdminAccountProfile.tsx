/**
 * AdminAccountProfile — Telecom-grade CRM Account Profile Page
 * Central master profile for a customer account
 */
import { useParams } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import {
  AccountProfileHeader,
  AccountOverviewTab,
  AccountServicesTab,
  AccountAddressesTab,
  AccountBillingTab,
  AccountOrdersTab,
  AccountSupportTab,
  AccountEquipmentTab,
  AccountDocumentsTab,
  AccountCreditTab,
  AccountStreamingTab,
  useAccountProfile,
} from "@/components/admin/account-profile";
import ClientInternalNotes from "@/components/admin/ClientInternalNotes";
import AccountBlockingControls from "@/components/admin/AccountBlockingControls";
import { AuthorizedUsersCard } from "@/components/admin/AuthorizedUsersCard";
import ClientActivityLogTable from "@/components/admin/ClientActivityLogTable";
import AdminSecurityControls from "@/components/admin/AdminSecurityControls";
import { ClientCommunicationsPanel } from "@/components/admin/ClientCommunicationsPanel";

export default function AdminAccountProfile() {
  const { accountId } = useParams<{ accountId: string }>();
  const data = useAccountProfile(accountId);

  if (data.isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!data.account) {
    return (
      <AdminLayout>
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Compte introuvable</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4 pb-8">
        {/* Account Header */}
        <AccountProfileHeader
          account={data.account}
          profile={data.profile}
          invoices={data.invoices}
          payments={data.payments}
          subscriptions={data.subscriptions}
          tickets={data.tickets}
          onRefresh={data.refetch}
        />

        {/* Tabbed Content */}
        <Tabs defaultValue="overview" className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="w-full justify-start h-auto flex-wrap gap-0.5 bg-muted/50 p-1">
              <TabsTrigger value="overview" className="text-xs">Aperçu</TabsTrigger>
              <TabsTrigger value="services" className="text-xs">Services</TabsTrigger>
              <TabsTrigger value="addresses" className="text-xs">Adresses</TabsTrigger>
              <TabsTrigger value="billing" className="text-xs">Facturation</TabsTrigger>
              <TabsTrigger value="orders" className="text-xs">Commandes</TabsTrigger>
              <TabsTrigger value="support" className="text-xs">Support</TabsTrigger>
              <TabsTrigger value="streaming" className="text-xs">Chaînes / Streaming</TabsTrigger>
              <TabsTrigger value="communications" className="text-xs">Communications</TabsTrigger>
              <TabsTrigger value="contacts" className="text-xs">Contacts</TabsTrigger>
              <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
              <TabsTrigger value="credit" className="text-xs">Crédit</TabsTrigger>
              <TabsTrigger value="blocking" className="text-xs">Blocage</TabsTrigger>
              <TabsTrigger value="security" className="text-xs">Sécurité</TabsTrigger>
              <TabsTrigger value="equipment" className="text-xs">Équipements</TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">Journal</TabsTrigger>
            </TabsList>
          </ScrollArea>

          <div className="mt-4">
            <TabsContent value="overview">
              <AccountOverviewTab
                account={data.account}
                profile={data.profile}
                subscriptions={data.subscriptions}
                locations={data.locations}
                invoices={data.invoices}
                payments={data.payments}
                tickets={data.tickets}
                orders={data.orders}
                authorizedUsers={data.authorizedUsers}
              />
            </TabsContent>

            <TabsContent value="services">
              <AccountServicesTab
                subscriptions={data.subscriptions}
                serviceAddresses={data.serviceAddresses}
                account={data.account}
                locations={data.locations}
              />
            </TabsContent>

            <TabsContent value="addresses">
              <AccountAddressesTab
                account={data.account}
                locations={data.locations}
                subscriptions={data.subscriptions}
              />
            </TabsContent>

            <TabsContent value="billing">
              <AccountBillingTab
                account={data.account}
                invoices={data.invoices}
                payments={data.payments}
                subscriptions={data.subscriptions}
                legacyBilling={data.legacyBilling}
              />
            </TabsContent>

            <TabsContent value="orders">
              <AccountOrdersTab orders={data.orders} />
            </TabsContent>

            <TabsContent value="support">
              <AccountSupportTab
                tickets={data.tickets}
                appointments={data.appointments}
                clientId={data.clientId}
              />
            </TabsContent>

            <TabsContent value="streaming">
              <AccountStreamingTab subscriptions={data.subscriptions} clientId={data.clientId} />
            </TabsContent>

            <TabsContent value="communications">
              {data.clientId && (
                <ClientCommunicationsPanel
                  clientId={data.clientId}
                  clientPhone={data.profile?.phone}
                />
              )}
            </TabsContent>

            <TabsContent value="contacts">
              {data.clientId && (
                <AuthorizedUsersCard clientId={data.clientId} clientUserId={data.clientId} />
              )}
            </TabsContent>

            <TabsContent value="notes">
              {data.clientId && (
                <ClientInternalNotes
                  clientId={data.clientId}
                  clientEmail={data.profile?.email}
                />
              )}
            </TabsContent>

            <TabsContent value="credit">
              <AccountCreditTab account={data.account} />
            </TabsContent>

            <TabsContent value="blocking">
              {data.clientId && data.profile && (
                <AccountBlockingControls
                  clientId={data.clientId}
                  clientEmail={data.profile.email}
                  accountStatus={data.profile.account_status || "active"}
                  onlineAccessStatus={data.profile.online_access_status || "active"}
                  blockedReason={data.profile.blocked_reason}
                  blockedAt={data.profile.blocked_at}
                  onUpdate={() => data.refetch()}
                />
              )}
            </TabsContent>

            <TabsContent value="security">
              {data.clientId && data.profile && (
                <AdminSecurityControls
                  clientId={data.clientId}
                  clientEmail={data.profile.email}
                  securityStatus={data.profile.security_status || "normal"}
                  securityAlertLevel={data.profile.security_alert_level || "none"}
                  securityReason={data.profile.security_reason}
                  securityFlaggedAt={data.profile.security_flagged_at}
                  securityFlaggedOrderId={data.profile.security_flagged_order_id}
                  securityRequiresPinReset={data.profile.security_requires_pin_reset || false}
                  onUpdate={() => data.refetch()}
                />
              )}
            </TabsContent>

            <TabsContent value="equipment">
              {data.clientId && accountId && (
                <AccountEquipmentTab accountId={accountId} clientId={data.clientId} />
              )}
            </TabsContent>

            <TabsContent value="documents">
              {data.clientId && accountId && (
                <AccountDocumentsTab clientId={data.clientId} accountId={accountId} />
              )}
            </TabsContent>

            <TabsContent value="activity">
              {data.clientId && (
                <ClientActivityLogTable clientId={data.clientId} />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
