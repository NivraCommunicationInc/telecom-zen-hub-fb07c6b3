/**
 * AdminOrders — Orders Center (carrier-grade list view)
 * Full-width DataTable, no card wrappers, no detail dialog.
 * All detail work is done in the Workbench (/admin/orders/:id).
 */
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { DataTable, Column } from "@/components/admin/ui/DataTable";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package, Plus, RefreshCw, Wrench, Wifi, ShoppingCart, ChevronDown,
  CreditCard, Filter, AlertTriangle, Eye,
} from "lucide-react";
import ManualOrderWizard from "@/components/admin/ManualOrderWizard";
import EquipmentOrderDialog from "@/components/admin/EquipmentOrderDialog";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* ── Status configs ── */
const ORDER_STATUS: Record<string, string> = {
  pending: "En attente",
  pending_verification: "Vérification KYC",
  confirmed: "Confirmé",
  hold: "Suspendu",
  verification: "Vérification",
  back_order: "Back Order",
  backorder: "Rupture de stock",
  cancelled: "Annulé",
  shipped: "Expédié",
  completed: "Terminé",
  installation_scheduled: "Installation planifiée",
  technician_en_route: "Tech en route",
  installation_in_progress: "Installation en cours",
  installation_completed: "Installation terminée",
};

const PAYMENT_STATUS: Record<string, string> = {
  pending: "En attente",
  pre_authorized: "Pré-autorisé",
  authorized: "Autorisé",
  captured: "Capturé",
  confirmed: "Confirmé",
  refunded: "Remboursé",
  disputed: "Contesté",
  chargeback: "Rétrofacturation",
  fraud: "Fraude",
  failed: "Échoué",
  not_renewed: "Non renouvelé",
};

const statusOptions = Object.entries(ORDER_STATUS).map(([value, label]) => ({ value, label }));
const paymentOptions = Object.entries(PAYMENT_STATUS).map(([value, label]) => ({ value, label }));

/* ── Component ── */
const AdminOrders = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      if (ordersData && ordersData.length > 0) {
        const userIds = [...new Set(ordersData.map((o: any) => o.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone, account_number")
          .in("user_id", userIds);

        return ordersData.map((order: any) => ({
          ...order,
          profiles: profiles?.find((p: any) => p.user_id === order.user_id) || null,
        }));
      }
      return ordersData || [];
    },
  });

  const filtered = useMemo(() => {
    return orders.filter((order: any) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        order.order_number?.toLowerCase().includes(q) ||
        order.profiles?.full_name?.toLowerCase().includes(q) ||
        order.profiles?.email?.toLowerCase().includes(q) ||
        order.profiles?.account_number?.toLowerCase().includes(q) ||
        order.service_type?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesPayment = paymentFilter === "all" || order.payment_status === paymentFilter;
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orders, searchTerm, statusFilter, paymentFilter]);

  const columns: Column<any>[] = useMemo(() => [
    {
      key: "order_number",
      label: "Commande",
      render: (o: any) => (
        <div className="flex items-center gap-2">
          <Link to={`/admin/orders/${o.id}`} className="font-mono font-medium text-foreground hover:text-primary transition-colors">
            {o.order_number || `#${o.id.slice(0, 8)}`}
          </Link>
          {o.order_type === "equipment" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Équip.</Badge>
          )}
          {o.risk_flags?.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
        </div>
      ),
    },
    {
      key: "account_number",
      label: "Compte",
      render: (o: any) => (
        <span className="font-mono text-muted-foreground text-xs">{o.profiles?.account_number || "—"}</span>
      ),
    },
    {
      key: "client",
      label: "Client",
      sortable: false,
      render: (o: any) => (
        <div>
          <p className="font-medium text-foreground text-sm truncate max-w-[180px]">
            {o.profiles?.full_name?.trim() || [o.client_first_name, o.client_last_name].filter(Boolean).join(" ").trim() || "—"}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{o.profiles?.email || o.client_email || ""}</p>
        </div>
      ),
    },
    {
      key: "service_type",
      label: "Service",
      render: (o: any) => <span className="text-sm">{o.service_type || "—"}</span>,
    },
    {
      key: "total_amount",
      label: "Total",
      render: (o: any) => (
        <span className="tabular-nums text-sm">
          {Number(o.total_amount || 0).toFixed(2)} $
        </span>
      ),
    },
    {
      key: "status",
      label: "Statut",
      render: (o: any) => (
        <StatusBadge label={ORDER_STATUS[o.status] || o.status} variant={statusToVariant(o.status)} size="sm" />
      ),
    },
    {
      key: "payment_status",
      label: "Paiement",
      render: (o: any) => (
        <StatusBadge label={PAYMENT_STATUS[o.payment_status] || o.payment_status} variant={statusToVariant(o.payment_status)} size="sm" />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (o: any) => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {format(new Date(o.created_at), "d MMM yyyy", { locale: fr })}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      sortable: false,
      className: "w-[100px]",
      render: (o: any) => (
        <Link to={`/admin/orders/${o.id}`}>
          <Button size="sm" className="gap-1.5 h-7 text-xs">
            <Wrench className="w-3 h-3" /> Workbench
          </Button>
        </Link>
      ),
    },
  ], []);

  return (
    <AdminLayout>
      <div className="space-y-3">
        <PageHeader
          title="Commandes"
          subtitle={`Centre opérationnel · ${filtered.length} résultat${filtered.length !== 1 ? "s" : ""}`}
          breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Commandes" }]}
          actions={
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Actualiser
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Nouvelle <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                    <Wifi className="w-4 h-4 mr-2" /> Commande service
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEquipmentDialogOpen(true)}>
                    <ShoppingCart className="w-4 h-4 mr-2" /> Commande équipement
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        {/* Filters — flat, no card wrapper */}
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par #, client, compte, service…"
          resultCount={filtered.length}
          resultLabel="commande"
        >
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[170px] h-9 text-xs">
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="Paiement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les paiements</SelectItem>
              {paymentOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>

        {/* DataTable — full width, NO card wrapper */}
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(o: any) => o.id}
          isLoading={isLoading}
          emptyMessage="Aucune commande trouvée"
          emptyIcon={<Package className="w-10 h-10 text-muted-foreground" />}
          pageSize={30}
          selectable
          onRowClick={(o: any) => navigate(`/admin/orders/${o.id}`)}
        />

        {/* Dialogs */}
        <ManualOrderWizard open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={() => refetch()} />
        <EquipmentOrderDialog open={equipmentDialogOpen} onOpenChange={setEquipmentDialogOpen} clients={[]} onSuccess={() => refetch()} />
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
