/**
 * AddressAutocomplete — THE SINGLE source of truth for address autocomplete.
 * 
 * CRITICAL IMPLEMENTATION NOTES:
 * - Uses internalValue as the source of truth for display (not parent's value)
 * - Uses onPointerDownCapture with preventDefault() + stopPropagation() to ensure selection before blur
 * - applySuggestion: setInternalValue → onValueChange → onSelect → then close dropdown (requestAnimationFrame)
 * - Shows warning if parent binding is incorrect (300ms after selection)
 * - DEV diagnostic panel shows prop value, internalValue, lastSelected, lastEvent
 * 
 * STANDARDIZED API:
 *   value: string                              — controlled input value
 *   onValueChange: (value: string) => void     — called on typing AND selection
 *   onSelect: (address: AddressValue) => void  — structured address object
 *   placeholder?: string
 *   disabled?: boolean
 *   restrictToQuebec?: boolean
 *   className?: string
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { backendClient } from "@/integrations/backend/client";
import { 
  AddressValue, 
  formatPostalCode, 
  normalizeProvince 
} from "./AddressTypes";

// Re-export AddressValue for convenience
export type { AddressValue };
export { createEmptyAddressValue, isAddressValueComplete } from "./AddressTypes";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface MapboxSuggestion {
  mapbox_id: string;
  name: string;
  full_address: string;
  place_formatted: string;
  context?: {
    postcode?: { name: string };
    place?: { name: string };
    region?: { name: string; region_code: string };
    country?: { name: string };
    street?: { name: string };
    address?: { street_number: string; address_number: string };
  };
}

export interface AddressAutocompleteProps {
  /** Controlled input value */
  value: string;
  /** Called on typing AND selection - parent MUST update value prop */
  onValueChange: (value: string) => void;
  /** Called with structured address on selection */
  onSelect?: (address: AddressValue) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disable the input */
  disabled?: boolean;
  /** Filter results to Quebec only */
  restrictToQuebec?: boolean;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;
const BINDING_CHECK_DELAY_MS = 300;
const DEV_MODE = false; // Disabled - was: import.meta.env.DEV

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const parseAddressValue = (
  suggestion: MapboxSuggestion,
  lat?: number,
  lng?: number
): AddressValue => {
  const ctx = suggestion.context || {};
  const streetNumber = ctx.address?.address_number || ctx.address?.street_number || "";
  const streetName = ctx.street?.name || "";
  const line1 = [streetNumber, streetName].filter(Boolean).join(" ").trim() || 
                suggestion.full_address.split(",")[0] || "";

  return {
    formatted: suggestion.full_address,
    line1,
    city: ctx.place?.name || "",
    region: normalizeProvince(ctx.region?.region_code || ctx.region?.name),
    postalCode: ctx.postcode?.name ? formatPostalCode(ctx.postcode.name) : "",
    country: ctx.country?.name || "Canada",
    lat,
    lng,
    mapboxPlaceId: suggestion.mapbox_id,
  };
};

// --------------------------------------------------------------------------
// Main Component
// --------------------------------------------------------------------------

export function AddressAutocomplete({
  value,
  onValueChange,
  onSelect,
  placeholder = "Entrez votre adresse...",
  className,
  disabled = false,
  restrictToQuebec = false,
}: AddressAutocompleteProps) {
  // CRITICAL: Internal value is the source of truth for display
  // We sync from parent but prioritize our internal state during selection
  const [internalValue, setInternalValue] = useState(value || "");
  const [bindingWarning, setBindingWarning] = useState(false);
  const lastSelectionRef = useRef<string | null>(null);
  const lastEventRef = useRef<string>("init");
  const bindingCheckTimeoutRef = useRef<number | null>(null);

  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [noResults, setNoResults] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Displayed value: use internalValue (we control this)
  const displayedValue = internalValue;

  // Sync internal value when parent provides value
  // BUT: don't reset if we just made a selection (protect against parent overwriting)
  useEffect(() => {
    // If parent's value matches our last selection, we're good
    if (lastSelectionRef.current && value === lastSelectionRef.current) {
      setBindingWarning(false);
      lastEventRef.current = "parent-confirmed";
      return;
    }
    
    // If we have no pending selection, sync with parent
    if (!lastSelectionRef.current) {
      setInternalValue(value || "");
      lastEventRef.current = "parent-sync";
    }
  }, [value]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (bindingCheckTimeoutRef.current) {
        window.clearTimeout(bindingCheckTimeoutRef.current);
      }
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownRect({
      top: Math.round(rect.bottom + 6),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
    });
  }, []);

  // Close on outside click
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const wrapper = wrapperRef.current;
      const dropdown = dropdownRef.current;
      if (!wrapper) return;

      const clickedInsideWrapper = wrapper.contains(target);
      const clickedInsideDropdown = dropdown ? dropdown.contains(target) : false;

      if (!clickedInsideWrapper && !clickedInsideDropdown) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Keep dropdown positioned on scroll/resize
  useEffect(() => {
    if (!showSuggestions) return;
    updateDropdownPosition();

    const onScroll = () => updateDropdownPosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [showSuggestions, updateDropdownPosition]);

  // Quebec filter
  const applyQuebecFilter = useCallback(
    (results: MapboxSuggestion[]) => {
      if (!restrictToQuebec) return results;
      return results.filter(
        (s) =>
          s.context?.region?.region_code === "QC" ||
          s.context?.region?.name?.toLowerCase().includes("québec") ||
          s.context?.region?.name?.toLowerCase().includes("quebec")
      );
    },
    [restrictToQuebec]
  );

  // Fetch suggestions from edge function
  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);

      const trimmed = input.trim();
      if (!trimmed || trimmed.length < MIN_CHARS) {
        setSuggestions([]);
        setShowSuggestions(false);
        setNoResults(false);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setNoResults(false);
      setErrorMessage(null);

      debounceRef.current = window.setTimeout(async () => {
        try {
          const { data, error } = await backendClient.functions.invoke("mapbox-address-autocomplete", {
            body: {
              action: "suggest",
              query: trimmed,
              session_token: sessionTokenRef.current,
            },
          });

          if (error) {
            setSuggestions([]);
            setNoResults(false);
            setErrorMessage("Service temporairement indisponible — saisie manuelle possible.");
            setShowSuggestions(true);
            return;
          }

          if (data?.error || data?.ok === false) {
            setSuggestions([]);
            setNoResults(false);
            setErrorMessage(data.hint || "Service temporairement indisponible — saisie manuelle possible.");
            setShowSuggestions(true);
            return;
          }

          const results: MapboxSuggestion[] = (data?.suggestions || data?.results || []).slice(0, MAX_RESULTS);
          const filtered = applyQuebecFilter(results);

          setSuggestions(filtered);
          setNoResults(filtered.length === 0);
          setShowSuggestions(true);
        } catch {
          setSuggestions([]);
          setNoResults(false);
          setErrorMessage("Service temporairement indisponible — saisie manuelle possible.");
          setShowSuggestions(true);
        } finally {
          setIsLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    [applyQuebecFilter]
  );

  // Retrieve full address details
  const retrieveDetails = async (suggestion: MapboxSuggestion): Promise<AddressValue> => {
    try {
      const { data, error } = await backendClient.functions.invoke("mapbox-address-autocomplete", {
        body: {
          action: "retrieve",
          mapbox_id: suggestion.mapbox_id,
          session_token: sessionTokenRef.current,
        },
      });

      if (error || !data?.features?.[0]) {
        return parseAddressValue(suggestion);
      }

      const feature = data.features[0];
      const coordinates = feature.geometry?.coordinates || [];
      return parseAddressValue(suggestion, coordinates[1], coordinates[0]);
    } catch {
      return parseAddressValue(suggestion);
    }
  };

  // Handle input change (user typing)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Clear any pending selection tracking when user types
    lastSelectionRef.current = null;
    lastEventRef.current = "typing";
    setBindingWarning(false);
    
    // Update internal value immediately
    setInternalValue(newValue);
    // Notify parent
    onValueChange(newValue);
    
    setHighlightedIndex(-1);
    fetchSuggestions(newValue);
  };

  // Handle suggestion selection — CRITICAL: update BEFORE closing dropdown
  // This is the core "applySuggestion" logic
  const handleSuggestionSelect = async (suggestion: MapboxSuggestion) => {
    const parsed = parseAddressValue(suggestion);
    // Use full_address for the input display (more descriptive)
    const selectedLabel = suggestion.full_address || parsed.formatted || parsed.line1;

    // STEP 1: Update internal value IMMEDIATELY (this ensures the input stays filled)
    setInternalValue(selectedLabel);
    lastSelectionRef.current = selectedLabel;
    lastEventRef.current = "selection";
    setBindingWarning(false);

    // STEP 2: Notify parent IMMEDIATELY (before anything else)
    onValueChange(selectedLabel);

    // STEP 3: Call onSelect for structured data IMMEDIATELY
    if (onSelect) {
      onSelect(parsed);
    }

    // STEP 4: Close dropdown AFTER updating values (use requestAnimationFrame for smooth transition)
    requestAnimationFrame(() => {
      setShowSuggestions(false);
      setSuggestions([]);
      setErrorMessage(null);
      setHighlightedIndex(-1);
    });

    // STEP 5: Check if parent updated value after BINDING_CHECK_DELAY_MS
    if (bindingCheckTimeoutRef.current) {
      window.clearTimeout(bindingCheckTimeoutRef.current);
    }
    bindingCheckTimeoutRef.current = window.setTimeout(() => {
      // Check if our selection was reset by parent
      // We compare by checking if our internal value still matches what we set
      // and if the parent's value prop doesn't match
      if (lastSelectionRef.current === selectedLabel) {
        // Check current prop value
        const currentPropValue = value;
        if (currentPropValue !== selectedLabel) {
          setBindingWarning(true);
          lastEventRef.current = "parent-reset-detected";
          if (DEV_MODE) {
            console.warn(
              "[AddressAutocomplete] PARENT IS RESETTING VALUE. " +
              `Expected: "${selectedLabel}", Got prop: "${currentPropValue}"`
            );
          }
        } else {
          // Parent updated correctly, clear the selection tracker
          lastSelectionRef.current = null;
          lastEventRef.current = "parent-confirmed";
        }
      }
    }, BINDING_CHECK_DELAY_MS);

    // STEP 6: Retrieve full details async and update if we have onSelect (for lat/lng)
    try {
      const details = await retrieveDetails(suggestion);
      if (onSelect && (details.lat !== undefined || details.lng !== undefined)) {
        onSelect(details);
      }
    } catch {
      // Silent fail - we already sent the initial parsed data
    }

    // New session token for next interaction
    sessionTokenRef.current = crypto.randomUUID();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (suggestions.length === 0) {
      if (e.key === "Escape") setShowSuggestions(false);
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  // On focus, refresh suggestions if already has content
  const handleFocus = () => {
    sessionTokenRef.current = crypto.randomUUID();
    const currentValue = displayedValue;
    if (currentValue.trim().length >= MIN_CHARS) {
      fetchSuggestions(currentValue);
    }
  };

  const dropdownVisible = showSuggestions && dropdownRect !== null;

  const dropdown = dropdownVisible
    ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 99999,
          }}
          className="rounded-lg border border-[#E5E7EB] bg-white shadow-lg"
          role="listbox"
        >
          {errorMessage ? (
            <div className="px-4 py-3 text-sm text-[#4B5563]">{errorMessage}</div>
          ) : suggestions.length > 0 ? (
            <div className="max-h-72 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.mapbox_id}
                  type="button"
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-[#F5F7FA] transition-colors flex items-start gap-3",
                    highlightedIndex === index && "bg-[#F5F7FA]"
                  )}
                  // CRITICAL: Use onPointerDownCapture to ensure we capture before blur
                  onPointerDownCapture={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSuggestionSelect(suggestion);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <MapPin className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1A1A2E] text-sm truncate">{suggestion.name}</p>
                    <p className="text-xs text-[#4B5563] truncate">{suggestion.place_formatted}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : noResults ? (
            <div className="px-4 py-3 text-center">
              <p className="text-sm text-[#4B5563]">Aucun résultat — veuillez préciser</p>
            </div>
          ) : null}

          <div className="px-4 py-2 border-t border-[#E5E7EB]">
            <p className="text-xs text-[#4B5563] flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {restrictToQuebec ? "Service au Québec seulement" : "Canada"}
            </p>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4B5563]" />
        <Input
          ref={inputRef}
          type="text"
          value={displayedValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pl-10 pr-10", className)}
          disabled={disabled}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4B5563] animate-spin" />
        )}
      </div>

      {/* Binding warning - silent in production, only console.warn in dev */}

      {/* DEV Diagnostic panel */}
      {DEV_MODE && (
        <div className="mt-1 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 space-y-0.5">
          <div><span className="text-slate-500">prop.value:</span> "{value}"</div>
          <div><span className="text-slate-500">internalValue:</span> "{internalValue}"</div>
          <div><span className="text-slate-500">lastSelected:</span> "{lastSelectionRef.current || "(none)"}"</div>
          <div><span className="text-slate-500">lastEvent:</span> {lastEventRef.current}</div>
        </div>
      )}

      {dropdown}
    </div>
  );
}

export default AddressAutocomplete;
