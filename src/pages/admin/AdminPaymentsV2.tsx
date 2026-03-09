/**
 * AdminPayments v2 — Billing payments list (carrier-grade)
 * payment_number is the PRIMARY identifier.
 * All amounts from DB. No local math.
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
import { CreditCard, RefreshCw, Filter, Banknote, Wallet, DollarSign } from "lucide-react";
import { useAdminPayments, AdminPayment } from "@/hooks/admin/useAdminPayments";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  failed: "Échoué",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  interac: "Interac",
  paypal: "PayPal",
  manual: "Manuel",
};

const METHOD_ICONS: Record<string, React.ReactNode> = {
  interac: <Banknote className="w-3.5 h-3.5" />,
  paypal: <Wallet className="w-3.5 h-3.5" />,
  manual: <DollarSign className="w-3.5 h-3.5" />,
};

const statusOptions = Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label }));

const formatCAD = (n: number | null) =>
  n != null ? `${n.toFixed(2)} $` : "—";

const AdminPaymentsV2 = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  const { data: payments = [], isLoading, refetch } = useAdminPayments();

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        p.payment_number?.toLowerCase().includes(q) ||
        p.invoice_number?.toLowerCase().includes(q) ||
        p.customer_name?.toLowerCase().includes(q) ||
        p.customer_email?.toLowerCase().includes(q) ||
        p.account_number?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const matchesMethod = methodFilter === "all" || p.method === methodFilter;
      return matchesSearch && matchesStatus && matchesMethod;
    });
  }, [payments, searchTerm, statusFilter, methodFilter]);

  const columns: Column<AdminPayment>[] = useMemo(() => [
    {
      key: "payment_number",
      label: "N° Paiement",
      render: (p) => (
        <span className="font-mono font-medium text-foreground">{p.payment_number}</span>
      ),
    },
    {
      key: "account_number",
      label: "Compte",
      render: (p) => (
        <span className="font-mono text-muted-foreground text-xs">{p.account_number || "—"}</span>
      ),
    },
    {
      key: "customer_name",
      label: "Client",
      sortable: false,
      render: (p) => (
        <div>
          <p className="font-medium text-foreground text-sm truncate max-w-[160px]">{p.customer_name || "—"}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{p.customer_email || ""}</p>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Montant",
      render: (p) => <span className="tabular-nums text-sm font-medium">{formatCAD(p.amount)}</span>,
    },
    {
      key: "method",
      label: "Méthode",
      render: (p) => (
        <div className="flex items-center gap-1.5 text-sm">
          {METHOD_ICONS[p.method] || <CreditCard className="w-3.5 h-3.5" />}
          <span>{PAYMENT_METHOD_LABELS[p.method] || p.method}</span>
        </div>
      ),
    },
    {
      key: "invoice_number",
      label: "Facture",
      render: (p) => (
        p.invoice_number ? (
          <Link to={`/admin/invoices`} className="font-mono text-xs text-primary hover:underline">
            {p.invoice_number}
          </Link>
        ) : <span className="text-xs text-muted-foreground">—</span>
      ),
    },
    {
      key: "reference",
      label: "Référence",
      render: (p) => (
        <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px] block">
          {p.reference || "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Statut",
      render: (p) => (
        <StatusBadge
          label={PAYMENT_STATUS_LABELS[p.status ?? ""] || p.status || "—"}
          variant={statusToVariant(p.status ?? "")}
          size="sm"
        />
      ),
    },
    {
      key: "created_at",
      label: "Reçu le",
      render: (p) => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {p.received_at || p.created_at
            ? format(new Date(p.received_at || p.created_at!), "d MMM yyyy", { locale: fr })
            : "—"}
        </span>
      ),
    },
  ], []);

  return (
    <AdminLayout>
      <div className="space-y-3">
        <PageHeader
          title="Paiements"
          subtitle={`Facturation V2 · ${filtered.length} résultat${filtered.length !== 1 ? "s" : ""}`}
          breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Paiements" }]}
          actions={
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Actualiser
            </Button>
          }
        />

        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par n° paiement, facture, client, compte, référence…"
          resultCount={filtered.length}
          resultLabel="paiement"
        >
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
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
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="Méthode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les méthodes</SelectItem>
              {methodOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(p) => p.id}
          isLoading={isLoading}
          emptyMessage="Aucun paiement trouvé"
          emptyIcon={<CreditCard className="w-10 h-10 text-muted-foreground" />}
          pageSize={30}
          selectable
        />
      </div>
    </AdminLayout>
  );
};

export default AdminPaymentsV2;
