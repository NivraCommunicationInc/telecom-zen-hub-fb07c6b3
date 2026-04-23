/**
 * carrierTracking — canonical carrier label + tracking URL builder.
 *
 * Provides a deterministic, dependency-free helper used by every UI that
 * displays a shipment so that:
 *  - the carrier name is always shown to the client (or "Transporteur non
 *    spécifié" when missing),
 *  - the tracking number links to the carrier's official tracking page when
 *    we know how to build the URL.
 */

export type CarrierKey =
  | "canada_post"
  | "purolator"
  | "fedex"
  | "ups"
  | "dhl"
  | "other";

const NORMALIZE: Record<string, CarrierKey> = {
  "canada post": "canada_post",
  canadapost: "canada_post",
  postescanada: "canada_post",
  "postes canada": "canada_post",
  cpc: "canada_post",
  purolator: "purolator",
  puro: "purolator",
  fedex: "fedex",
  "fed ex": "fedex",
  ups: "ups",
  dhl: "dhl",
};

const LABELS: Record<CarrierKey, string> = {
  canada_post: "Postes Canada",
  purolator: "Purolator",
  fedex: "FedEx",
  ups: "UPS",
  dhl: "DHL",
  other: "Autre transporteur",
};

export function normalizeCarrier(raw?: string | null): CarrierKey | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (NORMALIZE[key]) return NORMALIZE[key];
  // Loose contains-match for free-text carriers.
  for (const k of Object.keys(NORMALIZE)) {
    if (key.includes(k)) return NORMALIZE[k];
  }
  return "other";
}

export function carrierLabel(raw?: string | null): string {
  const key = normalizeCarrier(raw);
  if (!key) return "Transporteur non spécifié";
  return LABELS[key];
}

export function buildCarrierTrackingUrl(
  raw: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const tn = trackingNumber?.trim();
  if (!tn) return null;
  const key = normalizeCarrier(raw);
  const encoded = encodeURIComponent(tn);
  switch (key) {
    case "canada_post":
      return `https://www.canadapost-postescanada.ca/track-reperage/fr#/details/${encoded}`;
    case "purolator":
      return `https://www.purolator.com/fr/expedition/suivi-de-colis?pin=${encoded}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
    case "ups":
      return `https://www.ups.com/track?loc=fr_CA&tracknum=${encoded}`;
    case "dhl":
      return `https://www.dhl.com/ca-fr/home/suivi.html?tracking-id=${encoded}`;
    default:
      return null;
  }
}

/**
 * Returns the best link to surface for a shipment row.
 * Priority: explicit tracking_url override → carrier-derived URL.
 */
export function resolveTrackingLink(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
  trackingUrlOverride: string | null | undefined,
): string | null {
  const override = trackingUrlOverride?.trim();
  if (override) return override;
  return buildCarrierTrackingUrl(carrier, trackingNumber);
}
