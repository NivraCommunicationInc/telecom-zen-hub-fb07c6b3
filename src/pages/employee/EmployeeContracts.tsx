import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search, Eye, Download, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { employeeClient as supabase } from "@/integrations/backend/employeeClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const EmployeeContracts = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["employee-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filteredContracts = contracts?.filter((contract: any) => {
    const clientName = contract.profiles?.full_name || 
      `${contract.profiles?.first_name || ""} ${contract.profiles?.last_name || ""}`.trim();
    
    const matchesSearch = !searchQuery || 
      contract.contract_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.contract_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clientName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "signed" && contract.is_signed) ||
      (statusFilter === "pending" && !contract.is_signed);
    
    return matchesSearch && matchesStatus;
  });

  const handleDownload = (contract: any) => {
    if (contract.contract_url) {
      window.open(contract.contract_url, "_blank");
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contrats</h1>
          <p className="text-muted-foreground mt-1">Consulter et télécharger les contrats clients</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro, nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="signed">Signé</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contracts List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Contrats ({filteredContracts?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : filteredContracts && filteredContracts.length > 0 ? (
              <div className="space-y-2">
                {filteredContracts.map((contract: any) => {
                  const clientName = contract.profiles?.full_name || 
                    `${contract.profiles?.first_name || ""} ${contract.profiles?.last_name || ""}`.trim() ||
                    "Client";

                  return (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          {contract.is_signed ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {contract.contract_name || "Contrat de service"}
                          </p>
                          <p className="text-sm text-muted-foreground">{clientName}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {contract.contract_number || "—"} • {format(new Date(contract.created_at), "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={contract.is_signed ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"}>
                          {contract.is_signed ? "Signé" : "En attente"}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedContract(contract);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(contract)}
                          disabled={!contract.contract_url}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Aucun contrat trouvé</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contract Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du contrat</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            {selectedContract && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Numéro de contrat</p>
                    <p className="font-mono font-medium">{selectedContract.contract_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    <Badge className={selectedContract.is_signed ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"}>
                      {selectedContract.is_signed ? "Signé" : "En attente de signature"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nom du contrat</p>
                    <p className="font-medium">{selectedContract.contract_name || "Contrat de service"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date de création</p>
                    <p>{format(new Date(selectedContract.created_at), "d MMMM yyyy HH:mm", { locale: fr })}</p>
                  </div>
                  {selectedContract.is_signed && selectedContract.signed_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Date de signature</p>
                      <p>{format(new Date(selectedContract.signed_at), "d MMMM yyyy HH:mm", { locale: fr })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-medium">
                      {selectedContract.profiles?.full_name || 
                        `${selectedContract.profiles?.first_name || ""} ${selectedContract.profiles?.last_name || ""}`.trim() ||
                        "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedContract.profiles?.email}</p>
                  </div>
                </div>

                {selectedContract.pdf_hash && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-1">Hash du document</p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {selectedContract.pdf_hash}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleDownload(selectedContract)}
                    disabled={!selectedContract.contract_url}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger le PDF
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeeContracts;
