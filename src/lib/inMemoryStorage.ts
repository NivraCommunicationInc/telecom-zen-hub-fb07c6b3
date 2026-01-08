/**
 * InMemoryStorage - Secure session storage that never persists to localStorage/sessionStorage
 * 
 * SECURITY: This adapter stores tokens ONLY in memory. Sessions are lost on page refresh,
 * but this prevents tokens from being accessible via XSS attacks or browser extensions.
 */

interface StorageData {
  [key: string]: string;
}

class InMemoryStorage {
  private data: StorageData = {};

  getItem(key: string): string | null {
    return this.data[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.data[key] = value;
  }

  removeItem(key: string): void {
    delete this.data[key];
  }

  clear(): void {
    this.data = {};
  }

  get length(): number {
    return Object.keys(this.data).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.data);
    return keys[index] ?? null;
  }
}

// Singleton instance for all auth clients
export const inMemoryStorage = new InMemoryStorage();

/**
 * Verify that no session tokens exist in browser storage
 * Call this after login to prove security compliance
 */
export function verifyNoStoredTokens(): { 
  isSecure: boolean; 
  localStorage: string[]; 
  sessionStorage: string[];
} {
  const sessionKeyPatterns = [
    /sb-.*-auth-token/,
    /supabase\.auth\.token/,
    /access_token/,
    /refresh_token/,
    /session/i,
  ];

  const checkStorage = (storage: Storage): string[] => {
    const foundKeys: string[] = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && sessionKeyPatterns.some(pattern => pattern.test(key))) {
          foundKeys.push(key);
        }
      }
    } catch {
      // Storage access may fail in some contexts
    }
    return foundKeys;
  };

  const localStorageKeys = checkStorage(localStorage);
  const sessionStorageKeys = checkStorage(sessionStorage);
  const isSecure = localStorageKeys.length === 0 && sessionStorageKeys.length === 0;

  // Log verification result
  if (isSecure) {
    console.log('[SECURITY] ✅ No session tokens found in browser storage');
  } else {
    console.warn('[SECURITY] ⚠️ Session tokens detected in browser storage:', {
      localStorage: localStorageKeys,
      sessionStorage: sessionStorageKeys
    });
  }

  return { isSecure, localStorage: localStorageKeys, sessionStorage: sessionStorageKeys };
}

/**
 * Purge any residual tokens from browser storage
 * Call on logout to ensure complete cleanup
 */
export function purgeAllStoredTokens(): void {
  const sessionKeyPatterns = [
    /sb-.*-auth-token/,
    /supabase\.auth\.token/,
    /access_token/,
    /refresh_token/,
  ];

  const purgeStorage = (storage: Storage): number => {
    const keysToRemove: string[] = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && sessionKeyPatterns.some(pattern => pattern.test(key))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => storage.removeItem(key));
    } catch {
      // Storage access may fail
    }
    return keysToRemove.length;
  };

  const localPurged = purgeStorage(localStorage);
  const sessionPurged = purgeStorage(sessionStorage);

  if (localPurged > 0 || sessionPurged > 0) {
    console.log(`[SECURITY] Purged ${localPurged + sessionPurged} residual tokens from storage`);
  }

  // Also clear in-memory storage
  inMemoryStorage.clear();
}
