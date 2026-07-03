/**
 * Pre-checked service address handoff — from plan pages (InternetPlans, TVPlans)
 * to the checkout (/commander → GuestCheckout).
 *
 * The customer validates an address BEFORE entering checkout to confirm
 * serviceability. We stash the structured address in sessionStorage so the
 * checkout can hydrate the "Adresse de service" step without asking again.
 *
 * Keys are namespaced to survive alongside the checkout draft.
 */

export const PRECHECKED_ADDRESS_KEY = "nivra_prechecked_address_v1";

export interface PrecheckedAddress {
  line1: string;
  apartment?: string;
  city: string;
  region: string;      // "QC"
  postalCode: string;
}

export function writePrecheckedAddress(addr: Partial<PrecheckedAddress> | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (!addr || !addr.line1) {
      sessionStorage.removeItem(PRECHECKED_ADDRESS_KEY);
      return;
    }
    const payload: PrecheckedAddress = {
      line1: addr.line1 || "",
      apartment: addr.apartment || "",
      city: addr.city || "",
      region: (addr.region || "QC").toUpperCase(),
      postalCode: (addr.postalCode || "").toUpperCase(),
    };
    sessionStorage.setItem(PRECHECKED_ADDRESS_KEY, JSON.stringify(payload));
  } catch { /* storage disabled — best-effort only */ }
}

export function readPrecheckedAddress(): PrecheckedAddress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PRECHECKED_ADDRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrecheckedAddress;
    if (!parsed?.line1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPrecheckedAddress(): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(PRECHECKED_ADDRESS_KEY); } catch { /* noop */ }
}
