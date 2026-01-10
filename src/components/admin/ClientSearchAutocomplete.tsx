/**
 * Client Search Autocomplete Component
 * Allows searching clients by name, email, phone, or client number
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, Hash, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientSearchResult {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  client_number: string | null;
}

interface ClientSearchAutocompleteProps {
  onSelect: (client: ClientSearchResult) => void;
  selectedClientId?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export function ClientSearchAutocomplete({
  onSelect,
  selectedClientId,
  label = "Client",
  placeholder = "Rechercher par nom, email, téléphone...",
  required = false,
}: ClientSearchAutocompleteProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Fetch all clients for search
  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients-autocomplete"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone, client_number")
        .order("full_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as ClientSearchResult[];
    },
    staleTime: 60000, // Cache for 1 minute
  });

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients.slice(0, 50); // Show first 50 when no search
    
    const query = search.toLowerCase().trim();
    return clients.filter((client) => {
      return (
        client.full_name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query) ||
        client.client_number?.toLowerCase().includes(query)
      );
    }).slice(0, 20); // Limit results
  }, [clients, search]);

  // Get selected client info
  const selectedClient = useMemo(() => {
    if (!selectedClientId || !clients) return null;
    return clients.find((c) => c.user_id === selectedClientId);
  }, [clients, selectedClientId]);

  const handleSelect = (client: ClientSearchResult) => {
    onSelect(client);
    setSearch("");
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        {/* Search Input */}
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={selectedClient ? selectedClient.full_name || selectedClient.email || "Client sélectionné" : placeholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              // Delay close to allow click on results
              setTimeout(() => setIsOpen(false), 200);
            }}
            className="pl-10"
          />
        </div>

        {/* Selected Client Display */}
        {selectedClient && !isOpen && (
          <div className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span className="font-medium">{selectedClient.full_name || "Sans nom"}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {selectedClient.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {selectedClient.email}
                </span>
              )}
              {selectedClient.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {selectedClient.phone}
                </span>
              )}
              {selectedClient.client_number && (
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {selectedClient.client_number}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Dropdown Results */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg">
            <ScrollArea className="max-h-64">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Chargement...
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {search ? "Aucun client trouvé" : "Commencez à taper pour rechercher"}
                </div>
              ) : (
                <div className="py-1">
                  {filteredClients.map((client) => (
                    <button
                      key={client.user_id}
                      type="button"
                      className={cn(
                        "w-full px-3 py-2 text-left hover:bg-accent transition-colors",
                        selectedClientId === client.user_id && "bg-primary/10"
                      )}
                      onClick={() => handleSelect(client)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {client.full_name || "Sans nom"}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {client.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[150px]">{client.email}</span>
                              </span>
                            )}
                            {client.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {client.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        {client.client_number && (
                          <Badge variant="outline" className="ml-2 shrink-0 font-mono text-xs">
                            {client.client_number}
                          </Badge>
                        )}
                        {selectedClientId === client.user_id && (
                          <Check className="w-4 h-4 ml-2 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientSearchAutocomplete;
