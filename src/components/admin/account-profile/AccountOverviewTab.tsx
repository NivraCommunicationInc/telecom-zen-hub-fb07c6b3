/**
 * AccountOverviewTab — Summary dashboard of the customer account
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wifi, Tv, Smartphone, Play, MapPin, CreditCard,
  FileText, Headphones, Shield, Package, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AccountOverviewTabProps {
  account: any;
  profile: any;
  subscriptions: any[];
  locations: any[];
  invoices: any[];
  payments: any[];
  tickets: any[];
  orders: any[];
  authorizedUsers: any[];
}

export function AccountOverviewTab({
  account, profile, subscriptions, locations,
  invoices, payments, tickets, orders, authorizedUsers,
}: AccountOverviewTabProps) {
  const activeServices = subscriptions.filter((s: any) => s.status === "active");
  const totalBalance = invoices.reduce((sum: number, inv: any) => sum + (inv.balance_due || 0), 0);
  const openTickets = tickets.filter((t: any) => !["resolved", "closed"].includes(t.status));
  const lastPayment = payments.length > 0 ? payments[0] : null;

  const servicesByCategory: Record<string, any[]> = {};
  activeServices.forEach((sub: any) => {
    const cat = sub.service_category || "other";
    if (!servicesByCategory[cat]) servicesByCategory[cat] = [];
    servicesByCategory[cat].push(sub);
  });

  const categoryIcons: Record<string, any> = {
    internet: Wifi,
    tv: Tv,
    mobile: Smartphone,
    streaming: Play,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left column - Services summary */}
      <div className="lg:col-span-2 space-y-4">
        {/* Active Services */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Services actifs ({activeServices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun service actif</p>
            ) : (
              <div className="space-y-2">
                {activeServices.map((sub: any) => {
                  const Icon = categoryIcons[sub.service_category] || Package;
                  return (
                    <div key={sub.id} className="flex items-center justify-between p-2.5 rounded-md border">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{sub.plan_name}</p>
                          <p className="text-xs text-muted-foreground">{sub.plan_code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{sub.plan_price?.toFixed(2)} $/mois</p>
                        <Badge variant="default" className="text-[10px]">Actif</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Commandes récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune commande</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-2.5 rounded-md border">
                    <div>
                      <p className="text-sm font-mono">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.service_type} • {order.created_at && format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Open Tickets */}
        {openTickets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Headphones className="h-4 w-4 text-destructive" />
                Tickets ouverts ({openTickets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {openTickets.slice(0, 5).map((ticket: any) => (
                  <div key={ticket.id} className="flex items-center justify-between p-2.5 rounded-md border">
                    <div>
                      <p className="text-sm font-medium">{ticket.ticket_number || ticket.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{ticket.subject || ticket.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{ticket.priority || "Normal"}</Badge>
                      <Badge variant="outline">{ticket.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right column - Account details */}
      <div className="space-y-4">
        {/* Account Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Informations du compte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="Numéro de compte" value={account.account_number} mono />
            <InfoRow label="Nom du compte" value={account.account_name || "Principal"} />
            <InfoRow label="Client" value={profile?.full_name || "—"} />
            <InfoRow label="Courriel" value={profile?.email || "—"} />
            <InfoRow label="Téléphone" value={profile?.phone || "—"} />
            <InfoRow
              label="Client depuis"
              value={account.created_at ? format(new Date(account.created_at), "d MMMM yyyy", { locale: fr }) : "—"}
            />
          </CardContent>
        </Card>

        {/* Billing Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Facturation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow
              label="Solde actuel"
              value={`${totalBalance.toFixed(2)} $`}
              highlight={totalBalance > 0}
            />
            <InfoRow
              label="Cycle de facturation"
              value={account.billing_cycle_day ? `${account.billing_cycle_day} du mois` : "—"}
            />
            <InfoRow
              label="Dernier paiement"
              value={lastPayment ? `${lastPayment.amount?.toFixed(2)} $ (${lastPayment.method})` : "—"}
            />
            <InfoRow label="Factures totales" value={invoices.length.toString()} />
          </CardContent>
        </Card>

        {/* Addresses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Adresses ({locations.length + 1})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {account.primary_service_address && (
              <div className="p-2 rounded-md bg-primary/5 border border-primary/20">
                <Badge className="text-[10px] mb-1">Principal</Badge>
                <p className="text-xs">
                  {account.primary_service_address}, {account.primary_service_city} {account.primary_service_postal_code}
                </p>
              </div>
            )}
            {locations.map((loc: any) => (
              <div key={loc.id} className="p-2 rounded-md border">
                <Badge variant="outline" className="text-[10px] mb-1">{loc.label}</Badge>
                <p className="text-xs">
                  {loc.service_address}, {loc.service_city} {loc.service_postal_code}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Contacts autorisés ({authorizedUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {authorizedUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun contact autorisé</p>
            ) : (
              <div className="space-y-1.5">
                {authorizedUsers.slice(0, 3).map((u: any) => (
                  <div key={u.id} className="text-xs flex justify-between">
                    <span>{u.full_name}</span>
                    <Badge variant="outline" className="text-[10px]">{u.permission_level}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${mono ? "font-mono" : ""} ${highlight ? "text-destructive" : ""}`}>
        {value}
      </span>
    </div>
  );
}
