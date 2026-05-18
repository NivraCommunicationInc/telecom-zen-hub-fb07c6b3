/**
 * CoreTechnicianMapPage — Carte des techniciens en temps réel.
 * Route: /core/technicians/map
 */
import TechnicianMapView from "@/core-app/components/TechnicianMapView";

export default function CoreTechnicianMapPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Carte techniciens</h1>
        <p className="text-sm text-muted-foreground">
          Positions GPS en temps réel des techniciens partageant leur position.
          Les marqueurs s'actualisent automatiquement toutes les 30 secondes.
        </p>
      </div>
      <TechnicianMapView />
    </div>
  );
}
