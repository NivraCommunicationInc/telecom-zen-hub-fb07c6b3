/**
 * CoreGlobalSearch — Command-palette style search overlay for Nivra Core.
 * Cmd+K / Ctrl+K to open. Searches across all core business objects.
 *
 * - 300ms debounce, triggers after 2 chars
 * - Recent searches (last 5) stored in localStorage
 * - Keyboard nav (↑ ↓ Enter Esc)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, X, Users, ShoppingCart, FileText, CreditCard, RefreshCcw,
  Building2, Package, ShieldCheck, Loader2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCoreGlobalSearch, type SearchResult } from "@/core-app/hooks/useCoreGlobalSearch";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { TestBadge } from "@/core-app/components/CoreEnvironmentToggle";

const RECENT_KEY = "core-global-search-recent";
const RECENT_MAX = 5;

const TYPE_META: Record<SearchResult["type"], { label: string; icon: typeof Users; color: string }> = {
  account:      { label: "Comptes",      icon: Building2,    color: "text-sky-400" },
  customer:     { label: "Clients",      icon: Users,        color: "text-violet-400" },
  order:        { label: "Commandes",    icon: ShoppingCart, color: "text-amber-400" },
  invoice:      { label: "Factures",     icon: FileText,     color: "text-emerald-400" },
  payment:      { label: "Paiements",    icon: CreditCard,   color: "text-cyan-400" },
  subscription: { label: "Abonnements",  icon: RefreshCcw,   color: "text-rose-400" },
  equipment:    { label: "Équipement",   icon: Package,      color: "text-blue-400" },
  verification: { label: "Vérifications", icon: ShieldCheck, color: "text-orange-400" },
};

const TYPE_ORDER: SearchResult["type"][] = [
  "order", "customer", "account", "equipment", "verification", "invoice", "payment", "subscription",
];

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch { return []; }
}

function saveRecent(q: string) {
  if (!q || q.trim().length < 2) return;
  try {
    const cur = loadRecent();
    const next = [q, ...cur.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function CoreGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching } = useCoreGlobalSearch(debouncedQuery, "live");

  const grouped = useMemo(() => TYPE_ORDER
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0), [results]);

  const flatResults = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Keyboard shortcut (open with Cmd/Ctrl+K, close with Esc)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus on open + reset
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedIdx(0);
      setRecent(loadRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setSelectedIdx(0); }, [results]);

  const goTo = useCallback((result: SearchResult) => {
    saveRecent(debouncedQuery);
    setOpen(false);
    navigate(result.href);
  }, [navigate, debouncedQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, Math.max(flatResults.length - 1, 0)));
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

  const showRecents = query.length < 2 && recent.length > 0;
  const showTypeHint = query.length < 2 && recent.length === 0;
  const isSearching = query.length >= 2 && (isFetching || debouncedQuery !== query.trim());

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed inset-x-0 top-[12vh] z-50 mx-auto w-full max-w-[640px] px-4">
        <div className="rounded-xl border border-slate-700 bg-[#0d1421] shadow-2xl shadow-black/60 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-slate-800">
            {isSearching
              ? <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
              : <Search className="h-4 w-4 text-slate-500 shrink-0" />}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher commande, client, équipement, vérification…"
              className="flex-1 bg-transparent py-4 text-[18px] text-white placeholder:text-slate-500 outline-none"
              autoFocus
            />
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-slate-500 hover:text-white transition-colors"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto">
            {showTypeHint && (
              <div className="py-10 text-center text-xs text-slate-500">
                Tapez au moins 2 caractères pour rechercher
              </div>
            )}

            {showRecents && (
              <div className="py-2">
                <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Recherches récentes
                </div>
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => setQuery(r)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-slate-800 text-sm text-slate-300"
                  >
                    <Search className="h-3.5 w-3.5 text-slate-500" />
                    {r}
                  </button>
                ))}
                <button
                  onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]); }}
                  className="w-full text-[10px] text-slate-500 hover:text-slate-300 py-1.5"
                >
                  Effacer l'historique
                </button>
              </div>
            )}

            {query.length >= 2 && !isSearching && flatResults.length === 0 && (
              <div className="py-10 text-center text-xs text-slate-500">
                Aucun résultat pour « {query} »
              </div>
            )}

            {query.length >= 2 && flatResults.length > 0 && (
              <div className="py-1.5">
                {grouped.map((group) => {
                  const meta = TYPE_META[group.type];
                  return (
                    <div key={group.type}>
                      <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {meta.label}
                      </div>
                      {group.items.map((item) => {
                        const globalIdx = flatResults.indexOf(item);
                        const Icon = meta.icon;
                        const selected = globalIdx === selectedIdx;
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            onClick={() => goTo(item)}
                            onMouseEnter={() => setSelectedIdx(globalIdx)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                              selected ? "bg-slate-700" : "hover:bg-slate-800"
                            )}
                          >
                            <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
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
                                <span className="text-[11px] text-slate-400 truncate block">
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-600 shrink-0">↵</span>
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
          <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono border border-slate-700">↑↓</kbd>
              {" "}naviguer{" "}
              <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono border border-slate-700">↵</kbd>
              {" "}ouvrir{" "}
              <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono border border-slate-700">esc</kbd>
              {" "}fermer
            </span>
            <span className="text-emerald-500/60">live</span>
          </div>
        </div>
      </div>
    </>
  );
}
