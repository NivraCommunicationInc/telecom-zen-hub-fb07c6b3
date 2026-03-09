/**
 * AdminInvoices — Billing invoices list (carrier-grade)
 * Reads billing_invoices with customer + order joins.
 * All financial amounts are authoritative DB values.
 */
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { DataTable, Column } from "@/components/admin/ui/DataTable";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { FilterBar } from "@/components/admin/ui/FilterBar";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, RefreshCw, Filter, Eye } from "lucide-react";
import { useAdminInvoices, AdminInvoice } from "@/hooks/admin/useAdminInvoices";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  paid_by_promo: "Payée par promo",
  failed: "Échouée",
  cancelled: "Annulée",
  refunded: "Remboursée",
  overdue: "En retard",
  void: "Annulée",
  not_renewed: "Non renouvelée",
};

const statusOptions = Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label }));

const formatCAD = (n: number | null) =>
  n != null ? `${n.toFixed(2)} $` : "—";

const AdminInvoices = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: invoices = [], isLoading, refetch } = useAdminInvoices();

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.customer_name?.toLowerCase().includes(q) ||
        inv.customer_email?.toLowerCase().includes(q) ||
        inv.account_number?.toLowerCase().includes(q) ||
        inv.order_number?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  const columns: Column<AdminInvoice>[] = useMemo(() => [
    {
      key: "invoice_number",
      label: "Facture",
      render: (inv) => (
        <Link
          to={`/admin/invoices/${inv.id}`}
          className="font-mono font-medium text-foreground hover:text-primary transition-colors"
        >
          {inv.invoice_number}
        </Link>
      ),
    },
    {
      key: "account_number",
      label: "Compte",
      render: (inv) => (
        <span className="font-mono text-muted-foreground text-xs">{inv.account_number || "—"}</span>
      ),
    },
    {
      key: "customer_name",
      label: "Client",
      sortable: false,
      render: (inv) => (
        <div>
          <p className="font-medium text-foreground text-sm truncate max-w-[180px]">{inv.customer_name || "—"}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{inv.customer_email || ""}</p>
        </div>
      ),
    },
    {
      key: "order_number",
      label: "Commande",
      render: (inv) => (
        inv.order_number ? (
          <Link to={`/admin/orders`} className="font-mono text-xs text-primary hover:underline">
            {inv.order_number}
          </Link>
        ) : <span className="text-xs text-muted-foreground">—</span>
      ),
    },
    {
      key: "total",
      label: "Total",
      render: (inv) => <span className="tabular-nums text-sm font-medium">{formatCAD(inv.total)}</span>,
    },
    {
      key: "balance_due",
      label: "Solde dû",
      render: (inv) => (
        <span className={`tabular-nums text-sm ${(inv.balance_due ?? 0) > 0 ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
          {formatCAD(inv.balance_due)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Statut",
      render: (inv) => (
        <StatusBadge
          label={INVOICE_STATUS_LABELS[inv.status ?? ""] || inv.status || "—"}
          variant={statusToVariant(inv.status ?? "")}
          size="sm"
        />
      ),
    },
    {
      key: "due_date",
      label: "Échéance",
      render: (inv) => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {format(new Date(inv.due_date), "d MMM yyyy", { locale: fr })}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "Créée le",
      render: (inv) => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {inv.created_at ? format(new Date(inv.created_at), "d MMM yyyy", { locale: fr }) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      sortable: false,
      className: "w-[90px]",
      render: (inv) => (
        <Link to={`/admin/invoices/${inv.id}`}>
          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
            <Eye className="w-3 h-3" /> Voir
          </Button>
        </Link>
      ),
    },
  ], []);

  return (
    <AdminLayout>
      <div className="space-y-3">
        <PageHeader
          title="Factures"
          subtitle={`Facturation V2 · ${filtered.length} résultat${filtered.length !== 1 ? "s" : ""}`}
          breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Factures" }]}
          actions={
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Actualiser
            </Button>
          }
        />

        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par #facture, client, compte, commande…"
          resultCount={filtered.length}
          resultLabel="facture"
        >
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
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
          keyExtractor={(inv) => inv.id}
          isLoading={isLoading}
          emptyMessage="Aucune facture trouvée"
          emptyIcon={<FileText className="w-10 h-10 text-muted-foreground" />}
          pageSize={30}
          selectable
          onRowClick={(inv) => navigate(`/admin/invoices/${inv.id}`)}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminInvoices;
