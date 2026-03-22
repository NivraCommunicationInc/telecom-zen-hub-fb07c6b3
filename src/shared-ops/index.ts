/**
 * shared-ops — Canonical shared operations layer.
 * Single source of truth for data loaders and actions used by Core + Employee portals.
 */

// Hooks
export { useOrderDetail } from "./hooks/useOrderDetail";
export type { OrderDetailData } from "./hooks/useOrderDetail";

export { useClientProfile } from "./hooks/useClientProfile";
export type { ClientProfileData } from "./hooks/useClientProfile";

export { usePaymentsList } from "./hooks/usePaymentsList";
export type { PaymentItem } from "./hooks/usePaymentsList";

export { useInvoicesList } from "./hooks/useInvoicesList";
export type { InvoiceItem } from "./hooks/useInvoicesList";

export { useOperationalQueue } from "./hooks/useOperationalQueue";
export type { WorkQueueItem, AppointmentQueueItem } from "./hooks/useOperationalQueue";

export { useOrdersList } from "./hooks/useOrdersList";
export type { OrderListItem } from "./hooks/useOrdersList";

// Actions
export { updateOrderStatus } from "./actions/updateOrderStatus";
export type { StatusUpdateParams } from "./actions/updateOrderStatus";

export { addOperationalNote } from "./actions/addOperationalNote";
export type { AddNoteParams } from "./actions/addOperationalNote";