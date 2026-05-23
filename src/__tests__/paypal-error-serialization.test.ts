/**
 * ═══════════════════════════════════════════════════════════════════
 * REGRESSION SUITE: PayPal error serialization
 * ═══════════════════════════════════════════════════════════════════
 *
 * The edge function `paypal-create-subscription` previously stored
 * "[object Object]" in `paypal_autopay_attempts.error_message` whenever
 * an upstream caller threw a raw object (e.g. Supabase PostgrestError) —
 * making every failed autopay attempt impossible to debug.
 *
 * The fix introduces a robust serializeError() that NEVER produces
 * "[object Object]" as the final message. This test reproduces the
 * function locally (Deno code is duplicated here for testability) and
 * locks the contract.
 *
 * If this test fails, autopay debugging will go dark again — DO NOT
 * weaken the assertions without rolling out an alternative observability
 * path first.
 */
import { describe, it, expect } from "vitest";

// Mirror of the production helper in
// supabase/functions/paypal-create-subscription/index.ts
function serializeError(err: unknown): { msg: string; payload: Record<string, unknown> } {
  if (err == null) return { msg: "Unknown error (null)", payload: {} };
  if (typeof err === "string") return { msg: err, payload: { raw: err } };

  const errObj = err as Record<string, unknown>;
  const errAsError = err as Error;
  const hasUsefulMessage =
    typeof errAsError?.message === "string" &&
    errAsError.message.length > 0 &&
    errAsError.message !== "[object Object]";

  const payload: Record<string, unknown> = {};
  for (const key of ["message", "code", "details", "hint", "status", "statusCode", "name", "cause"]) {
    const v = errObj[key];
    if (v != null) payload[key] = v;
  }
  if (errAsError?.stack) {
    payload.stack = errAsError.stack.split("\n").slice(0, 6).join("\n");
  }

  let msg: string;
  if (hasUsefulMessage) {
    msg = errAsError.message;
  } else {
    try {
      msg = JSON.stringify(payload);
    } catch {
      msg =
        Object.entries(payload)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(" | ") || "Unhandled error";
    }
  }
  return { msg, payload };
}

describe("PayPal autopay error serialization", () => {
  it("never returns the bare literal '[object Object]'", () => {
    // The classic regression: someone throws `new Error(obj)` where obj is a
    // plain object. Without the fix, JS implicitly does obj.toString() →
    // "[object Object]" and that landed verbatim in the DB.
    const e = new Error({ message: "real error", code: 42 } as unknown as string);
    const { msg } = serializeError(e);
    expect(msg).not.toBe("[object Object]");
  });

  it("extracts message from a standard Error", () => {
    const e = new Error("plan price invalid");
    const { msg, payload } = serializeError(e);
    expect(msg).toBe("plan price invalid");
    expect(payload.message).toBe("plan price invalid");
  });

  it("extracts message + code from a Supabase PostgrestError-shaped object", () => {
    // Supabase errors are plain objects with these fields. Without the fix,
    // throwing one of these bare caused "[object Object]" downstream.
    const supabaseError = {
      message: "duplicate key value violates unique constraint",
      code: "23505",
      details: "Key (email)=(test@example.com) already exists.",
      hint: null,
    };
    const { msg, payload } = serializeError(supabaseError);
    expect(msg).toContain("duplicate key value");
    expect(payload.code).toBe("23505");
    expect(payload.details).toContain("already exists");
  });

  it("handles a string thrown directly", () => {
    const { msg } = serializeError("boom");
    expect(msg).toBe("boom");
  });

  it("handles null gracefully", () => {
    const { msg } = serializeError(null);
    expect(msg).toBe("Unknown error (null)");
  });

  it("handles undefined gracefully", () => {
    const { msg } = serializeError(undefined);
    expect(msg).toBe("Unknown error (null)");
  });

  it("captures stack trace (truncated) when available", () => {
    const e = new Error("with stack");
    const { payload } = serializeError(e);
    // Stack might be undefined in some test environments — only assert
    // shape when present.
    if (payload.stack) {
      expect(typeof payload.stack).toBe("string");
      // Truncated to ≤6 lines per the helper contract
      expect((payload.stack as string).split("\n").length).toBeLessThanOrEqual(6);
    }
  });

  it("handles circular objects without throwing", () => {
    const circular: Record<string, unknown> = { message: "circular" };
    circular.self = circular;
    // Must not throw — payload may degrade but the function returns a string.
    const { msg } = serializeError(circular);
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
    expect(msg).not.toBe("[object Object]");
  });
});
