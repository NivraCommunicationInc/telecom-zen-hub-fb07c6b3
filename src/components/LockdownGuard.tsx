import { ReactNode, useEffect, useState } from "react";
import { useLockdownMode } from "@/hooks/useLockdownMode";
import LockdownPage from "./LockdownPage";

interface LockdownGuardProps {
  children: ReactNode;
}

/**
 * LockdownGuard - Total security lockdown for the entire site
 * 
 * When lockdown is enabled:
 * - ALL routes are blocked (including admin)
 * - Only users with the unlock password can access
 * - Unlock is stored in sessionStorage (cleared on browser close)
 */
const LockdownGuard = ({ children }: LockdownGuardProps) => {
  const { isLockdownActive, lockdownConfig, isLoading } = useLockdownMode();
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    // Check if user has unlocked in this session
    const unlocked = sessionStorage.getItem("lockdown_unlocked");
    const unlockTime = sessionStorage.getItem("lockdown_unlock_time");
    
    if (unlocked === "true" && unlockTime) {
      // Unlock expires after 4 hours
      const UNLOCK_DURATION = 4 * 60 * 60 * 1000;
      const elapsed = Date.now() - parseInt(unlockTime, 10);
      
      if (elapsed < UNLOCK_DURATION) {
        setIsUnlocked(true);
      } else {
        // Expired - clear and require re-auth
        sessionStorage.removeItem("lockdown_unlocked");
        sessionStorage.removeItem("lockdown_unlock_time");
        setIsUnlocked(false);
      }
    }
  }, []);

  // While loading, render children optimistically (prevents blank screen)
  // Lockdown is rare; if active it will kick in once the query resolves
  if (isLoading) {
    return <>{children}</>;
  }

  // If lockdown is active and user hasn't unlocked
  if (isLockdownActive && !isUnlocked) {
    return (
      <LockdownPage
        messageFr={lockdownConfig?.message_fr}
        messageEn={lockdownConfig?.message_en}
        onUnlock={() => setIsUnlocked(true)}
      />
    );
  }

  return <>{children}</>;
};

export default LockdownGuard;
