/**
 * Global Search Component for Admin Panel
 * Searches across clients, orders, invoices, and tickets
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, User, Package, CreditCard, Ticket, 
  Loader2, X, ExternalLink 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: string;
  type: "client" | "order" | "invoice" | "ticket";
  title: string;
  subtitle: string;
  status?: string;
  href: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const navigate = useNavigate();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset search when closing
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setDebouncedSearch("");
    }
  }, [isOpen]);

  // Fetch clients
  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["global-search-clients", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      
      const query = debouncedSearch.toLowerCase();
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone, client_number")
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,client_number.ilike.%${query}%`)
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && debouncedSearch.length >= 2,
  });

  // Fetch orders
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["global-search-orders", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      
      const query = debouncedSearch.toLowerCase();
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, client_name, client_email, status, created_at")
        .or(`order_number.ilike.%${query}%,client_name.ilike.%${query}%,client_email.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && debouncedSearch.length >= 2,
  });

  // Fetch invoices
  const { data: invoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["global-search-invoices", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      
      const query = debouncedSearch.toLowerCase();
      const { data, error } = await supabase
        .from("billing")
        .select("id, invoice_number, client_email, amount, status, created_at")
        .or(`invoice_number.ilike.%${query}%,client_email.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && debouncedSearch.length >= 2,
  });

  // Fetch tickets
  const { data: tickets, isLoading: loadingTickets } = useQuery({
    queryKey: ["global-search-tickets", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      
      const query = debouncedSearch.toLowerCase();
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, client_name, status, created_at")
        .or(`ticket_number.ilike.%${query}%,subject.ilike.%${query}%,client_name.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && debouncedSearch.length >= 2,
  });

  const isLoading = loadingClients || loadingOrders || loadingInvoices || loadingTickets;

  // Combine all results
  const results = useMemo<SearchResult[]>(() => {
    const combined: SearchResult[] = [];

    // Add clients
    clients?.forEach((c) => {
      combined.push({
        id: c.user_id,
        type: "client",
        title: c.full_name || c.email || "Client",
        subtitle: `${c.client_number || ""} • ${c.email || ""} • ${c.phone || ""}`.trim(),
        href: `/admin/clients?search=${encodeURIComponent(c.email || c.user_id)}`,
      });
    });

    // Add orders
    orders?.forEach((o) => {
      combined.push({
        id: o.id,
        type: "order",
        title: `Commande ${o.order_number}`,
        subtitle: `${o.client_name || o.client_email} • ${format(new Date(o.created_at), "d MMM yyyy", { locale: fr })}`,
        status: o.status,
        href: `/admin/orders?search=${encodeURIComponent(o.order_number)}`,
      });
    });

    // Add invoices
    invoices?.forEach((i) => {
      combined.push({
        id: i.id,
        type: "invoice",
        title: `Facture ${i.invoice_number || i.id.slice(0, 8)}`,
        subtitle: `${i.client_email} • ${i.amount?.toFixed(2)} $`,
        status: i.status,
        href: `/admin/billing?search=${encodeURIComponent(i.invoice_number || i.id)}`,
      });
    });

    // Add tickets
    tickets?.forEach((t) => {
      combined.push({
        id: t.id,
        type: "ticket",
        title: `Ticket ${t.ticket_number}`,
        subtitle: `${t.subject} • ${t.client_name || ""}`,
        status: t.status,
        href: `/admin/tickets?search=${encodeURIComponent(t.ticket_number)}`,
      });
    });

    return combined;
  }, [clients, orders, invoices, tickets]);

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(result.href);
    onClose();
  }, [navigate, onClose]);

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "client": return User;
      case "order": return Package;
      case "invoice": return CreditCard;
      case "ticket": return Ticket;
      default: return Search;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "client": return "Client";
      case "order": return "Commande";
      case "invoice": return "Facture";
      case "ticket": return "Ticket";
      default: return type;
    }
  };

  const getTypeBadgeColor = (type: SearchResult["type"]) => {
    switch (type) {
      case "client": return "bg-blue-500/20 text-blue-500";
      case "order": return "bg-green-500/20 text-green-500";
      case "invoice": return "bg-amber-500/20 text-amber-500";
      case "ticket": return "bg-purple-500/20 text-purple-500";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="sr-only">Recherche globale</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher clients, commandes, factures, tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-10 h-12 text-base"
              autoFocus
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setSearch("")}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-4 pt-2">
          {!debouncedSearch || debouncedSearch.length < 2 ? (
            <div className="text-center text-muted-foreground py-8">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Entrez au moins 2 caractères pour rechercher</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Recherche en cours...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucun résultat pour "{debouncedSearch}"</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-1">
                {results.map((result) => {
                  const Icon = getIcon(result.type);
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left",
                        "hover:bg-accent transition-colors group"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        getTypeBadgeColor(result.type)
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">
                            {result.title}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {getTypeLabel(result.type)}
                          </Badge>
                          {result.status && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {result.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
          Appuyez sur <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">⌘K</kbd> ou{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+K</kbd> pour ouvrir la recherche
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GlobalSearchTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start text-muted-foreground gap-2"
        onClick={() => setIsOpen(true)}
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Recherche...</span>
        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
          ⌘K
        </kbd>
      </Button>
      <GlobalSearch isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
