import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ArrowLeft, 
  Search, 
  Loader2, 
  QrCode, 
  RefreshCw, 
  AlertCircle,
  MoreHorizontal,
  Edit,
  Ban,
  CheckCircle,
  Eye
} from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const AdminReferralCodes = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<any>(null);
  const [editData, setEditData] = useState({
    usage_limit_total: "",
    usage_limit_monthly: "",
  });

  const { data: codes, isLoading, error, refetch } = useQuery({
    queryKey: ["referral-codes", searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("referral_codes")
        .select(`
          *,
          influencers(id, first_name, last_name, email)
        `)
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.ilike("code", `%${searchTerm}%`);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Toggle code status via admin-referrals-manage (F33-1)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ codeId, newStatus }: { codeId: string; newStatus: string }) => {
      const { error } = await supabase.functions.invoke("admin-referrals-manage", {
        body: { action: "code.toggle", code_id: codeId, status: newStatus },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-codes"] });
      toast.success("Statut du code mis à jour");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Update code limits via admin-referrals-manage
  const updateCodeMutation = useMutation({
    mutationFn: async ({ codeId, updates }: { codeId: string; updates: { usage_limit_total: number | null; usage_limit_monthly: number | null } }) => {
      const { error } = await supabase.functions.invoke("admin-referrals-manage", {
        body: {
          action: "code.update",
          code_id: codeId,
          usage_limit_total: updates.usage_limit_total,
          usage_limit_monthly: updates.usage_limit_monthly,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-codes"] });
      setEditDialogOpen(false);
      setSelectedCode(null);
      toast.success("Code mis à jour");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const openEditDialog = (code: any) => {
    setSelectedCode(code);
    setEditData({
      usage_limit_total: code.usage_limit_total?.toString() || "",
      usage_limit_monthly: code.usage_limit_monthly?.toString() || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCode) return;
    updateCodeMutation.mutate({
      codeId: selectedCode.id,
      updates: {
        usage_limit_total: editData.usage_limit_total ? parseInt(editData.usage_limit_total) : null,
        usage_limit_monthly: editData.usage_limit_monthly ? parseInt(editData.usage_limit_monthly) : null,
      },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Actif</Badge>;
      case "disabled":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Désactivé</Badge>;
      case "expired":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Expiré</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  };

  if (error) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/referrals">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Codes de Parrainage</h1>
            </div>
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Erreur de chargement: {(error as Error).message}</span>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/referrals">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Codes de Parrainage</h1>
            <p className="text-muted-foreground">
              Gérez tous les codes de parrainage
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="disabled">Désactivés</SelectItem>
                  <SelectItem value="expired">Expirés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Influenceur</TableHead>
                  <TableHead className="text-center">Utilisations</TableHead>
                  <TableHead>Limites</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : !codes || codes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <QrCode className="w-10 h-10 opacity-50" />
                        <p>Aucun code trouvé</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  codes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                          {code.code}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(code.status)}</TableCell>
                      <TableCell>
                        {code.influencers ? (
                          <Link 
                            to={`/admin/referrals/influencers/${code.influencers.id}`}
                            className="hover:text-primary"
                          >
                            <div>
                              <p className="font-medium">
                                {code.influencers.first_name || "—"} {code.influencers.last_name || ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {code.influencers.email || "—"}
                              </p>
                            </div>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{code.usage_count ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {code.usage_limit_total || code.usage_limit_monthly ? (
                          <div className="space-y-1">
                            {code.usage_limit_total && (
                              <p>Total: {code.usage_limit_total}</p>
                            )}
                            {code.usage_limit_monthly && (
                              <p>Mensuel: {code.usage_limit_monthly}</p>
                            )}
                          </div>
                        ) : (
                          <span>Illimité</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {code.created_at
                          ? new Date(code.created_at).toLocaleDateString("fr-CA")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {code.influencers && (
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/referrals/influencers/${code.influencers.id}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Voir l'influenceur
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEditDialog(code)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier les limites
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {code.status === "active" ? (
                              <DropdownMenuItem
                                onClick={() => toggleStatusMutation.mutate({ codeId: code.id, newStatus: "disabled" })}
                                className="text-red-500"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Désactiver
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => toggleStatusMutation.mutate({ codeId: code.id, newStatus: "active" })}
                                className="text-green-500"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Activer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le code</DialogTitle>
            <DialogDescription>
              Modifiez les limites d'utilisation du code{" "}
              <code className="bg-muted px-1 rounded">{selectedCode?.code}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="usage_limit_total">Limite totale d'utilisations</Label>
              <Input
                id="usage_limit_total"
                type="number"
                min="0"
                placeholder="Illimité"
                value={editData.usage_limit_total}
                onChange={(e) => setEditData({ ...editData, usage_limit_total: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour illimité
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usage_limit_monthly">Limite mensuelle</Label>
              <Input
                id="usage_limit_monthly"
                type="number"
                min="0"
                placeholder="Illimité"
                value={editData.usage_limit_monthly}
                onChange={(e) => setEditData({ ...editData, usage_limit_monthly: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Nombre maximum d'utilisations par mois
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateCodeMutation.isPending}>
              {updateCodeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReferralCodes;
