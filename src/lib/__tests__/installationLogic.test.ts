import { describe, it, expect } from "vitest";
import {
  isRiskyCoax,
  calculateReadinessScore,
  determineInstallation,
  isSameDayStillAvailable,
  type CablingQuestionnaire,
} from "../installationLogic";

// ── isRiskyCoax ────────────────────────────────────────────────────────

describe("isRiskyCoax", () => {
  it("returns false when coax present + cable intact + recent service", () => {
    expect(isRiskyCoax({ hasCoaxial: "yes", cableStatus: "yes", previousService: "yes" })).toBe(false);
  });

  it("returns true when coax present but cable absent", () => {
    expect(isRiskyCoax({ hasCoaxial: "yes", cableStatus: "no", previousService: "yes" })).toBe(true);
  });

  it("returns true when coax present but cable unknown", () => {
    expect(isRiskyCoax({ hasCoaxial: "yes", cableStatus: "unknown", previousService: "yes" })).toBe(true);
  });

  it("returns true when coax present + cable ok but no recent service", () => {
    expect(isRiskyCoax({ hasCoaxial: "yes", cableStatus: "yes", previousService: "no" })).toBe(true);
  });

  it("returns true when coax present + cable ok but service unknown", () => {
    expect(isRiskyCoax({ hasCoaxial: "yes", cableStatus: "yes", previousService: "unknown" })).toBe(true);
  });

  it("returns true when coax is unknown", () => {
    expect(isRiskyCoax({ hasCoaxial: "unknown", cableStatus: "yes", previousService: "yes" })).toBe(true);
  });

  it("returns false when coax is absent (confirmed bad → Level 2, not risky)", () => {
    expect(isRiskyCoax({ hasCoaxial: "no", cableStatus: "no", previousService: "no" })).toBe(false);
  });
});

// ── calculateReadinessScore ────────────────────────────────────────────

describe("calculateReadinessScore", () => {
  it("returns 100 for all-yes answers", () => {
    expect(calculateReadinessScore({ hasCoaxial: "yes", cableStatus: "yes", previousService: "yes" })).toBe(100);
  });

  it("returns 0 for all-no answers", () => {
    expect(calculateReadinessScore({ hasCoaxial: "no", cableStatus: "no", previousService: "no" })).toBe(0);
  });

  it("returns 35 for all-unknown answers", () => {
    expect(calculateReadinessScore({ hasCoaxial: "unknown", cableStatus: "unknown", previousService: "unknown" })).toBe(35);
  });

  it("returns 70 for coax yes + cable yes + service no", () => {
    expect(calculateReadinessScore({ hasCoaxial: "yes", cableStatus: "yes", previousService: "no" })).toBe(70);
  });
});

// ── determineInstallation — Zone A routing ─────────────────────────────

describe("determineInstallation — Zone A (≤70km)", () => {
  const ZONE_A_DISTANCE = 30;

  it("rapid install: coax OK + cable OK + recent service → N1 same-day", () => {
    const q: CablingQuestionnaire = { hasCoaxial: "yes", cableStatus: "yes", previousService: "yes" };
    const d = determineInstallation(ZONE_A_DISTANCE, q);
    expect(d.zone).toBe("zone_a");
    expect(d.technicianLevel).toBe("level_1");
    expect(d.sameDayPossible).toBe(true);
    expect(d.messageKey).toBe("rapid");
    expect(d.riskyCoax).toBe(false);
  });

  it("risky coax: coax OK but cable unknown → N1, no same-day, 1-2 days", () => {
    const q: CablingQuestionnaire = { hasCoaxial: "yes", cableStatus: "unknown", previousService: "yes" };
    const d = determineInstallation(ZONE_A_DISTANCE, q);
    expect(d.technicianLevel).toBe("level_1");
    expect(d.sameDayPossible).toBe(false);
    expect(d.minLeadDays).toBe(1);
    expect(d.riskyCoax).toBe(true);
    expect(d.messageKey).toBe("uncertain");
  });

  it("risky coax: coax OK + cable OK but no recent service → N1, no same-day", () => {
    const q: CablingQuestionnaire = { hasCoaxial: "yes", cableStatus: "yes", previousService: "no" };
    const d = determineInstallation(ZONE_A_DISTANCE, q);
    expect(d.technicianLevel).toBe("level_1");
    expect(d.sameDayPossible).toBe(false);
    expect(d.riskyCoax).toBe(true);
  });

  it("coax unknown → N1, no same-day, risky", () => {
    const q: CablingQuestionnaire = { hasCoaxial: "unknown", cableStatus: "unknown", previousService: "unknown" };
    const d = determineInstallation(ZONE_A_DISTANCE, q);
    expect(d.technicianLevel).toBe("level_1");
    expect(d.sameDayPossible).toBe(false);
    expect(d.riskyCoax).toBe(true);
  });

  it("coax absent → N2, 3-5 days", () => {
    const q: CablingQuestionnaire = { hasCoaxial: "no", cableStatus: "no", previousService: "no" };
    const d = determineInstallation(ZONE_A_DISTANCE, q);
    expect(d.zone).toBe("zone_b");
    expect(d.technicianLevel).toBe("level_2");
    expect(d.minLeadDays).toBe(3);
    expect(d.messageKey).toBe("heavy_work");
  });

  it("coax present but cable cut → N2, 3-5 days", () => {
    const q: CablingQuestionnaire = { hasCoaxial: "no", cableStatus: "no", previousService: "yes" };
    const d = determineInstallation(ZONE_A_DISTANCE, q);
    expect(d.technicianLevel).toBe("level_2");
    expect(d.minLeadDays).toBe(3);
  });
});

// ── determineInstallation — Zone C routing ─────────────────────────────

describe("determineInstallation — Zone C (>70km)", () => {
  const ZONE_C_DISTANCE = 120;

  it("always returns auto-install with fallback ticket", () => {
    const q: CablingQuestionnaire = { hasCoaxial: "yes", cableStatus: "yes", previousService: "yes" };
    const d = determineInstallation(ZONE_C_DISTANCE, q);
    expect(d.zone).toBe("zone_c");
    expect(d.installationType).toBe("auto");
    expect(d.needsFallbackTicket).toBe(true);
    expect(d.messageKey).toBe("remote_auto");
  });

  it("returns risky flag when coax is uncertain", () => {
    const q: CablingQuestionnaire = { hasCoaxial: "unknown", cableStatus: "unknown", previousService: "no" };
    const d = determineInstallation(ZONE_C_DISTANCE, q);
    expect(d.riskyCoax).toBe(true);
    expect(d.needsFallbackTicket).toBe(true);
  });
});

// ── Guard: slots never shown before decision ───────────────────────────

describe("Guard: no slots without decision", () => {
  it("determineInstallation always returns a valid decision object", () => {
    const combos: CablingQuestionnaire[] = [
      { hasCoaxial: "yes", cableStatus: "yes", previousService: "yes" },
      { hasCoaxial: "yes", cableStatus: "no", previousService: "unknown" },
      { hasCoaxial: "no", cableStatus: "no", previousService: "no" },
      { hasCoaxial: "unknown", cableStatus: "unknown", previousService: "unknown" },
    ];
    for (const q of combos) {
      for (const dist of [10, 50, 80, 200]) {
        const d = determineInstallation(dist, q);
        expect(d).toBeDefined();
        expect(d.zone).toBeTruthy();
        expect(d.technicianLevel).toBeTruthy();
        expect(typeof d.minLeadDays).toBe("number");
        expect(typeof d.sameDayPossible).toBe("boolean");
        expect(typeof d.riskyCoax).toBe("boolean");
      }
    }
  });
});
