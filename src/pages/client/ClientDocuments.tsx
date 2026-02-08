/**
 * Client Documents Page
 * Centralized access to all client documents (Terms, Contracts, Invoices)
 */

import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ScrollText, 
  FileText, 
  Receipt, 
  Download, 
  ExternalLink,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  FolderOpen
} from "lucide-react";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend/portalClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { safePDFDownload } from "@/lib/pdfUtils";

// Static terms document info
const TERMS_DOCUMENT_INFO = {
  version: "v2026-02-05",
  effectiveDate: "2026-02-05",
  title: "Modalités de service",
  subtitle: "Conditions générales",
  lastUpdated: "2026-02-05",
  id: "terms-modalites-v2026",
};

const STATIC_TERMS_PDF = "/documents/Nivra_Telecom_Modalites_de_service_v2026-02-05.pdf";

const ClientDocuments = () => {
  const { user } = useClientAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("terms");

  // Fetch client profile
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, client_number")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch client account
  const { data: account } = useQuery({
    queryKey: ["client-account", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_number")
        .eq("client_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch orders for terms documents
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["client-orders-for-docs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, created_at, status, service_type")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch contracts
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ["client-contracts-for-docs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("id, contract_number, contract_name, created_at, is_signed, signed_at")
        .eq("owner_user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const handleDownloadTerms = (order: { id: string; order_number: string; created_at: string }) => {
    try {
      // Download static PDF from public folder
      const link = document.createElement("a");
      link.href = STATIC_TERMS_PDF;
      link.download = `Modalites-Service-Nivra-${order.order_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Modalités de service téléchargées");
    } catch (error) {
      console.error("Error downloading terms PDF:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const isLoading = ordersLoading || contractsLoading;

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-cyan-500" />
            Mes documents
          </h1>
          <p className="text-muted-foreground mt-1">
            Accédez à tous vos documents officiels Nivra Telecom.
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="terms" className="gap-2">
              <ScrollText className="w-4 h-4" />
              <span className="hidden sm:inline">Modalités</span>
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Contrats</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">Factures</span>
            </TabsTrigger>
          </TabsList>

          {/* Terms Tab */}
          <TabsContent value="terms" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ScrollText className="w-5 h-5 text-purple-500" />
                  Modalités de service
                </CardTitle>
                <CardDescription>
                  Les conditions générales et annexes applicables à vos services Nivra.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Current Terms Version */}
                <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <ScrollText className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">
                          {TERMS_DOCUMENT_INFO.title}
                        </h3>
                        <Badge className="bg-purple-500/20 text-purple-500 border-0">
                          v{TERMS_DOCUMENT_INFO.version}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {TERMS_DOCUMENT_INFO.subtitle}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Dernière mise à jour : {TERMS_DOCUMENT_INFO.lastUpdated}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Document ID : {TERMS_DOCUMENT_INFO.id}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Orders with Terms */}
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Chargement...</p>
                  </div>
                ) : orders && orders.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Modalités par commande
                    </h4>
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border hover:border-purple-500/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border">
                            <ScrollText className="w-5 h-5 text-purple-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Modalités — {order.order_number}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleDownloadTerms(order)}
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">Télécharger</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>Aucune commande trouvée</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-500" />
                  Contrats de services
                </CardTitle>
                <CardDescription>
                  Vos accords de services et ententes contractuelles.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Chargement...</p>
                  </div>
                ) : contracts && contracts.length > 0 ? (
                  <div className="space-y-3">
                    {contracts.map((contract) => (
                      <div
                        key={contract.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border hover:border-cyan-500/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border">
                            <FileText className="w-5 h-5 text-cyan-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {contract.contract_name || contract.contract_number || "Contrat"}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(contract.created_at), "d MMM yyyy", { locale: fr })}
                              </p>
                              {contract.is_signed ? (
                                <Badge className="bg-emerald-500/20 text-emerald-500 border-0 text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Signé
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/20 text-amber-600 border-0 text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  En attente
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => navigate("/portal/contracts")}
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="hidden sm:inline">Voir</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>Aucun contrat trouvé</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate("/portal/contracts")}
                    >
                      Voir tous mes contrats
                    </Button>
                  </div>
                )}

                {contracts && contracts.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => navigate("/portal/contracts")}
                    >
                      <FileText className="w-4 h-4" />
                      Gérer mes contrats
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-500" />
                  Factures
                </CardTitle>
                <CardDescription>
                  Historique de vos factures et paiements.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Receipt className="w-12 h-12 mx-auto mb-4 text-emerald-500 opacity-50" />
                  <p className="text-muted-foreground mb-4">
                    Consultez et téléchargez toutes vos factures dans la section dédiée.
                  </p>
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={() => navigate("/portal/invoices")}
                  >
                    <Receipt className="w-4 h-4" />
                    Accéder à mes factures
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Help Card */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-cyan-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Besoin d'un document?</p>
                <p className="text-xs text-muted-foreground">
                  Contactez notre support si vous avez besoin d'un document spécifique ou d'une copie certifiée.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/portal/tickets")}
              >
                Contacter le support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientDocuments;
