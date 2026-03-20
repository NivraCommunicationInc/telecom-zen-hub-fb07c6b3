/**
 * Step 4 — Installation / Fulfillment type selection
 */
import { CalendarDays, Wrench, Truck, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldSaleInstallation, FieldSaleService } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  services: FieldSaleService[];
  installation: FieldSaleInstallation;
  onChange: (i: FieldSaleInstallation) => void;
  onNext: () => void;
  onBack: () => void;
}

const TIME_WINDOWS = ["09h00 - 12h00", "12h00 - 15h00", "15h00 - 18h00"];

function getNextAvailableDates(): string[] {
  const dates: string[] = [];
  const now = new Date();
  let d = new Date(now);
  d.setDate(d.getDate() + 2); // min 2 days out
  for (let i = 0; i < 14 && dates.length < 10; i++) {
    const day = d.getDay();
    if (day !== 0) { // skip Sunday
      dates.push(d.toISOString().split("T")[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export default function StepInstallation({ services, installation, onChange, onNext, onBack }: Props) {
  const hasResidential = services.some((s) => ["internet", "tv"].includes(s.category));
  const isMobileOnly = services.every((s) => s.category === "mobile");

  const availableDates = getNextAvailableDates();

  if (isMobileOnly) {
    // Mobile-only: auto self-install
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#000000]">Livraison</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">Services mobiles uniquement — activation automatique.</p>
        </div>
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-5 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5 text-[#16A34A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#000000]">Auto-activation</p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              La carte SIM / eSIM sera activée automatiquement. Aucune installation requise.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
            ← Retour
          </button>
          <button type="button" onClick={onNext} className="flex-1 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors">
            Continuer →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Installation</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">Choisissez le mode d'installation pour les services résidentiels.</p>
      </div>

      {/* Install type selection */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange({ ...installation, type: "technician", scheduledDate: null, timeWindow: null })}
          className={cn(
            "p-4 rounded-xl border-2 text-left transition-all",
            installation.type === "technician"
              ? "border-[#22C55E] bg-[#F0FDF4]"
              : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
          )}
        >
          <Wrench className={cn("h-6 w-6 mb-2", installation.type === "technician" ? "text-[#16A34A]" : "text-[#6B7280]")} />
          <p className="text-sm font-semibold text-[#000000]">Technicien</p>
          <p className="text-[11px] text-[#6B7280] mt-0.5">Installation professionnelle à domicile</p>
        </button>
        <button
          type="button"
          onClick={() => onChange({ type: "self_install", scheduledDate: null, timeWindow: null })}
          className={cn(
            "p-4 rounded-xl border-2 text-left transition-all",
            installation.type === "self_install"
              ? "border-[#22C55E] bg-[#F0FDF4]"
              : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
          )}
        >
          <Truck className={cn("h-6 w-6 mb-2", installation.type === "self_install" ? "text-[#16A34A]" : "text-[#6B7280]")} />
          <p className="text-sm font-semibold text-[#000000]">Auto-installation</p>
          <p className="text-[11px] text-[#6B7280] mt-0.5">Équipement expédié, guide inclus</p>
        </button>
      </div>

      {/* Technician scheduling */}
      {installation.type === "technician" && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#22C55E]" />
            <h3 className="text-sm font-semibold text-[#000000]">Choisir une date</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {availableDates.map((d) => {
              const label = new Date(d + "T12:00:00").toLocaleDateString("fr-CA", {
                weekday: "short", day: "numeric", month: "short",
              });
              const active = installation.scheduledDate === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChange({ ...installation, scheduledDate: d })}
                  className={cn(
                    "py-2.5 px-3 rounded-lg border text-xs font-medium transition-colors text-left",
                    active
                      ? "bg-[#22C55E] text-white border-[#22C55E]"
                      : "border-[#E5E7EB] text-[#374151] hover:border-[#22C55E] hover:bg-[#F0FDF4]"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {installation.scheduledDate && (
            <div>
              <h4 className="text-xs font-medium text-[#374151] mb-2">Plage horaire</h4>
              <div className="flex gap-2">
                {TIME_WINDOWS.map((tw) => {
                  const active = installation.timeWindow === tw;
                  return (
                    <button
                      key={tw}
                      type="button"
                      onClick={() => onChange({ ...installation, timeWindow: tw })}
                      className={cn(
                        "flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                        active
                          ? "bg-[#22C55E] text-white border-[#22C55E]"
                          : "border-[#E5E7EB] text-[#374151] hover:border-[#22C55E]"
                      )}
                    >
                      {tw}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {installation.type === "self_install" && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 text-sm text-[#16A34A]">
          <p className="font-medium">📦 Expédition standard</p>
          <p className="text-xs text-[#6B7280] mt-1">
            L'équipement sera expédié à l'adresse de service. Le client recevra un guide d'installation.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
          ← Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={installation.type === "technician" && !installation.scheduledDate}
          className="flex-1 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuer →
        </button>
      </div>
    </div>
  );
}
