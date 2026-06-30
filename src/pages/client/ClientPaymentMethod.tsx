import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { SquareCardForm } from "@/components/client/SquareCardForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ShieldCheck, Wallet, Repeat, Lock, XCircle, Sparkles, FileText, ExternalLink, CreditCard, Trash2 } from "lucide-react";
import { useClientAuth } from "@/hooks/useClientAuth";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { portalClient } from "@/integrations/backend/portalClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ClientPaymentMethod = () => {
  const { user } = useClientAuth();
  const qc = useQueryClient();
  const { data: canonicalData, isLoading } = useCanonicalClientData(user?.id);

  const billingCustomer = canonicalData?.billingCustomer as any;
  const customerId = billingCustomer?.id ?? null;
  const squareCardId = billingCustomer?.square_card_id ?? null;

  const [savedCard, setSavedCard] = useState<{ brand: string; last4: string } | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const hasCard = !!squareCardId || !!savedCard;

  const paymentsByInvoice = new Map(
    (canonicalData?.payments || []).filter((p: any) => p.invoice_id).map((p: any) => [p.invoice_id, p])
  );
  const recentInvoices = (canonicalData?.invoices || []).slice(0, 6).map((inv: any) => ({
    ...inv,
    payment: paymentsByInvoice.get(inv.id) || null,
  }));

  const handleCardSaved = (brand: string, last4: string) => {
    setSavedCard({ brand, last4 });
    qc.invalidateQueries({ queryKey: ["canonical-client", user?.id] });
  };

  const handleRemoveCard = async () => {
    if (!customerId) return;
    setRemoving(true);
    try {
      const { error } = await portalClient
        .from("billing_customers")
        .update({ square_card_id: null })
        .eq("id", customerId);
      if (error) throw error;
      setSavedCard(null);
      toast.success("Carte retirée.");
      qc.invalidateQueries({ queryKey: ["canonical-client", user?.id] });
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setRemoving(false);
      setRemoveOpen(false);
    }
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Mode de paiement automatique
          </h1>
          <p className="text-muted-foreground mt-1">
            Enregistrez votre carte de crédit pour les renouvellements automatiques et économisez 5 $/mois.
          </p>
        </div>

        {/* Status hero */}
        {isLoading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : hasCard ? (
          <Card className="border-2 border-emerald-300 bg-emerald-50/40">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Actif</Badge>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      Carte de crédit enregistrée
                    </h2>
                  </div>
                  {savedCard ? (
                    <p className="text-sm text-foreground/80">
                      {savedCard.brand} se terminant par <strong>****{savedCard.last4}</strong>
                    </p>
                  ) : (
                    <p className="text-sm text-foreground/80">
                      Votre carte est enregistrée et sera débitée automatiquement à chaque renouvellement.
                    </p>
                  )}
                  <p className="text-sm text-emerald-700 flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-4 h-4" />
                    Rabais de 5,00 $/mois actif sur votre compte
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => setRemoveOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Retirer ma carte
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-border bg-muted/30">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                  <Wallet className="w-9 h-9 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    Aucune carte enregistrée
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Ajoutez votre carte ci-dessous pour activer les paiements automatiques et économiser 5 $ chaque mois.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Square card form (only if no card) */}
        {!isLoading && !hasCard && customerId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Enregistrer une carte de crédit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SquareCardForm customerId={customerId} onSaved={handleCardSaved} />
            </CardContent>
          </Card>
        )}

        {/* How it works */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Comment ça fonctionne</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Montant variable</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Le montant prélevé correspond exactement à votre facture mensuelle.
                  Si vous changez de forfait, le montant s'ajuste automatiquement.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Paiement sécurisé</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Vos informations de carte sont gérées directement par Square.
                  Nivra ne stocke jamais vos données de carte.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Annulation facile</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Retirez votre carte à tout moment depuis cette page.
                  Le rabais de 5 $ sera retiré au prochain cycle.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-foreground">Rabais 5 $/mois</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Le rabais est appliqué automatiquement sur chaque facture
                  tant que le paiement automatique est actif.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Historique récent (6 dernières factures)</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/portal/invoices">
                Voir tout <ExternalLink className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !recentInvoices.length ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Aucune facture pour le moment.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentInvoices.map((inv: any) => {
                  const isPaid = inv.status === "paid" || inv.status === "paid_by_promo";
                  const auto =
                    inv.payment?.provider === "square" ||
                    inv.payment?.source === "paypal_subscription" ||
                    inv.payment?.method === "paypal_subscription";
                  const methodLabel = !inv.payment
                    ? "Aucun paiement"
                    : auto
                      ? "Payé automatiquement"
                      : "Payé manuellement";
                  return (
                    <div key={inv.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold text-foreground truncate">
                          {inv.invoice_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })} ·{" "}
                          {Number(inv.total).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      </div>
                      <div className="text-right">
                        {isPaid ? (
                          <Badge className={auto ? "bg-emerald-600 text-white hover:bg-emerald-600" : "bg-emerald-100 text-emerald-700"}>
                            {methodLabel}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">En attente</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trust footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3 h-3" />
          Paiement sécurisé via Square — Nivra ne stocke jamais vos informations de carte
        </div>
      </div>

      {/* Remove card confirm dialog */}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer la carte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Votre carte sera supprimée de votre compte. Les prochains renouvellements devront être payés manuellement. Le rabais de 5 $/mois sera retiré.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveCard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClientLayout>
  );
};

export default ClientPaymentMethod;
