/**
 * Installation Decision Logic
 * Determines installation type, technician level, and available slots
 * based on geographic zone and cabling questionnaire answers.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type CablingAnswer = "yes" | "no" | "unknown";

export interface CablingQuestionnaire {
  hasCoaxial: CablingAnswer;
  cableStatus: CablingAnswer; // 'yes' = present/connected, 'no' = absent/cut, 'unknown'
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
  /** Whether same-day is possible (if ≥4h remain in working day) */
  sameDayPossible: boolean;
  /** User-facing message key */
  messageKey: "rapid" | "uncertain" | "heavy_work" | "remote_auto" | "remote_tech";
  /** Readiness score 0-100 for internal tracking */
  readinessScore: number;
  /** Whether a fallback auto-install validation ticket should be created */
  needsFallbackTicket: boolean;
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

// ── Readiness score ────────────────────────────────────────────────────

/**
 * Calculate a readiness score (0-100) based on questionnaire answers.
 * Higher score = more likely infrastructure is ready for quick install.
 */
export function calculateReadinessScore(q: CablingQuestionnaire): number {
  let score = 0;

  // Coaxial present: 40 pts
  if (q.hasCoaxial === "yes") score += 40;
  else if (q.hasCoaxial === "unknown") score += 15;
  // "no" = 0

  // Cable intact/present: 30 pts
  if (q.cableStatus === "yes") score += 30;
  else if (q.cableStatus === "unknown") score += 10;
  // "no" = 0

  // Previous service: 30 pts
  if (q.previousService === "yes") score += 30;
  else if (q.previousService === "unknown") score += 10;
  // "no" = 0

  return score;
}

// ── Decision engine ────────────────────────────────────────────────────

export function determineInstallation(
  distanceKm: number,
  questionnaire: CablingQuestionnaire
): InstallationDecision {
  const { hasCoaxial, cableStatus, previousService } = questionnaire;
  const readinessScore = calculateReadinessScore(questionnaire);

  // ── Zone C — Région éloignée (>70 km) ──
  if (distanceKm > 70) {
    // If coax absent/cut/uncertain → auto-install with fallback ticket
    const cableProblem = hasCoaxial === "no" || cableStatus === "no" || hasCoaxial === "unknown";

    return {
      zone: "zone_c",
      installationType: "auto",
      technicianLevel: "level_2",
      minLeadDays: 3,
      maxLeadDays: 14,
      sameDayPossible: false,
      messageKey: "remote_auto",
      readinessScore,
      needsFallbackTicket: true, // Always create fallback for auto-install
    };
  }

  // ── Zone A — Grand Montréal (≤70 km) ──

  // Case 1 — Rapid install: coaxial present + cable intact + previous service
  if (
    hasCoaxial === "yes" &&
    cableStatus === "yes" &&
    previousService === "yes"
  ) {
    return {
      zone: "zone_a",
      installationType: "technician",
      technicianLevel: "level_1",
      minLeadDays: 0,
      maxLeadDays: 7,
      sameDayPossible: true,
      messageKey: "rapid",
      readinessScore,
      needsFallbackTicket: false,
    };
  }

  // Case 2 — Coaxial present + cable intact but NO previous service
  // Still Level 1, but not same-day (slightly uncertain)
  if (hasCoaxial === "yes" && cableStatus === "yes" && previousService !== "yes") {
    return {
      zone: "zone_a",
      installationType: "technician",
      technicianLevel: "level_1",
      minLeadDays: 1,
      maxLeadDays: 7,
      sameDayPossible: false,
      messageKey: "uncertain",
      readinessScore,
      needsFallbackTicket: false,
    };
  }

  // Case 3 — Uncertain: user doesn't know about coaxial or cable status
  if (hasCoaxial === "unknown" || cableStatus === "unknown") {
    return {
      zone: "zone_a",
      installationType: "technician",
      technicianLevel: "level_1",
      minLeadDays: 1,
      maxLeadDays: 7,
      sameDayPossible: false,
      messageKey: "uncertain",
      readinessScore,
      needsFallbackTicket: false,
    };
  }

  // Case 4 — Cable absent or cut → heavy work (Level 2)
  if (hasCoaxial === "no" || cableStatus === "no") {
    return {
      zone: "zone_b",
      installationType: "technician",
      technicianLevel: "level_2",
      minLeadDays: 3,
      maxLeadDays: 14,
      sameDayPossible: false,
      messageKey: "heavy_work",
      readinessScore,
      needsFallbackTicket: false,
    };
  }

  // Fallback → Level 1, 1-2 days
  return {
    zone: "zone_a",
    installationType: "technician",
    technicianLevel: "level_1",
    minLeadDays: 1,
    maxLeadDays: 7,
    sameDayPossible: false,
    messageKey: "uncertain",
    readinessScore,
    needsFallbackTicket: false,
  };
}

/**
 * Check if same-day appointment is still possible (≥4h remaining in work day).
 */
export function isSameDayStillAvailable(): boolean {
  const now = new Date();
  const cutoffHour = 16; // Must book before 4 PM for same-day
  return now.getHours() < cutoffHour;
}

/**
 * Messages for each decision case (FR/EN).
 * Professional, neutral — no third-party brand mentions.
 */
export const INSTALLATION_MESSAGES: Record<
  InstallationDecision["messageKey"],
  { fr: { title: string; description: string }; en: { title: string; description: string } }
> = {
  rapid: {
    fr: {
      title: "Installation rapide disponible",
      description: "Si une prise câble (coaxiale) est déjà présente et en bon état, un technicien peut activer votre service rapidement.",
    },
    en: {
      title: "Fast installation available",
      description: "If a cable (coaxial) outlet is already present and in good condition, a technician can activate your service quickly.",
    },
  },
  uncertain: {
    fr: {
      title: "Vérification nécessaire",
      description: "Un technicien effectuera une validation sur place pour vérifier l'état du câblage à votre adresse. Délai estimé : 1 à 2 jours.",
    },
    en: {
      title: "Verification needed",
      description: "A technician will perform an on-site validation to verify the cabling at your address. Estimated delay: 1-2 days.",
    },
  },
  heavy_work: {
    fr: {
      title: "Intervention technique requise",
      description: "Un technicien spécialisé devra effectuer une vérification ou un ajustement de câblage. Délai estimé : 3 à 5 jours ouvrables.",
    },
    en: {
      title: "Technical work required",
      description: "A specialized technician will need to verify or adjust the cabling. Estimated delay: 3-5 business days.",
    },
  },
  remote_auto: {
    fr: {
      title: "Auto-installation disponible",
      description: "Nous vous envoyons l'équipement et les instructions. Si l'activation ne fonctionne pas, une visite technique pourra être planifiée.",
    },
    en: {
      title: "Self-installation available",
      description: "We'll ship the equipment and instructions. If activation doesn't work, a technician visit can be scheduled.",
    },
  },
  remote_tech: {
    fr: {
      title: "Technicien en région",
      description: "Un technicien spécialisé se déplacera dans votre région sous 3 à 5 jours ouvrables.",
    },
    en: {
      title: "Regional technician",
      description: "A specialized technician will travel to your region within 3-5 business days.",
    },
  },
};
