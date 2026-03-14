/**
 * AdminPayments v1 — DEPRECATED & KILLED
 * 
 * This legacy page wrote to the `payments` table (not `billing_payments`).
 * All payment operations now go through AdminPaymentsV2 → billing_payments.
 * 
 * Hard redirect to canonical /admin/payments (which renders AdminPaymentsV2).
 */
import { Navigate } from "react-router-dom";

const AdminPayments = () => <Navigate to="/admin/payments" replace />;

export default AdminPayments;
