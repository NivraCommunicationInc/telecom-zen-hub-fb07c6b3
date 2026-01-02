import { useState, useCallback, useEffect } from "react";

interface VerifiedClient {
  clientId: string;
  verifiedAt: number;
  expiresAt: number;
}

const SESSION_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = "nivra_verified_clients";

export const useClientAccessGate = () => {
  const [verifiedClients, setVerifiedClients] = useState<VerifiedClient[]>([]);

  // Load from session storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as VerifiedClient[];
        // Filter out expired entries
        const now = Date.now();
        const valid = parsed.filter((vc) => vc.expiresAt > now);
        setVerifiedClients(valid);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Check if a client is currently verified (unlocked)
  const isClientVerified = useCallback(
    (clientId: string): boolean => {
      const now = Date.now();
      return verifiedClients.some(
        (vc) => vc.clientId === clientId && vc.expiresAt > now
      );
    },
    [verifiedClients]
  );

  // Mark a client as verified
  const verifyClient = useCallback((clientId: string) => {
    const now = Date.now();
    const newEntry: VerifiedClient = {
      clientId,
      verifiedAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    };

    setVerifiedClients((prev) => {
      // Remove any existing entry for this client
      const filtered = prev.filter((vc) => vc.clientId !== clientId);
      const updated = [...filtered, newEntry];
      
      // Persist to session storage
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      
      return updated;
    });
  }, []);

  // Clear verification for a specific client
  const revokeClient = useCallback((clientId: string) => {
    setVerifiedClients((prev) => {
      const updated = prev.filter((vc) => vc.clientId !== clientId);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear all verifications (e.g., on logout)
  const clearAllVerifications = useCallback(() => {
    setVerifiedClients([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  // Get remaining time for a verified client
  const getTimeRemaining = useCallback(
    (clientId: string): number => {
      const entry = verifiedClients.find((vc) => vc.clientId === clientId);
      if (!entry) return 0;
      const remaining = entry.expiresAt - Date.now();
      return Math.max(0, remaining);
    },
    [verifiedClients]
  );

  return {
    isClientVerified,
    verifyClient,
    revokeClient,
    clearAllVerifications,
    getTimeRemaining,
  };
};
