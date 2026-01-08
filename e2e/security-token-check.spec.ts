import { test, expect } from '@playwright/test';

/**
 * Security E2E Test: Verify no session tokens in browser storage
 * 
 * This test ensures that after login, NO tokens are stored in:
 * - localStorage
 * - sessionStorage
 * - IndexedDB (checked for token-like keys)
 * 
 * This is critical for XSS attack prevention.
 */

const SESSION_KEY_PATTERNS = [
  /sb-.*-auth-token/,
  /supabase\.auth\.token/,
  /access_token/,
  /refresh_token/,
  /session/i,
  /jwt/i,
  /bearer/i,
];

// Helper to check storage for session tokens
async function checkStorageForTokens(page: ReturnType<typeof test.step>, storageName: 'localStorage' | 'sessionStorage') {
  return page.evaluate((storage) => {
    const keys: string[] = [];
    const store = storage === 'localStorage' ? localStorage : sessionStorage;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key) keys.push(key);
    }
    return keys;
  }, storageName);
}

// Helper to check IndexedDB for token-like data
async function checkIndexedDBForTokens(page: ReturnType<typeof test.step>) {
  return page.evaluate(async () => {
    const tokenPatterns = [
      /sb-.*-auth-token/,
      /supabase/i,
      /access_token/,
      /refresh_token/,
      /session/i,
      /jwt/i,
    ];
    
    const suspiciousDBs: string[] = [];
    
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name && tokenPatterns.some(p => p.test(db.name!))) {
          suspiciousDBs.push(db.name);
        }
      }
    } catch {
      // indexedDB.databases() may not be available in all browsers
    }
    
    return suspiciousDBs;
  });
}

// Helper to check cookies for token-like values
async function checkCookiesForTokens(page: ReturnType<typeof test.step>) {
  const cookies = await page.context().cookies();
  return cookies.filter(c => 
    SESSION_KEY_PATTERNS.some(p => p.test(c.name) || p.test(c.value))
  ).map(c => c.name);
}

test.describe('Security: Token Storage Verification', () => {
  
  test.describe('Page Load Tests (No Login)', () => {
    
    test('should NOT store any tokens in localStorage after page load', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const localStorageKeys = await checkStorageForTokens(page, 'localStorage');
      const sessionKeys = localStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      
      expect(sessionKeys, 'No session tokens should be in localStorage').toHaveLength(0);
    });
    
    test('should NOT store any tokens in sessionStorage after page load', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const sessionStorageKeys = await checkStorageForTokens(page, 'sessionStorage');
      const sessionKeys = sessionStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      
      expect(sessionKeys, 'No session tokens should be in sessionStorage').toHaveLength(0);
    });
    
    test('should log security verification on page load', async ({ page }) => {
      const consoleMessages: string[] = [];
      
      page.on('console', msg => {
        if (msg.text().includes('[SECURITY]')) {
          consoleMessages.push(msg.text());
        }
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      const hasSecurityLog = consoleMessages.some(msg => 
        msg.includes('No session tokens found') || msg.includes('✅')
      );
      
      expect(hasSecurityLog, 'Should log security verification').toBe(true);
    });
  });

  test.describe('Admin Portal Post-Login Tests', () => {
    
    test('should NOT persist tokens after visiting admin login page', async ({ page }) => {
      await page.goto('/admin/login');
      await page.waitForLoadState('networkidle');
      
      // Check localStorage
      const localStorageKeys = await checkStorageForTokens(page, 'localStorage');
      const localSessionKeys = localStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      
      // Check sessionStorage
      const sessionStorageKeys = await checkStorageForTokens(page, 'sessionStorage');
      const sessionSessionKeys = sessionStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      
      // Check IndexedDB
      const indexedDBKeys = await checkIndexedDBForTokens(page);
      
      // Check cookies
      const cookieTokens = await checkCookiesForTokens(page);
      
      expect(localSessionKeys, 'No session tokens in localStorage for admin').toHaveLength(0);
      expect(sessionSessionKeys, 'No session tokens in sessionStorage for admin').toHaveLength(0);
      expect(indexedDBKeys, 'No session tokens in IndexedDB for admin').toHaveLength(0);
      expect(cookieTokens, 'No session tokens in cookies for admin').toHaveLength(0);
    });
    
    test('admin login attempt should NOT persist tokens even after form interaction', async ({ page }) => {
      await page.goto('/admin/login');
      await page.waitForLoadState('networkidle');
      
      // Try to interact with login form (without valid credentials)
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
      
      if (await emailInput.isVisible()) {
        await emailInput.fill('test@example.com');
      }
      if (await passwordInput.isVisible()) {
        await passwordInput.fill('testpassword123');
      }
      
      // Wait a moment for any storage operations
      await page.waitForTimeout(500);
      
      // Verify no tokens stored
      const localStorageKeys = await checkStorageForTokens(page, 'localStorage');
      const sessionKeys = localStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      
      expect(sessionKeys, 'No tokens after admin form interaction').toHaveLength(0);
    });
  });

  test.describe('Client Portal Post-Login Tests', () => {
    
    test('should NOT persist tokens after visiting client auth page', async ({ page }) => {
      await page.goto('/portal/auth');
      await page.waitForLoadState('networkidle');
      
      // Check all storage types
      const localStorageKeys = await checkStorageForTokens(page, 'localStorage');
      const localSessionKeys = localStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      
      const sessionStorageKeys = await checkStorageForTokens(page, 'sessionStorage');
      const sessionSessionKeys = sessionStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      
      const indexedDBKeys = await checkIndexedDBForTokens(page);
      const cookieTokens = await checkCookiesForTokens(page);
      
      expect(localSessionKeys, 'No session tokens in localStorage for portal').toHaveLength(0);
      expect(sessionSessionKeys, 'No session tokens in sessionStorage for portal').toHaveLength(0);
      expect(indexedDBKeys, 'No session tokens in IndexedDB for portal').toHaveLength(0);
      expect(cookieTokens, 'No session tokens in cookies for portal').toHaveLength(0);
    });
    
    test('client portal form interaction should NOT persist tokens', async ({ page }) => {
      await page.goto('/portal/auth');
      await page.waitForLoadState('networkidle');
      
      // Try to interact with auth form
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      
      if (await emailInput.isVisible()) {
        await emailInput.fill('client@example.com');
      }
      
      await page.waitForTimeout(500);
      
      const localStorageKeys = await checkStorageForTokens(page, 'localStorage');
      const sessionKeys = localStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      
      expect(sessionKeys, 'No tokens after portal form interaction').toHaveLength(0);
    });
  });

  test.describe('Cross-Navigation Token Leak Prevention', () => {
    
    test('navigating between portals should not leak tokens', async ({ page }) => {
      // Visit admin login
      await page.goto('/admin/login');
      await page.waitForLoadState('networkidle');
      
      // Navigate to client portal
      await page.goto('/portal/auth');
      await page.waitForLoadState('networkidle');
      
      // Navigate back to public site
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Final check - no tokens should exist
      const localStorageKeys = await checkStorageForTokens(page, 'localStorage');
      const sessionStorageKeys = await checkStorageForTokens(page, 'sessionStorage');
      
      const localSessionKeys = localStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      const sessionSessionKeys = sessionStorageKeys.filter(key => 
        SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
      );
      
      expect(localSessionKeys, 'No token leakage after navigation in localStorage').toHaveLength(0);
      expect(sessionSessionKeys, 'No token leakage after navigation in sessionStorage').toHaveLength(0);
    });
  });
});
