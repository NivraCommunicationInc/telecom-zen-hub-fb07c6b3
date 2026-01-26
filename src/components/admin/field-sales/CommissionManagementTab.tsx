/**
 * CommissionManagementTab - Advanced commission management for field sales
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Clock,
  CheckCircle,
  CreditCard,
  Settings,
  Filter,
  Calculator,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface Commission {
  id: string;
  salesperson_id: string;
  salesperson_name?: string;
  field_order_id: string | null;
  order_id: string | null;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface CommissionRuleSettings {
  defaultRate: number;
  mobileRate: number;
  internetRate: number;
  tvRate: number;
  bonusThreshold: number;
  bonusRate: number;
}

export function CommissionManagementTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [commissionSettings, setCommissionSettings] = useState<CommissionRuleSettings>({
    defaultRate: 10,
    mobileRate: 10,
    internetRate: 12,
    tvRate: 15,
    bonusThreshold: 20,
    bonusRate: 2,
  });

  // Fetch all commissions
  const { data: commissions, isLoading } = useQuery({
    queryKey: ["admin-all-commissions", statusFilter],
    queryFn: async () => {
      let query = adminSupabase
        .from("sales_commissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get salesperson names
      if (data && data.length > 0) {
        const salespersonIds = [...new Set(data.map(c => c.salesperson_id))];
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", salespersonIds);

        return data.map(commission => ({
          ...commission,
          salesperson_name: profiles?.find(p => p.user_id === commission.salesperson_id)?.full_name || "—",
        })) as Commission[];
      }

      return data as Commission[];
    },
  });

  // Mark commissions as paid
  const markPaidMutation = useMutation({
    mutationFn: async (commissionIds: string[]) => {
      const { error } = await adminSupabase
        .from("sales_commissions")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .in("id", commissionIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Commissions marquées comme payées" });
      setSelectedCommissions([]);
      setPayDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-all-commissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-reps"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Validate pending commissions
  const validateMutation = useMutation({
    mutationFn: async (commissionIds: string[]) => {
      const { error } = await adminSupabase
        .from("sales_commissions")
        .update({ status: "validated" })
        .in("id", commissionIds);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Commissions validées" });
      setSelectedCommissions([]);
      queryClient.invalidateQueries({ queryKey: ["admin-all-commissions"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Calculate totals
  const totalPending = commissions?.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0) || 0;
  const totalValidated = commissions?.filter(c => c.status === "validated").reduce((sum, c) => sum + c.commission_amount, 0) || 0;
  const totalPaid = commissions?.filter(c => c.status === "paid").reduce((sum, c) => sum + c.commission_amount, 0) || 0;
  const selectedTotal = commissions?.filter(c => selectedCommissions.includes(c.id)).reduce((sum, c) => sum + c.commission_amount, 0) || 0;

  const pendingCommissions = commissions?.filter(c => c.status === "pending" || c.status === "validated") || [];

  const toggleSelectAll = () => {
    if (selectedCommissions.length === pendingCommissions.length) {
      setSelectedCommissions([]);
    } else {
      setSelectedCommissions(pendingCommissions.map(c => c.id));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0"><CreditCard className="w-3 h-3 mr-1" />Payé</Badge>;
      case "validated":
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-0"><CheckCircle className="w-3 h-3 mr-1" />Validé</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-0"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Clock className="h-8 w-8 text-amber-400" />
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-400">${totalPending.toFixed(2)}</p>
                <p className="text-xs text-amber-400/70">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/30 bg-cyan-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <CheckCircle className="h-8 w-8 text-cyan-400" />
              <div className="text-right">
                <p className="text-2xl font-bold text-cyan-400">${totalValidated.toFixed(2)}</p>
                <p className="text-xs text-cyan-400/70">Validé à payer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <CreditCard className="h-8 w-8 text-emerald-400" />
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-400">${totalPaid.toFixed(2)}</p>
                <p className="text-xs text-emerald-400/70">Total payé</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/30 bg-purple-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Calculator className="h-8 w-8 text-purple-400" />
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-400">{commissionSettings.defaultRate}%</p>
                <p className="text-xs text-purple-400/70">Taux par défaut</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      {selectedCommissions.length > 0 && (
        <Card className="border-orange-500/50 bg-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-orange-400" />
                <span className="font-medium text-orange-400">
                  {selectedCommissions.length} commission(s) sélectionnée(s) • Total: ${selectedTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => validateMutation.mutate(selectedCommissions.filter(id => 
                    commissions?.find(c => c.id === id)?.status === "pending"
                  ))}
                  disabled={validateMutation.isPending}
                  className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/20"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Valider
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPayDialogOpen(true)}
                  className="bg-gradient-to-r from-emerald-500 to-green-400 text-white"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Marquer payé
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Table */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Gestion des commissions</CardTitle>
              <CardDescription>Valider et payer les commissions des représentants</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 bg-slate-900/50 border-slate-700">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="validated">Validées</SelectItem>
                  <SelectItem value="paid">Payées</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsDialogOpen(true)}
                className="border-slate-700"
              >
                <Settings className="h-4 w-4 mr-2" />
                Règles
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !commissions || commissions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune commission trouvée</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedCommissions.length === pendingCommissions.length && pendingCommissions.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">Vendeur</TableHead>
                  <TableHead className="text-slate-400">Montant vente</TableHead>
                  <TableHead className="text-slate-400">Taux</TableHead>
                  <TableHead className="text-slate-400">Commission</TableHead>
                  <TableHead className="text-slate-400">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => (
                  <TableRow key={commission.id} className="border-slate-700">
                    <TableCell>
                      {(commission.status === "pending" || commission.status === "validated") && (
                        <Checkbox
                          checked={selectedCommissions.includes(commission.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCommissions([...selectedCommissions, commission.id]);
                            } else {
                              setSelectedCommissions(selectedCommissions.filter(id => id !== commission.id));
                            }
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {commission.salesperson_name}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      ${commission.order_amount?.toFixed(2) || "—"}
                    </TableCell>
                    <TableCell className="text-purple-400">
                      {((commission.commission_rate || 0.1) * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-emerald-400 font-bold">
                      ${commission.commission_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(commission.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pay Confirmation Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-400" />
              Confirmer le paiement
            </DialogTitle>
            <DialogDescription>
              Marquer {selectedCommissions.length} commission(s) comme payée(s)
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Montant total</span>
                <span className="text-2xl font-bold text-emerald-400">${selectedTotal.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-4">
              Cette action marquera les commissions sélectionnées comme payées et enregistrera la date de paiement.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)} className="border-slate-700">
              Annuler
            </Button>
            <Button
              onClick={() => markPaidMutation.mutate(selectedCommissions)}
              disabled={markPaidMutation.isPending}
              className="bg-gradient-to-r from-emerald-500 to-green-400 text-white"
            >
              {markPaidMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-purple-400" />
              Règles de commission
            </DialogTitle>
            <DialogDescription>
              Configurer les taux de commission par type de service
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Taux par défaut (%)</Label>
                <Input
                  type="number"
                  value={commissionSettings.defaultRate}
                  onChange={(e) => setCommissionSettings({
                    ...commissionSettings,
                    defaultRate: parseFloat(e.target.value) || 0
                  })}
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Mobile (%)</Label>
                <Input
                  type="number"
                  value={commissionSettings.mobileRate}
                  onChange={(e) => setCommissionSettings({
                    ...commissionSettings,
                    mobileRate: parseFloat(e.target.value) || 0
                  })}
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Internet (%)</Label>
                <Input
                  type="number"
                  value={commissionSettings.internetRate}
                  onChange={(e) => setCommissionSettings({
                    ...commissionSettings,
                    internetRate: parseFloat(e.target.value) || 0
                  })}
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">TV (%)</Label>
                <Input
                  type="number"
                  value={commissionSettings.tvRate}
                  onChange={(e) => setCommissionSettings({
                    ...commissionSettings,
                    tvRate: parseFloat(e.target.value) || 0
                  })}
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>
            </div>
            <Separator className="bg-slate-700" />
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <p className="text-sm text-purple-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Les nouveaux taux s'appliqueront aux futures ventes uniquement.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)} className="border-slate-700">
              Fermer
            </Button>
            <Button className="bg-gradient-to-r from-purple-500 to-indigo-400 text-white">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
