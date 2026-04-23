/**
 * ClientPaymentMethod — Dedicated page for managing the PayPal pre-authorized payment.
 *
 * Sections:
 * 1) Current status (active / inactive) with full details + cancel action
 * 2) Step-by-step activation explainer (only when not active)
 * 3) "How it works" info cards
 * 4) Last 6 invoices with payment method used
 *
 * Activation/cancellation logic is delegated to the existing ClientPaymentMethodCard
 * (which already wraps useClientAutoPayEnrollment + paypal-cancel-subscription).
 * This page adds rich context and a billing-history view around it.
 */
import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { ClientPaymentMethodCard } from "@/components/client/ClientPaymentMethodCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ShieldCheck, Wallet, Repeat, Lock, XCircle, Sparkles, FileText, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useClientAuth } from "@/hooks/useClientAuth";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ClientPaymentMethod = () => {
  const { user } = useClientAuth();

  // PayPal subscription status (mirrors logic of ClientPaymentMethodCard for the hero block)
  const { data: paypalSub, isLoading: subLoading } = useQuery({
    queryKey: ["client-paypal-preauth-page", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!customer) return null;
      const { data } = await portalSupabase
        .from("billing_subscriptions")
        .select("id, plan_name, plan_price, status, paypal_subscription_id, created_at")
        .eq("customer_id", customer.id)
        .eq("status", "active")
        .not("paypal_subscription_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  // Last 6 invoices + payment method used (joined via billing_payments)
  const { data: recentInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["client-payment-method-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: customer } = await portalSupabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!customer) return [];
      const { data: invoices } = await portalSupabase
        .from("billing_invoices")
        .select("id, invoice_number, total, status, created_at, due_date")
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(6);
      if (!invoices || invoices.length === 0) return [];
      const invoiceIds = invoices.map((inv) => inv.id);
      const { data: payments } = await portalSupabase
        .from("billing_payments")
        .select("invoice_id, method, source, provider, status")
        .in("invoice_id", invoiceIds);
      const byInvoice = new Map<string, any>();
      for (const p of payments ?? []) {
        // Keep the most recent successful capture (or any if none successful)
        if (!byInvoice.has(p.invoice_id) || p.status === "succeeded" || p.status === "captured") {
          byInvoice.set(p.invoice_id, p);
        }
      }
      return invoices.map((inv) => ({
        ...inv,
        payment: byInvoice.get(inv.id) ?? null,
      }));
    },
  });

  const isActive = !!paypalSub;
  const subRefShort = paypalSub?.paypal_subscription_id
    ? String(paypalSub.paypal_subscription_id).slice(-8)
    : null;
  const activatedAt = paypalSub?.created_at ? new Date(paypalSub.created_at) : null;

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Mode de paiement automatique
          </h1>
          <p className="text-muted-foreground mt-1">
            Configurez le paiement pré-autorisé PayPal et économisez 5 $/mois.
          </p>
        </div>

        {/* ─── SECTION 1 — Current status (rich hero) ─── */}
        {subLoading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : isActive ? (
          <Card className="border-2 border-emerald-300 bg-emerald-50/40">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                      Actif
                    </Badge>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      Paiement automatique PayPal actif
                    </h2>
                  </div>
                  <p className="text-sm text-foreground/80">
                    Votre carte est débitée automatiquement à chaque cycle de facturation.
                  </p>
                  <p className="text-sm text-emerald-700 flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-4 h-4" />
                    Rabais de 5,00 $/mois actif sur votre compte
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {subRefShort && (
                      <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Référence PayPal</p>
                        <p className="font-mono text-sm font-semibold">…{subRefShort}</p>
                      </div>
                    )}
                    {activatedAt && (
                      <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Date d'activation</p>
                        <p className="text-sm font-semibold">
                          {format(activatedAt, "d MMMM yyyy", { locale: fr })}
                        </p>
                      </div>
                    )}
                  </div>
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
                    Aucun mode de paiement automatique
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Activez le paiement pré-autorisé et économisez 5 $ chaque mois.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Inline activation/cancellation control (canonical component) ─── */}
        <ClientPaymentMethodCard />

        {/* ─── SECTION 2 — Activation steps (only when not active) ─── */}
        {!isActive && !subLoading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comment activer en 5 étapes</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {[
                  "Cliquez sur Activer ci-dessus.",
                  "Vous serez redirigé vers PayPal pour autoriser le prélèvement automatique.",
                  "Entrez votre carte de crédit ou connectez-vous à PayPal.",
                  "Approuvez l'autorisation.",
                  "Vous revenez sur Nivra — c'est terminé !",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* ─── SECTION 3 — How it works ─── */}
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
                  Vos informations de carte sont gérées directement par PayPal.
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
                  Désactivez à tout moment depuis cette page.
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

        {/* ─── SECTION 4 — Recent invoices with payment method ─── */}
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
            {invoicesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !recentInvoices || recentInvoices.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Aucune facture pour le moment.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentInvoices.map((inv: any) => {
                  const isPaid = inv.status === "paid" || inv.status === "paid_by_promo";
                  const auto =
                    inv.payment?.source === "paypal_subscription" ||
                    inv.payment?.method === "paypal_subscription";
                  const methodLabel = !inv.payment
                    ? "Aucun paiement"
                    : auto
                      ? "Payé automatiquement"
                      : "Payé manuellement";
                  return (
                    <div
                      key={inv.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold text-foreground truncate">
                          {inv.invoice_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })} ·{" "}
                          {Number(inv.total).toLocaleString("fr-CA", {
                            style: "currency",
                            currency: "CAD",
                          })}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        {isPaid ? (
                          <Badge
                            className={
                              auto
                                ? "bg-emerald-600 text-white hover:bg-emerald-600"
                                : "bg-emerald-100 text-emerald-700"
                            }
                          >
                            {methodLabel}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            En attente
                          </Badge>
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
          Paiement sécurisé via PayPal — Nivra ne stocke jamais vos informations de carte
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientPaymentMethod;
