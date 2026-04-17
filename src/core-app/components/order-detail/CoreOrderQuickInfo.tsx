/**
 * CoreOrderQuickInfo — Always-visible summary of key order data
 *
 * Shows: DOB (locked 🔒), service address, equipment items with prices,
 * appointment date/time, applied promo code, discount amount.
 */
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Lock, MapPin, Package, CalendarClock, Tag, Percent } from "lucide-react";

interface Props {
  proc: any;
}

const fmtCAD = (n: number | null | undefined) =>
  n != null && !isNaN(Number(n)) ? `${Number(n).toFixed(2)} $` : "—";

const fmtDate = (d?: string | null) => {
  if (!d) return null;
  try {
    return format(new Date(d), "d MMM yyyy", { locale: fr });
  } catch {
    return null;
  }
};

const fmtDateTime = (d?: string | null) => {
  if (!d) return null;
  try {
    return format(new Date(d), "d MMM yyyy 'à' HH:mm", { locale: fr });
  } catch {
    return null;
  }
};

export function CoreOrderQuickInfo({ proc }: Props) {
  const { order, profile, account, appointment, invoiceLines } = proc;

  const dob = order?.client_dob || profile?.date_of_birth;
  const dobFormatted = fmtDate(dob);

  // Build complete service address
  const serviceAddress = [
    order?.shipping_address || account?.primary_service_address,
    order?.shipping_city || account?.primary_service_city,
    order?.shipping_province || account?.primary_service_province || "QC",
    order?.shipping_postal_code || account?.primary_service_postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  // Equipment items from canonical billing_invoice_lines
  const equipment = (invoiceLines || []).filter((l: any) => {
    const desc = String(l.description || "").toLowerCase();
    return (
      l.line_type === "equipment" ||
      desc.includes("borne") ||
      desc.includes("terminal") ||
      desc.includes("routeur") ||
      desc.includes("router") ||
      desc.includes("modem") ||
      desc.includes("décodeur") ||
      desc.includes("sim")
    );
  });

  // Promo / discount
  const discountLines = (invoiceLines || []).filter(
    (l: any) => l.line_type === "discount" || l.line_type === "credit",
  );
  const discountTotal = discountLines.reduce(
    (sum: number, l: any) => sum + Math.abs(Number(l.line_total || 0)),
    0,
  );
  const promoCode = order?.promo_code;

  const apptDate = fmtDateTime(appointment?.scheduled_at);

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(220,10%,40%)]">
          Informations clés de la commande
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* DOB (locked) */}
        <div className="rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="h-3 w-3 text-amber-400" />
            <span className="text-[9px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-semibold">
              Date de naissance
            </span>
          </div>
          <div className="text-[12px] text-white font-medium">
            {dobFormatted || (
              <span className="text-[hsl(220,10%,40%)]">Non renseignée</span>
            )}
          </div>
          <div className="text-[9px] text-[hsl(220,10%,35%)] mt-0.5">
            🔒 Lecture seule (vérifiée KYC)
          </div>
        </div>

        {/* Service address */}
        <div className="rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-2.5 md:col-span-2">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="h-3 w-3 text-sky-400" />
            <span className="text-[9px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-semibold">
              Adresse de service
            </span>
          </div>
          <div className="text-[12px] text-white">
            {serviceAddress || (
              <span className="text-[hsl(220,10%,40%)]">Non renseignée</span>
            )}
          </div>
        </div>

        {/* Appointment */}
        <div className="rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarClock className="h-3 w-3 text-violet-400" />
            <span className="text-[9px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-semibold">
              Rendez-vous d'installation
            </span>
          </div>
          {apptDate ? (
            <>
              <div className="text-[12px] text-white">{apptDate}</div>
              {appointment?.installation_method && (
                <div className="text-[10px] text-[hsl(220,10%,55%)] mt-0.5">
                  {appointment.installation_method}
                </div>
              )}
            </>
          ) : (
            <div className="text-[12px] text-[hsl(220,10%,40%)]">
              Aucun rendez-vous planifié
            </div>
          )}
        </div>

        {/* Promo code */}
        <div className="rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Tag className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-semibold">
              Code promo
            </span>
          </div>
          {promoCode ? (
            <div className="text-[12px] text-emerald-300 font-mono font-semibold">
              {promoCode}
            </div>
          ) : (
            <div className="text-[12px] text-[hsl(220,10%,40%)]">Aucun</div>
          )}
        </div>

        {/* Discount amount */}
        <div className="rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Percent className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-semibold">
              Rabais appliqué
            </span>
          </div>
          {discountTotal > 0 ? (
            <>
              <div className="text-[12px] text-emerald-300 font-semibold tabular-nums">
                −{fmtCAD(discountTotal)}
              </div>
              {discountLines.length > 0 && (
                <div className="text-[9px] text-[hsl(220,10%,55%)] mt-0.5 truncate">
                  {discountLines[0].description}
                </div>
              )}
            </>
          ) : (
            <div className="text-[12px] text-[hsl(220,10%,40%)]">Aucun</div>
          )}
        </div>

        {/* Equipment */}
        <div className="rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-2.5 md:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Package className="h-3 w-3 text-sky-400" />
            <span className="text-[9px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-semibold">
              Équipement commandé
            </span>
          </div>
          {equipment.length > 0 ? (
            <div className="space-y-1">
              {equipment.map((eq: any) => (
                <div
                  key={eq.id}
                  className="flex justify-between items-center text-[11px] py-0.5 border-b border-[hsl(220,15%,13%)] last:border-0"
                >
                  <span className="text-white">
                    {eq.description}
                    {eq.quantity > 1 && (
                      <span className="text-[hsl(220,10%,45%)] ml-1">
                        ×{eq.quantity}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[hsl(220,10%,75%)] tabular-nums">
                    {fmtCAD(eq.line_total)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-[hsl(220,10%,40%)]">
              Aucun équipement sur cette commande
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
