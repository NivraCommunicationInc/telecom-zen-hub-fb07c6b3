/**
 * HubTraining — Unified entry into Nivra Academy from the Source Hub.
 * Detects which portal is hosting the hub (Field vs Employee/OneView CS)
 * and embeds the single canonical AcademyPortal. The legacy hub_posts
 * training system has been retired in favour of training_modules.
 */
import { useLocation } from "react-router-dom";
import AcademyPortal from "@/shared-training/AcademyPortal";

export default function HubTraining(_props: { search?: string } = {}) {
  const { pathname } = useLocation();
  const portal: "field" | "cs" = pathname.startsWith("/field") ? "field" : "cs";
  return (
    <div className="-mx-4 md:-mx-6">
      <AcademyPortal portal={portal} />
    </div>
  );
}
