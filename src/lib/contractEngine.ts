/**
 * Contract Engine - Simplified V2.5
 * Stub for backward compatibility after legacy removal
 */

/**
 * @deprecated Contract generation now uses the unified PDF engine
 * This function is a no-op stub for backward compatibility
 */
export const ensureOrderContractUpToDate = async (params: {
  orderId: string;
  trigger: string;
  force?: boolean;
}) => {
  console.warn("[contractEngine] DEPRECATED: ensureOrderContractUpToDate is no longer used.");
  
  return {
    contractId: null,
    regenerated: false,
    message: "Contract engine has been deprecated.",
    pdfHash: null,
  };
};
