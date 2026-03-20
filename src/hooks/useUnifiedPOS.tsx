/**
 * useUnifiedPOS - Unified hook for POS cart management.
 * ⛔ NO LOCAL TAX MATH — taxes/totals must come from server RPC at submission time.
 * Cart subtotals (item sums) are kept for display purposes only.
 */
import { useMemo, useCallback, useState } from "react";
import { EquipmentItem } from "@/components/pos/POSEquipmentSelector";
import { AdjustmentItem } from "@/components/pos/POSAdjustments";
import { SelectedService } from "@/hooks/useFieldSalesOffers";

export interface POSCartTotals {
  // Services
  monthlySubtotal: number;
  setupSubtotal: number;
  
  // Equipment (one-time)
  equipmentTotal: number;
  
  // Adjustments
  adjustmentsTotal: number;
  feesTotal: number;
  creditsTotal: number;
  
  // Activation fee
  activationFee: number;
  
  // Subtotals
  oneTimeSubtotal: number;
  recurringSubtotal: number;
  
  // Taxes
  taxableAmount: number;
  tps: number;
  tvq: number;
  
  // Finals
  firstMonthTotal: number;
  recurringMonthly: number;
}

export interface UnifiedPOSState {
  services: SelectedService[];
  equipment: EquipmentItem[];
  adjustments: AdjustmentItem[];
}

export function useUnifiedPOS(initialState?: Partial<UnifiedPOSState>) {
  const [services, setServices] = useState<SelectedService[]>(initialState?.services || []);
  const [equipment, setEquipment] = useState<EquipmentItem[]>(initialState?.equipment || []);
  const [adjustments, setAdjustments] = useState<AdjustmentItem[]>(initialState?.adjustments || []);

  // Calculate totals
  const totals = useMemo<POSCartTotals>(() => {
    // Monthly services
    const monthlySubtotal = services.reduce((sum, s) => sum + (s.priceMonthly * s.quantity), 0);
    const setupSubtotal = services.reduce((sum, s) => sum + (s.priceSetup * s.quantity), 0);
    
    // Equipment (one-time purchase)
    const equipmentTotal = equipment.reduce((sum, e) => sum + (e.price * e.quantity), 0);
    
    // Adjustments
    const fees = adjustments.filter(a => a.amount > 0);
    const credits = adjustments.filter(a => a.amount < 0);
    const feesTotal = fees.reduce((sum, a) => sum + a.amount, 0);
    const creditsTotal = credits.reduce((sum, a) => sum + a.amount, 0); // Already negative
    const adjustmentsTotal = feesTotal + creditsTotal;
    
    // Activation fee (grouped rate)
    const serviceCount = services.length;
    const activationFee = serviceCount === 0 ? 0 : serviceCount === 1 ? 25 : 45;
    
    // Subtotals
    const oneTimeSubtotal = setupSubtotal + equipmentTotal + activationFee + adjustmentsTotal;
    const recurringSubtotal = monthlySubtotal;
    
    // First month taxable: monthly + one-time
    const taxableAmount = recurringSubtotal + oneTimeSubtotal;
    
    // ⛔ NO LOCAL TAX MATH — taxes set to 0 as placeholders.
    // Real taxes computed server-side at order submission via compute_checkout_pricing RPC.
    const tps = 0;
    const tvq = 0;
    
    // Display-only estimates (NOT authoritative)
    const firstMonthTotal = taxableAmount; // Without taxes — server will compute final
    const recurringMonthly = monthlySubtotal; // Without taxes — server will compute final
    
    return {
      monthlySubtotal,
      setupSubtotal,
      equipmentTotal,
      adjustmentsTotal,
      feesTotal,
      creditsTotal,
      activationFee,
      oneTimeSubtotal,
      recurringSubtotal,
      taxableAmount,
      tps,
      tvq,
      firstMonthTotal,
      recurringMonthly,
    };
  }, [services, equipment, adjustments]);

  // Service actions
  const addService = useCallback((service: SelectedService) => {
    setServices(prev => {
      const exists = prev.find(s => s.offerId === service.offerId);
      if (exists) {
        return prev.map(s => 
          s.offerId === service.offerId 
            ? { ...s, quantity: s.quantity + 1 }
            : s
        );
      }
      return [...prev, { ...service, quantity: 1 }];
    });
  }, []);

  const removeService = useCallback((offerId: string) => {
    setServices(prev => prev.filter(s => s.offerId !== offerId));
  }, []);

  const updateServiceQuantity = useCallback((offerId: string, delta: number) => {
    setServices(prev => 
      prev.map(s => {
        if (s.offerId === offerId) {
          const newQty = Math.max(1, s.quantity + delta);
          return { ...s, quantity: newQty };
        }
        return s;
      })
    );
  }, []);

  // Equipment actions
  const addEquipment = useCallback((item: Omit<EquipmentItem, "id" | "quantity">) => {
    const newItem: EquipmentItem = {
      ...item,
      id: `${item.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      quantity: 1,
    };
    setEquipment(prev => [...prev, newItem]);
  }, []);

  const removeEquipment = useCallback((id: string) => {
    setEquipment(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateEquipmentQuantity = useCallback((id: string, delta: number) => {
    setEquipment(prev => 
      prev.map(e => {
        if (e.id === id) {
          return { ...e, quantity: Math.max(1, e.quantity + delta) };
        }
        return e;
      })
    );
  }, []);

  // Adjustment actions
  const addAdjustment = useCallback((item: Omit<AdjustmentItem, "id">) => {
    const newItem: AdjustmentItem = {
      ...item,
      id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setAdjustments(prev => [...prev, newItem]);
  }, []);

  const removeAdjustment = useCallback((id: string) => {
    setAdjustments(prev => prev.filter(a => a.id !== id));
  }, []);

  // Clear all
  const clearCart = useCallback(() => {
    setServices([]);
    setEquipment([]);
    setAdjustments([]);
  }, []);

  // Get cart summary for order
  const getOrderPayload = useCallback(() => {
    return {
      services: services.map(s => ({
        offer_id: s.offerId,
        name: s.name,
        category: s.category,
        price_monthly: s.priceMonthly,
        price_setup: s.priceSetup,
        quantity: s.quantity,
      })),
      equipment: equipment.map(e => ({
        type: e.type,
        name: e.name,
        description: e.description,
        price: e.price,
        quantity: e.quantity,
        serial_number: e.serialNumber || null,
      })),
      adjustments: adjustments.map(a => ({
        type: a.type,
        name: a.name,
        amount: a.amount,
        description: a.description || null,
      })),
      totals: {
        monthly_subtotal: totals.monthlySubtotal,
        equipment_total: totals.equipmentTotal,
        adjustments_total: totals.adjustmentsTotal,
        activation_fee: totals.activationFee,
        tps: totals.tps,
        tvq: totals.tvq,
        first_month_total: totals.firstMonthTotal,
        recurring_monthly: totals.recurringMonthly,
      },
    };
  }, [services, equipment, adjustments, totals]);

  const itemCount = services.reduce((sum, s) => sum + s.quantity, 0) + 
                    equipment.reduce((sum, e) => sum + e.quantity, 0) +
                    adjustments.length;

  const isEmpty = services.length === 0 && equipment.length === 0 && adjustments.length === 0;

  return {
    // State
    services,
    equipment,
    adjustments,
    totals,
    itemCount,
    isEmpty,
    
    // Setters (for controlled usage)
    setServices,
    setEquipment,
    setAdjustments,
    
    // Actions
    addService,
    removeService,
    updateServiceQuantity,
    addEquipment,
    removeEquipment,
    updateEquipmentQuantity,
    addAdjustment,
    removeAdjustment,
    clearCart,
    getOrderPayload,
  };
}

// Standalone calculation function (for components that manage their own state)
export function calculateUnifiedPOSTotals(
  services: SelectedService[],
  equipment: EquipmentItem[],
  adjustments: AdjustmentItem[]
): POSCartTotals {
  const monthlySubtotal = services.reduce((sum, s) => sum + (s.priceMonthly * s.quantity), 0);
  const setupSubtotal = services.reduce((sum, s) => sum + (s.priceSetup * s.quantity), 0);
  const equipmentTotal = equipment.reduce((sum, e) => sum + (e.price * e.quantity), 0);
  
  const fees = adjustments.filter(a => a.amount > 0);
  const credits = adjustments.filter(a => a.amount < 0);
  const feesTotal = fees.reduce((sum, a) => sum + a.amount, 0);
  const creditsTotal = credits.reduce((sum, a) => sum + a.amount, 0);
  const adjustmentsTotal = feesTotal + creditsTotal;
  
  const serviceCount = services.length;
  const activationFee = serviceCount === 0 ? 0 : serviceCount === 1 ? 25 : 45;
  
  const oneTimeSubtotal = setupSubtotal + equipmentTotal + activationFee + adjustmentsTotal;
  const recurringSubtotal = monthlySubtotal;
  const taxableAmount = recurringSubtotal + oneTimeSubtotal;
  
  // ⛔ NO LOCAL TAX MATH
  const tps = 0;
  const tvq = 0;
  const firstMonthTotal = taxableAmount;
  const recurringMonthly = monthlySubtotal;
  
  return {
    monthlySubtotal,
    setupSubtotal,
    equipmentTotal,
    adjustmentsTotal,
    feesTotal,
    creditsTotal,
    activationFee,
    oneTimeSubtotal,
    recurringSubtotal,
    taxableAmount,
    tps,
    tvq,
    firstMonthTotal,
    recurringMonthly,
  };
}
