/**
 * AccountBillingTab — Financial overview, invoices, payments
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, FileText, Receipt, Calendar, DollarSign, Download } from "lucide-react";
import { format, addMonths, setDate } from "date-fns";
import { fr } from "date-fns/locale";

interface AccountBillingTabProps {
  account: any;
  invoices: any[];
  payments: any[];
  subscriptions: any[];
  legacyBilling: any[];
}

const invoiceStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Payée", variant: "default" },
  pending: { label: "En attente", variant: "outline" },
  overdue: { label: "En retard", variant: "destructive" },
  voided: { label: "Annulée", variant: "secondary" },
  partially_paid: { label: "Part. payée", variant: "secondary" },
  draft: { label: "Brouillon", variant: "outline" },
};

export function AccountBillingTab({ account, invoices, payments, subscriptions, legacyBilling }: AccountBillingTabProps) {
  const totalBalance = invoices.reduce((sum: number, inv: any) => sum + (inv.balance_due || 0), 0);
  const monthlyRecurring = subscriptions
    .filter((s: any) => s.status === "active")
    .reduce((sum: number, s: any) => sum + (s.plan_price || 0), 0);

  const cycleDay = account?.billing_cycle_day || 1;
  const today = new Date();
  let cycleStart = setDate(today, cycleDay);
  if (cycleStart > today) cycleStart = addMonths(cycleStart, -1);
  const cycleEnd = new Date(addMonths(cycleStart, 1));
  cycleEnd.setDate(cycleEnd.getDate() - 1);
  const nextInvoice = addMonths(cycleStart, 1);

  return (
    <div className="space-y-4">
      {/* Billing Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <SummaryCard icon={DollarSign} label="Solde actuel" value={`${totalBalance.toFixed(2)} $`} highlight={totalBalance > 0} />
        <SummaryCard icon={Receipt} label="Récurrent mensuel" value={`${monthlyRecurring.toFixed(2)} $`} />
        <SummaryCard icon={Calendar} label="Cycle actuel" value={`${format(cycleStart, "d MMM", { locale: fr })} - ${format(cycleEnd, "d MMM", { locale: fr })}`} />
        <SummaryCard icon={Calendar} label="Prochaine facture" value={format(nextInvoice, "d MMM yyyy", { locale: fr })} />
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Factures ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Paiements ({payments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-3 space-y-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune facture</p>
          ) : (
            invoices.map((inv: any) => {
              const st = invoiceStatusConfig[inv.status] || invoiceStatusConfig.pending;
              return (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-mono font-medium">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.type === "recurring" ? "Récurrente" : "Ponctuelle"}
                        {" • "}
                        {inv.created_at && format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}
                        {inv.due_date && ` • Éch. ${format(new Date(inv.due_date), "d MMM", { locale: fr })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">{inv.total?.toFixed(2)} $</p>
                      {inv.balance_due > 0 && (
                        <p className="text-xs text-destructive">Dû: {inv.balance_due.toFixed(2)} $</p>
                      )}
                    </div>
                    <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-3 space-y-2">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun paiement</p>
          ) : (
            payments.map((pay: any) => (
              <div key={pay.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{pay.amount?.toFixed(2)} $</p>
                    <p className="text-xs text-muted-foreground">
                      {pay.method} {pay.reference && `• Réf: ${pay.reference}`}
                      {" • "}
                      {pay.created_at && format(new Date(pay.created_at), "d MMM yyyy", { locale: fr })}
                    </p>
                  </div>
                </div>
                <Badge variant={pay.status === "confirmed" ? "default" : "outline"} className="text-[10px]">
                  {pay.status === "confirmed" ? "Confirmé" : pay.status || "En attente"}
                </Badge>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-sm font-semibold ${highlight ? "text-destructive" : ""}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
