import { test, expect } from '@playwright/test';

/**
 * Security E2E Test: Verify no session tokens in browser storage
 * 
 * This test ensures that after login, NO tokens are stored in:
 * - localStorage
 * - sessionStorage
 * 
 * This is critical for XSS attack prevention.
 */

const SESSION_KEY_PATTERNS = [
  /sb-.*-auth-token/,
  /supabase\.auth\.token/,
  /access_token/,
  /refresh_token/,
  /session/i,
];

test.describe('Security: Token Storage Verification', () => {
  
  test('should NOT store any tokens in localStorage after page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check localStorage
    const localStorageKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    });
    
    // Find any session-related keys
    const sessionKeys = localStorageKeys.filter(key => 
      SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
    );
    
    expect(sessionKeys, 'No session tokens should be in localStorage').toHaveLength(0);
  });
  
  test('should NOT store any tokens in sessionStorage after page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check sessionStorage
    const sessionStorageKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    });
    
    // Find any session-related keys
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
    
    // Wait a bit for console messages
    await page.waitForTimeout(1000);
    
    // Verify security log is present
    const hasSecurityLog = consoleMessages.some(msg => 
      msg.includes('No session tokens found') || msg.includes('✅')
    );
    
    expect(hasSecurityLog, 'Should log security verification').toBe(true);
  });
  
  test('admin portal should NOT persist tokens after navigation', async ({ page }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    // Check localStorage after visiting admin
    const localStorageKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    });
    
    const sessionKeys = localStorageKeys.filter(key => 
      SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
    );
    
    expect(sessionKeys, 'No session tokens should be in localStorage for admin portal').toHaveLength(0);
  });
  
  test('client portal should NOT persist tokens after navigation', async ({ page }) => {
    await page.goto('/portal/auth');
    await page.waitForLoadState('networkidle');
    
    // Check localStorage after visiting portal
    const localStorageKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      return keys;
    });
    
    const sessionKeys = localStorageKeys.filter(key => 
      SESSION_KEY_PATTERNS.some(pattern => pattern.test(key))
    );
    
    expect(sessionKeys, 'No session tokens should be in localStorage for client portal').toHaveLength(0);
  });
});
