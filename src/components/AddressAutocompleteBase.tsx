import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, CheckCircle2, AlertCircle, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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

export interface AddressDetails {
  formattedAddress: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressAutocompleteBaseProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (details: AddressDetails) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  restrictToQuebec?: boolean;
  supabaseClient: SupabaseClient;
  /** Show diagnostic status panel under the input (for debugging without DevTools) */
  showDiagnostic?: boolean;
}

interface DiagnosticState {
  endpoint: "idle" | "loading" | "ok" | "fail";
  httpStatus: number | null;
  resultCount: number | null;
  errorMessage: string | null;
  lastQuery: string | null;
  tokenMissing: boolean;
}

const AUTOCOMPLETE_MIN_CHARS = 3;
const AUTOCOMPLETE_DEBOUNCE_MS = 300;
const AUTOCOMPLETE_MAX_RESULTS = 8;

const DiagnosticPanel = ({ state, dropdownActuallyVisible }: { state: DiagnosticState; dropdownActuallyVisible: boolean }) => {
  const getEndpointColor = () => {
    if (state.endpoint === "idle") return "text-muted-foreground";
    if (state.endpoint === "loading") return "text-blue-500";
    if (state.endpoint === "ok") return "text-green-600";
    return "text-destructive";
  };

  const showDropdownWarning = state.resultCount !== null && state.resultCount > 0 && !dropdownActuallyVisible;

  return (
    <div className="mt-1.5 p-2 rounded border border-dashed border-muted-foreground/30 bg-muted/20 text-xs font-mono space-y-0.5">
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        <span>
          Endpoint: <span className={cn("font-semibold", getEndpointColor())}>
            {state.endpoint === "idle" ? "—" : state.endpoint === "loading" ? "..." : state.endpoint.toUpperCase()}
          </span>
        </span>
        <span>
          HTTP: <span className={cn("font-semibold", state.httpStatus === 200 ? "text-green-600" : state.httpStatus ? "text-destructive" : "text-muted-foreground")}>
            {state.httpStatus ?? "—"}
          </span>
        </span>
        <span>
          Résultats: <span className="font-semibold">{state.resultCount ?? "—"}</span>
        </span>
      </div>
      {state.lastQuery && (
        <div className="text-muted-foreground truncate">
          Requête: "<span className="text-foreground">{state.lastQuery}</span>"
        </div>
      )}
      {state.tokenMissing && (
        <div className="flex items-center gap-1 text-destructive">
          <XCircle className="h-3 w-3" />
          <span>TOKEN MANQUANT (MAPBOX_PUBLIC_TOKEN)</span>
        </div>
      )}
      {state.errorMessage && !state.tokenMissing && (
        <div className="flex items-center gap-1 text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span className="truncate">Erreur: {state.errorMessage}</span>
        </div>
      )}
      {showDropdownWarning && (
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-3 w-3" />
          <span>UI: dropdown hidden (z-index/overflow issue)</span>
        </div>
      )}
      {state.endpoint === "ok" && state.resultCount !== null && state.resultCount > 0 && dropdownActuallyVisible && (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          <span>OK — suggestions visibles</span>
        </div>
      )}
    </div>
  );
};

const createInitialDiagnostic = (): DiagnosticState => ({
  endpoint: "idle",
  httpStatus: null,
  resultCount: null,
  errorMessage: null,
  lastQuery: null,
  tokenMissing: false,
});

const AddressAutocompleteBase = ({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Entrez votre adresse...",
  className,
  disabled = false,
  restrictToQuebec = false,
  supabaseClient,
  showDiagnostic = false,
}: AddressAutocompleteBaseProps) => {
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [noResults, setNoResults] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticState>(createInitialDiagnostic);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const endpointForLogs = useMemo(() => {
    const base = import.meta.env.VITE_SUPABASE_URL;
    return base ? `${base}/functions/v1/mapbox-address-autocomplete` : "(unknown)";
  }, []);

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

  // Close dropdown on outside click (works with portal)
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

  // Keep dropdown positioned + visible on scroll/resize when opened
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

  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);

      const trimmed = input.trim();
      if (!trimmed || trimmed.length < AUTOCOMPLETE_MIN_CHARS) {
        setSuggestions([]);
        setShowSuggestions(false);
        setNoResults(false);
        setErrorMessage(null);
        setDiagnostic(createInitialDiagnostic());
        return;
      }

      setIsLoading(true);
      setNoResults(false);
      setErrorMessage(null);
      setDiagnostic((prev) => ({ ...prev, endpoint: "loading", lastQuery: trimmed }));

      debounceRef.current = window.setTimeout(async () => {
        try {
          if (import.meta.env.DEV) {
            console.debug("[Mapbox] query fired", {
              url: endpointForLogs,
              origin: window.location.origin,
              query: trimmed,
              queryLength: trimmed.length,
            });
          }

          const { data, error } = await supabaseClient.functions.invoke("mapbox-address-autocomplete", {
            body: {
              action: "suggest",
              query: trimmed,
              session_token: sessionTokenRef.current,
            },
          });

          if (error) {
            if (import.meta.env.DEV) {
              console.debug("[Mapbox] suggest failed", { url: endpointForLogs, error });
            }
            
            const errorMsg = error.message?.toLowerCase() || "";
            const isTokenError = errorMsg.includes("token") && (errorMsg.includes("missing") || errorMsg.includes("not configured"));
            
            setDiagnostic({
              endpoint: "fail",
              httpStatus: 500,
              resultCount: 0,
              errorMessage: error.message,
              lastQuery: trimmed,
              tokenMissing: isTokenError,
            });
            
            setSuggestions([]);
            setNoResults(false);
            setErrorMessage("Service temporairement indisponible — saisie manuelle possible.");
            setShowSuggestions(true);
            return;
          }

          // Check for API-level errors in response
          if (data?.error || data?.ok === false) {
            const mapboxStatus = data.mapbox_status || data.status || 500;
            const isTokenError = data.error?.toLowerCase()?.includes("token") || false;
            
            setDiagnostic({
              endpoint: "fail",
              httpStatus: mapboxStatus,
              resultCount: 0,
              errorMessage: data.error || data.message,
              lastQuery: trimmed,
              tokenMissing: isTokenError,
            });
            
            setSuggestions([]);
            setNoResults(false);
            setErrorMessage(data.hint || "Service temporairement indisponible — saisie manuelle possible.");
            setShowSuggestions(true);
            return;
          }

          if (import.meta.env.DEV) {
            console.debug("[Mapbox] suggest ok", {
              url: endpointForLogs,
              request_id: data?.request_id,
              mapbox_status: data?.mapbox_status,
              suggestions: data?.suggestions?.length ?? 0,
            });
          }

          const results: MapboxSuggestion[] = (data?.suggestions || data?.results || []).slice(0, AUTOCOMPLETE_MAX_RESULTS);
          const filtered = applyQuebecFilter(results);

          setSuggestions(filtered);
          setNoResults(filtered.length === 0);
          setShowSuggestions(true);
          
          setDiagnostic({
            endpoint: "ok",
            httpStatus: data?.mapbox_status || 200,
            resultCount: filtered.length,
            errorMessage: null,
            lastQuery: trimmed,
            tokenMissing: false,
          });
        } catch (err) {
          if (import.meta.env.DEV) {
            console.debug("[Mapbox] suggest exception", { url: endpointForLogs, err });
          }
          setSuggestions([]);
          setNoResults(false);
          setErrorMessage("Service temporairement indisponible — saisie manuelle possible.");
          setShowSuggestions(true);
          setDiagnostic({
            endpoint: "fail",
            httpStatus: 0,
            resultCount: 0,
            errorMessage: "Exception réseau",
            lastQuery: trimmed,
            tokenMissing: false,
          });
        } finally {
          setIsLoading(false);
        }
      }, AUTOCOMPLETE_DEBOUNCE_MS);
    },
    [applyQuebecFilter, endpointForLogs, supabaseClient]
  );

  const parseFromSuggestion = (suggestion: MapboxSuggestion): AddressDetails => {
    const context = suggestion.context || {};
    return {
      formattedAddress: suggestion.full_address,
      streetNumber: context.address?.address_number || context.address?.street_number,
      street: context.street?.name,
      city: context.place?.name,
      province: context.region?.region_code || context.region?.name,
      postalCode: context.postcode?.name,
      country: context.country?.name || "Canada",
    };
  };

  const toLine1 = (details: AddressDetails) =>
    [details.streetNumber, details.street].filter(Boolean).join(" ").trim() || details.formattedAddress;

  const retrieveAddressDetails = async (suggestion: MapboxSuggestion) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("mapbox-address-autocomplete", {
        body: {
          action: "retrieve",
          mapbox_id: suggestion.mapbox_id,
          session_token: sessionTokenRef.current,
        },
      });

      if (error || !data?.features?.[0]) {
        if (import.meta.env.DEV) {
          console.debug("[Mapbox] retrieve fallback", { url: endpointForLogs, error, request_id: data?.request_id });
        }
        return parseFromSuggestion(suggestion);
      }

      const feature = data.features[0];
      const properties = feature.properties || {};
      const context = properties.context || {};
      const coordinates = feature.geometry?.coordinates || [];

      const details: AddressDetails = {
        formattedAddress: properties.full_address || suggestion.full_address,
        streetNumber: context.address?.address_number || context.address?.street_number,
        street: context.street?.name,
        city: context.place?.name,
        province: context.region?.region_code || context.region?.name,
        postalCode: context.postcode?.name,
        country: context.country?.name || "Canada",
        latitude: coordinates[1],
        longitude: coordinates[0],
      };

      return details;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug("[Mapbox] retrieve exception", { url: endpointForLogs, err });
      }
      return parseFromSuggestion(suggestion);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setHighlightedIndex(-1);
    fetchSuggestions(newValue);
  };

  const handleSuggestionClick = async (suggestion: MapboxSuggestion) => {
    // Prefer line1 (numéro + rue) to avoid duplicating city/postal in separate fields
    onChange(toLine1(parseFromSuggestion(suggestion)));
    setShowSuggestions(false);
    setSuggestions([]);
    setErrorMessage(null);
    setDiagnostic(createInitialDiagnostic());

    const details = await retrieveAddressDetails(suggestion);
    onAddressSelect(details);

    // New session token for next interaction
    sessionTokenRef.current = crypto.randomUUID();
  };

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
          handleSuggestionClick(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  const handleFocus = () => {
    sessionTokenRef.current = crypto.randomUUID();
    if (value.trim().length >= AUTOCOMPLETE_MIN_CHARS) {
      fetchSuggestions(value);
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
          className="rounded-lg border border-border bg-popover shadow-lg"
          role="listbox"
        >
          {errorMessage ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">{errorMessage}</div>
          ) : suggestions.length > 0 ? (
            <div className="max-h-72 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.mapbox_id}
                  type="button"
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-start gap-3",
                    highlightedIndex === index && "bg-muted/50"
                  )}
                  onMouseDown={(e) => {
                    // Prevent blur from firing before selection is applied
                    e.preventDefault();
                    e.stopPropagation();
                    handleSuggestionClick(suggestion);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <MapPin className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{suggestion.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{suggestion.place_formatted}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : noResults ? (
            <div className="px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">Aucun résultat — veuillez préciser</p>
            </div>
          ) : null}

          <div className="px-4 py-2 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
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
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pl-10 pr-10", className)}
          disabled={disabled}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {showDiagnostic && <DiagnosticPanel state={diagnostic} dropdownActuallyVisible={dropdownVisible} />}

      {dropdown}
    </div>
  );
};

export default AddressAutocompleteBase;
