/**
 * OrderSummaryPanel — Right-side summary (always visible)
 * 3-section structure: Recurring / One-time / Today's total
 * CANONICAL: Uses billing_invoice_lines for itemization, invoice for totals
 */
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  proc: any;
}

function Row({ label, value, bold, accent }: { label: string; value: string | number | null | undefined; bold?: boolean; accent?: string }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`text-right text-xs ${bold ? "font-semibold text-gray-900" : accent || "text-gray-700"}`}>
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

const fmt = (n: number | null | undefined) => n != null ? `${Number(n).toFixed(2)} $` : null;

/** Classify an invoice line */
function classifyLine(line: any): "recurring" | "equipment" | "fee" | "discount" {
  if (line.line_type === "discount" || line.line_type === "credit") return "discount";
  const desc = (line.description || "").toLowerCase();
  if (line.line_type === "equipment" || desc.includes("routeur") || desc.includes("router") || desc.includes("terminal") || desc.includes("modem") || desc.includes("sim") || desc.includes("décodeur")) return "equipment";
  if (line.line_type === "fee" || desc.includes("activation") || desc.includes("livraison") || desc.includes("installation") || desc.includes("shipping") || desc.includes("delivery")) return "fee";
  return "recurring";
}

export function OrderSummaryPanel({ proc }: Props) {
  const { order, invoice, appointment, items, invoiceLines } = proc;
  const hasInvoiceLines = invoiceLines && invoiceLines.length > 0;

  const pricingSnapshot = order.pricing_snapshot as any;

  // Categorize invoice lines
  const recurringLines: any[] = [];
  const equipmentLines: any[] = [];
  const feeLines: any[] = [];
  const discountLines: any[] = [];

  if (hasInvoiceLines) {
    for (const line of invoiceLines) {
      const cat = classifyLine(line);
      if (cat === "recurring") recurringLines.push(line);
      else if (cat === "equipment") equipmentLines.push(line);
      else if (cat === "fee") feeLines.push(line);
      else if (cat === "discount") discountLines.push(line);
    }
  }

  // Recurring
  const recurringSubtotal = hasInvoiceLines
    ? recurringLines.reduce((s, l) => s + Number(l.line_total || 0), 0)
    : (pricingSnapshot?.recurring_subtotal ?? order.subtotal ?? 0);
  const discountTotal = hasInvoiceLines
    ? discountLines.reduce((s, l) => s + Math.abs(Number(l.line_total || 0)), 0)
    : (pricingSnapshot?.discount_total_combined ?? order.discount_amount ?? 0);
  const recurringNet = Math.max(0, Number(recurringSubtotal) - Number(discountTotal));

  // One-time
  const oneTimeSubtotal = hasInvoiceLines
    ? [...equipmentLines, ...feeLines].reduce((s, l) => s + Number(l.line_total || 0), 0)
    : (pricingSnapshot?.one_time_subtotal ?? 0);

  // Today's total — CANONICAL from invoice
  const tps = invoice?.tps_amount ?? pricingSnapshot?.tps_amount ?? order.tps_amount;
  const tvq = invoice?.tvq_amount ?? pricingSnapshot?.tvq_amount ?? order.tvq_amount;
  const total = invoice?.total ?? pricingSnapshot?.grand_total ?? order.total_amount;
  const amountPaid = invoice?.amount_paid ?? order.amount_paid ?? 0;
  const balanceDue = invoice?.balance_due ?? (total ? Number(total) - Number(amountPaid) : 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-3">Résumé</h3>

      {/* ═══ SECTION A: Recurring Services — itemized ═══ */}
      <SectionTitle>Services mensuels</SectionTitle>
      <Row label="Type" value={order.service_type} />
      {hasInvoiceLines ? (
        recurringLines.map((line: any, i: number) => (
          <Row key={`r-${i}`} label={line.description} value={fmt(line.line_total)} />
        ))
      ) : (
        items.length > 0 && items.map((item: any, i: number) => (
          <Row key={i} label={item.product_name || item.plan_name || `Item ${i + 1}`} value={fmt(item.unit_price)} />
        ))
      )}
      <div className="border-t border-gray-100 mt-1 pt-1">
        <Row label="Sous-total mensuel" value={fmt(recurringSubtotal)} bold />
        {Number(discountTotal) > 0 && (
          <>
            {hasInvoiceLines ? (
              discountLines.map((dl: any, i: number) => (
                <Row key={`d-${i}`} label={dl.description} value={`-${fmt(Math.abs(Number(dl.line_total || 0)))}`} accent="text-emerald-600" />
              ))
            ) : (
              <Row label={`Rabais${order.promo_code ? ` (${order.promo_code})` : ""}`} value={`-${fmt(discountTotal)}`} accent="text-emerald-600" />
            )}
            <Row label="Net mensuel" value={fmt(recurringNet)} />
          </>
        )}
      </div>

      {/* ═══ SECTION B: One-time Fees — itemized ═══ */}
      {(Number(oneTimeSubtotal) > 0 || equipmentLines.length > 0 || feeLines.length > 0) && (
        <>
          <SectionTitle>Frais uniques</SectionTitle>
          {hasInvoiceLines ? (
            <>
              {equipmentLines.map((line: any, i: number) => (
                <Row key={`eq-${i}`} label={line.description} value={fmt(line.line_total)} />
              ))}
              {feeLines.map((line: any, i: number) => (
                <Row key={`fee-${i}`} label={line.description} value={fmt(line.line_total)} />
              ))}
            </>
          ) : (
            <>
              {order.activation_fee > 0 && <Row label="Activation" value={fmt(order.activation_fee)} />}
              {order.delivery_fee > 0 && <Row label="Livraison" value={fmt(order.delivery_fee)} />}
              {order.installation_fee > 0 && <Row label="Installation" value={fmt(order.installation_fee)} />}
              {order.router_fee > 0 && <Row label="Routeur" value={fmt(order.router_fee)} />}
              {order.terminal_fee > 0 && <Row label="Terminal(s)" value={fmt(order.terminal_fee)} />}
            </>
          )}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <Row label="Total frais uniques" value={fmt(oneTimeSubtotal)} bold />
          </div>
        </>
      )}

      {/* ═══ SECTION C: Total ═══ */}
      <SectionTitle>Total de la commande</SectionTitle>
      <Row label="TPS (5%)" value={fmt(tps)} />
      <Row label="TVQ (9.975%)" value={fmt(tvq)} />
      <div className="border-t border-gray-200 mt-1 pt-1">
        <Row label="Total" value={fmt(total)} bold />
        <Row label="Payé" value={fmt(amountPaid)} />
        <Row label="Solde dû" value={fmt(balanceDue)} bold />
      </div>

      {/* Equipment */}
      <SectionTitle>Équipement</SectionTitle>
      <Row label="SIM" value={order.sim_number || order.sim_type} />
      <Row label="IMEI" value={order.imei_number} />
      <Row label="Série" value={order.serial_number} />

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
