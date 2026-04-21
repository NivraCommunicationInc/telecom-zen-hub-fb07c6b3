/**
 * OrderShippingActivationPanel
 *
 * Read-only display of Phase 2 checkout fields:
 *   - Service address
 *   - Alternative shipping address (if applicable)
 *   - Activation preference + requested date
 *   - Installation details (coax, occupancy, access notes)
 *
 * Used by:
 *   - Admin / Core order overview
 *   - Client portal order detail dialog
 *
 * Backward compatible: hides any field that is missing on the order.
 */
import { Truck, MapPin, CalendarClock, Wrench, Info } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AnyOrder {
  // Service address (existing checkout fields, may live under different names)
  client_full_address?: string | null;
  service_address?: string | null;
  service_city?: string | null;
  service_province?: string | null;
  service_postal_code?: string | null;

  // Phase 2 — alternative shipping
  ship_to_different_address?: boolean | null;
  shipping_first_name?: string | null;
  shipping_last_name?: string | null;
  shipping_address_line?: string | null;
  shipping_apartment?: string | null;
  shipping_city?: string | null;
  shipping_province?: string | null;
  shipping_postal_code?: string | null;
  shipping_instructions?: string | null;

  // Phase 2 — activation preference
  activation_preference?: string | null;
  requested_activation_date?: string | null;

  // Phase 2 — installation details
  installation_details?: {
    coaxAvailable?: string;
    occupancyStatus?: string;
    accessNotes?: string;
  } | null;
}

interface Props {
  order: AnyOrder;
  /** "admin" gives a denser, white-card look; "client" uses softer slate styling. */
  variant?: "admin" | "client";
}

const COAX_LABELS: Record<string, string> = {
  yes: "Oui, déjà installé",
  no: "Non",
  unknown: "Le client ne sait pas",
};

const OCCUPANCY_LABELS: Record<string, string> = {
  occupied: "Logement occupé",
  vacant: "Logement vacant",
};

function buildServiceAddress(o: AnyOrder): string | null {
  if (o.client_full_address) return o.client_full_address;
  const parts = [o.service_address, o.service_city, o.service_province, o.service_postal_code].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function buildShippingAddress(o: AnyOrder): string | null {
  if (!o.ship_to_different_address) return null;
  const line = [o.shipping_address_line, o.shipping_apartment].filter(Boolean).join(", ");
  const parts = [line, o.shipping_city, o.shipping_province, o.shipping_postal_code].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function shippingRecipient(o: AnyOrder): string | null {
  const name = [o.shipping_first_name, o.shipping_last_name].filter(Boolean).join(" ").trim();
  return name || null;
}

export function OrderShippingActivationPanel({ order, variant = "admin" }: Props) {
  const serviceAddress = buildServiceAddress(order);
  const shippingAddress = buildShippingAddress(order);
  const recipient = shippingRecipient(order);
  const hasAltShipping = Boolean(order.ship_to_different_address && shippingAddress);

  const activationPreference = order.activation_preference || "ASAP";
  const requestedDate = order.requested_activation_date
    ? format(new Date(order.requested_activation_date), "EEEE d MMMM yyyy", { locale: fr })
    : null;

  const installation = order.installation_details || null;
  const hasInstallationDetails =
    installation && (installation.coaxAvailable || installation.occupancyStatus || installation.accessNotes);

  const isAdmin = variant === "admin";
  const cardClass = isAdmin
    ? "bg-white border border-gray-200 rounded-lg p-4"
    : "bg-slate-50 border border-slate-200 rounded-lg p-4";
  const titleClass = isAdmin
    ? "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3"
    : "text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3";
  const labelClass = isAdmin ? "text-xs text-gray-500" : "text-xs text-slate-500";
  const valueClass = isAdmin ? "text-sm text-gray-900" : "text-sm text-slate-900";
  const accentClass = isAdmin ? "text-gray-900" : "text-slate-900";

  return (
    <div className="space-y-4">
      {/* ── Service & shipping addresses ───────────────────────── */}
      <div className={cardClass}>
        <h3 className={titleClass}>
          <span className="inline-flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" /> Livraison
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Service address */}
          <div className="space-y-1">
            <p className={`${labelClass} flex items-center gap-1.5`}>
              <MapPin className="w-3 h-3" /> Adresse de service
            </p>
            <p className={valueClass}>{serviceAddress || "—"}</p>
          </div>

          {/* Shipping address */}
          <div className="space-y-1">
            <p className={`${labelClass} flex items-center gap-1.5`}>
              <Truck className="w-3 h-3" /> Adresse de livraison
            </p>
            {hasAltShipping ? (
              <>
                {recipient && <p className={`${valueClass} font-medium`}>{recipient}</p>}
                <p className={valueClass}>{shippingAddress}</p>
                <span className="inline-block text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded mt-1">
                  Adresse alternative
                </span>
              </>
            ) : (
              <p className={`text-sm ${isAdmin ? "text-gray-500" : "text-slate-500"} italic`}>
                Identique à l'adresse de service
              </p>
            )}
          </div>
        </div>

        {hasAltShipping && order.shipping_instructions && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className={`${labelClass} flex items-center gap-1.5 mb-1`}>
              <Info className="w-3 h-3" /> Instructions de livraison
            </p>
            <p className={`text-sm ${isAdmin ? "text-gray-700" : "text-slate-700"} whitespace-pre-wrap`}>
              {order.shipping_instructions}
            </p>
          </div>
        )}
      </div>

      {/* ── Activation preference ──────────────────────────────── */}
      <div className={cardClass}>
        <h3 className={titleClass}>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> Activation
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className={labelClass}>Préférence du client</p>
            {activationPreference === "SCHEDULED" ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                <CalendarClock className="w-3.5 h-3.5" /> Date choisie
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                Le plus tôt possible (ASAP)
              </span>
            )}
          </div>

          <div className="space-y-1">
            <p className={labelClass}>Date demandée</p>
            {requestedDate ? (
              <p className={`${valueClass} font-medium ${accentClass}`}>{requestedDate}</p>
            ) : (
              <p className={`text-sm ${isAdmin ? "text-gray-500" : "text-slate-500"} italic`}>
                Aucune date spécifique demandée
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Installation details ───────────────────────────────── */}
      {hasInstallationDetails && (
        <div className={cardClass}>
          <h3 className={titleClass}>
            <span className="inline-flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> Détails d'installation
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {installation?.coaxAvailable && (
              <div className="space-y-1">
                <p className={labelClass}>Câble coaxial</p>
                <p className={valueClass}>{COAX_LABELS[installation.coaxAvailable] || installation.coaxAvailable}</p>
              </div>
            )}

            {installation?.occupancyStatus && (
              <div className="space-y-1">
                <p className={labelClass}>Statut du logement</p>
                <p className={valueClass}>
                  {OCCUPANCY_LABELS[installation.occupancyStatus] || installation.occupancyStatus}
                </p>
              </div>
            )}
          </div>

          {installation?.accessNotes && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className={`${labelClass} mb-1`}>Notes d'accès</p>
              <p className={`text-sm ${isAdmin ? "text-gray-700" : "text-slate-700"} whitespace-pre-wrap`}>
                {installation.accessNotes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OrderShippingActivationPanel;
