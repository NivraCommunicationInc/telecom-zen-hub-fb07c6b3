import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Package } from "lucide-react";

interface POSOrderSummaryProps {
  services: any[];
  equipment: any[];
  adjustments: any[];
  totals: any;
  customerData: any;
  paymentData: any;
}

export function POSOrderSummary({ services, equipment, adjustments, totals, customerData, paymentData }: POSOrderSummaryProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader><CardTitle className="text-white flex items-center gap-2"><Package className="h-5 w-5" />Résumé de la commande</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Client</h4>
          <p className="text-white">{customerData?.full_name}</p>
          <p className="text-slate-400 text-sm">{customerData?.email}</p>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-300">Services ({services.length})</h4>
          {services.map((s, i) => <div key={i} className="flex justify-between text-sm"><span className="text-white">{s.name}</span><span className="text-slate-400">{s.priceMonthly?.toFixed(2)} $/mois</span></div>)}
        </div>
        {equipment.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-300">Équipements ({equipment.length})</h4>
            {equipment.map((e, i) => <div key={i} className="flex justify-between text-sm"><span className="text-white">{e.name}</span><span className="text-slate-400">{e.price?.toFixed(2)} $</span></div>)}
          </div>
        )}
        <div className="pt-4 border-t border-slate-700">
          <div className="flex justify-between text-lg font-bold"><span className="text-white">Total 1er mois</span><span className="text-orange-400">{totals?.firstMonthTotal?.toFixed(2) || totals?.first_month_total?.toFixed(2)} $</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
