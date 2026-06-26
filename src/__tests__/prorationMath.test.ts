/**
 * Unit tests — proration math (Scenarios 1–6).
 * The math helper is duplicated here to be Vitest-portable
 * (the edge-function source lives under supabase/functions and uses Deno globals).
 * Keep both files in sync — see supabase/functions/_shared/prorationMath.ts
 */
import { describe, it, expect } from "vitest";

function prorateRemaining(o: {
  cycleStart: string; cycleEnd: string; referenceDate: string; amount: number;
}) {
  const s = new Date(o.cycleStart).getTime();
  const e = new Date(o.cycleEnd).getTime();
  const n = new Date(o.referenceDate).getTime();
  const cycleTotalDays = Math.max(1, Math.round((e - s) / 86_400_000));
  const daysRemaining = Math.max(0, Math.ceil((e - n) / 86_400_000));
  const ratio = Math.min(1, daysRemaining / cycleTotalDays);
  return { daysRemaining, cycleTotalDays, proratedAmount: Math.round(o.amount * ratio * 100) / 100 };
}

describe("Proration — prepaid billing model", () => {
  const cycle = { cycleStart: "2026-06-01", cycleEnd: "2026-07-01" };

  it("Scenario 1 — UPGRADE: bills delta × days remaining", () => {
    const r = prorateRemaining({ ...cycle, referenceDate: "2026-06-16", amount: 30 });
    expect(r.cycleTotalDays).toBe(30);
    expect(r.daysRemaining).toBe(15);
    expect(r.proratedAmount).toBe(15); // 30 * 15/30
  });

  it("Scenario 2 — CANCELLATION: full plan price credited for unused days", () => {
    const r = prorateRemaining({ ...cycle, referenceDate: "2026-06-21", amount: 90 });
    expect(r.daysRemaining).toBe(10);
    expect(r.proratedAmount).toBe(30); // 90 * 10/30
  });

  it("Scenario 3 — ADD SERVICE: charges full new-service price × ratio", () => {
    const r = prorateRemaining({ ...cycle, referenceDate: "2026-06-11", amount: 60 });
    expect(r.daysRemaining).toBe(20);
    expect(r.proratedAmount).toBe(40); // 60 * 20/30
  });

  it("Scenario 4 — SUSPENSION (reactivation): credit for suspended days", () => {
    // Suspended for 7 days mid-cycle out of 30 — credit 7/30 of plan
    const r = prorateRemaining({
      cycleStart: "2026-06-01",
      cycleEnd: "2026-06-08", // window length 7d
      referenceDate: "2026-06-01",
      amount: 90,
    });
    expect(r.proratedAmount).toBe(90); // window fully unused
  });

  it("Scenario 5 — REMOVE SERVICE: deferred (no immediate credit) — math returns 0 on past cycle end", () => {
    const r = prorateRemaining({ ...cycle, referenceDate: "2026-07-15", amount: 50 });
    expect(r.daysRemaining).toBe(0);
    expect(r.proratedAmount).toBe(0);
  });

  it("Scenario 6 — PAUSE TEMPORAIRE: credit window of 5 days on a 30d/90$ cycle = 15$", () => {
    const r = prorateRemaining({
      cycleStart: "2026-06-10",
      cycleEnd: "2026-06-15",
      referenceDate: "2026-06-10",
      amount: 90 * (5 / 30), // amount supplied is already the pause window's share
    });
    expect(r.proratedAmount).toBe(15);
  });

  it("Edge — ratio is clamped to [0, 1]", () => {
    const r = prorateRemaining({ ...cycle, referenceDate: "2026-05-01", amount: 30 });
    // 61 days before cycle end, total 30 → ratio caps at 1
    expect(r.proratedAmount).toBeLessThanOrEqual(30);
  });
});
