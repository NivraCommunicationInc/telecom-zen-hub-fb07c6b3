/**
 * CoreCrm — Outbound Call Center admin view for Nivra Core.
 * Full visibility on all contacts, all agents, assignations and stats.
 */
import { CrmCenter } from "@/shared-crm/components/CrmCenter";
import { CrmTerritoriesPanel } from "@/shared-crm/components/CrmTerritoriesPanel";
import { corePath } from "@/core-app/lib/corePaths";

export default function CoreCrm() {
  return (
    <div className="space-y-4">
      <CrmTerritoriesPanel variant="light" />
      <CrmCenter
        portal="core"
        variant="light"
        isAdmin
        saleRouteBuilder={(contactId) => corePath(`/pos?prospect=${contactId}`)}
      />
    </div>
  );
}
