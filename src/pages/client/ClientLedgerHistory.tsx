/**
 * Client Ledger History Page
 * 
 * Displays full ledger history with:
 * - All ledger entries (debits/credits)
 * - Payment allocations to invoices
 * - Outstanding amounts
 * - Credit blocked status
 */

import { useState } from "react";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useLedgerBalance, useLedgerEntries } from "@/hooks/useLedgerBalance";
import { useLedgerAllocations } from "@/hooks/useLedgerAllocations";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Receipt,
  CreditCard,
  ChevronRight,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ClientLedgerHistory = () => {
  const { user } = useClientAuth();
  const { data: balance, isLoading: balanceLoading } = useLedgerBalance(user?.id);
  const { data: entries, isLoading: entriesLoading } = useLedgerEntries(user?.id);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return Math.abs(amount).toLocaleString("fr-CA", {
      style: "currency",
      currency: "CAD",
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const getEntryType = (entry: { amount: number; entry_type: string }) => {
    if (entry.amount > 0) {
      return { label: "Débit", icon: ArrowDownCircle, color: "text-red-500" };
    }
    return { label: "Crédit", icon: ArrowUpCircle, color: "text-green-500" };
  };

  const getStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "paid":
      case "captured":
      case "complete":
        return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">Payé</Badge>;
      case "pending":
        return <Badge variant="secondary">En attente</Badge>;
      case "overdue":
        return <Badge variant="destructive">En retard</Badge>;
      default:
        return status ? <Badge variant="outline">{status}</Badge> : null;
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historique du compte</h1>
          <p className="text-muted-foreground">
            Toutes vos transactions et allocations de paiements
          </p>
        </div>

        {/* Balance Summary */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Résumé du solde</CardTitle>
          </CardHeader>
          <CardContent>
            {balanceLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : balance ? (
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Solde actuel</p>
                  <p className={`text-2xl font-bold ${balance.isCredit ? "text-green-500" : balance.balance > 0 ? "text-red-500" : "text-foreground"}`}>
                    {balance.display}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total facturé</p>
                  <p className="text-lg font-medium">{formatCurrency(balance.totalDebits)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total payé</p>
                  <p className="text-lg font-medium text-green-500">{formatCurrency(balance.totalCredits)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Factures impayées</p>
                  <p className="text-lg font-medium">{balance.outstandingInvoices}</p>
                </div>
              </div>
            ) : null}

            {/* Credit Blocked Warning */}
            {balance?.creditBlocked && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Crédit bloqué</AlertTitle>
                <AlertDescription>
                  Vous avez {balance.outstandingInvoices} facture(s) impayée(s). 
                  Le crédit disponible ({formatCurrency(Math.abs(balance.balance))}) sera libéré après paiement complet.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Ledger Entries Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Historique des transactions</CardTitle>
            <CardDescription>
              Cliquez sur une ligne pour voir les détails d'allocation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {entriesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : entries && entries.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const typeInfo = getEntryType(entry);
                      const TypeIcon = typeInfo.icon;
                      const hasAllocations = entry.amount !== 0;

                      return (
                        <TableRow
                          key={entry.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedEntryId(entry.id)}
                        >
                          <TableCell className="font-medium">
                            {formatDate(entry.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <TypeIcon className={`h-4 w-4 ${typeInfo.color}`} />
                              <span>{typeInfo.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {entry.description || entry.entry_type}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {entry.reference_number || "—"}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${entry.amount > 0 ? "text-red-500" : "text-green-500"}`}>
                            {entry.amount > 0 ? "+" : ""}{formatCurrency(entry.amount)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(entry.payment_status)}
                          </TableCell>
                          <TableCell>
                            {hasAllocations && (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune transaction pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allocation Details Dialog */}
        <AllocationDetailsDialog
          entryId={selectedEntryId}
          open={!!selectedEntryId}
          onClose={() => setSelectedEntryId(null)}
        />
      </div>
    </ClientLayout>
  );
};

/**
 * Dialog showing allocation details for a ledger entry
 */
interface AllocationDetailsDialogProps {
  entryId: string | null;
  open: boolean;
  onClose: () => void;
}

const AllocationDetailsDialog = ({ entryId, open, onClose }: AllocationDetailsDialogProps) => {
  const { data: allocations, isLoading } = useLedgerAllocations(entryId);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("fr-CA", {
      style: "currency",
      currency: "CAD",
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy à HH:mm", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Détail des allocations
          </DialogTitle>
          <DialogDescription>
            Comment ce montant a été réparti entre les factures
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : allocations && allocations.length > 0 ? (
            <div className="rounded-md border divide-y">
              {allocations.map((alloc) => (
                <div key={alloc.allocation_id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {alloc.is_payment ? (
                        <span className="flex items-center gap-1">
                          <ArrowUpCircle className="h-3 w-3 text-green-500" />
                          Paiement
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <ArrowDownCircle className="h-3 w-3 text-red-500" />
                          Facture
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alloc.other_reference_number || alloc.other_description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(alloc.allocated_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-500">
                      {formatCurrency(alloc.amount_allocated)}
                    </p>
                    <p className="text-xs text-muted-foreground">alloué</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune allocation pour cette entrée</p>
              <p className="text-xs mt-1">
                Les paiements sont automatiquement alloués aux factures impayées les plus anciennes
              </p>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientLedgerHistory;
