/**
 * AdminSubscriptionDetail — Full subscription detail page.
 * Services, invoices, audit trail, address, client — all from DB.
 */
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SectionCard } from "@/components/admin/ui/SectionCard";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { useAdminSubscriptionDetail } from "@/hooks/admin/useAdminSubscriptionDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, MapPin, User, FileText, Package, History,
  Calendar, ToggleRight, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminSubscriptionDetail() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const { subscription, customer, address, invoices, audit, accountNumber, isLoading } = useAdminSubscriptionDetail(subscriptionId);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-4 py-8">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!subscription) {
    return (
      <AdminLayout>
        <div className="py-20 text-center text-muted-foreground">Abonnement introuvable</div>
      </AdminLayout>
    );
  }

  const services = subscription.billing_subscription_services || [];
  const clientName = customer ? `${customer.first_name} ${customer.last_name}` : "—";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title={subscription.plan_name}
          subtitle={`Code: ${subscription.plan_code}`}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Abonnements", href: "/admin/subscriptions" },
            { label: subscription.plan_name },
          ]}
          badge={
            <StatusBadge label={subscription.status || "—"} variant={statusToVariant(subscription.status || "")} size="md" />
          }
        />

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricBox label="Prix mensuel" value={subscription.plan_price.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} />
          <MetricBox label="Début cycle" value={format(new Date(subscription.cycle_start_date), "d MMM yyyy", { locale: fr })} />
          <MetricBox label="Fin cycle" value={format(new Date(subscription.cycle_end_date), "d MMM yyyy", { locale: fr })} />
          <MetricBox
            label="Auto-facturation"
            value={subscription.auto_billing_enabled ? "Activée" : "Désactivée"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Client */}
          <SectionCard title="Client" icon={User}>
            <div className="space-y-2 text-sm">
              <Row label="Nom" value={clientName} />
              <Row label="Email" value={customer?.email || "—"} />
              <Row label="Téléphone" value={customer?.phone || "—"} />
              {accountNumber && <Row label="N° compte" value={accountNumber} mono />}
            </div>
          </SectionCard>

          {/* Address */}
          <SectionCard title="Adresse de service" icon={MapPin}>
            {address ? (
              <div className="space-y-2 text-sm">
                <Row label="Adresse" value={address.address_line1 || "—"} />
                {address.address_line2 && <Row label="" value={address.address_line2} />}
                <Row label="Ville" value={address.city || "—"} />
                <Row label="Province" value={address.province || "QC"} />
                <Row label="Code postal" value={address.postal_code || "—"} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune adresse liée</p>
            )}
          </SectionCard>
        </div>

        {/* Services inclus */}
        <SectionCard title="Services inclus" icon={Package} noPadding>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun service inclus</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Service</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Code</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground text-right">Prix unitaire</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground text-center">Qté</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Actif</th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc: any) => (
                  <tr key={svc.id} className="border-b border-border/40">
                    <td className="px-5 py-3 font-medium">{svc.service_name}</td>
                    <td className="px-5 py-3 font-mono text-xs">{svc.service_code}</td>
                    <td className="px-5 py-3 text-xs">{svc.service_type || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {svc.unit_price.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </td>
                    <td className="px-5 py-3 text-center">{svc.quantity}</td>
                    <td className="px-5 py-3">
                      {svc.is_active ? (
                        <ToggleRight className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Inactif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Commande source */}
        {subscription.order_id && (
          <SectionCard title="Commande source" icon={Package}>
            <Link to={`/admin/orders/${subscription.order_id}`} className="text-sm text-primary hover:underline flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              Voir la commande
            </Link>
            {subscription.source_type && !subscription.order_id && (
              <p className="text-xs text-muted-foreground mt-1">
                Source: {subscription.source_type} / {subscription.source_id || "—"}
              </p>
            )}
          </SectionCard>
        )}

        {/* Invoices */}
        <SectionCard title="Historique des factures" icon={FileText} noPadding>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune facture</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">N° facture</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Statut</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground text-right">Total</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground text-right">Solde dû</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-border/40 hover:bg-primary/5">
                    <td className="px-5 py-3">
                      <Link to={`/admin/invoices/${inv.id}`} className="font-mono text-primary hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={inv.status || "—"} variant={statusToVariant(inv.status || "")} size="sm" />
                    </td>
                    <td className="px-5 py-3 text-xs">{inv.type || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {inv.total?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) || "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {inv.balance_due > 0 ? (
                        <span className="text-red-400 font-medium">
                          {inv.balance_due.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0,00 $</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {inv.created_at ? format(new Date(inv.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Audit trail */}
        <SectionCard title="Journal d'audit" icon={History} noPadding>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun événement</p>
          ) : (
            <div className="divide-y divide-border/40">
              {audit.map((entry: any) => (
                <div key={entry.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{entry.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.created_at ? format(new Date(entry.created_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}
                    </span>
                  </div>
                  {entry.reason && <p className="text-xs text-muted-foreground mt-0.5">{entry.reason}</p>}
                  {entry.details && typeof entry.details === "object" && (
                    <pre className="text-[11px] text-muted-foreground mt-1 bg-muted/30 rounded p-2 overflow-x-auto">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </AdminLayout>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {label && <span className="text-muted-foreground shrink-0">{label}</span>}
      <span className={`text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
