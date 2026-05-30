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

export { useAppointmentDetail, useAppointmentsList } from "./hooks/useAppointmentDetail";
export type { AppointmentDetailData } from "./hooks/useAppointmentDetail";

export { useInvoiceDetail } from "./hooks/useInvoiceDetail";
export type { InvoiceDetailData } from "./hooks/useInvoiceDetail";

export { useSubscriptionDetail } from "./hooks/useSubscriptionDetail";
export type { SubscriptionDetailData } from "./hooks/useSubscriptionDetail";

// Actions
export { updateOrderStatus } from "./actions/updateOrderStatus";
export type { StatusUpdateParams } from "./actions/updateOrderStatus";

export { addOperationalNote } from "./actions/addOperationalNote";
export type { AddNoteParams } from "./actions/addOperationalNote";

export { recordPayment } from "./actions/recordPayment";
export type { RecordPaymentParams, PaymentMethod } from "./actions/recordPayment";

// Components
export { PaymentMethodPicker } from "./components/PaymentMethodPicker";
export type { SharedPaymentMethod, PaymentMethodPickerProps } from "./components/PaymentMethodPicker";