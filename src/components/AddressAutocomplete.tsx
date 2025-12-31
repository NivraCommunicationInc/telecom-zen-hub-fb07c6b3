import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddressSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface AddressDetails {
  formattedAddress: string;
  streetNumber?: string;
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
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

// Canada Post API simulation with common Quebec cities
const QUEBEC_CITIES = [
  "Montreal", "Montréal", "Laval", "Gatineau", "Longueuil", "Sherbrooke",
  "Saguenay", "Lévis", "Trois-Rivières", "Terrebonne", "Saint-Jean-sur-Richelieu",
  "Repentigny", "Brossard", "Drummondville", "Saint-Jérôme", "Granby",
  "Blainville", "Saint-Hyacinthe", "Shawinigan", "Dollard-des-Ormeaux",
  "Rimouski", "Châteauguay", "Victoriaville", "Alma", "Rouyn-Noranda",
  "Mirabel", "Mascouche", "Chambly", "Varennes", "Candiac"
];

// Sample addresses for autocomplete simulation
const generateSuggestions = (input: string): AddressSuggestion[] => {
  if (!input || input.length < 3) return [];
  
  const inputLower = input.toLowerCase();
  const suggestions: AddressSuggestion[] = [];
  
  // Check if input contains a number (street number)
  const hasNumber = /\d/.test(input);
  const numbers = input.match(/\d+/);
  const streetNumber = numbers ? numbers[0] : Math.floor(Math.random() * 9000 + 100).toString();
  
  // Extract text part
  const textPart = input.replace(/\d+/g, "").trim();
  
  // Generate Quebec suggestions
  const matchingCities = QUEBEC_CITIES.filter(city => 
    city.toLowerCase().includes(inputLower) || 
    inputLower.includes(city.toLowerCase())
  );
  
  const cityToUse = matchingCities.length > 0 ? matchingCities : QUEBEC_CITIES.slice(0, 5);
  
  // Common Quebec street names
  const streetNames = ["Saint-Laurent", "Sainte-Catherine", "René-Lévesque", "Sherbrooke", "Mont-Royal", "Jean-Talon", "Notre-Dame", "Saint-Denis", "Maisonneuve", "Berri"];
  
  // Quebec postal code prefixes
  const postalPrefixes = ["H1A", "H2B", "H3C", "H4D", "G1A", "J4B", "G1V", "H2X", "J3Y", "H9S"];
  
  cityToUse.slice(0, 4).forEach((city, index) => {
    const street = streetNames[index % streetNames.length];
    const postalPrefix = postalPrefixes[index % postalPrefixes.length];
    const postalSuffix = `${Math.floor(Math.random() * 9)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 9)}`;
    
    suggestions.push({
      place_id: `place_${index}_${Date.now()}`,
      description: `${streetNumber} ${textPart || street}, ${city}, QC ${postalPrefix} ${postalSuffix}, Canada`,
      structured_formatting: {
        main_text: `${streetNumber} ${textPart || street}`,
        secondary_text: `${city}, QC, Canada`
      }
    });
  });
  
  return suggestions;
};

// Parse address from description
const parseAddress = (description: string): AddressDetails => {
  const parts = description.split(",").map(p => p.trim());
  const streetPart = parts[0] || "";
  const cityPart = parts[1] || "";
  const provincePostalPart = parts[2] || "";
  
  // Extract postal code (Canadian format: A1A 1A1)
  const postalMatch = provincePostalPart.match(/([A-Z]\d[A-Z]\s?\d[A-Z]\d)/i);
  const postalCode = postalMatch ? postalMatch[1] : "";
  const province = provincePostalPart.replace(postalCode, "").trim() || "QC";
  
  // Extract street number
  const streetNumberMatch = streetPart.match(/^(\d+)/);
  const streetNumber = streetNumberMatch ? streetNumberMatch[1] : "";
  const street = streetPart.replace(/^\d+\s*/, "");
  
  return {
    formattedAddress: description,
    streetNumber,
    street,
    city: cityPart,
    province,
    postalCode,
    country: "Canada"
  };
};

const AddressAutocomplete = ({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Enter your address...",
  className,
  disabled = false,
  restrictToQuebec = true
}: AddressAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

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

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback((input: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!input || input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(() => {
      // Simulate API call delay
      const results = generateSuggestions(input);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setIsLoading(false);
    }, 300);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    fetchSuggestions(newValue);
    setHighlightedIndex(-1);
  };

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    onChange(suggestion.description);
    const details = parseAddress(suggestion.description);
    onAddressSelect(details);
    setShowSuggestions(false);
    setSuggestions([]);
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

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
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

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
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
                  {suggestion.structured_formatting.main_text}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {suggestion.structured_formatting.secondary_text}
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
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
