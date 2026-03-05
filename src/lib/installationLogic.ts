/**
 * Installation Decision Logic
 * Determines installation type, technician level, and available slots
 * based on geographic zone and cabling questionnaire answers.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type CablingAnswer = "yes" | "no" | "unknown";

export interface CablingQuestionnaire {
  hasCoaxial: CablingAnswer;
  cableStatus: CablingAnswer; // 'yes' = connected, 'no' = cut, 'unknown'
  previousService: CablingAnswer;
}

export type InstallationZone = "zone_a" | "zone_b" | "zone_c";
export type TechnicianLevel = "level_1" | "level_2";

export interface InstallationDecision {
  zone: InstallationZone;
  installationType: "auto" | "technician";
  technicianLevel: TechnicianLevel;
  /** Minimum days from today before first available slot */
  minLeadDays: number;
  /** Maximum days ahead to show slots */
  maxLeadDays: number;
  /** Whether same-day is possible (if >4h remain in working day) */
  sameDayPossible: boolean;
  /** User-facing message key */
  messageKey: "rapid" | "uncertain" | "heavy_work" | "remote_auto" | "remote_tech";
}

// ── Montreal reference point ───────────────────────────────────────────

const MONTREAL_LAT = 45.5017;
const MONTREAL_LNG = -73.5673;

/**
 * Haversine distance in km between two lat/lng points.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate distance from Montreal.
 */
export function distanceFromMontreal(lat: number, lng: number): number {
  return haversineDistance(MONTREAL_LAT, MONTREAL_LNG, lat, lng);
}

// ── Decision engine ────────────────────────────────────────────────────

export function determineInstallation(
  distanceKm: number,
  questionnaire: CablingQuestionnaire
): InstallationDecision {
  const { hasCoaxial, cableStatus, previousService } = questionnaire;

  // ── Zone C — Region éloignée (>70 km) ──
  if (distanceKm > 70) {
    // Default to auto-installation for remote areas
    return {
      zone: "zone_c",
      installationType: "auto",
      technicianLevel: "level_2",
      minLeadDays: 3,
      maxLeadDays: 14,
      sameDayPossible: false,
      messageKey: "remote_auto",
    };
  }

  // ── Grand Montréal (≤70 km) ──

  // Case 1 — Rapid install: coaxial present + connected + previous service
  if (
    hasCoaxial === "yes" &&
    cableStatus === "yes" &&
    previousService === "yes"
  ) {
    return {
      zone: "zone_a",
      installationType: "technician",
      technicianLevel: "level_1",
      minLeadDays: 0, // same-day possible
      maxLeadDays: 7,
      sameDayPossible: true,
      messageKey: "rapid",
    };
  }

  // Case 2 — Uncertain: user doesn't know about coaxial
  if (hasCoaxial === "unknown" || cableStatus === "unknown") {
    return {
      zone: "zone_a",
      installationType: "technician",
      technicianLevel: "level_1",
      minLeadDays: 1,
      maxLeadDays: 7,
      sameDayPossible: false,
      messageKey: "uncertain",
    };
  }

  // Case 3 — Cable absent or cut → heavy work
  if (hasCoaxial === "no" || cableStatus === "no") {
    return {
      zone: "zone_b",
      installationType: "technician",
      technicianLevel: "level_2",
      minLeadDays: 3,
      maxLeadDays: 14,
      sameDayPossible: false,
      messageKey: "heavy_work",
    };
  }

  // Fallback: coaxial present but cable connected + no previous service
  // Still level 1 but not same-day
  return {
    zone: "zone_a",
    installationType: "technician",
    technicianLevel: "level_1",
    minLeadDays: 1,
    maxLeadDays: 7,
    sameDayPossible: false,
    messageKey: "uncertain",
  };
}

/**
 * Check if same-day appointment is still possible (>4h remaining in work day).
 */
export function isSameDayStillAvailable(): boolean {
  const now = new Date();
  const cutoffHour = 16; // Must book before 4 PM for same-day
  return now.getHours() < cutoffHour;
}

/**
 * Messages for each decision case (FR/EN).
 */
export const INSTALLATION_MESSAGES: Record<
  InstallationDecision["messageKey"],
  { fr: { title: string; description: string }; en: { title: string; description: string } }
> = {
  rapid: {
    fr: {
      title: "🎉 Bonne nouvelle !",
      description: "Votre adresse permet une installation rapide. Un technicien de niveau 1 peut intervenir dès aujourd'hui ou demain.",
    },
    en: {
      title: "🎉 Great news!",
      description: "Your address qualifies for a fast installation. A level 1 technician can come as early as today or tomorrow.",
    },
  },
  uncertain: {
    fr: {
      title: "🔍 Vérification nécessaire",
      description: "Nous devons vérifier l'état du câblage à votre adresse. Un technicien interviendra sous 1 à 2 jours.",
    },
    en: {
      title: "🔍 Verification needed",
      description: "We need to verify the cabling at your address. A technician will visit within 1-2 days.",
    },
  },
  heavy_work: {
    fr: {
      title: "🔧 Travaux techniques requis",
      description: "Une intervention technique est nécessaire pour votre adresse. Un technicien spécialisé (niveau 2) interviendra sous 3 à 5 jours ouvrables.",
    },
    en: {
      title: "🔧 Technical work required",
      description: "Technical work is needed at your address. A specialized technician (level 2) will visit within 3-5 business days.",
    },
  },
  remote_auto: {
    fr: {
      title: "📦 Auto-installation disponible",
      description: "Votre adresse est en région éloignée. Nous vous enverrons l'équipement avec les instructions d'installation.",
    },
    en: {
      title: "📦 Self-installation available",
      description: "Your address is in a remote area. We'll ship the equipment with installation instructions.",
    },
  },
  remote_tech: {
    fr: {
      title: "🔧 Technicien en région",
      description: "Un technicien spécialisé se déplacera dans votre région sous 3 à 5 jours ouvrables.",
    },
    en: {
      title: "🔧 Regional technician",
      description: "A specialized technician will travel to your region within 3-5 business days.",
    },
  },
};
