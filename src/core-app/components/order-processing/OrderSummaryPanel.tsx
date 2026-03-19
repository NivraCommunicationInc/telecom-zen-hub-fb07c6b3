/**
 * OrderSummaryPanel — Right-side summary (always visible)
 * 3-section structure: Recurring / One-time / Today's total
 * CANONICAL: Uses billing_invoice_lines ONLY. No reconstruction from pricing_snapshot.
 */
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  proc: any;
}

function Row({ label, value, bold, accent }: { label: string; value: string | number | null | undefined; bold?: boolean; accent?: string }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1">
      <span className="text-[hsl(220,10%,38%)] text-[11px]">{label}</span>
      <span className={`text-right text-[11px] ${bold ? "font-semibold text-white" : accent || "text-[hsl(220,10%,65%)]"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold text-[hsl(220,10%,40%)] uppercase tracking-wider mt-4 mb-1 first:mt-0">
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
  const { order, invoice, appointment, invoiceLines } = proc;
  const hasInvoiceLines = invoiceLines && invoiceLines.length > 0;

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

  // Totals from canonical invoice ONLY
  const recurringSubtotal = hasInvoiceLines
    ? recurringLines.reduce((s, l) => s + Number(l.line_total || 0), 0)
    : 0;
  const discountTotal = hasInvoiceLines
    ? discountLines.reduce((s, l) => s + Math.abs(Number(l.line_total || 0)), 0)
    : 0;
  const recurringNet = Math.max(0, Number(recurringSubtotal) - Number(discountTotal));

  const oneTimeSubtotal = hasInvoiceLines
    ? [...equipmentLines, ...feeLines].reduce((s, l) => s + Number(l.line_total || 0), 0)
    : 0;

  // Today's total — CANONICAL from invoice
  const tps = invoice?.tps_amount ?? 0;
  const tvq = invoice?.tvq_amount ?? 0;
  const total = invoice?.total ?? (order.pricing_snapshot as any)?.grand_total ?? order.total_amount;
  const amountPaid = invoice?.amount_paid ?? 0;
  const balanceDue = invoice?.balance_due ?? (total ? Number(total) - Number(amountPaid) : 0);

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
      <h3 className="text-xs font-bold text-white mb-3">Résumé de commande</h3>

      {/* Missing lines warning */}
      {!hasInvoiceLines && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 mb-3">
          <p className="text-[10px] text-amber-400">⚠ Lignes de facturation manquantes</p>
        </div>
      )}

      {/* ═══ SECTION A: Recurring Services — itemized ═══ */}
      <SectionTitle>Services mensuels</SectionTitle>
      <Row label="Type" value={order.service_type} />
      {hasInvoiceLines && recurringLines.map((line: any, i: number) => (
        <Row key={`r-${i}`} label={line.description} value={fmt(line.line_total)} />
      ))}
      <div className="border-t border-[hsl(220,15%,16%)] mt-1 pt-1">
        <Row label="Sous-total mensuel" value={fmt(recurringSubtotal)} bold />
        {Number(discountTotal) > 0 && (
          <>
            {hasInvoiceLines && discountLines.map((dl: any, i: number) => (
              <Row key={`d-${i}`} label={dl.description} value={`-${fmt(Math.abs(Number(dl.line_total || 0)))}`} accent="text-emerald-400" />
            ))}
            <Row label="Net mensuel" value={fmt(recurringNet)} />
          </>
        )}
      </div>

      {/* ═══ SECTION B: One-time Fees — itemized ═══ */}
      {(equipmentLines.length > 0 || feeLines.length > 0) && (
        <>
          <SectionTitle>Frais uniques & Équipement</SectionTitle>
          {equipmentLines.map((line: any, i: number) => (
            <Row key={`eq-${i}`} label={line.description} value={fmt(line.line_total)} />
          ))}
          {feeLines.map((line: any, i: number) => (
            <Row key={`fee-${i}`} label={line.description} value={fmt(line.line_total)} />
          ))}
          <div className="border-t border-[hsl(220,15%,16%)] mt-1 pt-1">
            <Row label="Total frais uniques" value={fmt(oneTimeSubtotal)} bold />
          </div>
        </>
      )}

      {/* ═══ SECTION C: Total de la commande ═══ */}
      <SectionTitle>Total de la commande</SectionTitle>
      <Row label="TPS (5%)" value={fmt(tps)} />
      <Row label="TVQ (9.975%)" value={fmt(tvq)} />
      <div className="border-t border-[hsl(220,15%,18%)] mt-1 pt-1">
        <Row label="Total" value={fmt(total)} bold />
        <Row label="Payé" value={fmt(amountPaid)} accent="text-emerald-400" />
        <Row label="Solde dû" value={fmt(balanceDue)} bold accent={Number(balanceDue) > 0 ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"} />
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