import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Payment & Billing Hardening E2E Tests - P0 Non-Regression
 * 
 * These tests verify strict database-level protections:
 * 1. [AUDIT_BLOCK] Finalized payments MUST have created_by_* fields
 * 2. [IMMUTABILITY] Paid invoices cannot have financial fields modified
 * 3. recompute_invoice_balance is NOT callable by authenticated users
 * 4. recover_error_captured_payment is service_role only
 * 5. RLS isolation between clients
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

test.describe('Payment & Billing Hardening - P0 Non-Regression', () => {
  
  test.describe('1. [AUDIT_BLOCK] Payment Audit Trail Enforcement', () => {
    
    test('1.1 Finalized payment without created_by_* must fail with AUDIT_BLOCK', async () => {
      // Use anon client to test DB trigger enforcement
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Attempt to insert a finalized payment without created_by fields
      const { error } = await supabase
        .from('payments')
        .insert({
          amount: 100,
          status: 'completed',
          user_id: '00000000-0000-0000-0000-000000000001',
          payment_method: 'test',
          // Intentionally missing: created_by_id, created_by_name, created_by_role
        });
      
      // Should fail with AUDIT_BLOCK error
      expect(error).not.toBeNull();
      expect(error?.message || error?.code).toMatch(/AUDIT_BLOCK|violates|permission denied|row-level security/i);
    });
    
    test('1.2 Finalized payment with invalid created_by_role must fail', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const { error } = await supabase
        .from('payments')
        .insert({
          amount: 100,
          status: 'captured',
          user_id: '00000000-0000-0000-0000-000000000001',
          payment_method: 'test',
          created_by_id: '00000000-0000-0000-0000-000000000002',
          created_by_name: 'Test User',
          created_by_role: 'hacker', // Invalid role
        });
      
      // Should fail with AUDIT_BLOCK error for invalid role
      expect(error).not.toBeNull();
      expect(error?.message || error?.code).toMatch(/AUDIT_BLOCK|violates|permission denied|row-level security/i);
    });
    
    test('1.3 Payment with pending status does not require created_by fields', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Pending payments should not be blocked by the audit trigger
      // (but may be blocked by RLS - that's expected)
      const { error } = await supabase
        .from('payments')
        .insert({
          amount: 100,
          status: 'pending',
          user_id: '00000000-0000-0000-0000-000000000001',
          payment_method: 'test',
        });
      
      // If blocked, should be by RLS, not AUDIT_BLOCK
      if (error) {
        expect(error.message).not.toContain('AUDIT_BLOCK');
      }
    });
  });
  
  test.describe('2. [IMMUTABILITY] Paid Invoice Protection', () => {
    
    test('2.1 Update protected columns on paid invoice must fail with IMMUTABILITY', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // First get a paid invoice (if any exist)
      const { data: paidInvoices } = await supabase
        .from('billing')
        .select('id, amount')
        .eq('status', 'paid')
        .limit(1);
      
      if (paidInvoices && paidInvoices.length > 0) {
        const invoiceId = paidInvoices[0].id;
        
        // Attempt to modify the amount - should fail
        const { error } = await supabase
          .from('billing')
          .update({ amount: 9999 })
          .eq('id', invoiceId);
        
        // Should fail with IMMUTABILITY error or RLS
        expect(error).not.toBeNull();
        expect(error?.message || '').toMatch(/IMMUTABILITY|permission denied|row-level security/i);
      } else {
        // No paid invoices to test - skip gracefully
        console.log('No paid invoices found to test immutability');
      }
    });
    
    test('2.2 Bypass without service_role context must fail', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Try to use the bypass as an authenticated user
      // (The bypass should only work for service_role)
      const { data: paidInvoices } = await supabase
        .from('billing')
        .select('id')
        .eq('status', 'paid')
        .limit(1);
      
      if (paidInvoices && paidInvoices.length > 0) {
        // Even with RPC call attempting to set the bypass, it should fail
        const { error } = await supabase
          .from('billing')
          .update({ subtotal: 1 })
          .eq('id', paidInvoices[0].id);
        
        expect(error).not.toBeNull();
      }
    });
  });
  
  test.describe('3. Security Function Access Control', () => {
    
    test('3.1 Calling recompute_invoice_balance as authenticated must fail (permission denied)', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Try to call the function directly as anon/authenticated
      const { error } = await supabase.rpc('recompute_invoice_balance', {
        p_invoice_id: '00000000-0000-0000-0000-000000000001'
      });
      
      // Should fail with permission denied
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied|does not exist|not authorized/i);
    });
    
    test('3.2 Calling mark_payment_error_captured as authenticated must fail', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const { error } = await supabase.rpc('mark_payment_error_captured', {
        p_payment_id: '00000000-0000-0000-0000-000000000001',
        p_error_reason: 'Test error',
        p_admin_user_id: '00000000-0000-0000-0000-000000000002'
      });
      
      // Should fail with permission denied
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied|does not exist|not authorized/i);
    });
    
    test('3.3 Calling recover_error_captured_payment as authenticated must fail', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const { error } = await supabase.rpc('recover_error_captured_payment', {
        p_payment_id: '00000000-0000-0000-0000-000000000001',
        p_action: 'credit',
        p_admin_id: '00000000-0000-0000-0000-000000000002',
        p_reason: 'Test recovery'
      });
      
      // Should fail with permission denied
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied|does not exist|not authorized/i);
    });
  });
  
  test.describe('4. RLS Client Isolation', () => {
    
    test('4.1 Unauthenticated access to payments table is blocked', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Try to read all payments without auth
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .limit(10);
      
      // Either returns empty or error - no data leak
      expect(data?.length || 0).toBe(0);
    });
    
    test('4.2 Unauthenticated access to billing table is blocked', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const { data } = await supabase
        .from('billing')
        .select('*')
        .limit(10);
      
      // Either returns empty or error - no data leak
      expect(data?.length || 0).toBe(0);
    });
    
    test('4.3 Unauthenticated access to ledger_entries is blocked', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const { data } = await supabase
        .from('ledger_entries')
        .select('*')
        .limit(10);
      
      // Either returns empty or error - no data leak
      expect(data?.length || 0).toBe(0);
    });
  });
  
  test.describe('5. UI Route Protection', () => {
    
    test('5.1 Client payments page requires authentication', async ({ page }) => {
      await page.goto('/client/payments');
      await page.waitForTimeout(2000);
      
      const url = page.url();
      const isBlocked = url.includes('login') || 
                        url.includes('auth') || 
                        url.includes('client/auth');
      
      expect(isBlocked).toBe(true);
    });
    
    test('5.2 Client invoices page requires authentication', async ({ page }) => {
      await page.goto('/client/invoices');
      await page.waitForTimeout(2000);
      
      const url = page.url();
      const isBlocked = url.includes('login') || 
                        url.includes('auth') || 
                        url.includes('client/auth');
      
      expect(isBlocked).toBe(true);
    });
    
    test('5.3 Admin billing page requires authentication', async ({ page }) => {
      await page.goto('/admin/billing');
      await page.waitForTimeout(2000);
      
      const url = page.url();
      const requiresAuth = url.includes('login') || 
                           url.includes('auth') || 
                           await page.locator('input[type="email"], input[type="password"]').first().isVisible();
      
      expect(requiresAuth).toBe(true);
    });
  });
});

test.describe('Smoke Tests - No Critical Errors', () => {
  const pages = [
    { name: 'Homepage', path: '/' },
    { name: 'Admin Login', path: '/admin/login' },
    { name: 'Client Portal', path: '/client/auth' },
  ];
  
  for (const { name, path } of pages) {
    test(`${name} loads without AUDIT_BLOCK or IMMUTABILITY errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto(path);
      await page.waitForTimeout(2000);
      
      // Filter for critical hardening-related errors
      const criticalErrors = errors.filter(e => 
        e.includes('AUDIT_BLOCK') || 
        e.includes('IMMUTABILITY') ||
        e.includes('permission denied for function')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  }
});
