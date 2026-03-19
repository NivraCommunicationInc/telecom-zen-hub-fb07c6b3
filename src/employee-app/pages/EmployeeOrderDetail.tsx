/**
 * EmployeeOrderDetail — Order detail view for employees.
 * READ-ONLY canonical financials. Operational actions only.
 * Sections: Summary, Pricing snapshot (read-only), Consent, Documents, Timeline.
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, ShoppingCart, Clock, Shield, FileText, DollarSign, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { cn } from "@/lib/utils";

function useEmployeeOrderDetail(orderId: string) {
  return useQuery({
    queryKey: ["employee-order-detail", orderId],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!order) throw new Error("Commande introuvable");

      // Get profile, invoice, consent evidence in parallel
      const [profileRes, invoiceRes, consentRes, logsRes] = await Promise.all([
        order.user_id
          ? supabase.from("profiles").select("full_name, email, phone").eq("user_id", order.user_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("billing_invoices").select("id, invoice_number, total, subtotal, tps_amount, tvq_amount, status, due_date, paid_at")
          .eq("order_id", orderId).maybeSingle(),
        supabase.from("consent_records").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1),
        supabase.from("activity_logs").select("action, created_at, actor_name, details")
          .eq("entity_id", orderId).eq("entity_type", "order").order("created_at", { ascending: false }).limit(20),
      ]);

      return {
        order,
        profile: profileRes.data,
        invoice: invoiceRes.data,
        consent: consentRes.data?.[0] ?? null,
        logs: logsRes.data ?? [],
        pricingSnapshot: order.pricing_snapshot as Record<string, any> | null,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function EmployeeOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  if (!orderId) {
    return (
      <div className="py-20 text-center">
        <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,30%)]" />
        <p className="text-sm text-[hsl(220,10%,40%)]">Commande introuvable</p>
        <Link to={employeePath("/orders")} className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  return <OrderDetailContent orderId={orderId} />;
}

function OrderDetailContent({ orderId }: { orderId: string }) {
  const { data, isLoading, error } = useEmployeeOrderDetail(orderId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-red-400 text-sm font-medium">Erreur de chargement</p>
        <Link to={employeePath("/orders")} className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  const { order, profile, invoice, consent, logs, pricingSnapshot } = data;

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "text-amber-400 bg-amber-500/10",
      submitted: "text-blue-400 bg-blue-500/10",
      processing: "text-indigo-400 bg-indigo-500/10",
      completed: "text-emerald-400 bg-emerald-500/10",
      cancelled: "text-red-400 bg-red-500/10",
    };
    return map[s] ?? "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,15%)]";
  };

  const fmtMoney = (v: number | null | undefined) =>
    v != null ? `${v.toFixed(2)} $` : "—";

  // Use pricing_snapshot as canonical source
  const snap = pricingSnapshot;
  const grandTotal = snap?.grand_total ?? invoice?.total ?? order.total_amount;

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link
        to={employeePath("/orders")}
        className="inline-flex items-center gap-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Commandes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-400" />
            {order.order_number ?? `Commande #${orderId.slice(0, 8)}`}
          </h1>
          <p className="text-xs text-[hsl(220,10%,45%)] mt-0.5">
            Créée le {format(new Date(order.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
          </p>
        </div>
        <span className={cn("px-3 py-1 rounded-md text-xs font-semibold", statusColor(order.status))}>
          {order.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          <Section title="Résumé" icon={<FileText className="h-4 w-4" />}>
            <InfoRow label="Statut" value={order.status} />
            <InfoRow label="Service" value={order.service_type ?? "—"} />
            <InfoRow label="Paiement" value={order.payment_status ?? "—"} />
            <InfoRow label="Source" value={(order as any).source ?? "web"} />
          </Section>

          {/* Pricing Snapshot — READ ONLY */}
          <Section title="Détail financier (lecture seule)" icon={<DollarSign className="h-4 w-4" />}>
            <div className="bg-[hsl(220,20%,7%)] rounded-lg p-3 border border-[hsl(220,15%,13%)]">
              <div className="flex items-center gap-1.5 mb-3">
                <Shield className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                  Source canonique: pricing_snapshot
                </span>
              </div>
              {snap ? (
                <div className="space-y-1.5 text-xs">
                  <InfoRow label="Sous-total" value={fmtMoney(snap.subtotal)} />
                  <InfoRow label="TPS" value={fmtMoney(snap.tps_amount)} />
                  <InfoRow label="TVQ" value={fmtMoney(snap.tvq_amount)} />
                  {snap.discount_amount > 0 && <InfoRow label="Rabais" value={`-${fmtMoney(snap.discount_amount)}`} />}
                  {snap.activation_fee > 0 && <InfoRow label="Frais d'activation" value={fmtMoney(snap.activation_fee)} />}
                  <div className="border-t border-[hsl(220,15%,15%)] pt-1.5 mt-1.5">
                    <InfoRow label="Total" value={fmtMoney(snap.grand_total)} bold />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <InfoRow label="Total facturé" value={fmtMoney(invoice?.total)} />
                  <InfoRow label="Total commande" value={fmtMoney(order.total_amount)} />
                  <p className="text-[10px] text-amber-400 mt-2">⚠ Aucun pricing_snapshot — valeurs de la facture/commande affichées.</p>
                </div>
              )}
            </div>
          </Section>

          {/* Consent */}
          {consent && (
            <Section title="Preuve de consentement" icon={<Shield className="h-4 w-4" />}>
              <InfoRow label="Horodatage" value={format(new Date(consent.created_at), "d MMM yyyy HH:mm:ss", { locale: fr })} />
              <InfoRow label="IP" value={(consent as any).ip_address ?? "—"} />
              <InfoRow label="Conditions acceptées" value={(consent as any).terms_accepted ? "Oui ✓" : "Non"} />
            </Section>
          )}
        </div>

        {/* RIGHT: Client + Timeline */}
        <div className="space-y-4">
          {/* Client */}
          <Section title="Client" icon={<User className="h-4 w-4" />}>
            <InfoRow label="Nom" value={profile?.full_name ?? "—"} />
            <InfoRow label="Email" value={profile?.email ?? "—"} />
            <InfoRow label="Téléphone" value={profile?.phone ?? "—"} />
          </Section>

          {/* Timeline */}
          <Section title="Historique" icon={<Clock className="h-4 w-4" />}>
            {logs.length === 0 ? (
              <p className="text-xs text-[hsl(220,10%,35%)]">Aucune entrée.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="text-xs border-l-2 border-[hsl(220,15%,15%)] pl-3 py-1">
                    <p className="text-white font-medium">{log.action}</p>
                    <p className="text-[hsl(220,10%,40%)]">
                      {log.actor_name ?? "Système"} · {format(new Date(log.created_at), "d MMM HH:mm", { locale: fr })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[hsl(220,10%,40%)]">{icon}</span>
        <h3 className="text-sm font-semibold text-[hsl(220,10%,65%)]">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[hsl(220,10%,45%)]">{label}</span>
      <span className={cn("text-white", bold && "font-semibold")}>{value}</span>
    </div>
  );
}
