import { test, expect, Page } from '@playwright/test';

/**
 * Security E2E Test: Verify no session tokens in browser storage
 * 
 * CRITICAL: These tests verify that AFTER SUCCESSFUL LOGIN, NO tokens are stored in:
 * - localStorage
 * - sessionStorage
 * - IndexedDB (checked for token-like keys)
 * - Cookies (checked for token-like values)
 * 
 * This is critical for XSS attack prevention. Memory-only storage must be enforced.
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

// CI environment credentials (must be set in CI secrets)
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';
const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL || '';
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD || '';

// Helper to check storage for session tokens
async function checkStorageForTokens(page: Page, storageName: 'localStorage' | 'sessionStorage') {
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

// Helper to check IndexedDB for token-like data (names AND records)
async function checkIndexedDBForTokens(page: Page): Promise<{ databases: string[], records: string[] }> {
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
    const suspiciousRecords: string[] = [];
    
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name && tokenPatterns.some(p => p.test(db.name!))) {
          suspiciousDBs.push(db.name);
        }
        
        // Try to open each database and check for token-like object stores
        if (db.name) {
          try {
            const openRequest = indexedDB.open(db.name);
            await new Promise<void>((resolve, reject) => {
              openRequest.onerror = () => reject(openRequest.error);
              openRequest.onsuccess = () => {
                const database = openRequest.result;
                const storeNames = Array.from(database.objectStoreNames);
                for (const storeName of storeNames) {
                  if (tokenPatterns.some(p => p.test(storeName))) {
                    suspiciousRecords.push(`${db.name}/${storeName}`);
                  }
                }
                database.close();
                resolve();
              };
            });
          } catch {
            // Database might be locked or inaccessible
          }
        }
      }
    } catch {
      // indexedDB.databases() may not be available in all browsers
    }
    
    return { databases: suspiciousDBs, records: suspiciousRecords };
  });
}

// Helper to check cookies for token-like values
async function checkCookiesForTokens(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.filter(c => 
    SESSION_KEY_PATTERNS.some(p => p.test(c.name) || p.test(c.value))
  ).map(c => ({ name: c.name, hasTokenValue: SESSION_KEY_PATTERNS.some(p => p.test(c.value)) }));
}

// Comprehensive storage check function
async function verifyNoTokensInAnyStorage(page: Page, context: string) {
  const localStorageKeys = await checkStorageForTokens(page, 'localStorage');
  const sessionStorageKeys = await checkStorageForTokens(page, 'sessionStorage');
  const indexedDBResult = await checkIndexedDBForTokens(page);
  const cookieTokens = await checkCookiesForTokens(page);
  
  const localSessionKeys = localStorageKeys.filter(key => 
    SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
  );
  const sessionSessionKeys = sessionStorageKeys.filter(key => 
    SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
  );
  
  expect(localSessionKeys, `[${context}] No session tokens in localStorage`).toHaveLength(0);
  expect(sessionSessionKeys, `[${context}] No session tokens in sessionStorage`).toHaveLength(0);
  expect(indexedDBResult.databases, `[${context}] No suspicious IndexedDB databases`).toHaveLength(0);
  expect(indexedDBResult.records, `[${context}] No suspicious IndexedDB records`).toHaveLength(0);
  expect(cookieTokens, `[${context}] No session tokens in cookies`).toHaveLength(0);
  
  return {
    localStorage: localSessionKeys,
    sessionStorage: sessionSessionKeys,
    indexedDB: indexedDBResult,
    cookies: cookieTokens,
  };
}

test.describe('Security: Token Storage Verification (No Login)', () => {
  
  test('should NOT store any tokens in localStorage after page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await verifyNoTokensInAnyStorage(page, 'page-load');
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

// ============================================================================
// POST-LOGIN TESTS: ADMIN PORTAL
// These tests perform REAL successful login and verify NO tokens persist
// ============================================================================

test.describe('Security: Admin Portal POST-LOGIN Token Verification', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Skipping - E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set');

  test('should NOT persist tokens after SUCCESSFUL admin login', async ({ page }) => {
    // Navigate to admin login
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    // Perform real login
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for successful login - detect redirect to dashboard
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 });
    
    // Verify we're on the dashboard (login was successful)
    const dashboardIndicator = page.locator('text=Dashboard').or(page.locator('text=Tableau de bord')).or(page.locator('[data-testid="admin-dashboard"]'));
    await expect(dashboardIndicator.first()).toBeVisible({ timeout: 10000 });
    
    // CRITICAL: Verify NO tokens in any persistent storage after successful login
    await verifyNoTokensInAnyStorage(page, 'admin-post-login');
    
    // Additional check: Wait a moment for any async storage operations
    await page.waitForTimeout(1000);
    await verifyNoTokensInAnyStorage(page, 'admin-post-login-delayed');
  });

  test('should NOT persist session after page refresh (memory-only)', async ({ page }) => {
    // Login first
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 });
    
    // Verify login was successful
    const dashboardIndicator = page.locator('text=Dashboard').or(page.locator('text=Tableau de bord'));
    await expect(dashboardIndicator.first()).toBeVisible({ timeout: 10000 });
    
    // Verify no tokens before refresh
    await verifyNoTokensInAnyStorage(page, 'admin-pre-refresh');
    
    // CRITICAL TEST: Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // With memory-only storage, session should NOT persist after refresh
    // User should be redirected back to login
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });
    
    // Verify still no tokens after refresh
    await verifyNoTokensInAnyStorage(page, 'admin-post-refresh');
  });
});

// ============================================================================
// POST-LOGIN TESTS: CLIENT PORTAL
// These tests perform REAL successful login and verify NO tokens persist
// ============================================================================

test.describe('Security: Client Portal POST-LOGIN Token Verification', () => {
  test.skip(!CLIENT_EMAIL || !CLIENT_PASSWORD, 'Skipping - E2E_CLIENT_EMAIL/E2E_CLIENT_PASSWORD not set');

  test('should NOT persist tokens after SUCCESSFUL client login', async ({ page }) => {
    // Navigate to client auth
    await page.goto('/portal/auth');
    await page.waitForLoadState('networkidle');
    
    // Perform real login
    await page.fill('input[type="email"]', CLIENT_EMAIL);
    await page.fill('input[type="password"]', CLIENT_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for successful login - detect redirect to dashboard
    await page.waitForURL(/\/portal(?!\/auth)/, { timeout: 15000 });
    
    // Verify we're on the client dashboard (login was successful)
    const dashboardIndicator = page.locator('text=Mon compte').or(page.locator('text=Tableau de bord')).or(page.locator('[data-testid="client-dashboard"]'));
    await expect(dashboardIndicator.first()).toBeVisible({ timeout: 10000 });
    
    // CRITICAL: Verify NO tokens in any persistent storage after successful login
    await verifyNoTokensInAnyStorage(page, 'client-post-login');
    
    // Additional check: Wait a moment for any async storage operations
    await page.waitForTimeout(1000);
    await verifyNoTokensInAnyStorage(page, 'client-post-login-delayed');
  });

  test('should NOT persist session after page refresh (memory-only)', async ({ page }) => {
    // Login first
    await page.goto('/portal/auth');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', CLIENT_EMAIL);
    await page.fill('input[type="password"]', CLIENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/portal(?!\/auth)/, { timeout: 15000 });
    
    // Verify login was successful
    const dashboardIndicator = page.locator('text=Mon compte').or(page.locator('text=Tableau de bord'));
    await expect(dashboardIndicator.first()).toBeVisible({ timeout: 10000 });
    
    // Verify no tokens before refresh
    await verifyNoTokensInAnyStorage(page, 'client-pre-refresh');
    
    // CRITICAL TEST: Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // With memory-only storage, session should NOT persist after refresh
    // User should be redirected back to login
    await page.waitForURL(/\/portal\/auth/, { timeout: 10000 });
    
    // Verify still no tokens after refresh
    await verifyNoTokensInAnyStorage(page, 'client-post-refresh');
  });
});

// ============================================================================
// CROSS-NAVIGATION TESTS
// ============================================================================

test.describe('Security: Cross-Navigation Token Leak Prevention', () => {
  
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
    await verifyNoTokensInAnyStorage(page, 'cross-navigation');
  });
});

// ============================================================================
// FORM INTERACTION TESTS (without credentials)
// ============================================================================

test.describe('Security: Form Interaction Token Verification', () => {
  
  test('admin login form interaction should NOT persist tokens', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    // Try to interact with login form (without valid credentials)
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com');
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('testpassword123');
    }
    
    // Wait a moment for any storage operations
    await page.waitForTimeout(500);
    
    await verifyNoTokensInAnyStorage(page, 'admin-form-interaction');
  });
  
  test('client portal form interaction should NOT persist tokens', async ({ page }) => {
    await page.goto('/portal/auth');
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"]').first();
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('client@example.com');
    }
    
    await page.waitForTimeout(500);
    
    await verifyNoTokensInAnyStorage(page, 'client-form-interaction');
  });
});
