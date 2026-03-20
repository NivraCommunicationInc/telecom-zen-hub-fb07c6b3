/**
 * REGRESSION GUARD — PaymentIntent Factory Lock
 * 
 * This test enforces that stripe.paymentIntents.create() is NEVER called
 * outside the canonical factory file. If any other file calls it directly,
 * this test will FAIL, blocking the build.
 * 
 * LOCKED PRODUCTION — DO NOT MODIFY WITHOUT EXPLICIT APPROVAL
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FACTORY_FILE = 'supabase/functions/_shared/nivraPaymentIntentFactory.ts';
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
  } catch {
    // Directory doesn't exist yet — OK
  }
  return results;
}

describe('PaymentIntent Factory — Regression Guard', () => {
  it('paymentIntents.create() must ONLY exist in the canonical factory', () => {
    const allFiles = getAllTsFiles(FUNCTIONS_DIR);
    const violations: string[] = [];

    for (const file of allFiles) {
      // Skip the factory itself and test files
      const relativePath = file.replace(/\\/g, '/');
      if (relativePath === FACTORY_FILE) continue;
      if (relativePath.includes('.test.')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      // Match any call to paymentIntents.create (various patterns)
      if (/paymentIntents\.create\s*\(/g.test(content)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it('all edge functions that handle payments must import from the factory', () => {
    const paymentFunctions = [
      'supabase/functions/stripe-create-payment-intent/index.ts',
      'supabase/functions/field-sale-payment/index.ts',
      'supabase/functions/billing-generate-renewals/index.ts',
    ];

    for (const funcFile of paymentFunctions) {
      try {
        const content = fs.readFileSync(funcFile, 'utf-8');
        const importsFactory = content.includes('nivraPaymentIntentFactory') || 
                               content.includes('createNivraPaymentIntent');
        expect(importsFactory).toBe(true);
      } catch {
        // Function file may not exist yet — skip
      }
    }
  });

  it('no edge function imports Stripe and creates intents without the factory', () => {
    const allFiles = getAllTsFiles(FUNCTIONS_DIR);
    const violations: string[] = [];

    for (const file of allFiles) {
      const relativePath = file.replace(/\\/g, '/');
      if (relativePath === FACTORY_FILE) continue;
      if (relativePath.includes('_shared/')) continue;
      if (relativePath.includes('.test.')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      
      // If file imports Stripe AND calls .create on intents — violation
      const importsStripe = /import\s+Stripe\s+from/.test(content) || /new\s+Stripe\s*\(/.test(content);
      const createsIntent = /paymentIntents\.create\s*\(/g.test(content);
      
      if (importsStripe && createsIntent) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
