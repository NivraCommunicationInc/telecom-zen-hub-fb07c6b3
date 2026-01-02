import { useState, useEffect, useCallback, useRef } from 'react';

// Storage key for order drafts
const DRAFT_STORAGE_KEY = 'nivra_order_draft';

// Order draft interface - single source of truth
export interface OrderDraft {
  // Meta
  draftId: string;
  createdAt: string;
  updatedAt: string;
  orderType: 'tv' | 'internet' | 'mobile';
  
  // Step tracking
  currentStep: number;
  stepsCompleted: {
    address: boolean;
    planSelection: boolean;
    channels: boolean;
    confirmation: boolean;
  };
  
  // Address
  address: string;
  addressValidation: {
    isValid: boolean;
    isQuebec: boolean;
    formattedAddress: string;
    city: string;
    province: string;
    postalCode: string;
  } | null;
  
  // Plan selection
  selectedPlanId: string | null;
  
  // Channels (TV orders only)
  selectedFreeChannelIds: string[];
  selectedPremiumChannelIds: string[];
  
  // Streaming services
  selectedStreamingServiceIds: string[];
  
  // Equipment
  terminalCount: number;
  installationMethod: 'auto' | 'technician';
  
  // Scheduling
  selectedDate: string;
  selectedTime: string;
  
  // Promo
  discountCode: string;
  installationCredit: number;
  
  // Notes
  notes: string;
}

// Generate unique draft ID
const generateDraftId = () => {
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// Create empty draft
const createEmptyDraft = (orderType: 'tv' | 'internet' | 'mobile'): OrderDraft => ({
  draftId: generateDraftId(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  orderType,
  currentStep: 1,
  stepsCompleted: {
    address: false,
    planSelection: false,
    channels: false,
    confirmation: false,
  },
  address: '',
  addressValidation: null,
  selectedPlanId: null,
  selectedFreeChannelIds: [],
  selectedPremiumChannelIds: [],
  selectedStreamingServiceIds: [],
  terminalCount: 1,
  installationMethod: 'auto',
  selectedDate: '',
  selectedTime: '',
  discountCode: '',
  installationCredit: 0,
  notes: '',
});

// Load draft from storage
const loadDraftFromStorage = (orderType: 'tv' | 'internet' | 'mobile'): OrderDraft | null => {
  try {
    const stored = sessionStorage.getItem(`${DRAFT_STORAGE_KEY}_${orderType}`);
    if (stored) {
      const draft = JSON.parse(stored) as OrderDraft;
      // Validate that draft is not stale (24 hours)
      const createdAt = new Date(draft.createdAt).getTime();
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (now - createdAt < maxAge) {
        return draft;
      }
    }
  } catch (e) {
    console.error('Failed to load order draft:', e);
  }
  return null;
};

// Save draft to storage
const saveDraftToStorage = (draft: OrderDraft) => {
  try {
    const updatedDraft = { ...draft, updatedAt: new Date().toISOString() };
    sessionStorage.setItem(`${DRAFT_STORAGE_KEY}_${draft.orderType}`, JSON.stringify(updatedDraft));
  } catch (e) {
    console.error('Failed to save order draft:', e);
  }
};

// Clear draft from storage
const clearDraftFromStorage = (orderType: 'tv' | 'internet' | 'mobile') => {
  try {
    sessionStorage.removeItem(`${DRAFT_STORAGE_KEY}_${orderType}`);
  } catch (e) {
    console.error('Failed to clear order draft:', e);
  }
};

interface UseOrderDraftOptions {
  orderType: 'tv' | 'internet' | 'mobile';
  // Optional initial values from location state (one-time hydration)
  initialAddress?: string;
  initialAddressDetails?: {
    formattedAddress: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  initialPlanId?: string;
}

export const useOrderDraft = (options: UseOrderDraftOptions) => {
  const { orderType, initialAddress, initialAddressDetails, initialPlanId } = options;
  
  // Track if we've completed hydration
  const [isHydrated, setIsHydrated] = useState(false);
  const hasInitializedRef = useRef(false);
  
  // Initialize draft state
  const [draft, setDraft] = useState<OrderDraft>(() => {
    // First try to load from storage
    const storedDraft = loadDraftFromStorage(orderType);
    if (storedDraft) {
      return storedDraft;
    }
    // Otherwise create empty draft
    return createEmptyDraft(orderType);
  });

  // Handle initial hydration from location state (one-time only)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    
    // Check if we have stored draft
    const storedDraft = loadDraftFromStorage(orderType);
    
    if (storedDraft) {
      // Use stored draft - don't override with location state
      setDraft(storedDraft);
    } else if (initialAddress && initialAddressDetails) {
      // No stored draft but we have location state - create new draft with these values
      const newDraft = createEmptyDraft(orderType);
      newDraft.address = initialAddress;
      newDraft.addressValidation = {
        isValid: true,
        isQuebec: true,
        formattedAddress: initialAddressDetails.formattedAddress,
        city: initialAddressDetails.city || '',
        province: 'QC',
        postalCode: initialAddressDetails.postalCode || '',
      };
      newDraft.stepsCompleted.address = true;
      
      if (initialPlanId) {
        newDraft.selectedPlanId = initialPlanId;
        newDraft.stepsCompleted.planSelection = true;
        newDraft.currentStep = 3; // Go to channels step if plan is selected
      } else {
        newDraft.currentStep = 2; // Go to plan selection
      }
      
      setDraft(newDraft);
      saveDraftToStorage(newDraft);
    }
    
    setIsHydrated(true);
  }, [orderType, initialAddress, initialAddressDetails, initialPlanId]);

  // Save draft whenever it changes (after hydration)
  useEffect(() => {
    if (isHydrated) {
      saveDraftToStorage(draft);
    }
  }, [draft, isHydrated]);

  // Update draft helper - preserves other fields
  const updateDraft = useCallback((updates: Partial<OrderDraft>) => {
    setDraft(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Step navigation helpers
  const setStep = useCallback((step: number) => {
    setDraft(prev => ({
      ...prev,
      currentStep: step,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const completeStep = useCallback((stepName: keyof OrderDraft['stepsCompleted']) => {
    setDraft(prev => ({
      ...prev,
      stepsCompleted: {
        ...prev.stepsCompleted,
        [stepName]: true,
      },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Address helpers
  const setAddress = useCallback((address: string, validation: OrderDraft['addressValidation'] | null) => {
    setDraft(prev => ({
      ...prev,
      address,
      addressValidation: validation,
      stepsCompleted: {
        ...prev.stepsCompleted,
        address: !!(validation?.isValid && validation?.isQuebec),
      },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Plan selection helpers
  const selectPlan = useCallback((planId: string | null) => {
    setDraft(prev => ({
      ...prev,
      selectedPlanId: planId,
      stepsCompleted: {
        ...prev.stepsCompleted,
        planSelection: !!planId,
      },
      // Clear channel selections when plan changes
      selectedFreeChannelIds: [],
      selectedPremiumChannelIds: [],
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Channel selection helpers
  const setFreeChannels = useCallback((channelIds: string[]) => {
    setDraft(prev => ({
      ...prev,
      selectedFreeChannelIds: channelIds,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setPremiumChannels = useCallback((channelIds: string[]) => {
    setDraft(prev => ({
      ...prev,
      selectedPremiumChannelIds: channelIds,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Streaming services helpers
  const setStreamingServices = useCallback((serviceIds: string[]) => {
    setDraft(prev => ({
      ...prev,
      selectedStreamingServiceIds: serviceIds,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Equipment helpers
  const setTerminalCount = useCallback((count: number) => {
    setDraft(prev => ({
      ...prev,
      terminalCount: count,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setInstallationMethod = useCallback((method: 'auto' | 'technician') => {
    setDraft(prev => ({
      ...prev,
      installationMethod: method,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Scheduling helpers
  const setSchedule = useCallback((date: string, time: string) => {
    setDraft(prev => ({
      ...prev,
      selectedDate: date,
      selectedTime: time,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Promo helpers
  const setPromo = useCallback((code: string, credit: number) => {
    setDraft(prev => ({
      ...prev,
      discountCode: code,
      installationCredit: credit,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Notes helpers
  const setNotes = useCallback((notes: string) => {
    setDraft(prev => ({
      ...prev,
      notes,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  // Clear draft (after successful order or explicit reset)
  const clearDraft = useCallback(() => {
    clearDraftFromStorage(orderType);
    setDraft(createEmptyDraft(orderType));
  }, [orderType]);

  // Check if we should redirect to plan selection
  const shouldRedirectToPlanSelection = useCallback(() => {
    // Only redirect if hydrated AND no plan is selected AND we're past step 2
    return isHydrated && !draft.selectedPlanId && draft.currentStep > 2;
  }, [isHydrated, draft.selectedPlanId, draft.currentStep]);

  return {
    draft,
    isHydrated,
    updateDraft,
    setStep,
    completeStep,
    setAddress,
    selectPlan,
    setFreeChannels,
    setPremiumChannels,
    setStreamingServices,
    setTerminalCount,
    setInstallationMethod,
    setSchedule,
    setPromo,
    setNotes,
    clearDraft,
    shouldRedirectToPlanSelection,
  };
};
