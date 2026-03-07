/**
 * AccountProfileHeader — CRM-grade account header with summary + quick actions
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building2, MapPin, Calendar, Shield, CreditCard, Star,
  StickyNote, Ban, PlusCircle, Package, Headphones, Mail,
  ArrowLeft, RefreshCw, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  suspended: { label: "Suspendu", variant: "secondary" },
  closed: { label: "Fermé", variant: "destructive" },
  pending: { label: "En attente", variant: "outline" },
};

const creditLabels: Record<string, { label: string; className: string }> = {
  A: { label: "Excellent", className: "bg-green-500" },
  B: { label: "Bon", className: "bg-blue-500" },
  C: { label: "Moyen", className: "bg-yellow-500" },
  D: { label: "Mauvais", className: "bg-red-500" },
};

interface AccountProfileHeaderProps {
  account: any;
  profile: any;
  invoices: any[];
  payments: any[];
  subscriptions: any[];
  tickets: any[];
  onRefresh: () => void;
}

export function AccountProfileHeader({
  account, profile, invoices, payments, subscriptions, tickets, onRefresh,
}: AccountProfileHeaderProps) {
  const navigate = useNavigate();
  if (!account) return null;

  const statusInfo = statusConfig[account.status] || statusConfig.active;
  const creditInfo = creditLabels[account.credit_class] || null;
  const customerSince = account.created_at
    ? format(new Date(account.created_at), "d MMMM yyyy", { locale: fr })
    : "—";

  // Calculate balance from invoices
  const totalBalance = invoices.reduce((sum: number, inv: any) => sum + (inv.balance_due || 0), 0);
  const lastPayment = payments.length > 0 ? payments[0] : null;
  const activeServices = subscriptions.filter((s: any) => s.status === "active").length;
  const openTickets = tickets.filter((t: any) => !["resolved", "closed"].includes(t.status)).length;

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/accounts")} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Comptes
        </Button>
        <Button variant="ghost" size="icon" onClick={onRefresh} className="ml-auto h-8 w-8">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Header */}
      <div className="border rounded-lg p-5 bg-card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  {profile?.full_name || account.account_name || "Client"}
                </h1>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                {creditInfo && (
                  <div className="flex items-center gap-1.5">
                    <div className={`h-3 w-3 rounded-full ${creditInfo.className}`} />
                    <span className="text-xs text-muted-foreground">Crédit {creditInfo.label}</span>
                  </div>
                )}
                {account.status === "suspended" && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Suspendu
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                <span className="font-mono font-medium text-foreground/70">{account.account_number}</span>
                {profile?.email && <span>{profile.email}</span>}
                {profile?.phone && <span>{profile.phone}</span>}
              </div>
              {account.primary_service_address && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {account.primary_service_address}
                  {account.primary_service_city && `, ${account.primary_service_city}`}
                  {account.primary_service_postal_code && ` ${account.primary_service_postal_code}`}
                </p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard label="Services actifs" value={activeServices.toString()} />
          <MetricCard
            label="Solde du compte"
            value={`${totalBalance.toFixed(2)} $`}
            highlight={totalBalance > 0}
          />
          <MetricCard
            label="Prochain cycle"
            value={account.billing_cycle_day ? `${account.billing_cycle_day} du mois` : "—"}
          />
          <MetricCard
            label="Dernier paiement"
            value={lastPayment ? `${lastPayment.amount?.toFixed(2)} $` : "—"}
          />
          <MetricCard label="Tickets ouverts" value={openTickets.toString()} highlight={openTickets > 0} />
          <MetricCard label="Client depuis" value={customerSince} />
          <MetricCard
            label="Sécurité"
            value={profile?.security_status === "flagged" ? "Alerte" : "Normal"}
            highlight={profile?.security_status === "flagged"}
          />
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <StickyNote className="h-3.5 w-3.5" />
            Note
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Ban className="h-3.5 w-3.5" />
            Suspendre
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <PlusCircle className="h-3.5 w-3.5" />
            Ajouter service
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Package className="h-3.5 w-3.5" />
            Créer commande
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Headphones className="h-3.5 w-3.5" />
            Ticket support
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" />
            Communication
          </Button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center p-2 rounded-md bg-muted/40">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
