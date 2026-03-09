/**
 * CoreGlobalSearch — Command-palette style search overlay for Nivra Core.
 * Cmd+K / Ctrl+K to open. Searches across all core business objects.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Users, ShoppingCart, FileText, CreditCard, RefreshCcw, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCoreGlobalSearch, type SearchResult } from "@/core-app/hooks/useCoreGlobalSearch";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { TestBadge } from "@/core-app/components/CoreEnvironmentToggle";

const TYPE_META: Record<SearchResult["type"], { label: string; icon: typeof Users; color: string }> = {
  account:      { label: "Compte",       icon: Building2,   color: "text-sky-400" },
  customer:     { label: "Client",       icon: Users,       color: "text-violet-400" },
  order:        { label: "Commande",     icon: ShoppingCart, color: "text-amber-400" },
  invoice:      { label: "Facture",      icon: FileText,    color: "text-emerald-400" },
  payment:      { label: "Paiement",     icon: CreditCard,  color: "text-cyan-400" },
  subscription: { label: "Abonnement",   icon: RefreshCcw,  color: "text-rose-400" },
};

const TYPE_ORDER: SearchResult["type"][] = ["account", "customer", "order", "invoice", "payment", "subscription"];

export function CoreGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { data: results = [], isLoading } = useCoreGlobalSearch(query, "live");

  // Group results by type in fixed order
  const grouped = TYPE_ORDER
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  const flatResults = grouped.flatMap((g) => g.items);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection on results change
  useEffect(() => { setSelectedIdx(0); }, [results]);

  const goTo = useCallback((result: SearchResult) => {
    setOpen(false);
    navigate(result.href);
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatResults[selectedIdx]) {
      e.preventDefault();
      goTo(flatResults[selectedIdx]);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,10%)] text-[hsl(220,10%,45%)] hover:text-[hsl(220,10%,70%)] hover:border-[hsl(220,15%,25%)] transition-colors text-xs"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 ml-2 px-1.5 py-0.5 rounded bg-[hsl(220,15%,14%)] text-[10px] font-mono text-[hsl(220,10%,40%)] border border-[hsl(220,15%,18%)]">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-x-0 top-[12vh] z-50 mx-auto w-full max-w-xl px-4">
        <div className="rounded-xl border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] shadow-2xl shadow-black/40 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-[hsl(220,15%,16%)]">
            <Search className="h-4 w-4 text-[hsl(220,10%,40%)] shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un compte, commande, facture…"
              className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder:text-[hsl(220,10%,35%)] outline-none"
            />
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-[hsl(220,10%,40%)] hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[55vh] overflow-y-auto">
            {query.length < 2 ? (
              <div className="py-10 text-center text-xs text-[hsl(220,10%,35%)]">
                Tapez au moins 2 caractères pour rechercher
              </div>
            ) : isLoading ? (
              <div className="py-10 text-center text-xs text-[hsl(220,10%,45%)]">
                Recherche en cours…
              </div>
            ) : flatResults.length === 0 ? (
              <div className="py-10 text-center text-xs text-[hsl(220,10%,35%)]">
                Aucun résultat pour « {query} »
              </div>
            ) : (
              <div className="py-1.5">
                {grouped.map((group) => {
                  const meta = TYPE_META[group.type];
                  return (
                    <div key={group.type}>
                      <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(220,10%,40%)]">
                        {meta.label}
                      </div>
                      {group.items.map((item) => {
                        const globalIdx = flatResults.indexOf(item);
                        const Icon = meta.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => goTo(item)}
                            onMouseEnter={() => setSelectedIdx(globalIdx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                              globalIdx === selectedIdx
                                ? "bg-[hsl(220,15%,14%)]"
                                : "hover:bg-[hsl(220,15%,12%)]"
                            )}
                          >
                            <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white truncate">
                                  {item.title}
                                </span>
                                {item.environment === "test" && <TestBadge />}
                                {item.badge && (
                                  <StatusBadge
                                    label={item.badge}
                                    variant={statusToVariant(item.badge)}
                                    size="sm"
                                    dot={false}
                                  />
                                )}
                              </div>
                              {item.subtitle && (
                                <span className="text-[11px] text-[hsl(220,10%,45%)] truncate block">
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[hsl(220,10%,30%)] shrink-0">
                              ↵
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[hsl(220,15%,16%)] text-[10px] text-[hsl(220,10%,35%)]">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-[hsl(220,15%,14%)] font-mono border border-[hsl(220,15%,18%)]">↑↓</kbd>
              {" "}naviguer{" "}
              <kbd className="px-1 py-0.5 rounded bg-[hsl(220,15%,14%)] font-mono border border-[hsl(220,15%,18%)]">↵</kbd>
              {" "}ouvrir{" "}
              <kbd className="px-1 py-0.5 rounded bg-[hsl(220,15%,14%)] font-mono border border-[hsl(220,15%,18%)]">esc</kbd>
              {" "}fermer
            </span>
            <span className="text-emerald-500/60">live uniquement</span>
          </div>
        </div>
      </div>
    </>
  );
}
