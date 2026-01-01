import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Download, CheckCircle, Eye, Pen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { downloadContractPDF } from "@/lib/contractPdfGenerator";
import { BUSINESS_INFO, CONTRACT_TERMS } from "@/lib/contractPolicies";

const ClientContracts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  // Fetch contracts for current user
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["client-contracts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch current profile for signature
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Sign contract mutation
  const signContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from("contracts")
        .update({
          is_signed: true,
          signed_at: new Date().toISOString(),
        })
        .eq("id", contractId)
        .eq("user_id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate with exact key used in query
      queryClient.invalidateQueries({ queryKey: ["client-contracts", user?.id] });
      toast({ title: "Contrat signé avec succès", description: "Vous pouvez maintenant télécharger votre contrat signé." });
      setSignDialogOpen(false);
      setSelectedContract(null);
      setIsAgreed(false);
    },
    onError: (error) => {
      console.error("Contract sign error:", error);
      toast({ title: "Erreur lors de la signature", variant: "destructive" });
    },
  });

  const handleDownloadContract = (contract: any) => {
    downloadContractPDF({
      contractNumber: contract.contract_url || `NIVRA-${contract.id.slice(0, 8).toUpperCase()}`,
      contractName: contract.contract_name,
      clientName: profile?.full_name || "Client",
      clientEmail: profile?.email || user?.email || "",
      clientPhone: profile?.phone,
      serviceDescription: `Contrat de services de courtage télécom - ${contract.contract_name}`,
      startDate: contract.created_at,
      isSigned: contract.is_signed,
      signedAt: contract.signed_at,
      employeeName: "Représentant Nivra",
      employeeTitle: "Conseiller Télécom",
    });
    toast({ title: "Contrat téléchargé" });
  };

  const openSignDialog = (contract: any) => {
    setSelectedContract(contract);
    setIsAgreed(false);
    setSignDialogOpen(true);
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Mes contrats</h1>
          <p className="text-muted-foreground mt-1">Consultez et signez vos contrats</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Contrats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : contracts && contracts.length > 0 ? (
              <div className="space-y-4">
                {contracts.map((contract: any) => (
                  <div
                    key={contract.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border rounded-lg hover:border-cyan-400/30 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-foreground">{contract.contract_name}</h3>
                        <Badge
                          className={
                            contract.is_signed
                              ? "bg-emerald-500/20 text-emerald-500"
                              : "bg-amber-500/20 text-amber-500"
                          }
                        >
                          {contract.is_signed ? "Signé" : "En attente de signature"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        N° {contract.contract_url || contract.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Créé le {format(new Date(contract.created_at), "d MMMM yyyy", { locale: fr })}
                        {contract.signed_at && (
                          <span className="text-emerald-500 ml-2">
                            • Signé le {format(new Date(contract.signed_at), "d MMMM yyyy", { locale: fr })}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!contract.is_signed && (
                        <Button
                          variant="hero"
                          size="sm"
                          onClick={() => openSignDialog(contract)}
                        >
                          <Pen className="w-4 h-4 mr-2" />
                          Signer
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadContract(contract)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun contrat disponible</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sign Contract Dialog */}
        <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Signature du contrat</DialogTitle>
            </DialogHeader>
            {selectedContract && (
              <div className="space-y-6 py-4">
                {/* Contract Preview */}
                <div className="space-y-4">
                  {/* Header */}
                  <div className="bg-cyan-500 text-white rounded-lg p-6 text-center">
                    <h2 className="text-2xl font-bold">{BUSINESS_INFO.name.toUpperCase()}</h2>
                    <p className="text-sm opacity-90">Compagnie Télécom Indépendante</p>
                    <p className="text-xs opacity-75 mt-1">
                      {BUSINESS_INFO.phone} | {BUSINESS_INFO.email}
                    </p>
                  </div>

                  {/* Contract Info */}
                  <div className="bg-muted rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Contrat N° :</span>{" "}
                        {selectedContract.contract_url || selectedContract.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium">Version :</span> {CONTRACT_TERMS.version}
                      </div>
                      <div>
                        <span className="font-medium">Date d'émission :</span>{" "}
                        {format(new Date(selectedContract.created_at), "d MMMM yyyy", { locale: fr })}
                      </div>
                      <div>
                        <span className="font-medium">Nom du contrat :</span> {selectedContract.contract_name}
                      </div>
                    </div>
                  </div>

                  {/* Parties */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-cyan-500 rounded-lg p-4">
                      <h3 className="font-bold text-cyan-500 mb-2">LE PRESTATAIRE</h3>
                      <p className="text-sm">{BUSINESS_INFO.legalName}</p>
                      <p className="text-sm text-muted-foreground">{BUSINESS_INFO.address}</p>
                      <p className="text-sm text-muted-foreground">{BUSINESS_INFO.phone}</p>
                    </div>
                    <div className="border border-cyan-500 rounded-lg p-4">
                      <h3 className="font-bold text-cyan-500 mb-2">LE CLIENT</h3>
                      <p className="text-sm">{profile?.full_name || "N/A"}</p>
                      <p className="text-sm text-muted-foreground">{profile?.email || user?.email}</p>
                      {profile?.phone && (
                        <p className="text-sm text-muted-foreground">{profile.phone}</p>
                      )}
                    </div>
                  </div>

                  {/* Services */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-cyan-500">SERVICES FOURNIS</h3>
                    <ul className="text-sm space-y-1">
                      {CONTRACT_TERMS.services.map((service, index) => (
                        <li key={index}>• {service}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Terms */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-cyan-500">CONDITIONS</h3>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Paiement sous {CONTRACT_TERMS.paymentTerms.dueDays} jours</li>
                      <li>• Intérêt de {CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois sur paiements en retard</li>
                      <li>• Préavis de résiliation de {CONTRACT_TERMS.cancellation.noticeDays} jours</li>
                      <li>• Frais après livraison: {CONTRACT_TERMS.cancellation.afterDeliveryCharge}</li>
                    </ul>
                  </div>

                  {/* Late Payment Warning */}
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h3 className="font-bold text-red-600 dark:text-red-400 mb-2">
                      POLITIQUE DE PAIEMENT EN RETARD
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      Un intérêt de {CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois sera appliqué sur tout solde impayé après {CONTRACT_TERMS.paymentTerms.dueDays} jours.
                    </p>
                  </div>
                </div>

                {/* Agreement Checkbox */}
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <input
                    type="checkbox"
                    id="agreement"
                    checked={isAgreed}
                    onChange={(e) => setIsAgreed(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="agreement" className="text-sm text-foreground">
                    J'ai lu et j'accepte les termes et conditions de ce contrat. Je comprends que cette signature électronique a la même valeur juridique qu'une signature manuscrite.
                  </label>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setSignDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    variant="hero"
                    onClick={() => signContractMutation.mutate(selectedContract.id)}
                    disabled={!isAgreed || signContractMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Signer le contrat
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ClientLayout>
  );
};

export default ClientContracts;
