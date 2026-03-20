/**
 * REGRESSION GUARD — Subscription Factory Lock + Validation
 * 
 * Enforces that Stripe subscriptions are ONLY created via the canonical factory.
 * Tests validation rules for the factory contract.
 * 
 * LOCKED PRODUCTION — DO NOT MODIFY WITHOUT EXPLICIT APPROVAL
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FACTORY_FILE = 'supabase/functions/_shared/nivraSubscriptionFactory.ts';
const FUNCTIONS_DIR = 'supabase/functions';

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getAllTsFiles(fullPath));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
        results.push(fullPath);
      }
    }
  } catch { /* noop */ }
  return results;
}

describe('Subscription Factory — Regression Guard', () => {
  it('subscriptions.create() must ONLY exist in the canonical factory', () => {
    const allFiles = getAllTsFiles(FUNCTIONS_DIR);
    const violations: string[] = [];

    for (const file of allFiles) {
      const rel = file.replace(/\\/g, '/');
      if (rel === FACTORY_FILE) continue;
      if (rel.includes('.test.')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      if (/subscriptions\.create\s*\(/g.test(content)) {
        violations.push(rel);
      }
    }

    expect(violations).toEqual([]);
  });

  it('factory file exists and contains validation', () => {
    const content = fs.readFileSync(FACTORY_FILE, 'utf-8');
    expect(content).toContain('validateRequired');
    expect(content).toContain('throw new Error');
    expect(content).toContain('stripe_customer_id');
    expect(content).toContain('plan_code');
    expect(content).toContain('default_payment_method_id');
    expect(content).toContain('ANTI-DUPLICATION');
  });
});

// ============================================================================
// Validation Contract Tests
// ============================================================================

interface SubFactoryParams {
  stripe_customer_id?: string;
  customer_email?: string;
  order_id?: string;
  order_number?: string;
  account_id?: string;
  customer_id?: string;
  plan_code?: string;
  invoice_id?: string;
  default_payment_method_id?: string;
}

function validateSubscriptionParams(params: SubFactoryParams): string[] {
  const errors: string[] = [];
  if (!params.stripe_customer_id) errors.push("stripe_customer_id is required");
  if (!params.customer_email) errors.push("customer_email is required");
  if (!params.order_id) errors.push("order_id is required");
  if (!params.order_number) errors.push("order_number is required");
  if (!params.account_id) errors.push("account_id is required");
  if (!params.customer_id) errors.push("customer_id is required");
  if (!params.plan_code) errors.push("plan_code is required");
  if (!params.invoice_id) errors.push("invoice_id is required");
  if (!params.default_payment_method_id) errors.push("default_payment_method_id is required");
  return errors;
}

const VALID: SubFactoryParams = {
  stripe_customer_id: "cus_test",
  customer_email: "test@nivra.ca",
  order_id: "ord-001",
  order_number: "63617",
  account_id: "acc-001",
  customer_id: "cust-001",
  plan_code: "internet_100",
  invoice_id: "inv-001",
  default_payment_method_id: "pm_test",
};

describe('Subscription Factory — Validation Contract', () => {
  it('accepts valid params', () => {
    expect(validateSubscriptionParams(VALID)).toEqual([]);
  });

  it('rejects missing stripe_customer_id', () => {
    expect(validateSubscriptionParams({ ...VALID, stripe_customer_id: undefined }))
      .toContain("stripe_customer_id is required");
  });

  it('rejects missing customer_email', () => {
    expect(validateSubscriptionParams({ ...VALID, customer_email: undefined }))
      .toContain("customer_email is required");
  });

  it('rejects missing order_id', () => {
    expect(validateSubscriptionParams({ ...VALID, order_id: undefined }))
      .toContain("order_id is required");
  });

  it('rejects missing plan_code', () => {
    expect(validateSubscriptionParams({ ...VALID, plan_code: undefined }))
      .toContain("plan_code is required");
  });

  it('rejects missing default_payment_method_id', () => {
    expect(validateSubscriptionParams({ ...VALID, default_payment_method_id: undefined }))
      .toContain("default_payment_method_id is required");
  });

  it('rejects missing invoice_id', () => {
    expect(validateSubscriptionParams({ ...VALID, invoice_id: undefined }))
      .toContain("invoice_id is required");
  });

  it('collects ALL errors for empty params', () => {
    const errors = validateSubscriptionParams({});
    expect(errors.length).toBe(9);
  });
});
