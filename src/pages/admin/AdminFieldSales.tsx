/**
 * AdminFieldSales - Professional admin control center for field sales management
 * Features: Rep management, sales tracking, commission control, order integration
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, RefreshCw, UserPlus, Users, Package, DollarSign, Settings } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Import field sales components
import { FieldSalesStatsCards } from "@/components/admin/field-sales/FieldSalesStatsCards";
import { CreateRepresentativeDialog } from "@/components/admin/field-sales/CreateRepresentativeDialog";
import { RepresentativeDetailDialog } from "@/components/admin/field-sales/RepresentativeDetailDialog";
import { RepresentativesTable } from "@/components/admin/field-sales/RepresentativesTable";
import { FieldSalesOrdersTab } from "@/components/admin/field-sales/FieldSalesOrdersTab";
import { CommissionManagementTab } from "@/components/admin/field-sales/CommissionManagementTab";

interface FieldSalesRep {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  territory?: string | null;
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

const AdminFieldSales = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("reps");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRep, setSelectedRep] = useState<FieldSalesRep | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Fetch representatives
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
      
      const { data: profiles } = await adminSupabase
        .from("profiles")
        .select("user_id, email, full_name, phone")
        .in("user_id", userIds);

      const { data: salesData } = await adminSupabase
        .from("field_sales_orders")
        .select("salesperson_id, total_amount, sync_status")
        .in("salesperson_id", userIds);

      const { data: commissionsData } = await adminSupabase
        .from("sales_commissions")
        .select("salesperson_id, commission_amount, amount")
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
          total_commission: userCommissions.reduce((sum, c) => sum + (c.commission_amount || c.amount || 0), 0),
          pending_sales: userSales.filter(s => s.sync_status === "pending").length,
        };
      });

      return reps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  // Fetch stats
  const { data: orders } = useQuery({
    queryKey: ["admin-field-sales-orders-stats"],
    queryFn: async () => {
      const { data, error } = await adminSupabase
        .from("field_sales_orders")
        .select("id, total_amount, sync_status, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const stats = {
    totalReps: reps?.length || 0,
    activeReps: reps?.filter(r => r.is_active && r.status === "active").length || 0,
    totalSalesToday: orders?.filter(o => new Date(o.created_at) >= today).length || 0,
    totalSalesWeek: orders?.filter(o => new Date(o.created_at) >= weekAgo).length || 0,
    totalSalesMonth: orders?.length || 0,
    pendingSyncs: orders?.filter(o => o.sync_status === "pending").length || 0,
    totalCommissions: reps?.reduce((sum, r) => sum + r.total_commission, 0) || 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    totalRevenue: orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
  };

  // Force sync mutation
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
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-orders-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-field-sales-reps"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleViewDetails = (rep: FieldSalesRep) => {
    setSelectedRep(rep);
    setDetailDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              Centre Ventes Terrain
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestion complète des représentants et ventes porte-à-porte
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchReps()}
              className="border-slate-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Nouveau représentant
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <FieldSalesStatsCards stats={stats} />

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="reps" className="data-[state=active]:bg-slate-700">
              <Users className="h-4 w-4 mr-2" />
              Représentants
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-slate-700">
              <Package className="h-4 w-4 mr-2" />
              Commandes
            </TabsTrigger>
            <TabsTrigger value="commissions" className="data-[state=active]:bg-slate-700">
              <DollarSign className="h-4 w-4 mr-2" />
              Commissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reps" className="mt-4">
            <RepresentativesTable
              representatives={reps}
              isLoading={repsLoading}
              onViewDetails={handleViewDetails}
              onCreateNew={() => setCreateDialogOpen(true)}
            />
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <FieldSalesOrdersTab
              onForceSync={() => forceSyncMutation.mutate()}
              isSyncing={forceSyncMutation.isPending}
              pendingSyncs={stats.pendingSyncs}
            />
          </TabsContent>

          <TabsContent value="commissions" className="mt-4">
            <CommissionManagementTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateRepresentativeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <RepresentativeDetailDialog
        representative={selectedRep}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </AdminLayout>
  );
};

export default AdminFieldSales;
