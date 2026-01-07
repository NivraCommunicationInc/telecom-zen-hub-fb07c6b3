/**
 * SensitiveDataMask - Masks sensitive data until account is unlocked via PIN
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useEmployeePinGate } from "@/hooks/useEmployeePinGate";
import { EmployeePinGateModal } from "./EmployeePinGateModal";
import { cn } from "@/lib/utils";

interface SensitiveDataMaskProps {
  value: string;
  accountId: string;
  clientId: string;
  clientName: string;
  accountNumber?: string;
  maskPattern?: "full" | "partial" | "dots";
  className?: string;
}

export const SensitiveDataMask = ({
  value,
  accountId,
  clientId,
  clientName,
  accountNumber,
  maskPattern = "dots",
  className,
}: SensitiveDataMaskProps) => {
  const { isAccountUnlocked, getUnlockTimeRemaining } = useEmployeePinGate();
  const [showPinModal, setShowPinModal] = useState(false);

  const isUnlocked = isAccountUnlocked(accountId);
  const timeRemaining = getUnlockTimeRemaining(accountId);

  const getMaskedValue = () => {
    if (!value) return "—";
    
    switch (maskPattern) {
      case "full":
        return "••••••••";
      case "partial":
        // Show first 2 and last 2 characters
        if (value.length <= 4) return "••••";
        return `${value.slice(0, 2)}••••${value.slice(-2)}`;
      case "dots":
      default:
        return "•".repeat(Math.min(value.length, 8));
    }
  };

  const formatTimeRemaining = () => {
    if (timeRemaining <= 0) return null;
    const mins = Math.floor(timeRemaining / 60000);
    const secs = Math.floor((timeRemaining % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isUnlocked) {
    return (
      <span className={cn("font-mono", className)}>
        {value || "—"}
        {timeRemaining > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">
            ({formatTimeRemaining()})
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      <span className={cn("inline-flex items-center gap-2", className)}>
        <span className="font-mono text-muted-foreground">{getMaskedValue()}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setShowPinModal(true)}
        >
          <Lock className="w-3 h-3 mr-1" />
          Déverrouiller
        </Button>
      </span>

      <EmployeePinGateModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onUnlocked={() => setShowPinModal(false)}
        account={{
          id: accountId,
          clientId,
          clientName,
          accountNumber,
        }}
      />
    </>
  );
};

export default SensitiveDataMask;
