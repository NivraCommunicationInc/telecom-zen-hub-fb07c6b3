/**
 * @deprecated This folder has been deprecated.
 * Use imports from @/lib/pdf instead.
 */

export * from "../pdf";
export type { ContractData as TelecomContractData } from "../pdf";
export type { InvoiceDataV2 as InvoiceData } from "../pdf";

export interface UnifiedDocumentData {
  docType?: "contract" | "invoice" | "estimate";
  [key: string]: any;
}
