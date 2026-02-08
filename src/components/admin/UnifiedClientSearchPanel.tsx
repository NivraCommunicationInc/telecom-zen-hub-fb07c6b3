/**
 * UnifiedClientSearchPanel
 * Searches across all client data sources: profiles, billing_customers, accounts, invoices, orders
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Users, Mail, Phone, User, Check, X, AlertTriangle, Database } from "lucide-react";
import { useUnifiedClientSearch, type UnifiedClientResult } from "@/hooks/useUnifiedClientSearch";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UnifiedClientSearchPanelProps {
  onSelectClient?: (result: UnifiedClientResult) => void;
  compact?: boolean;
}

export function UnifiedClientSearchPanel({ onSelectClient, compact = false }: UnifiedClientSearchPanelProps) {
  const [searchInput, setSearchInput] = useState("");
  const {
    results,
    isLoading,
    setSearchEmail,
    setSearchName,
    clearSearch,
  } = useUnifiedClientSearch();

  const handleSearch = () => {
    // Detect if it's an email or name
    if (searchInput.includes("@")) {
      setSearchEmail(searchInput);
    } else {
      setSearchName(searchInput);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClear = () => {
    setSearchInput("");
    clearSearch();
  };

  const getSourceBadge = (source: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      profiles: { label: "Profil", className: "bg-green-500/20 text-green-400" },
      billing_customers: { label: "Billing", className: "bg-blue-500/20 text-blue-400" },
      billing_invoices: { label: "Facture", className: "bg-purple-500/20 text-purple-400" },
      orders: { label: "Commande", className: "bg-orange-500/20 text-orange-400" },
    };
    return configs[source] || { label: source, className: "bg-muted text-muted-foreground" };
  };

  const StatusIcon = ({ has }: { has: boolean }) => (
    has ? <Check className="w-3 h-3 text-green-400" /> : <X className="w-3 h-3 text-red-400" />
  );

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      {!compact && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="w-5 h-5 text-cyan-400" />
            Recherche unifiée client
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-0" : ""}>
        {/* Search Input */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Email ou nom du client..."
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading || !searchInput.trim()}>
            {isLoading ? "..." : "Rechercher"}
          </Button>
          {searchInput && (
            <Button variant="outline" onClick={handleClear}>
              Effacer
            </Button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {results.map((result, index) => {
                const sourceBadge = getSourceBadge(result.source);
                const hasNoProfile = !result.has_profile;
                
                return (
                  <div
                    key={`${result.source}-${result.source_id}-${index}`}
                    className={`p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent ${
                      hasNoProfile ? "border-amber-500/50 bg-amber-500/5" : "border-border"
                    }`}
                    onClick={() => onSelectClient?.(result)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">
                            {result.full_name || "—"}
                          </span>
                          <Badge className={sourceBadge.className}>
                            {sourceBadge.label}
                          </Badge>
                          {hasNoProfile && (
                            <Badge className="bg-amber-500/20 text-amber-400">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Sans profil
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {result.email}
                          </span>
                          {result.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {result.phone}
                            </span>
                          )}
                        </div>

                        {/* Status indicators */}
                        <div className="flex gap-3 mt-2 text-xs">
                          <span className="flex items-center gap-1">
                            <StatusIcon has={result.has_profile} />
                            Profil
                          </span>
                          <span className="flex items-center gap-1">
                            <StatusIcon has={result.has_billing_customer} />
                            Billing
                          </span>
                          <span className="flex items-center gap-1">
                            <StatusIcon has={result.has_account} />
                            Compte
                          </span>
                          <span className="flex items-center gap-1">
                            <StatusIcon has={result.has_invoices} />
                            Factures
                          </span>
                          <span className="flex items-center gap-1">
                            <StatusIcon has={result.has_orders} />
                            Commandes
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground text-right shrink-0">
                        {result.created_at && format(new Date(result.created_at), "d MMM yyyy", { locale: fr })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* No results */}
        {!isLoading && searchInput && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Aucun client trouvé pour "{searchInput}"</p>
            <p className="text-xs mt-1">Recherche dans: profils, billing, factures, commandes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UnifiedClientSearchPanel;
