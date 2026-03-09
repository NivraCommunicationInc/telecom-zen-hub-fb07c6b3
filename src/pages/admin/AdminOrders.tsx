/**
 * AdminOrders v2 — Carrier-grade orders list
 * Joins: profiles (client), billing_invoices (invoice_number, invoice_status)
 * All amounts from DB. No local math.
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
  Filter, AlertTriangle,
} from "lucide-react";
import ManualOrderWizard from "@/components/admin/ManualOrderWizard";
import EquipmentOrderDialog from "@/components/admin/EquipmentOrderDialog";
import { useAdminOrders, AdminOrder } from "@/hooks/admin/useAdminOrders";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ORDER_STATUS_LABELS: Record<string, string> = {
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
  provisioning_failed: "Échec provisionnement",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  pre_authorized: "Pré-autorisé",
  authorized: "Autorisé",
  captured: "Capturé",
  confirmed: "Confirmé",
  paid: "Payé",
  refunded: "Remboursé",
  failed: "Échoué",
};

const statusOptions = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

const formatCAD = (n: number | null) =>
  n != null ? `${n.toFixed(2)} $` : "—";

const AdminOrders = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);

  const { data: orders = [], isLoading, refetch } = useAdminOrders();

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        o.order_number?.toLowerCase().includes(q) ||
        o.client_full_name?.toLowerCase().includes(q) ||
        o.client_email?.toLowerCase().includes(q) ||
        o.account_number?.toLowerCase().includes(q) ||
        o.invoice_number?.toLowerCase().includes(q) ||
        o.service_type?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const columns: Column<AdminOrder>[] = useMemo(() => [
    {
      key: "order_number",
      label: "Commande",
      render: (o) => (
        <div className="flex items-center gap-2">
          <Link to={`/admin/orders/${o.id}`} className="font-mono font-medium text-foreground hover:text-primary transition-colors">
            {o.order_number || `#${o.id.slice(0, 8)}`}
          </Link>
          {o.order_type === "equipment" && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Équip.</Badge>
          )}
          {(o.risk_flags?.length ?? 0) > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
        </div>
      ),
    },
    {
      key: "account_number",
      label: "Compte",
      render: (o) => (
        <span className="font-mono text-muted-foreground text-xs">{o.account_number || "—"}</span>
      ),
    },
    {
      key: "client_full_name",
      label: "Client",
      sortable: false,
      render: (o) => (
        <div>
          <p className="font-medium text-foreground text-sm truncate max-w-[180px]">{o.client_full_name || "—"}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{o.client_email || ""}</p>
        </div>
      ),
    },
    {
      key: "service_type",
      label: "Service",
      render: (o) => <span className="text-sm">{o.service_type || "—"}</span>,
    },
    {
      key: "total_amount",
      label: "Total",
      render: (o) => <span className="tabular-nums text-sm">{formatCAD(o.total_amount)}</span>,
    },
    {
      key: "invoice_number",
      label: "Facture",
      render: (o) => (
        o.invoice_number ? (
          <Link to={`/admin/invoices`} className="font-mono text-xs text-primary hover:underline">
            {o.invoice_number}
          </Link>
        ) : <span className="text-xs text-muted-foreground">—</span>
      ),
    },
    {
      key: "status",
      label: "Statut",
      render: (o) => (
        <StatusBadge label={ORDER_STATUS_LABELS[o.status] || o.status} variant={statusToVariant(o.status)} size="sm" />
      ),
    },
    {
      key: "payment_status",
      label: "Paiement",
      render: (o) => (
        <StatusBadge
          label={PAYMENT_STATUS_LABELS[o.payment_status ?? ""] || o.payment_status || "—"}
          variant={statusToVariant(o.payment_status ?? "")}
          size="sm"
        />
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (o) => (
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
      render: (o) => (
        <Link to={`/admin/orders/${o.id}`}>
          <Button size="sm" className="gap-1.5 h-7 text-xs">
            <Wrench className="w-3 h-3" /> Détails
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

        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par #, client, compte, facture, service…"
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
        </FilterBar>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(o) => o.id}
          isLoading={isLoading}
          emptyMessage="Aucune commande trouvée"
          emptyIcon={<Package className="w-10 h-10 text-muted-foreground" />}
          pageSize={30}
          selectable
          onRowClick={(o) => navigate(`/admin/orders/${o.id}`)}
        />

        <ManualOrderWizard open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={() => refetch()} />
        <EquipmentOrderDialog open={equipmentDialogOpen} onOpenChange={setEquipmentDialogOpen} clients={[]} onSuccess={() => refetch()} />
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
