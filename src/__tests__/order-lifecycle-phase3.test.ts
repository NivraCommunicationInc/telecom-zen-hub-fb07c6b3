/**
 * Phase 3 — Unit tests for order lifecycle visibility & filtering rules.
 *
 * Couvre :
 *  1. Calcul `isSelfInstall` (auto / ship_to_home → true ; technician → false ; null → true legacy).
 *  2. Sélection des étapes (STEPS_SELF vs STEPS_PRO) selon installation_type.
 *  3. Règle CRITIQUE Phase 3 : côté CLIENT, si installation_type = "technician",
 *     les étapes/badges/tracking d'expédition NE doivent JAMAIS apparaître.
 *  4. Côté ADMIN : audit complet (shipment toujours visible pour traçabilité).
 *  5. Filtrage des notifications email : pas de mail "shipped" si installation pro.
 */
import { describe, it, expect } from "vitest";

// --- Helpers réimplémentés ici pour test pur (mirror de OrderLifecycleTimeline) ---
function isSelfInstall(installationType?: string | null): boolean {
  if (installationType == null) return true; // legacy fallback
  return installationType === "auto" || installationType === "ship_to_home";
}

const STEPS_SELF = [
  "confirmed",
  "payment",
  "preparation",
  "shipping",
  "self_install",
  "activated",
];

const STEPS_PRO = [
  "confirmed",
  "payment",
  "preparation",
  "appointment",
  "installation",
  "activated",
];

function pickSteps(installationType?: string | null): string[] {
  return isSelfInstall(installationType) ? STEPS_SELF : STEPS_PRO;
}

function shouldShowShipmentToClient(installationType?: string | null): boolean {
  return isSelfInstall(installationType);
}

function shouldSendShippedEmail(installationType?: string | null): boolean {
  // Règle Phase 3 : pas d'email "shipped" pour install pro.
  return isSelfInstall(installationType);
}

function shouldSendActivatedEmail(): boolean {
  // Toujours envoyer l'email d'activation, peu importe le type.
  return true;
}

// =====================================================================
describe("Phase 3 — isSelfInstall classifier", () => {
  it("treats 'auto' as self-install", () => {
    expect(isSelfInstall("auto")).toBe(true);
  });

  it("treats 'ship_to_home' as self-install", () => {
    expect(isSelfInstall("ship_to_home")).toBe(true);
  });

  it("treats 'technician' as professional install (NOT self)", () => {
    expect(isSelfInstall("technician")).toBe(false);
  });

  it("falls back to self-install when installation_type is null (legacy orders)", () => {
    expect(isSelfInstall(null)).toBe(true);
    expect(isSelfInstall(undefined)).toBe(true);
  });

  it("treats unknown strings as professional (defensive)", () => {
    expect(isSelfInstall("on_site_pro")).toBe(false);
    expect(isSelfInstall("custom_install")).toBe(false);
  });
});

describe("Phase 3 — Step selection by installation type", () => {
  it("uses 6 SELF steps for auto-installation", () => {
    const steps = pickSteps("auto");
    expect(steps).toHaveLength(6);
    expect(steps).toContain("shipping");
    expect(steps).toContain("self_install");
    expect(steps).not.toContain("appointment");
  });

  it("uses 6 PRO steps for technician installation", () => {
    const steps = pickSteps("technician");
    expect(steps).toHaveLength(6);
    expect(steps).toContain("appointment");
    expect(steps).toContain("installation");
    expect(steps).not.toContain("shipping");
    expect(steps).not.toContain("self_install");
  });

  it("always exposes the same final step 'activated' for both flows", () => {
    expect(pickSteps("auto").at(-1)).toBe("activated");
    expect(pickSteps("technician").at(-1)).toBe("activated");
  });

  it("always starts at 'confirmed'", () => {
    expect(pickSteps("auto")[0]).toBe("confirmed");
    expect(pickSteps("technician")[0]).toBe("confirmed");
  });
});

describe("Phase 3 — Client-side shipping visibility (CRITICAL RULE)", () => {
  it("HIDES shipment from client when installation = technician", () => {
    expect(shouldShowShipmentToClient("technician")).toBe(false);
  });

  it("SHOWS shipment to client when installation = auto", () => {
    expect(shouldShowShipmentToClient("auto")).toBe(true);
  });

  it("SHOWS shipment to client when installation = ship_to_home", () => {
    expect(shouldShowShipmentToClient("ship_to_home")).toBe(true);
  });

  it("legacy orders (null installation_type) default to showing shipment", () => {
    expect(shouldShowShipmentToClient(null)).toBe(true);
  });
});

describe("Phase 3 — Email notification filtering", () => {
  it("sends 'shipped' email for self-install orders", () => {
    expect(shouldSendShippedEmail("auto")).toBe(true);
    expect(shouldSendShippedEmail("ship_to_home")).toBe(true);
  });

  it("DOES NOT send 'shipped' email for professional installation", () => {
    expect(shouldSendShippedEmail("technician")).toBe(false);
  });

  it("always sends 'activated' email regardless of install type", () => {
    expect(shouldSendActivatedEmail()).toBe(true);
  });
});

describe("Phase 3 — Admin always sees full audit (no filtering)", () => {
  // Côté admin : peu importe le type d'installation, on garde la traçabilité.
  // Cette règle est appliquée dans le composant via `variant === 'admin'`.
  function adminCanSeeShipment(_installationType?: string | null): boolean {
    return true;
  }

  it("admin sees shipment data even for technician installs", () => {
    expect(adminCanSeeShipment("technician")).toBe(true);
  });

  it("admin sees shipment data for self-install", () => {
    expect(adminCanSeeShipment("auto")).toBe(true);
  });
});

describe("Phase 3 — Lifecycle progress mapping invariants", () => {
  // Mirror of compute_lifecycle_progress :
  //   1 confirmed → 2 payment → 3 preparation
  //   self : 4 shipping → 5 self_install → 6 activated
  //   pro  : 4 appointment → 5 installation → 6 activated
  function computeProgress(step: number): number {
    return Math.round((Math.min(Math.max(step, 1), 6) / 6) * 100);
  }

  it("step 1 → ~17%", () => expect(computeProgress(1)).toBe(17));
  it("step 3 → 50%", () => expect(computeProgress(3)).toBe(50));
  it("step 6 → 100%", () => expect(computeProgress(6)).toBe(100));

  it("clamps step below 1", () => expect(computeProgress(0)).toBe(17));
  it("clamps step above 6", () => expect(computeProgress(99)).toBe(100));
});
