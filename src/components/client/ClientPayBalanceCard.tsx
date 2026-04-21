/**
 * ClientPayBalanceCard
 * Displays the customer's TOTAL unpaid balance and a single PayPal button
 * that pays everything at once. After capture, all unpaid invoices are
 * marked paid FIFO via apply_balance_payment RPC.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useClientAuth } from "@/hooks/useClientAuth";
import { CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const ClientPayBalanceCard = () => {
  const { user } = useClientAuth();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-balance-summary", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!customer) return { totalBalance: 0, invoiceCount: 0 };

      // Compute account balance using SAME formula as ledger:
      // balance = sum(non-cancelled invoice totals) - sum(confirmed payments)
      const { data: invoices } = await supabase
        .from("billing_invoices")
        .select("total, balance_due, status")
        .eq("customer_id", customer.id)
        .not("status", "in", '("cancelled","refunded","void")');

      const { data: payments } = await supabase
        .from("billing_payments")
        .select("amount")
        .eq("customer_id", customer.id)
        .eq("status", "confirmed");

      const debits = (invoices || []).reduce((s, i: any) => s + (Number(i.total) || 0), 0);
      const credits = (payments || []).reduce((s, p: any) => s + (Number(p.amount) || 0), 0);
      const total = Math.round((debits - credits) * 100) / 100;

      const CLOSED = ["paid", "paid_by_promo", "void", "cancelled", "refunded"];
      const unpaidCount = (invoices || []).filter(
        (i: any) => !CLOSED.includes(i.status) && (Number(i.balance_due) || 0) > 0
      ).length;

      return { totalBalance: total, invoiceCount: unpaidCount };
    },
  });

  // Handle return from PayPal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const captured = sessionStorage.getItem("balance_pay_captured");
    if (token && !captured && window.location.pathname.includes("balance-payment-success")) {
      sessionStorage.setItem("balance_pay_captured", "1");
      capturePayment(token);
    }
  }, []);

  const capturePayment = async (paypalOrderId: string) => {
    setPaying(true);
    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke(
        "paypal-balance-pay-capture",
        { body: { paypal_order_id: paypalOrderId } }
      );
      if (invokeErr || result?.error) throw new Error(result?.error || invokeErr?.message);
      toast.success(`Paiement de ${result.captured_amount}$ appliqué à ${result.apply_result?.invoices_paid_count || 0} facture(s)`);
      sessionStorage.removeItem("balance_pay_captured");
      window.history.replaceState({}, "", "/portal/billing");
      await refetch();
    } catch (e: any) {
      setError(e.message || "Erreur lors du paiement");
      toast.error(e.message || "Erreur lors du paiement");
    } finally {
      setPaying(false);
    }
  };

  const handlePayBalance = async () => {
    setError(null);
    setPaying(true);
    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke(
        "paypal-balance-pay-create"
      );
      if (invokeErr || result?.error) throw new Error(result?.error || invokeErr?.message);

      const approveLink = result.links?.find((l: any) => l.rel === "approve")?.href;
      if (!approveLink) throw new Error("Lien PayPal introuvable");
      window.location.href = approveLink;
    } catch (e: any) {
      setError(e.message || "Erreur PayPal");
      toast.error(e.message || "Erreur PayPal");
      setPaying(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!data || data.totalBalance <= 0) {
    return null;
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning" />
          Solde total à payer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-3">
          <p className="text-sm text-muted-foreground mb-1">
            {data.invoiceCount} facture{data.invoiceCount > 1 ? "s" : ""} impayée{data.invoiceCount > 1 ? "s" : ""}
          </p>
          <p className="text-3xl font-bold text-warning">
            {data.totalBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handlePayBalance}
          disabled={paying}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          size="lg"
        >
          {paying ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirection vers PayPal…</>
          ) : (
            <><CreditCard className="w-4 h-4 mr-2" /> Payer toute la balance avec PayPal</>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Un seul paiement règle automatiquement toutes vos factures impayées (de la plus ancienne à la plus récente).
        </p>
      </CardContent>
    </Card>
  );
};

export default ClientPayBalanceCard;
