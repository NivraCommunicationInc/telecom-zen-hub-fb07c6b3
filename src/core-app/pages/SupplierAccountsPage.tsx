/**
 * SupplierAccountsPage — Admin-only registry for "Comptes Fournisseur".
 * Visible only to users with the 'admin' role (also enforced server-side via RLS + RPCs).
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Lock, ShieldOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { corePath } from "@/core-app/lib/corePaths";
import { useSupplierAccounts, STATUS_LABEL, type SupplierAccountStatus } from "@/core-app/hooks/useSupplierAccounts";
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const SupplierAccountsPage = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: loadingRole } = useIsCoreAdmin();
  const { data: accounts = [], isLoading } = useSupplierAccounts();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SupplierAccountStatus>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      const name = `${a.first_name} ${a.last_name}`.toLowerCase();
      const clientName = (a.client?.full_name ?? "").toLowerCase();
      const clientEmail = (a.client?.email ?? "").toLowerCase();
      const email = a.account_email.toLowerCase();
      return (
        name.includes(q) ||
        clientName.includes(q) ||
        clientEmail.includes(q) ||
        email.includes(q) ||
        a.service_name.toLowerCase().includes(q)
      );
    });
  }, [accounts, search, statusFilter]);

  if (loadingRole) {
    return <div className="text-sm text-muted-foreground p-6">Vérification…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 rounded-lg border border-border bg-card p-6 text-center">
        <ShieldOff className="h-8 w-8 mx-auto text-destructive mb-3" />
        <h2 className="text-base font-semibold text-foreground">Accès refusé</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cette section est réservée aux administrateurs Nivra Core.
        </p>
      </div>
    );
  }

  const statusVariant = (s: SupplierAccountStatus) =>
    s === "active" ? "default" : s === "suspended" ? "secondary" : "destructive";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Comptes Fournisseur
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registre privé — réservé aux administrateurs. Invisible aux clients, agents et employés.
          </p>
        </div>
        <Button onClick={() => navigate(corePath("/supplier-accounts/new"))} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouveau compte
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher (client, courriel, service…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="suspended">Suspendu</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} {filtered.length > 1 ? "comptes" : "compte"}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Nivra</TableHead>
              <TableHead>Nom complet</TableHead>
              <TableHead>Service</TableHead>
              <TableHead className="text-right">Prix/mois</TableHead>
              <TableHead>Date activation</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Chargement…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Aucun compte fournisseur
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => navigate(corePath(`/supplier-accounts/${a.id}`))}
                >
                  <TableCell className="text-sm">
                    {a.client?.full_name ?? "—"}
                    {a.client?.client_number && (
                      <span className="block text-[11px] text-muted-foreground">
                        #{a.client.client_number}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {a.first_name} {a.last_name}
                  </TableCell>
                  <TableCell className="text-sm">{a.service_name}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {a.monthly_price.toFixed(2)} $
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(a.activation_date), "d MMM yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(a.status)}>{STATUS_LABEL[a.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SupplierAccountsPage;
