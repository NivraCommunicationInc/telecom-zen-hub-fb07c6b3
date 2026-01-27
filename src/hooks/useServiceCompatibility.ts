/**
 * useServiceCompatibility - Service compatibility rules for POS
 * Prevents incompatible service combinations (e.g., bundle TV+Internet blocks standalone Internet)
 */
import { FieldSalesOffer, SelectedService } from "./useFieldSalesOffers";

// Categories that bundles can include
const BUNDLE_INCLUDES: Record<string, string[]> = {
  // TV category bundles typically include Internet
  tv: ["internet"],
};

// Check if an offer name/description suggests it includes another category
function offerIncludesCategory(offer: FieldSalesOffer, category: string): boolean {
  const name = offer.name_fr.toLowerCase();
  const desc = (offer.description_fr || "").toLowerCase();
  const features = offer.features_json as { features?: string[] } | null;
  
  // Check for keywords that indicate included services
  const internetKeywords = ["internet", "mbps", "giga", "gbps", "fibre"];
  const tvKeywords = ["tv", "chaînes", "télé", "canal"];
  
  if (category === "internet") {
    // Check if offer includes internet
    if (internetKeywords.some(k => name.includes(k) || desc.includes(k))) {
      return true;
    }
    if (features?.features?.some(f => internetKeywords.some(k => f.toLowerCase().includes(k)))) {
      return true;
    }
    // TV bundles (category = tv) with speed info include internet
    if (offer.category === "tv" && (offer.features_json as { speed?: string })?.speed) {
      return true;
    }
  }
  
  if (category === "tv") {
    if (tvKeywords.some(k => name.includes(k) || desc.includes(k))) {
      return true;
    }
  }
  
  return false;
}

export interface CompatibilityResult {
  isCompatible: boolean;
  reason?: string;
  blockedBy?: SelectedService;
}

export function checkServiceCompatibility(
  offer: FieldSalesOffer,
  selectedServices: SelectedService[],
  allOffers: FieldSalesOffer[]
): CompatibilityResult {
  // Find the full offer details for selected services
  const selectedOffers = selectedServices
    .map(s => allOffers.find(o => o.id === s.offerId))
    .filter((o): o is FieldSalesOffer => !!o);

  // Rule 1: If adding a standalone Internet offer, check if any selected bundle already includes Internet
  if (offer.category === "internet" && offer.offer_type !== "bundle") {
    const blockingBundle = selectedOffers.find(selected => {
      // Check if this is a bundle or TV package that includes internet
      if (selected.category === "tv" || selected.offer_type === "bundle") {
        return offerIncludesCategory(selected, "internet");
      }
      return false;
    });

    if (blockingBundle) {
      const service = selectedServices.find(s => s.offerId === blockingBundle.id);
      return {
        isCompatible: false,
        reason: `Le forfait "${blockingBundle.name_fr}" inclut déjà Internet. Vous ne pouvez pas ajouter un plan Internet supplémentaire.`,
        blockedBy: service,
      };
    }
  }

  // Rule 2: If adding a TV bundle with Internet, check if standalone Internet is already selected
  if ((offer.category === "tv" || offer.offer_type === "bundle") && offerIncludesCategory(offer, "internet")) {
    const blockingInternet = selectedOffers.find(selected => {
      return selected.category === "internet" && selected.offer_type !== "bundle";
    });

    if (blockingInternet) {
      const service = selectedServices.find(s => s.offerId === blockingInternet.id);
      return {
        isCompatible: false,
        reason: `Ce forfait inclut déjà Internet. Veuillez d'abord retirer "${blockingInternet.name_fr}" du panier.`,
        blockedBy: service,
      };
    }
  }

  // Rule 3: Can't have multiple TV bundles (they overlap)
  if (offer.category === "tv" || (offer.offer_type === "bundle" && offerIncludesCategory(offer, "tv"))) {
    const existingTvBundle = selectedOffers.find(selected => {
      return selected.category === "tv" || (selected.offer_type === "bundle" && offerIncludesCategory(selected, "tv"));
    });

    if (existingTvBundle) {
      const service = selectedServices.find(s => s.offerId === existingTvBundle.id);
      return {
        isCompatible: false,
        reason: `Vous avez déjà un forfait TV sélectionné ("${existingTvBundle.name_fr}"). Un seul forfait TV/bundle est permis par adresse.`,
        blockedBy: service,
      };
    }
  }

  // Rule 4: Can't have multiple standalone Internet plans
  if (offer.category === "internet" && offer.offer_type !== "bundle") {
    const existingInternet = selectedOffers.find(selected => {
      return selected.category === "internet" && selected.offer_type !== "bundle";
    });

    if (existingInternet) {
      const service = selectedServices.find(s => s.offerId === existingInternet.id);
      return {
        isCompatible: false,
        reason: `Vous avez déjà un plan Internet sélectionné ("${existingInternet.name_fr}"). Un seul plan Internet est permis par adresse.`,
        blockedBy: service,
      };
    }
  }

  return { isCompatible: true };
}

// Get compatibility status for UI display
export function getOfferCompatibilityStatus(
  offer: FieldSalesOffer,
  selectedServices: SelectedService[],
  allOffers: FieldSalesOffer[]
): {
  canSelect: boolean;
  isSelected: boolean;
  incompatibleReason?: string;
} {
  const isSelected = selectedServices.some(s => s.offerId === offer.id);
  
  if (isSelected) {
    return { canSelect: true, isSelected: true };
  }

  const compatibility = checkServiceCompatibility(offer, selectedServices, allOffers);
  
  return {
    canSelect: compatibility.isCompatible,
    isSelected: false,
    incompatibleReason: compatibility.reason,
  };
}
