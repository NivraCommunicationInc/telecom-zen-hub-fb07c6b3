/**
 * POSOrderSummary - Detailed order summary for checkout confirmation
 */
import { SelectedService, calculateFieldSalesTotals } from "@/hooks/useFieldSalesOffers";
import { CustomerData } from "./POSCustomerForm";
import { PaymentData } from "./POSPaymentForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Receipt, User, MapPin, Phone, Mail, CreditCard, 
  Wifi, Tv, Smartphone, Package, FileText, Check
} from "lucide-react";

interface POSOrderSummaryProps {
  services: SelectedService[];
  customer: CustomerData;
  payment: PaymentData;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "internet": return Wifi;
    case "tv": return Tv;
    case "mobile": return Smartphone;
    default: return Package;
  }
};

const getPaymentLabel = (method: string) => {
  switch (method) {
    case "interac": return "Interac";
    case "paypal": return "PayPal";
    case "deferred": return "Paiement différé";
    default: return method;
  }
};

export function POSOrderSummary({ services, customer, payment }: POSOrderSummaryProps) {
  const totals = calculateFieldSalesTotals(services);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-emerald-500/30 bg-emerald-500/10 backdrop-blur-xl">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-emerald-500/20">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Commande prête</h2>
              <p className="text-emerald-300 text-sm">Vérifiez les détails avant de finaliser</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-400" />
            Services sélectionnés ({services.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {services.map((service) => {
            const Icon = getCategoryIcon(service.category);
            return (
              <div key={service.offerId} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="text-white text-sm truncate">{service.name}</span>
                  {service.quantity > 1 && (
                    <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
                      x{service.quantity}
                    </Badge>
                  )}
                </div>
                <span className="text-orange-400 font-medium text-sm shrink-0">
                  {(service.priceMonthly * service.quantity).toFixed(2)}$/mois
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Customer Info */}
      <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-cyan-400" />
            Client
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-300">
            <User className="h-3.5 w-3.5 text-slate-500" />
            {customer.full_name}
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Mail className="h-3.5 w-3.5 text-slate-500" />
            {customer.email}
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Phone className="h-3.5 w-3.5 text-slate-500" />
            {customer.phone}
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin className="h-3.5 w-3.5 text-slate-500" />
            {customer.service_address}, {customer.service_city} {customer.service_postal_code}
          </div>
        </CardContent>
      </Card>

      {/* Payment & Totals */}
      <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            Facturation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Mode de paiement</span>
            <Badge className="bg-slate-700 text-white">
              {getPaymentLabel(payment.payment_method)}
            </Badge>
          </div>
          
          <Separator className="bg-slate-700/50" />
          
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Mensuel</span>
              <span>{totals.monthlySubtotal.toFixed(2)}$</span>
            </div>
            {totals.activationFee > 0 && (
              <div className="flex justify-between text-slate-300">
                <span>Frais d'activation {services.length > 1 ? "(forfait)" : ""}</span>
                <span>{totals.activationFee.toFixed(2)}$</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500 text-xs">
              <span>TPS (5%)</span>
              <span>{totals.tps.toFixed(2)}$</span>
            </div>
            <div className="flex justify-between text-slate-500 text-xs">
              <span>TVQ (9.975%)</span>
              <span>{totals.tvq.toFixed(2)}$</span>
            </div>
          </div>

          <Separator className="bg-slate-700/50" />

          <div className="flex justify-between items-baseline">
            <div>
              <p className="text-xs text-slate-400">1ère facture</p>
              <p className="text-2xl font-bold text-white">{totals.firstMonthTotal.toFixed(2)}$</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Récurrent/mois</p>
              <p className="text-lg font-semibold text-orange-400">{totals.recurringMonthly.toFixed(2)}$</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="flex items-center gap-2 text-xs text-slate-500 justify-center">
        <FileText className="h-3.5 w-3.5" />
        <span>Le contrat et la facture seront générés automatiquement</span>
      </div>
    </div>
  );
}
