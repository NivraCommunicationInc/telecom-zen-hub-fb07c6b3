import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Loader2, Shield, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ClientDataExportProps {
  userId: string;
  userEmail: string;
}

export const ClientDataExport = ({ userId, userEmail }: ClientDataExportProps) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  // Fetch all client data for export
  const fetchAllClientData = async () => {
    const [
      profileResult,
      customerResult,
      accountsResult,
      ordersResult,
      ticketsResult,
      locationsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("billing_customers").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("accounts").select("*").eq("client_id", userId),
      supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("support_tickets").select("id, ticket_number, subject, status, priority, created_at").eq("client_user_id", userId),
      supabase.from("account_service_locations").select("*"),
    ]);

    const customerId = customerResult.data?.id;
    const [invoicesFetch, subsFetch] = await Promise.all([
      customerId 
        ? supabase.from("billing_invoices").select("*").eq("customer_id", customerId).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] } as any),
      customerId
        ? supabase.from("billing_subscriptions").select("*").eq("customer_id", customerId)
        : Promise.resolve({ data: [] } as any),
    ]);

    return {
      profile: profileResult.data,
      accounts: accountsResult.data || [],
      orders: ordersResult.data || [],
      invoices: invoicesFetch.data || [],
      subscriptions: subsFetch.data || [],
      supportTickets: ticketsResult.data || [],
      serviceLocations: locationsResult.data || [],
    };
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await fetchAllClientData();

      // Create export object
      const exportData = {
        exportInfo: {
          exportedAt: new Date().toISOString(),
          requestedBy: userEmail,
          dataSubject: userEmail,
          legalBasis: "Loi 25 du Québec - Droit d'accès aux renseignements personnels",
        },
        personalInformation: data.profile
          ? {
              fullName: data.profile.full_name,
              firstName: data.profile.first_name,
              lastName: data.profile.last_name,
              email: data.profile.email,
              phone: data.profile.phone,
              dateOfBirth: data.profile.date_of_birth,
              serviceAddress: data.profile.service_address,
              serviceCity: data.profile.service_city,
              serviceProvince: data.profile.service_province,
              servicePostalCode: data.profile.service_postal_code,
              accountStatus: data.profile.account_status,
              createdAt: data.profile.created_at,
            }
          : null,
        accounts: data.accounts.map((a) => ({
          accountNumber: a.account_number,
          accountName: a.account_name,
          billingAddress: a.billing_address,
          billingCity: a.billing_city,
          billingPostalCode: a.billing_postal_code,
          status: a.status,
          createdAt: a.created_at,
        })),
        orders: data.orders.map((o) => ({
          orderNumber: o.order_number,
          status: o.status,
          totalAmount: o.total_amount,
          createdAt: o.created_at,
        })),
        invoices: data.invoices.map((i) => ({
          invoiceNumber: i.invoice_number,
          amount: i.amount,
          status: i.status,
          paidAt: i.paid_at,
          createdAt: i.created_at,
        })),
        subscriptions: data.subscriptions.map((s) => ({
          planName: s.plan_name,
          status: s.status,
          monthlyAmount: s.monthly_amount,
          createdAt: s.created_at,
        })),
        supportTickets: data.supportTickets.map((t) => ({
          ticketNumber: t.ticket_number,
          subject: t.subject,
          status: t.status,
          createdAt: t.created_at,
        })),
      };

      // Generate JSON file
      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Download file
      const link = document.createElement("a");
      link.href = url;
      link.download = `nivra-donnees-personnelles-${format(new Date(), "yyyy-MM-dd")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: "Vos données ont été téléchargées",
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Erreur d'export",
        description: error.message || "Impossible d'exporter vos données",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          Portabilité des données
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-accent/50 space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Vos droits (Loi 25)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Conformément à la Loi 25 du Québec, vous avez le droit d'accéder
                à vos renseignements personnels et de les télécharger.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Profil
            </Badge>
            <Badge variant="outline" className="text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Commandes
            </Badge>
            <Badge variant="outline" className="text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Factures
            </Badge>
            <Badge variant="outline" className="text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Abonnements
            </Badge>
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting}
          variant="outline"
          className="w-full"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Télécharger mes données (JSON)
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Le fichier contient toutes vos informations personnelles stockées
          chez Nivra.
        </p>
      </CardContent>
    </Card>
  );
};

export default ClientDataExport;
