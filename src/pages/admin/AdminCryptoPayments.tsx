import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Search, ExternalLink, CheckCircle, Clock, XCircle, RefreshCw, Bitcoin } from "lucide-react";
import { useCryptoPayments, useReconcileCryptoPayment, CryptoPayment } from "@/hooks/useCryptoPayments";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  created: { label: "Créé", color: "bg-gray-500", icon: Clock },
  waiting: { label: "En attente", color: "bg-yellow-500", icon: Clock },
  confirming: { label: "Confirmation", color: "bg-blue-500", icon: RefreshCw },
  confirmed: { label: "Confirmé", color: "bg-green-500", icon: CheckCircle },
  sending: { label: "Envoi", color: "bg-blue-500", icon: RefreshCw },
  partially_paid: { label: "Partiel", color: "bg-orange-500", icon: Clock },
  finished: { label: "Terminé", color: "bg-green-600", icon: CheckCircle },
  failed: { label: "Échoué", color: "bg-red-500", icon: XCircle },
  refunded: { label: "Remboursé", color: "bg-purple-500", icon: RefreshCw },
  expired: { label: "Expiré", color: "bg-gray-400", icon: XCircle },
};

const CURRENCY_ICONS: Record<string, string> = {
  btc: "₿",
  eth: "Ξ",
  xrp: "✕",
  sol: "◎",
  usdt: "₮",
  usdc: "$",
  ltc: "Ł",
};

export default function AdminCryptoPayments() {
  const { data: payments, isLoading, refetch } = useCryptoPayments();
  const reconcileMutation = useReconcileCryptoPayment();
  
  const [search, setSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<CryptoPayment | null>(null);
  const [reconcileNotes, setReconcileNotes] = useState("");
  const [showReconcileDialog, setShowReconcileDialog] = useState(false);

  const filteredPayments = payments?.filter(p => 
    p.payment_id?.toLowerCase().includes(search.toLowerCase()) ||
    p.client_id?.toLowerCase().includes(search.toLowerCase()) ||
    p.pay_currency?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleReconcile = () => {
    if (!selectedPayment) return;
    
    reconcileMutation.mutate({
      paymentId: selectedPayment.id,
      notes: reconcileNotes,
    }, {
      onSuccess: () => {
        setShowReconcileDialog(false);
        setSelectedPayment(null);
        setReconcileNotes("");
      },
    });
  };

  const openInvoice = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bitcoin className="h-8 w-8" />
              Paiements Crypto
            </h1>
            <p className="text-muted-foreground">Liste de tous les paiements crypto</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par ID, client ou devise..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucun paiement crypto trouvé
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Montant CAD</TableHead>
                      <TableHead>Crypto</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Reçu</TableHead>
                      <TableHead>Réconcilié</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => {
                      const statusConfig = STATUS_CONFIG[payment.payment_status] || STATUS_CONFIG.created;
                      const StatusIcon = statusConfig.icon;
                      const currencyIcon = CURRENCY_ICONS[payment.pay_currency?.toLowerCase()] || "";

                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(payment.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {payment.payment_id?.slice(0, 12)}...
                            </code>
                          </TableCell>
                          <TableCell className="font-medium">
                            {payment.price_amount?.toFixed(2)} $
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span className="text-lg">{currencyIcon}</span>
                              <span className="uppercase font-medium">{payment.pay_currency}</span>
                              {payment.pay_amount && (
                                <span className="text-muted-foreground text-sm ml-1">
                                  ({payment.pay_amount})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`${statusConfig.color} text-white border-0`}
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {payment.actually_paid ? (
                              <span className="text-green-600 font-medium">
                                {payment.actually_paid} {payment.pay_currency?.toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {payment.reconciled_at ? (
                              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Oui
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">Non</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {payment.invoice_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openInvoice(payment.invoice_url!)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              {!payment.reconciled_at && ["finished", "confirmed"].includes(payment.payment_status) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setShowReconcileDialog(true);
                                  }}
                                >
                                  Réconcilier
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total paiements</CardDescription>
              <CardTitle className="text-2xl">{payments?.length || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>En attente</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">
                {payments?.filter(p => ["waiting", "confirming"].includes(p.payment_status)).length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Terminés</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {payments?.filter(p => ["finished", "confirmed"].includes(p.payment_status)).length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>À réconcilier</CardDescription>
              <CardTitle className="text-2xl text-blue-600">
                {payments?.filter(p => 
                  ["finished", "confirmed"].includes(p.payment_status) && !p.reconciled_at
                ).length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Reconcile Dialog */}
      <Dialog open={showReconcileDialog} onOpenChange={setShowReconcileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réconcilier le paiement</DialogTitle>
            <DialogDescription>
              Marquer ce paiement comme réconcilié dans votre comptabilité
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Montant CAD</p>
                  <p className="font-medium">{selectedPayment.price_amount?.toFixed(2)} $</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Crypto reçu</p>
                  <p className="font-medium">
                    {selectedPayment.actually_paid || selectedPayment.pay_amount} {selectedPayment.pay_currency?.toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment ID</p>
                  <code className="text-xs">{selectedPayment.payment_id}</code>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">TXID</p>
                  <code className="text-xs">{selectedPayment.txid || "N/A"}</code>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea
                  id="notes"
                  placeholder="Notes de réconciliation..."
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReconcileDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleReconcile} disabled={reconcileMutation.isPending}>
              {reconcileMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
