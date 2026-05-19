/**
 * EmployeeCrm — Outbound Call Center for Nivra OneView CS agents.
 */
import { CrmCenter } from "@/shared-crm/components/CrmCenter";
import { employeePath } from "@/employee-app/lib/employeePaths";

export default function EmployeeCrm() {
  return (
    <CrmCenter
      portal="employee"
      variant="light"
      saleRouteBuilder={(contactId) => employeePath(`/orders/new?prospect=${contactId}`)}
    />
  );
}
