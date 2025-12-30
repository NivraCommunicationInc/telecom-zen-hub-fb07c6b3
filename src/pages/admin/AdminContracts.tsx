import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Send, Plus, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { downloadContractPDF } from "@/lib/contractPdfGenerator";
import { BUSINESS_INFO, CONTRACT_TERMS } from "@/lib/contractPolicies";

interface ContractFormData {
  user_id: string;
  contract_name: string;
  service_description: string;
  monthly_amount?: number;
  total_amount?: number;
  start_date: string;
  end_date?: string;
  duration_months?: number;
  notes?: string;
  employee_name: string;
  employee_title: string;
}

const AdminContracts = () => {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [formData, setFormData] = useState<ContractFormData>({
    user_id: "",
    contract_name: "",
    service_description: "",
    start_date: new Date().toISOString().split("T")[0],
    employee_name: "",
    employee_title: "Conseiller Télécom",
  });

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["admin-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, profiles:user_id(email, full_name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-for-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: ContractFormData) => {
      const contractNumber = `NIVRA-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("contracts").insert({
        user_id: data.user_id,
        contract_name: data.contract_name,
        contract_url: contractNumber, // Using as contract number for now
        is_signed: false,
      });
      if (error) throw error;
      return { ...data, contractNumber };
    },
    onSuccess: () => {
      toast.success("Contrat créé avec succès");
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erreur lors de la création du contrat");
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrat supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  const markAsSignedMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from("contracts")
        .update({ is_signed: true, signed_at: new Date().toISOString() })
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrat marqué comme signé");
      queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const resetForm = () => {
    setFormData({
      user_id: "",
      contract_name: "",
      service_description: "",
      start_date: new Date().toISOString().split("T")[0],
      employee_name: "",
      employee_title: "Conseiller Télécom",
    });
  };

  const handleDownloadContract = (contract: any) => {
    const client = contract.profiles;
    downloadContractPDF({
      contractNumber: contract.contract_url || `NIVRA-${contract.id.slice(0, 8).toUpperCase()}`,
      contractName: contract.contract_name,
      clientName: client?.full_name || "Client",
      clientEmail: client?.email || "",
      clientPhone: client?.phone,
      serviceDescription: `Contrat de services de courtage télécom - ${contract.contract_name}`,
      startDate: contract.created_at,
      isSigned: contract.is_signed,
      signedAt: contract.signed_at,
      employeeName: "Représentant Nivra",
      employeeTitle: "Conseiller Télécom",
    });
    toast.success("Contrat téléchargé");
  };

  const handlePreviewContract = (contract: any) => {
    setSelectedContract(contract);
    setIsPreviewDialogOpen(true);
  };

  const handleSendContract = (contract: any) => {
    // TODO: Implement email sending
    toast.info("Fonctionnalité d'envoi par courriel à venir");
  };

  const handleCreateContract = () => {
    if (!formData.user_id || !formData.contract_name || !formData.employee_name) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    createContractMutation.mutate(formData);
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Contrats & Documents</h1>
            <p className="text-muted-foreground mt-1">Gérer les contrats clients signés</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-cyan-500 hover:bg-cyan-600">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau contrat
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Créer un nouveau contrat</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Client Selection */}
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <Select
                    value={formData.user_id}
                    onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.user_id} value={client.user_id}>
                          {client.full_name || client.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contract Name */}
                <div className="space-y-2">
                  <Label>Nom du contrat *</Label>
                  <Input
                    value={formData.contract_name}
                    onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
                    placeholder="Ex: Services de courtage télécom entreprise"
                  />
                </div>

                {/* Service Description */}
                <div className="space-y-2">
                  <Label>Description des services</Label>
                  <Textarea
                    value={formData.service_description}
                    onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
                    placeholder="Décrivez les services inclus dans ce contrat..."
                    rows={4}
                  />
                </div>

                {/* Financial Terms */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Montant mensuel ($)</Label>
                    <Input
                      type="number"
                      value={formData.monthly_amount || ""}
                      onChange={(e) => setFormData({ ...formData, monthly_amount: parseFloat(e.target.value) || undefined })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Montant total ($)</Label>
                    <Input
                      type="number"
                      value={formData.total_amount || ""}
                      onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || undefined })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date de début *</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Durée (mois)</Label>
                    <Input
                      type="number"
                      value={formData.duration_months || ""}
                      onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) || undefined })}
                      placeholder="12"
                    />
                  </div>
                </div>

                {/* Employee Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom de l'employé *</Label>
                    <Input
                      value={formData.employee_name}
                      onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                      placeholder="Prénom Nom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Titre</Label>
                    <Input
                      value={formData.employee_title}
                      onChange={(e) => setFormData({ ...formData, employee_title: e.target.value })}
                      placeholder="Conseiller Télécom"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes / Conditions particulières</Label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ajoutez des conditions ou notes spécifiques..."
                    rows={3}
                  />
                </div>

                {/* Policy Preview */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Politiques incluses automatiquement :</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Intérêt de {CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois sur paiements en retard</li>
                    <li>• Délai de paiement de {CONTRACT_TERMS.paymentTerms.dueDays} jours</li>
                    <li>• Préavis de résiliation de {CONTRACT_TERMS.cancellation.noticeDays} jours</li>
                    <li>• Clause de confidentialité et protection des données</li>
                    <li>• Juridiction: Province de Québec</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={handleCreateContract}
                    disabled={createContractMutation.isPending}
                    className="bg-cyan-500 hover:bg-cyan-600"
                  >
                    Créer le contrat
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Liste des contrats
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : contracts && contracts.length > 0 ? (
              <div className="space-y-3">
                {contracts.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{c.contract_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.profiles?.full_name || c.profiles?.email || "Client non assigné"}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>N° {c.contract_url || c.id.slice(0, 8).toUpperCase()}</span>
                        <span>Créé le {format(new Date(c.created_at), "d MMM yyyy", { locale: fr })}</span>
                        {c.signed_at && (
                          <span className="text-emerald-500">
                            Signé le {format(new Date(c.signed_at), "d MMM yyyy", { locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          c.is_signed
                            ? "bg-emerald-500/20 text-emerald-500"
                            : "bg-amber-500/20 text-amber-500"
                        }
                      >
                        {c.is_signed ? "Signé" : "En attente"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePreviewContract(c)}
                        title="Aperçu"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadContract(c)}
                        title="Télécharger PDF"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSendContract(c)}
                        title="Envoyer par courriel"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                      {!c.is_signed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsSignedMutation.mutate(c.id)}
                          className="text-emerald-500 hover:text-emerald-600"
                          title="Marquer comme signé"
                        >
                          ✓
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Supprimer ce contrat ?")) {
                            deleteContractMutation.mutate(c.id);
                          }
                        }}
                        className="text-destructive hover:text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucun contrat</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Créer le premier contrat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contract Preview Dialog */}
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aperçu du contrat</DialogTitle>
            </DialogHeader>
            {selectedContract && (
              <div className="space-y-6 py-4">
                {/* Header */}
                <div className="bg-cyan-500 text-white rounded-lg p-6 text-center">
                  <h2 className="text-2xl font-bold">{BUSINESS_INFO.name.toUpperCase()}</h2>
                  <p className="text-sm opacity-90">Courtier Télécom Indépendant</p>
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
                      <span className="font-medium">Statut :</span>{" "}
                      <Badge
                        className={
                          selectedContract.is_signed
                            ? "bg-emerald-500/20 text-emerald-500"
                            : "bg-amber-500/20 text-amber-500"
                        }
                      >
                        {selectedContract.is_signed ? "Signé" : "En attente"}
                      </Badge>
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
                    <p className="text-sm text-muted-foreground">{BUSINESS_INFO.email}</p>
                  </div>
                  <div className="border border-cyan-500 rounded-lg p-4">
                    <h3 className="font-bold text-cyan-500 mb-2">LE CLIENT</h3>
                    <p className="text-sm">{selectedContract.profiles?.full_name || "N/A"}</p>
                    <p className="text-sm text-muted-foreground">{selectedContract.profiles?.email}</p>
                    {selectedContract.profiles?.phone && (
                      <p className="text-sm text-muted-foreground">{selectedContract.profiles.phone}</p>
                    )}
                  </div>
                </div>

                {/* Contract Details */}
                <div className="space-y-4">
                  <h3 className="font-bold text-cyan-500">OBJET DU CONTRAT</h3>
                  <p className="text-sm">{selectedContract.contract_name}</p>
                </div>

                {/* Services */}
                <div className="space-y-4">
                  <h3 className="font-bold text-cyan-500">SERVICES FOURNIS</h3>
                  <ul className="text-sm space-y-1">
                    {CONTRACT_TERMS.services.map((service, index) => (
                      <li key={index}>• {service}</li>
                    ))}
                  </ul>
                </div>

                {/* Late Payment Policy */}
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h3 className="font-bold text-red-600 dark:text-red-400 mb-2">
                    POLITIQUE DE PAIEMENT EN RETARD
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Un intérêt de {CONTRACT_TERMS.paymentTerms.lateInterestRate}% par mois sera appliqué sur tout solde impayé après {CONTRACT_TERMS.paymentTerms.dueDays} jours.
                  </p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-cyan-500 rounded-lg p-4">
                    <h3 className="font-bold text-cyan-500 text-center mb-4">POUR LE PRESTATAIRE</h3>
                    <div className="border-b border-dashed border-muted-foreground h-12 mb-2" />
                    <p className="text-xs text-muted-foreground text-center">Signature</p>
                  </div>
                  <div className="border border-cyan-500 rounded-lg p-4">
                    <h3 className="font-bold text-cyan-500 text-center mb-4">POUR LE CLIENT</h3>
                    <div className="border-b border-dashed border-muted-foreground h-12 mb-2" />
                    <p className="text-xs text-muted-foreground text-center">Signature</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
                    Fermer
                  </Button>
                  <Button
                    onClick={() => {
                      handleDownloadContract(selectedContract);
                      setIsPreviewDialogOpen(false);
                    }}
                    className="bg-cyan-500 hover:bg-cyan-600"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger PDF
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminContracts;
