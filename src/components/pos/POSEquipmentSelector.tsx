/**
 * POSEquipmentSelector - Professional equipment selection for POS
 * Supports: Router, Decoder, SIM, Security equipment (one-time purchase)
 */
import { useState } from "react";
import { Wifi, Tv, Smartphone, Shield, Plus, Minus, X, Package, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface EquipmentItem {
  id: string;
  type: "router" | "decoder" | "sim" | "security";
  name: string;
  description: string;
  price: number; // One-time purchase price
  serialNumber?: string;
  quantity: number;
}

interface EquipmentConfig {
  type: EquipmentItem["type"];
  label: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  defaultItems: Omit<EquipmentItem, "id" | "quantity" | "serialNumber">[];
}

const EQUIPMENT_CONFIG: EquipmentConfig[] = [
  {
    type: "router",
    label: "Internet / Routeur",
    icon: Wifi,
    color: "text-cyan-400",
    gradient: "from-cyan-500 to-blue-600",
    defaultItems: [
      { type: "router", name: "Routeur WiFi 6", description: "Routeur haute performance", price: 99.99 },
      { type: "router", name: "Modem DOCSIS 3.1", description: "Modem câble compatible", price: 79.99 },
      { type: "router", name: "WiFi Mesh (1 unité)", description: "Extension de couverture", price: 149.99 },
      { type: "router", name: "ONT Fibre", description: "Terminal fibre optique", price: 0 },
    ],
  },
  {
    type: "decoder",
    label: "TV / Décodeur",
    icon: Tv,
    color: "text-purple-400",
    gradient: "from-purple-500 to-pink-600",
    defaultItems: [
      { type: "decoder", name: "Décodeur IPTV HD", description: "Streaming HD standard", price: 49.99 },
      { type: "decoder", name: "Décodeur IPTV 4K", description: "Streaming Ultra HD", price: 89.99 },
      { type: "decoder", name: "DVR 500GB", description: "Enregistreur numérique", price: 129.99 },
      { type: "decoder", name: "Fire TV Stick", description: "Clé streaming Amazon", price: 39.99 },
    ],
  },
  {
    type: "sim",
    label: "Mobile / SIM",
    icon: Smartphone,
    color: "text-emerald-400",
    gradient: "from-emerald-500 to-green-600",
    defaultItems: [
      { type: "sim", name: "Carte SIM Standard", description: "Format standard", price: 0 },
      { type: "sim", name: "Carte SIM Nano", description: "Format nano", price: 0 },
      { type: "sim", name: "eSIM (Activation)", description: "SIM intégrée", price: 0 },
      { type: "sim", name: "Téléphone débloqué", description: "Appareil compatible", price: 199.99 },
    ],
  },
  {
    type: "security",
    label: "Sécurité",
    icon: Shield,
    color: "text-red-400",
    gradient: "from-red-500 to-orange-600",
    defaultItems: [
      { type: "security", name: "Caméra intérieure WiFi", description: "1080p avec vision nocturne", price: 79.99 },
      { type: "security", name: "Caméra extérieure", description: "Résistante aux intempéries", price: 129.99 },
      { type: "security", name: "Panneau de contrôle", description: "Hub central domotique", price: 199.99 },
      { type: "security", name: "Capteur de mouvement", description: "Détection PIR", price: 39.99 },
      { type: "security", name: "Capteur porte/fenêtre", description: "Contact magnétique", price: 29.99 },
    ],
  },
];

interface POSEquipmentSelectorProps {
  selectedEquipment: EquipmentItem[];
  onEquipmentChange: (equipment: EquipmentItem[]) => void;
  compact?: boolean;
}

export function POSEquipmentSelector({
  selectedEquipment,
  onEquipmentChange,
  compact = false,
}: POSEquipmentSelectorProps) {
  const [activeTab, setActiveTab] = useState<EquipmentItem["type"]>("router");

  const addEquipment = (item: Omit<EquipmentItem, "id" | "quantity" | "serialNumber">) => {
    const newItem: EquipmentItem = {
      ...item,
      id: `${item.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      quantity: 1,
    };
    onEquipmentChange([...selectedEquipment, newItem]);
  };

  const removeEquipment = (id: string) => {
    onEquipmentChange(selectedEquipment.filter(e => e.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    onEquipmentChange(
      selectedEquipment.map(e => {
        if (e.id === id) {
          const newQty = Math.max(1, e.quantity + delta);
          return { ...e, quantity: newQty };
        }
        return e;
      })
    );
  };

  const updateSerialNumber = (id: string, serialNumber: string) => {
    onEquipmentChange(
      selectedEquipment.map(e => {
        if (e.id === id) {
          return { ...e, serialNumber };
        }
        return e;
      })
    );
  };

  const activeConfig = EQUIPMENT_CONFIG.find(c => c.type === activeTab)!;
  const equipmentTotal = selectedEquipment.reduce((sum, e) => sum + e.price * e.quantity, 0);

  return (
    <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Package className="h-5 w-5 text-orange-400" />
            </div>
            Équipements
          </CardTitle>
          {selectedEquipment.length > 0 && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
              {selectedEquipment.length} sélectionné{selectedEquipment.length > 1 ? "s" : ""} • {equipmentTotal.toFixed(2)}$
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {EQUIPMENT_CONFIG.map(config => {
            const Icon = config.icon;
            const isActive = activeTab === config.type;
            const count = selectedEquipment.filter(e => e.type === config.type).length;

            return (
              <button
                key={config.type}
                onClick={() => setActiveTab(config.type)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0",
                  "border font-medium text-sm",
                  isActive
                    ? `bg-gradient-to-r ${config.gradient} border-transparent text-white shadow-lg`
                    : "border-slate-700/50 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className={compact ? "hidden sm:inline" : ""}>{config.label.split(" / ")[0]}</span>
                {count > 0 && (
                  <Badge className={cn(
                    "h-5 min-w-5 p-0 flex items-center justify-center text-[10px] font-bold",
                    isActive ? "bg-white/20 text-white" : "bg-orange-500 text-white"
                  )}>
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Available Equipment List */}
        <ScrollArea className="h-48">
          <div className="space-y-2 pr-2">
            {activeConfig.defaultItems.map((item, idx) => {
              const Icon = activeConfig.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors"
                >
                  <div className={cn("p-2 rounded-lg bg-gradient-to-br text-white", activeConfig.gradient)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 truncate">{item.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-orange-400 font-bold text-sm">
                      {item.price > 0 ? `${item.price.toFixed(2)}$` : "Gratuit"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addEquipment(item)}
                    className="bg-orange-500 hover:bg-orange-400 text-white shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Selected Equipment */}
        {selectedEquipment.length > 0 && (
          <div className="border-t border-slate-700/50 pt-4">
            <p className="text-sm font-medium text-slate-300 mb-3">Équipements sélectionnés</p>
            <div className="space-y-2">
              {selectedEquipment.map(item => {
                const config = EQUIPMENT_CONFIG.find(c => c.type === item.type)!;
                const Icon = config.icon;

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30"
                  >
                    <div className={cn("p-1.5 rounded-lg", config.color.replace("text-", "bg-").replace("-400", "-500/20"))}>
                      <Icon className={cn("h-3.5 w-3.5", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.name}</p>
                      <Input
                        placeholder="N° série (optionnel)"
                        value={item.serialNumber || ""}
                        onChange={(e) => updateSerialNumber(item.id, e.target.value)}
                        className="mt-1 h-7 text-xs bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-white"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-white font-bold w-6 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-white"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-orange-400 font-bold text-sm w-16 text-right">
                        {(item.price * item.quantity).toFixed(2)}$
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => removeEquipment(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
