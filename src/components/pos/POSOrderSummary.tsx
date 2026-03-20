import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { SelectedService } from "@/hooks/useFieldSalesOffers";
import { CustomerData } from "./POSCustomerForm";
import { PaymentData } from "./POSPaymentForm";

interface POSOrderSummaryProps {
  services: SelectedService[];
  customer: CustomerData;
  payment: PaymentData;
}

export function POSOrderSummary({ services, customer, payment }: POSOrderSummaryProps) {
  // ⛔ NO LOCAL FINANCIAL MATH — display cart line items only (non-transactional preview)
  // Actual totals come from server RPC at order submission
  const monthlyTotal = services.reduce((sum, s) => sum + (s.priceMonthly || 0) * s.quantity, 0);
  const setupTotal = services.reduce((sum, s) => sum + (s.priceSetup || 0) * s.quantity, 0);
  // NOTE: These are pre-tax subtotals for cart preview only. Taxes computed server-side.

  const paymentMethodLabels: Record<string, string> = {
    card: "Carte de crédit",
    interac: "Interac e-Transfer",
    deferred: "Paiement différé"
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader><CardTitle className="text-white flex items-center gap-2"><Package className="h-5 w-5" />Résumé de la commande</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Client</h4>
          <p className="text-white">{customer.full_name}</p>
          <p className="text-slate-400 text-sm">{customer.email} • {customer.phone}</p>
          {customer.service_address && <p className="text-slate-400 text-sm">{customer.service_address}, {customer.service_city} {customer.service_postal_code}</p>}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Services ({services.length})</h4>
          {services.map((s, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-white">{s.name} {s.quantity > 1 && `x${s.quantity}`}</span>
              <span className="text-slate-400">{(s.priceMonthly * s.quantity).toFixed(2)} $/mois</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Paiement</h4>
          <p className="text-white">{paymentMethodLabels[payment.payment_method] || payment.payment_method}</p>
          {payment.payment_reference && <p className="text-slate-400 text-sm">Réf: {payment.payment_reference}</p>}
        </div>
        <div className="pt-4 border-t border-slate-700 space-y-2">
          <div className="flex justify-between"><span className="text-slate-300">Mensuel</span><span className="text-white">{monthlyTotal.toFixed(2)} $</span></div>
          {setupTotal > 0 && <div className="flex justify-between"><span className="text-slate-300">Frais activation</span><span className="text-white">{setupTotal.toFixed(2)} $</span></div>}
          <div className="flex justify-between text-lg font-bold"><span className="text-white">Total 1er mois</span><span className="text-orange-400">{(monthlyTotal + setupTotal).toFixed(2)} $</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
