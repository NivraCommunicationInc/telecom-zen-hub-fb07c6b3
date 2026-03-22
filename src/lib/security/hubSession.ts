/**
 * Hub Session — Tracks that the user entered through /hub.
 * All internal portals must verify this before granting access.
 * Session is stored in sessionStorage (cleared on tab close).
 * 
 * SECURITY: Enforces both absolute TTL (8h from auth) and
 * inactivity timeout (30min since last activity).
 */

const HUB_SESSION_KEY = "nivra_hub_session";
const HUB_SESSION_TTL = 1000 * 60 * 60 * 8; // 8 hours absolute max
const INACTIVITY_TIMEOUT = 1000 * 60 * 30; // 30 minutes inactivity

interface HubSession {
  authenticatedAt: number;
  lastActivityAt: number;
  mfaVerified: boolean;
  userId: string;
}

/** Called by HubPage after successful auth + MFA */
export function createHubSession(userId: string): void {
  const now = Date.now();
  const session: HubSession = {
    authenticatedAt: now,
    lastActivityAt: now,
    mfaVerified: true,
    userId,
  };
  sessionStorage.setItem(HUB_SESSION_KEY, JSON.stringify(session));
}

/** Record user activity to reset inactivity timer */
export function touchHubSession(): void {
  try {
    const raw = sessionStorage.getItem(HUB_SESSION_KEY);
    if (!raw) return;
    const session: HubSession = JSON.parse(raw);
    session.lastActivityAt = Date.now();
    sessionStorage.setItem(HUB_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Silently fail — next check will invalidate
  }
}

/**
 * Check if a valid hub session exists.
 * Rejects if:
 * - no session
 * - absolute TTL exceeded (8h from auth)
 * - inactivity timeout exceeded (30min since last activity)
 * - MFA not verified
 */
export function hasValidHubSession(): boolean {
  try {
    const raw = sessionStorage.getItem(HUB_SESSION_KEY);
    if (!raw) return false;
    const session: HubSession = JSON.parse(raw);
    const now = Date.now();

    // Absolute TTL check
    if (now - session.authenticatedAt > HUB_SESSION_TTL) {
      console.warn("[HubSession] Absolute TTL expired (8h)");
      sessionStorage.removeItem(HUB_SESSION_KEY);
      return false;
    }

    // Inactivity timeout check
    const lastActivity = session.lastActivityAt || session.authenticatedAt;
    if (now - lastActivity > INACTIVITY_TIMEOUT) {
      console.warn("[HubSession] Inactivity timeout expired (30min)");
      sessionStorage.removeItem(HUB_SESSION_KEY);
      return false;
    }

    return session.mfaVerified;
  } catch {
    return false;
  }
}

/** Get the userId from the current hub session (if valid) */
export function getHubSessionUserId(): string | null {
  try {
    const raw = sessionStorage.getItem(HUB_SESSION_KEY);
    if (!raw) return null;
    const session: HubSession = JSON.parse(raw);
    return session.userId || null;
  } catch {
    return null;
  }
}

/** Clear hub session (on logout) */
export function clearHubSession(): void {
  sessionStorage.removeItem(HUB_SESSION_KEY);
}
