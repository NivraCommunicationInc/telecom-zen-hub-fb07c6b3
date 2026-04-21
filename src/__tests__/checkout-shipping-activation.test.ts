/**
 * Phase 2 — Unit tests for shipping + activation validation helpers.
 * Covers the matrix requested by the user:
 *  - service address = shipping address (default, no validation triggered)
 *  - alternative shipping enabled (validation enforced field-by-field)
 *  - activation ASAP (no date required)
 *  - activation SCHEDULED with min/max bounds
 *  - installation details persistence shape
 */
import { describe, it, expect } from "vitest";
import {
  validateShipping,
  validateActivation,
  getMinActivationDate,
  getMaxActivationDate,
  DEFAULT_SHIPPING,
  DEFAULT_ACTIVATION,
  DEFAULT_INSTALLATION_DETAILS,
  type ShippingAddressData,
  type ActivationData,
} from "@/components/checkout/CheckoutShippingAndActivation";

const validShipping: ShippingAddressData = {
  shipToDifferentAddress: true,
  shippingFirstName: "Jean",
  shippingLastName: "Tremblay",
  shippingAddressLine: "123 Rue Saint-Laurent",
  shippingApartment: "",
  shippingCity: "Montréal",
  shippingProvince: "QC",
  shippingPostalCode: "H2X 1Y4",
  shippingInstructions: "",
};

describe("validateShipping", () => {
  it("returns null when shipping to same address (default)", () => {
    expect(validateShipping(DEFAULT_SHIPPING)).toBeNull();
  });

  it("returns null for a fully-filled valid alternate shipping address", () => {
    expect(validateShipping(validShipping)).toBeNull();
  });

  it("requires first name", () => {
    expect(validateShipping({ ...validShipping, shippingFirstName: "" })).toBe("Prénom requis");
  });

  it("requires last name", () => {
    expect(validateShipping({ ...validShipping, shippingLastName: "" })).toBe("Nom requis");
  });

  it("requires street address", () => {
    expect(validateShipping({ ...validShipping, shippingAddressLine: "  " })).toBe("Adresse requise");
  });

  it("requires city", () => {
    expect(validateShipping({ ...validShipping, shippingCity: "" })).toBe("Ville requise");
  });

  it("rejects invalid Canadian postal codes", () => {
    expect(validateShipping({ ...validShipping, shippingPostalCode: "12345" })).toBe("Code postal invalide");
  });

  it("accepts valid Canadian postal codes (with or without space)", () => {
    expect(validateShipping({ ...validShipping, shippingPostalCode: "H2X1Y4" })).toBeNull();
    expect(validateShipping({ ...validShipping, shippingPostalCode: "H2X 1Y4" })).toBeNull();
  });
});

describe("validateActivation", () => {
  it("returns null for ASAP regardless of date", () => {
    expect(validateActivation(DEFAULT_ACTIVATION)).toBeNull();
    expect(
      validateActivation({ activationPreference: "ASAP", requestedActivationDate: new Date() }),
    ).toBeNull();
  });

  it("requires a date when SCHEDULED", () => {
    expect(
      validateActivation({ activationPreference: "SCHEDULED", requestedActivationDate: null }),
    ).toBe("Date d'activation requise");
  });

  it("rejects dates before the minimum (today + 3 days)", () => {
    const tooEarly = new Date();
    tooEarly.setDate(tooEarly.getDate() + 1);
    const result = validateActivation({
      activationPreference: "SCHEDULED",
      requestedActivationDate: tooEarly,
    });
    expect(result).toMatch(/minimum/);
  });

  it("rejects dates beyond the maximum (today + 30 days)", () => {
    const tooFar = new Date();
    tooFar.setDate(tooFar.getDate() + 60);
    const result = validateActivation({
      activationPreference: "SCHEDULED",
      requestedActivationDate: tooFar,
    });
    expect(result).toMatch(/maximum/);
  });

  it("accepts a date inside the [min, max] window", () => {
    const ok = new Date();
    ok.setDate(ok.getDate() + 10);
    expect(
      validateActivation({ activationPreference: "SCHEDULED", requestedActivationDate: ok }),
    ).toBeNull();
  });

  it("min boundary is exactly today + 3 days", () => {
    const min = getMinActivationDate();
    const expectedDay = new Date();
    expectedDay.setDate(expectedDay.getDate() + 3);
    expect(min.getDate()).toBe(expectedDay.getDate());
  });

  it("max boundary is exactly today + 30 days", () => {
    const max = getMaxActivationDate();
    const expectedDay = new Date();
    expectedDay.setDate(expectedDay.getDate() + 30);
    expect(max.getDate()).toBe(expectedDay.getDate());
  });
});

describe("backward compatibility / persistence shape", () => {
  it("DEFAULT_SHIPPING preserves legacy behavior (no shipping fields enforced)", () => {
    const a: ActivationData = DEFAULT_ACTIVATION;
    expect(DEFAULT_SHIPPING.shipToDifferentAddress).toBe(false);
    expect(a.activationPreference).toBe("ASAP");
    expect(a.requestedActivationDate).toBeNull();
  });

  it("installation details default to empty (optional fields)", () => {
    expect(DEFAULT_INSTALLATION_DETAILS.coaxAvailable).toBe("");
    expect(DEFAULT_INSTALLATION_DETAILS.occupancyStatus).toBe("");
    expect(DEFAULT_INSTALLATION_DETAILS.accessNotes).toBe("");
  });

  it("a historical order (no Phase 2 fields) maps cleanly to defaults", () => {
    // Simulates an order created before the migration: nothing to validate.
    expect(validateShipping(DEFAULT_SHIPPING)).toBeNull();
    expect(validateActivation(DEFAULT_ACTIVATION)).toBeNull();
  });
});
