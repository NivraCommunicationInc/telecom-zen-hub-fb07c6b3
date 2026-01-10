import { useCallback, useEffect, useRef } from "react";

// Default: 60 minutes for client portal (1 hour security requirement)
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes (1 hour)
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click", "focus"];

interface UseIdleTimeoutOptions {
  onIdle: () => void;
  timeout?: number;
  enabled?: boolean;
}

/**
 * Hook to detect user inactivity and trigger a callback after timeout.
 * Does NOT log out on tab switch - only on actual inactivity.
 */
export const useIdleTimeout = ({
  onIdle,
  timeout = IDLE_TIMEOUT_MS,
  enabled = true,
}: UseIdleTimeoutOptions) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (enabled) {
      timeoutRef.current = setTimeout(() => {
        console.log("[useIdleTimeout] User idle for", timeout / 1000, "seconds. Triggering idle callback.");
        onIdle();
      }, timeout);
    }
  }, [onIdle, timeout, enabled]);

  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Set initial timer
    resetTimer();

    // Add event listeners for user activity
    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, handleActivity, resetTimer]);

  // Handle visibility change - pause timer when hidden, resume when visible
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Tab is visible again - check if we exceeded idle time while hidden
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;

        if (elapsed >= timeout) {
          console.log("[useIdleTimeout] Idle timeout exceeded while tab was hidden.");
          onIdle();
        } else {
          // Still within timeout - reset with remaining time
          const remaining = timeout - elapsed;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            console.log("[useIdleTimeout] User idle. Triggering idle callback.");
            onIdle();
          }, remaining);
        }
      }
      // When tab becomes hidden, we keep the timer running
      // We don't pause it because that would allow infinite idle time
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, timeout, onIdle]);

  return {
    resetTimer,
    getLastActivity: () => lastActivityRef.current,
  };
};

export default useIdleTimeout;
