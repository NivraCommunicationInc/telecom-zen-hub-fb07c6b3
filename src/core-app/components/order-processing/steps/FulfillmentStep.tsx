/**
 * FulfillmentStep — Step 5: Choose fulfillment routing
 */
import { Button } from "@/components/ui/button";
import { Truck, Wrench, Download, Wifi, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { proc: any; }

const FULFILLMENT_OPTIONS = [
  { value: "shipping", label: "Expédition / Livraison", icon: Truck, desc: "Envoi par transporteur" },
  { value: "technician", label: "Installation technicien", icon: Wrench, desc: "Technicien sur place" },
  { value: "self_install", label: "Auto-installation", icon: Download, desc: "Client installe lui-même" },
  { value: "digital", label: "Numérique seulement", icon: Wifi, desc: "Activation à distance" },
];

export function FulfillmentStep({ proc }: Props) {
  const { order } = proc;
  const current = order.fulfillment_type;

  const handleSelect = async (type: string) => {
    await proc.setFulfillmentType(type);
  };

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Fulfillment / Routing</h3>
      <p className="text-sm text-gray-500 mb-4">Sélectionnez le mode de livraison pour cette commande.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FULFILLMENT_OPTIONS.map((opt) => {
          const isSelected = current === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              disabled={proc.isUpdating}
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all",
                isSelected
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-400 bg-white"
              )}
            >
              <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", isSelected ? "text-gray-900" : "text-gray-400")} />
              <div>
                <p className={cn("text-sm font-medium", isSelected ? "text-gray-900" : "text-gray-700")}>{opt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
              {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto mt-0.5" />}
            </button>
          );
        })}
      </div>

      {current && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
          <p className="text-sm text-emerald-800">
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
            Mode sélectionné: <span className="font-semibold">{FULFILLMENT_OPTIONS.find(o => o.value === current)?.label || current}</span>
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
        <Button size="sm" onClick={() => proc.setActiveStep("equipment")} className="text-xs h-8 bg-gray-900 text-white hover:bg-gray-800">
          Continuer →
        </Button>
      </div>
    </div>
  );
}
