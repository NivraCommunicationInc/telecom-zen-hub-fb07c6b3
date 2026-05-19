/**
 * FieldCrm — Outbound Call Center for Field agents.
 * Uses the shared CrmCenter component.
 */
import { CrmCenter } from "@/shared-crm/components/CrmCenter";
import { fieldPath } from "@/field-app/lib/fieldPaths";

export default function FieldCrm() {
  return (
    <CrmCenter
      portal="field"
      variant="dark"
      saleRouteBuilder={(contactId) => fieldPath("/sale/new") + `?prospect=${contactId}`}
    />
  );
}
