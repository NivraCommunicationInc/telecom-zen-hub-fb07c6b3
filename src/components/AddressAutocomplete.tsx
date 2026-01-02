import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

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

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (details: AddressDetails) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  restrictToQuebec?: boolean;
}

const AddressAutocomplete = ({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Entrez votre adresse...",
  className,
  disabled = false,
  restrictToQuebec = false
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [noResults, setNoResults] = useState(false);
  const [hasValidSelection, setHasValidSelection] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions from Mapbox via edge function
  const fetchSuggestions = useCallback(async (input: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!input || input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setNoResults(false);
      return;
    }

    setIsLoading(true);
    setNoResults(false);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mapbox-address-autocomplete', {
          body: {
            action: 'suggest',
            query: input,
            session_token: sessionTokenRef.current
          }
        });

        if (error) {
          console.error('Mapbox suggest error:', error);
          setSuggestions([]);
          setNoResults(true);
          setShowSuggestions(true);
          setIsLoading(false);
          return;
        }

        const results: MapboxSuggestion[] = data?.suggestions || [];
        
        // Filter to Quebec only if restricted
        const filteredResults = restrictToQuebec 
          ? results.filter(s => s.context?.region?.region_code === 'QC' || s.context?.region?.name?.includes('Quebec') || s.context?.region?.name?.includes('Québec'))
          : results;

        setSuggestions(filteredResults);
        setNoResults(filteredResults.length === 0);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Mapbox fetch error:', err);
        setSuggestions([]);
        setNoResults(true);
        setShowSuggestions(true);
      } finally {
        setIsLoading(false);
      }
    }, 250);
  }, [restrictToQuebec]);

  // Retrieve full address details from Mapbox
  const retrieveAddressDetails = async (suggestion: MapboxSuggestion) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mapbox-address-autocomplete', {
        body: {
          action: 'retrieve',
          mapbox_id: suggestion.mapbox_id,
          session_token: sessionTokenRef.current
        }
      });

      if (error || !data?.features?.[0]) {
        console.error('Mapbox retrieve error:', error);
        // Fallback to suggestion data
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
        country: context.country?.name || 'Canada',
        latitude: coordinates[1],
        longitude: coordinates[0]
      };

      return details;
    } catch (err) {
      console.error('Retrieve error:', err);
      return parseFromSuggestion(suggestion);
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback parser from suggestion data
  const parseFromSuggestion = (suggestion: MapboxSuggestion): AddressDetails => {
    const context = suggestion.context || {};
    return {
      formattedAddress: suggestion.full_address,
      streetNumber: context.address?.address_number || context.address?.street_number,
      street: context.street?.name,
      city: context.place?.name,
      province: context.region?.region_code || context.region?.name,
      postalCode: context.postcode?.name,
      country: context.country?.name || 'Canada'
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setHasValidSelection(false); // Invalidate previous selection
    fetchSuggestions(newValue);
    setHighlightedIndex(-1);
  };

  const handleSuggestionClick = async (suggestion: MapboxSuggestion) => {
    onChange(suggestion.full_address);
    setShowSuggestions(false);
    setSuggestions([]);
    setHasValidSelection(true);
    
    const details = await retrieveAddressDetails(suggestion);
    onAddressSelect(details);
    
    // Generate new session token for next interaction
    sessionTokenRef.current = crypto.randomUUID();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
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
    // Generate new session token on focus
    sessionTokenRef.current = crypto.randomUUID();
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

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

      {showSuggestions && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.length > 0 ? (
            <>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.mapbox_id}
                  type="button"
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-start gap-3",
                    highlightedIndex === index && "bg-muted/50"
                  )}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <MapPin className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">
                      {suggestion.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {suggestion.place_formatted}
                    </p>
                  </div>
                </button>
              ))}
              <div className="px-4 py-2 bg-muted/30 border-t border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {restrictToQuebec ? "Service au Québec seulement" : "Canada"}
                </p>
              </div>
            </>
          ) : noResults ? (
            <div className="px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">
                Adresse introuvable — veuillez préciser
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
