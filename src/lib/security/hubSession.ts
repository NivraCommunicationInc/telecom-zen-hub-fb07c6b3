/**
 * Hub Session — Tracks that the user entered through /hub.
 * All internal portals must verify this before granting access.
 * Session is stored in sessionStorage (cleared on tab close).
 */

const HUB_SESSION_KEY = "nivra_hub_session";
const HUB_SESSION_TTL = 1000 * 60 * 60 * 8; // 8 hours

interface HubSession {
  authenticatedAt: number;
  mfaVerified: boolean;
  userId: string;
}

/** Called by HubPage after successful auth + MFA */
export function createHubSession(userId: string): void {
  const session: HubSession = {
    authenticatedAt: Date.now(),
    mfaVerified: true,
    userId,
  };
  sessionStorage.setItem(HUB_SESSION_KEY, JSON.stringify(session));
}

/** Check if a valid hub session exists */
export function hasValidHubSession(): boolean {
  try {
    const raw = sessionStorage.getItem(HUB_SESSION_KEY);
    if (!raw) return false;
    const session: HubSession = JSON.parse(raw);
    if (Date.now() - session.authenticatedAt > HUB_SESSION_TTL) {
      sessionStorage.removeItem(HUB_SESSION_KEY);
      return false;
    }
    return session.mfaVerified;
  } catch {
    return false;
  }
}

/** Clear hub session (on logout) */
export function clearHubSession(): void {
  sessionStorage.removeItem(HUB_SESSION_KEY);
}
