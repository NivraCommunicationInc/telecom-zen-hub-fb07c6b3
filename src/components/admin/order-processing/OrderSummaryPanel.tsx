/**
 * OrderSummaryPanel — Right-side summary (always visible)
 * Shows: services, equipment, totals, payment, fulfillment, appointment
 */
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  proc: any;
}

function Row({ label, value, bold }: { label: string; value: string | number | null | undefined; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`text-right text-xs ${bold ? "font-semibold text-gray-900" : "text-gray-700"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-1 first:mt-0">
      {children}
    </h4>
  );
}

export function OrderSummaryPanel({ proc }: Props) {
  const { order, invoice, appointment, items } = proc;

  const pricingSnapshot = order.pricing_snapshot as any;
  const subtotal = invoice?.subtotal ?? pricingSnapshot?.subtotal ?? order.subtotal;
  const tps = invoice?.tps_amount ?? pricingSnapshot?.tps ?? order.tps_amount;
  const tvq = invoice?.tvq_amount ?? pricingSnapshot?.tvq ?? order.tvq_amount;
  const total = invoice?.total ?? pricingSnapshot?.total ?? order.total_amount;
  const amountPaid = invoice?.amount_paid ?? order.amount_paid ?? 0;
  const balanceDue = invoice?.balance_due ?? (total ? Number(total) - Number(amountPaid) : 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-3">Résumé</h3>

      {/* Services */}
      <SectionTitle>Services</SectionTitle>
      <Row label="Type" value={order.service_type} />
      {items.length > 0 && items.map((item: any, i: number) => (
        <Row key={i} label={item.product_name || item.plan_name || `Item ${i + 1}`} value={`${Number(item.unit_price || 0).toFixed(2)} $`} />
      ))}

      {/* Equipment */}
      <SectionTitle>Équipement</SectionTitle>
      <Row label="SIM" value={order.sim_number || order.sim_type} />
      <Row label="IMEI" value={order.imei_number} />
      <Row label="Série" value={order.serial_number} />

      {/* Financials */}
      <SectionTitle>Montants</SectionTitle>
      <Row label="Sous-total" value={subtotal != null ? `${Number(subtotal).toFixed(2)} $` : null} />
      <Row label="TPS (5%)" value={tps != null ? `${Number(tps).toFixed(2)} $` : null} />
      <Row label="TVQ (9.975%)" value={tvq != null ? `${Number(tvq).toFixed(2)} $` : null} />
      <div className="border-t border-gray-200 mt-1 pt-1">
        <Row label="Total" value={total != null ? `${Number(total).toFixed(2)} $` : null} bold />
        <Row label="Payé" value={`${Number(amountPaid).toFixed(2)} $`} />
        <Row label="Solde dû" value={`${Number(balanceDue).toFixed(2)} $`} bold />
      </div>

      {/* Payment */}
      <SectionTitle>Paiement</SectionTitle>
      <Row label="Méthode" value={order.payment_method} />
      <Row label="Référence" value={order.payment_reference} />
      <Row label="Statut" value={order.payment_status} />

      {/* Fulfillment */}
      <SectionTitle>Livraison</SectionTitle>
      <Row label="Mode" value={order.fulfillment_type} />
      <Row label="Transporteur" value={order.carrier} />
      <Row label="Suivi" value={order.tracking_number} />

      {/* Appointment */}
      {appointment && (
        <>
          <SectionTitle>Rendez-vous</SectionTitle>
          <Row label="Date" value={format(new Date(appointment.scheduled_at), "d MMM yyyy HH:mm", { locale: fr })} />
          <Row label="Statut" value={appointment.status} />
          <Row label="Adresse" value={appointment.service_address} />
        </>
      )}
    </div>
  );
}
