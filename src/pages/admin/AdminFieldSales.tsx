/**
 * AdminFieldSales - Comprehensive admin page for managing field sales representatives
 * Features: Create reps, view sales, track commissions, manage offline sync status, analytics
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Briefcase, 
  Plus, 
  Users, 
  DollarSign, 
  Package, 
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Cloud,
  TrendingUp,
  Target,
  Award,
  Eye,
  UserPlus,
  MoreHorizontal,
  Ban,
  KeyRound,
  Settings,
  Calendar,
  Search,
  Filter,
  Download,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

interface FieldSalesRep {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  is_active: boolean;
  status: string;
  onboarding_completed_at: string | null;
  terms_accepted_at: string | null;
  staff_pin_hash: string | null;
  last_login_at: string | null;
  created_at: string;
  total_sales: number;
  total_commission: number;
  pending_sales: number;
}

interface FieldSalesOrder {
  id: string;
  order_number: string | null;
  local_id: string | null;
  salesperson_id: string;
  salesperson_name?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_address: string;
  service_city: string | null;
  service_type: string;
  plan_name: string;
  monthly_price: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  sync_status: string;
  synced_at: string | null;
  created_at: string;
  converted_order_id: string | null;
}

interface SalesStats {
  totalReps: number;
  activeReps: number;
  totalSalesToday: number;
  totalSalesMonth: number;
  pendingSyncs: number;
  totalCommissions: number;
}

const AdminFieldSales = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [syncFilter, setSyncFilter] = useState<string>("all");
  const [createRepDialogOpen, setCreateRepDialogOpen] = useState(false);
  const [selectedRep, setSelectedRep] = useState<FieldSalesRep | null>(null);
  
  // Form state for new rep
  const [newRepEmail, setNewRepEmail] = useState("");
  const [newRepName, setNewRepName] = useState("");
  const [newRepPhone, setNewRepPhone] = useState("");

  // Fetch field sales representatives
  const { data: reps, isLoading: repsLoading, refetch: refetchReps } = useQuery({
    queryKey: ["admin-field-sales-reps"],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await adminSupabase
        .from("user_roles")
        .select("user_id, is_active, status, onboarding_completed_at, terms_accepted_at, staff_pin_hash, last_login_at, created_at")
        .eq("role", "field_sales");

      if (rolesError) throw rolesError;
      if (!rolesData || rolesData.length === 0) return [];

      const userIds = rolesData.map(r => r.user_id);
      
      // Get profiles
      const { data: profiles } = await adminSupabase
        .from("profiles")
        .select("user_id, email, full_name, phone")
        .in("user_id", userIds);

      // Get sales counts
      const { data: salesData } = await adminSupabase
        .from("field_sales_orders")
        .select("salesperson_id, total_amount, sync_status")
        .in("salesperson_id", userIds);

      // Get commissions
      const { data: commissionsData } = await adminSupabase
        .from("sales_commissions")
        .select("salesperson_id, amount")
        .in("salesperson_id", userIds);

      const reps: FieldSalesRep[] = rolesData.map(role => {
        const profile = profiles?.find(p => p.user_id === role.user_id);
        const userSales = salesData?.filter(s => s.salesperson_id === role.user_id) || [];
        const userCommissions = commissionsData?.filter(c => c.salesperson_id === role.user_id) || [];
        
        return {
          id: role.user_id,
          user_id: role.user_id,
          email: profile?.email || "—",
          full_name: profile?.full_name || null,
          phone: profile?.phone || null,
          is_active: role.is_active !== false,
          status: role.status || "pending",
          onboarding_completed_at: role.onboarding_completed_at,
          terms_accepted_at: role.terms_accepted_at,
          staff_pin_hash: role.staff_pin_hash,
          last_login_at: role.last_login_at,
          created_at: role.created_at,
          total_sales: userSales.length,
          total_commission: userCommissions.reduce((sum, c) => sum + (c.amount || 0), 0),
          pending_sales: userSales.filter(s => s.sync_status === "pending").length,
        };
      });

      return reps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  // Fetch field sales orders
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["admin-field-sales-orders", syncFilter],
    queryFn: async () => {
      let query = adminSupabase
        .from("field_sales_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (syncFilter !== "all") {
        query = query.eq("sync_status", syncFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get salesperson names
      if (data && data.length > 0) {
        const salespersonIds = [...new Set(data.map(o => o.salesperson_id))];
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", salespersonIds);

        return data.map(order => ({
          ...order,
          salesperson_name: profiles?.find(p => p.user_id === order.salesperson_id)?.full_name || "—",
        }));
      }

      return data || [];
    },
  });

  // Calculate stats
  const stats: SalesStats = {
    totalReps: reps?.length || 0,
    activeReps: reps?.filter(r => r.is_active && r.status === "active").length || 0,
    totalSalesToday: orders?.filter(o => {
      const today = new Date();
      const orderDate = new Date(o.created_at);
      return orderDate.toDateString() === today.toDateString();
    }).length || 0,
    totalSalesMonth: orders?.length || 0,
    pendingSyncs: orders?.filter(o => o.sync_status === "pending").length || 0,
    totalCommissions: reps?.reduce((sum, r) => sum + r.total_commission, 0) || 0,
  };

  // Create new field sales rep
  const createRepMutation = useMutation({
    mutationFn: async () => {
      // First, check if user exists or create via edge function
      const { data, error } = await adminSupabase.functions.invoke("admin-manage-staff", {
        body: {
          action: "create_field_sales",
          email: newRepEmail.trim().toLowerCase(),
          full_name: newRepName.trim(),
          phone: newRepPhone.trim() || null,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de la création");
      
      return data;
    },
    onSuccess: () => {
      toast({ title: "Vendeur créé avec succès" });
      setCreateRepDialogOpen(false);
      setNewRepEmail("");
      setNewRepName("");
      setNewRepPhone("");
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-reps"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Toggle rep status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: boolean }) => {
      const { error } = await adminSupabase
        .from("user_roles")
        .update({ 
          is_active: newStatus,
          status: newStatus ? "active" : "disabled",
        })
        .eq("user_id", userId)
        .eq("role", "field_sales");

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Statut mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-reps"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Force sync pending sales
  const forceSyncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await adminSupabase.functions.invoke("field-sales-sync", {
        body: { action: "force_sync_all" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: "Synchronisation terminée", 
        description: `${data?.synced || 0} ventes synchronisées` 
      });
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-orders"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur de synchronisation", description: error.message, variant: "destructive" });
    },
  });

  // Filter reps
  const filteredReps = reps?.filter(rep => {
    const matchesSearch = !searchQuery || 
      rep.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && rep.is_active && rep.status === "active") ||
      (statusFilter === "inactive" && (!rep.is_active || rep.status !== "active")) ||
      (statusFilter === "pending" && !rep.onboarding_completed_at);

    return matchesSearch && matchesStatus;
  }) || [];

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "synced":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0"><Wifi className="w-3 h-3 mr-1" />Synchronisé</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-0"><Cloud className="w-3 h-3 mr-1" />En attente</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0"><CheckCircle className="w-3 h-3 mr-1" />Confirmé</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-0"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Échoué</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              Ventes Terrain
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestion des représentants et ventes porte-à-porte
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchReps();
                refetchOrders();
              }}
              className="border-slate-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Button
              onClick={() => setCreateRepDialogOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-400 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Nouveau vendeur
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Users className="h-8 w-8 text-orange-400" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{stats.totalReps}</p>
                  <p className="text-xs text-slate-400">Vendeurs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{stats.activeReps}</p>
                  <p className="text-xs text-slate-400">Actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Target className="h-8 w-8 text-cyan-400" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{stats.totalSalesToday}</p>
                  <p className="text-xs text-slate-400">Aujourd'hui</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Package className="h-8 w-8 text-purple-400" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{stats.totalSalesMonth}</p>
                  <p className="text-xs text-slate-400">Ce mois</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Cloud className="h-8 w-8 text-amber-400" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{stats.pendingSyncs}</p>
                  <p className="text-xs text-slate-400">En attente sync</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <DollarSign className="h-8 w-8 text-green-400" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">${stats.totalCommissions.toFixed(0)}</p>
                  <p className="text-xs text-slate-400">Commissions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Sync Alert */}
        {stats.pendingSyncs > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-400">
                      {stats.pendingSyncs} vente(s) en attente de synchronisation
                    </p>
                    <p className="text-sm text-amber-400/70">
                      Ces ventes ont été enregistrées hors ligne et n'ont pas encore été synchronisées
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => forceSyncMutation.mutate()}
                  disabled={forceSyncMutation.isPending}
                  className="border-amber-500 text-amber-400 hover:bg-amber-500/20"
                >
                  {forceSyncMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4 mr-2" />
                  )}
                  Forcer la sync
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
              <Users className="h-4 w-4 mr-2" />
              Représentants
            </TabsTrigger>
            <TabsTrigger value="sales" className="data-[state=active]:bg-slate-700">
              <Package className="h-4 w-4 mr-2" />
              Ventes
            </TabsTrigger>
            <TabsTrigger value="commissions" className="data-[state=active]:bg-slate-700">
              <DollarSign className="h-4 w-4 mr-2" />
              Commissions
            </TabsTrigger>
          </TabsList>

          {/* Representatives Tab */}
          <TabsContent value="overview" className="mt-4">
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Représentants Terrain</CardTitle>
                    <CardDescription>Gérer les vendeurs porte-à-porte</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64 bg-slate-900/50 border-slate-700"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36 bg-slate-900/50 border-slate-700">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="active">Actifs</SelectItem>
                        <SelectItem value="inactive">Inactifs</SelectItem>
                        <SelectItem value="pending">En attente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {repsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredReps.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Aucun représentant trouvé</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-400">Vendeur</TableHead>
                        <TableHead className="text-slate-400">Contact</TableHead>
                        <TableHead className="text-slate-400">Statut</TableHead>
                        <TableHead className="text-slate-400">Ventes</TableHead>
                        <TableHead className="text-slate-400">Commissions</TableHead>
                        <TableHead className="text-slate-400">Dernière activité</TableHead>
                        <TableHead className="text-slate-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReps.map((rep) => (
                        <TableRow key={rep.id} className="border-slate-700">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white font-semibold">
                                {rep.full_name?.charAt(0) || rep.email.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-white">{rep.full_name || "—"}</p>
                                <p className="text-sm text-slate-400">{rep.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {rep.phone && (
                              <div className="flex items-center gap-2 text-slate-400">
                                <Phone className="h-3 w-3" />
                                {rep.phone}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {rep.is_active && rep.status === "active" ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Actif
                              </Badge>
                            ) : !rep.onboarding_completed_at ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border-0">
                                <Clock className="w-3 h-3 mr-1" />
                                Configuration
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <Ban className="w-3 h-3 mr-1" />
                                Inactif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-slate-500" />
                              <span className="text-white font-medium">{rep.total_sales}</span>
                              {rep.pending_sales > 0 && (
                                <Badge variant="outline" className="text-amber-400 border-amber-500/50">
                                  {rep.pending_sales} sync
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-green-400 font-medium">
                              ${rep.total_commission.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-slate-400 text-sm">
                              {rep.last_login_at 
                                ? format(new Date(rep.last_login_at), "dd MMM HH:mm", { locale: fr })
                                : "—"
                              }
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                <DropdownMenuItem
                                  onClick={() => setSelectedRep(rep)}
                                  className="text-white hover:bg-slate-700"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Voir détails
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-white hover:bg-slate-700">
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  Réinitialiser PIN
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-700" />
                                <DropdownMenuItem
                                  onClick={() => toggleStatusMutation.mutate({ 
                                    userId: rep.user_id, 
                                    newStatus: !rep.is_active 
                                  })}
                                  className={rep.is_active ? "text-red-400 hover:bg-red-500/20" : "text-emerald-400 hover:bg-emerald-500/20"}
                                >
                                  {rep.is_active ? (
                                    <>
                                      <Ban className="h-4 w-4 mr-2" />
                                      Désactiver
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Activer
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales" className="mt-4">
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Ventes Terrain</CardTitle>
                    <CardDescription>Historique des ventes porte-à-porte</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={syncFilter} onValueChange={setSyncFilter}>
                      <SelectTrigger className="w-48 bg-slate-900/50 border-slate-700">
                        <SelectValue placeholder="Statut sync" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="synced">Synchronisées</SelectItem>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="failed">Échouées</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !orders || orders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Aucune vente trouvée</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400">Vendeur</TableHead>
                        <TableHead className="text-slate-400">Client</TableHead>
                        <TableHead className="text-slate-400">Service</TableHead>
                        <TableHead className="text-slate-400">Montant</TableHead>
                        <TableHead className="text-slate-400">Paiement</TableHead>
                        <TableHead className="text-slate-400">Sync</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id} className="border-slate-700">
                          <TableCell className="text-slate-400">
                            {format(new Date(order.created_at), "dd/MM HH:mm", { locale: fr })}
                          </TableCell>
                          <TableCell className="text-white">
                            {order.salesperson_name}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-white">{order.customer_name}</p>
                              <p className="text-xs text-slate-500">{order.customer_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-white capitalize">{order.service_type}</p>
                              <p className="text-xs text-slate-500">{order.plan_name}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-white font-medium">
                            ${order.total_amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {getPaymentStatusBadge(order.payment_status)}
                          </TableCell>
                          <TableCell>
                            {getSyncStatusBadge(order.sync_status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions" className="mt-4">
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle>Commissions</CardTitle>
                <CardDescription>Suivi des gains des représentants</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredReps.map((rep) => (
                    <div key={rep.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white font-semibold">
                          {rep.full_name?.charAt(0) || rep.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{rep.full_name || rep.email}</p>
                          <p className="text-sm text-slate-400">{rep.total_sales} ventes</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">${rep.total_commission.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">Commission totale</p>
                      </div>
                    </div>
                  ))}
                  {filteredReps.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Aucune commission enregistrée</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Rep Dialog */}
        <Dialog open={createRepDialogOpen} onOpenChange={setCreateRepDialogOpen}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Nouveau vendeur terrain</DialogTitle>
              <DialogDescription>
                Créer un compte pour un représentant porte-à-porte
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newRepEmail}
                  onChange={(e) => setNewRepEmail(e.target.value)}
                  placeholder="vendeur@nivratelecom.ca"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet *</Label>
                <Input
                  id="name"
                  value={newRepName}
                  onChange={(e) => setNewRepName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={newRepPhone}
                  onChange={(e) => setNewRepPhone(e.target.value)}
                  placeholder="514-555-1234"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateRepDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => createRepMutation.mutate()}
                disabled={!newRepEmail || !newRepName || createRepMutation.isPending}
                className="bg-gradient-to-r from-orange-500 to-amber-400"
              >
                {createRepMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Créer le compte
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminFieldSales;
