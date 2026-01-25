// Legacy wrapper - exports from CheckoutEssentialTermsBase for backward compatibility
// New implementations should use CheckoutEssentialTermsBase directly with the checklist pattern

import { useState, useEffect } from "react";
import { 
  CheckoutEssentialTermsBase, 
  ETransferStatusInfo, 
  ChecklistState, 
  isChecklistComplete 
} from "./CheckoutEssentialTermsBase";

// Re-export the status component
export { ETransferStatusInfo };

interface CheckoutEssentialTermsProps {
  isFrench: boolean;
  acknowledged: boolean;
  onAcknowledgeChange: (checked: boolean) => void;
  paymentMethod?: "credit_card" | "etransfer" | "saved" | "new" | "paypal";
}

/**
 * Legacy component that wraps the new CheckoutEssentialTermsBase
 * Converts the single "acknowledged" boolean to the new checklist pattern
 */
export const CheckoutEssentialTerms = ({
  isFrench,
  acknowledged,
  onAcknowledgeChange,
  paymentMethod,
}: CheckoutEssentialTermsProps) => {
  const isETransfer = paymentMethod === "etransfer";
  
  // Internal checklist state
  const [checklist, setChecklist] = useState<ChecklistState>({
    prepaid: acknowledged,
    delays: acknowledged,
    notices: acknowledged,
    etransfer: acknowledged,
  });

  // Sync with parent's acknowledged state
  useEffect(() => {
    if (acknowledged) {
      setChecklist({
        prepaid: true,
        delays: true,
        notices: true,
        etransfer: true,
      });
    }
  }, [acknowledged]);

  // Update parent when all items are checked/unchecked
  const handleChecklistChange = (key: keyof ChecklistState, checked: boolean) => {
    const newChecklist = { ...checklist, [key]: checked };
    setChecklist(newChecklist);
    
    const allComplete = isChecklistComplete(newChecklist, isETransfer);
    onAcknowledgeChange(allComplete);
  };

  return (
    <CheckoutEssentialTermsBase
      isFrench={isFrench}
      checklist={checklist}
      onChecklistChange={handleChecklistChange}
      paymentMethod={paymentMethod}
    />
  );
};

export default CheckoutEssentialTerms;
