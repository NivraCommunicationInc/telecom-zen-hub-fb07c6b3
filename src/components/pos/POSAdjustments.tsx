/**
 * POSAdjustments - Fees and adjustments management for POS
 * Supports: Delivery, Installation, Credits/Fees, Custom lines
 */
import { useState } from "react";
import { Truck, Wrench, DollarSign, Plus, X, FileText, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface AdjustmentItem {
  id: string;
  type: "delivery" | "installation" | "credit" | "fee" | "custom";
  name: string;
  amount: number; // Positive = fee, Negative = credit
  description?: string;
}

interface AdjustmentPreset {
  type: AdjustmentItem["type"];
  name: string;
  amount: number;
  icon: React.ElementType;
  color: string;
}

const PRESET_ADJUSTMENTS: AdjustmentPreset[] = [
  { type: "delivery", name: "Livraison standard", amount: 15.00, icon: Truck, color: "text-blue-400" },
  { type: "delivery", name: "Livraison express", amount: 29.99, icon: Truck, color: "text-blue-400" },
  { type: "delivery", name: "Livraison gratuite", amount: 0, icon: Truck, color: "text-blue-400" },
  { type: "installation", name: "Installation standard", amount: 49.99, icon: Wrench, color: "text-amber-400" },
  { type: "installation", name: "Installation pro", amount: 99.99, icon: Wrench, color: "text-amber-400" },
  { type: "installation", name: "Auto-installation", amount: 0, icon: Wrench, color: "text-amber-400" },
  { type: "credit", name: "Crédit fidélité", amount: -25.00, icon: CreditCard, color: "text-emerald-400" },
  { type: "credit", name: "Geste commercial", amount: -10.00, icon: CreditCard, color: "text-emerald-400" },
  { type: "credit", name: "Crédit parrainage", amount: -50.00, icon: CreditCard, color: "text-emerald-400" },
  { type: "fee", name: "Frais de dossier", amount: 25.00, icon: FileText, color: "text-red-400" },
  { type: "fee", name: "Frais de retard", amount: 15.00, icon: FileText, color: "text-red-400" },
];

interface POSAdjustmentsProps {
  adjustments: AdjustmentItem[];
  onAdjustmentsChange: (adjustments: AdjustmentItem[]) => void;
  compact?: boolean;
}

export function POSAdjustments({
  adjustments,
  onAdjustmentsChange,
  compact = false,
}: POSAdjustmentsProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customType, setCustomType] = useState<"credit" | "fee">("fee");

  const addPreset = (preset: AdjustmentPreset) => {
    const newItem: AdjustmentItem = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: preset.type,
      name: preset.name,
      amount: preset.amount,
    };
    onAdjustmentsChange([...adjustments, newItem]);
  };

  const addCustom = () => {
    if (!customName.trim() || !customAmount) return;
    
    const amount = parseFloat(customAmount);
    if (isNaN(amount)) return;

    const newItem: AdjustmentItem = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "custom",
      name: customName.trim(),
      amount: customType === "credit" ? -Math.abs(amount) : Math.abs(amount),
    };
    
    onAdjustmentsChange([...adjustments, newItem]);
    setCustomName("");
    setCustomAmount("");
    setShowCustomForm(false);
  };

  const removeAdjustment = (id: string) => {
    onAdjustmentsChange(adjustments.filter(a => a.id !== id));
  };

  const totalAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const fees = adjustments.filter(a => a.amount > 0);
  const credits = adjustments.filter(a => a.amount < 0);

  const getIcon = (type: AdjustmentItem["type"]) => {
    switch (type) {
      case "delivery": return Truck;
      case "installation": return Wrench;
      case "credit": return CreditCard;
      case "fee": return FileText;
      default: return DollarSign;
    }
  };

  const getColor = (type: AdjustmentItem["type"], amount: number) => {
    if (amount < 0) return "text-emerald-400 bg-emerald-500/20";
    switch (type) {
      case "delivery": return "text-blue-400 bg-blue-500/20";
      case "installation": return "text-amber-400 bg-amber-500/20";
      default: return "text-red-400 bg-red-500/20";
    }
  };

  return (
    <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <DollarSign className="h-5 w-5 text-purple-400" />
            </div>
            Frais & Ajustements
          </CardTitle>
          {adjustments.length > 0 && (
            <Badge className={cn(
              "border",
              totalAdjustments >= 0
                ? "bg-red-500/20 text-red-400 border-red-500/30"
                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            )}>
              {totalAdjustments >= 0 ? "+" : ""}{totalAdjustments.toFixed(2)}$
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Add Buttons */}
        <div className="space-y-3">
          {/* Delivery */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              Livraison
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_ADJUSTMENTS.filter(p => p.type === "delivery").map((preset, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => addPreset(preset)}
                  className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-blue-500/20 hover:border-blue-500/50 hover:text-blue-400"
                >
                  {preset.name}
                  <span className="ml-1.5 text-xs opacity-75">
                    {preset.amount > 0 ? `+${preset.amount.toFixed(2)}$` : "Gratuit"}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Installation */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5" />
              Installation
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_ADJUSTMENTS.filter(p => p.type === "installation").map((preset, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => addPreset(preset)}
                  className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-400"
                >
                  {preset.name}
                  <span className="ml-1.5 text-xs opacity-75">
                    {preset.amount > 0 ? `+${preset.amount.toFixed(2)}$` : "Gratuit"}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Credits & Fees */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Crédits & Frais
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_ADJUSTMENTS.filter(p => p.type === "credit" || p.type === "fee").map((preset, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => addPreset(preset)}
                  className={cn(
                    "border-slate-700 bg-slate-800/50",
                    preset.amount < 0
                      ? "text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                      : "text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
                  )}
                >
                  {preset.name}
                  <span className="ml-1.5 text-xs opacity-75">
                    {preset.amount >= 0 ? "+" : ""}{preset.amount.toFixed(2)}$
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Line */}
        {!showCustomForm ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCustomForm(true)}
            className="w-full border-dashed border-slate-600 text-slate-400 hover:text-white hover:border-slate-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une ligne personnalisée
          </Button>
        ) : (
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Description"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="flex-1 bg-slate-900/50 border-slate-700 text-white h-9"
              />
              <Select value={customType} onValueChange={(v) => setCustomType(v as "credit" | "fee")}>
                <SelectTrigger className="w-28 bg-slate-900/50 border-slate-700 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="fee" className="text-white">Frais</SelectItem>
                  <SelectItem value="credit" className="text-white">Crédit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="bg-slate-900/50 border-slate-700 text-white h-9 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              </div>
              <Button
                size="sm"
                onClick={addCustom}
                disabled={!customName.trim() || !customAmount}
                className="bg-purple-500 hover:bg-purple-400"
              >
                Ajouter
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomForm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Applied Adjustments */}
        {adjustments.length > 0 && (
          <div className="border-t border-slate-700/50 pt-4">
            <p className="text-sm font-medium text-slate-300 mb-3">Ajustements appliqués</p>
            <div className="space-y-2">
              {adjustments.map(item => {
                const Icon = getIcon(item.type);
                const colorClass = getColor(item.type, item.amount);

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/30 border border-slate-700/30"
                  >
                    <div className={cn("p-1.5 rounded-lg", colorClass.split(" ")[1])}>
                      <Icon className={cn("h-3.5 w-3.5", colorClass.split(" ")[0])} />
                    </div>
                    <span className="flex-1 text-white text-sm truncate">{item.name}</span>
                    <span className={cn(
                      "font-bold text-sm",
                      item.amount < 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {item.amount >= 0 ? "+" : ""}{item.amount.toFixed(2)}$
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => removeAdjustment(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
