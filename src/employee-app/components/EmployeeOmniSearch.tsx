/**
 * EmployeeOmniSearch — Global search across customers, accounts, orders, invoices, payments.
 * Grouped results with direct navigation to correct employee portal page.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, User, ShoppingCart, FileText, CreditCard, Hash,
  Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { employeePath } from "@/employee-app/lib/employeePaths";

interface SearchResult {
  id: string;
  type: "customer" | "account" | "order" | "invoice" | "payment";
  title: string;
  subtitle: string | null;
  badge: string | null;
  href: string;
}

const TYPE_META: Record<string, { label: string; icon: typeof User; color: string; bg: string }> = {
  customer: { label: "Client", icon: User, color: "text-blue-400", bg: "bg-blue-500/10" },
  account: { label: "Compte", icon: Hash, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  order: { label: "Commande", icon: ShoppingCart, color: "text-indigo-400", bg: "bg-indigo-500/10" },
  invoice: { label: "Facture", icon: FileText, color: "text-amber-400", bg: "bg-amber-500/10" },
  payment: { label: "Paiement", icon: CreditCard, color: "text-purple-400", bg: "bg-purple-500/10" },
};

async function searchAll(q: string): Promise<SearchResult[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  const pattern = `%${trimmed}%`;
  const results: SearchResult[] = [];

  const [profiles, accounts, orders, invoices, payments] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, full_name, email, phone, client_number")
      .or(`full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},client_number.ilike.${pattern}`)
      .limit(6),
    supabase
      .from("accounts")
      .select("id, client_id, account_number, account_name, status")
      .or(`account_number.ilike.${pattern},account_name.ilike.${pattern}`)
      .limit(6),
    supabase
      .from("orders")
      .select("id, order_number, status, service_type, shipping_tracking_number")
      .eq("environment", "live")
      .or(`order_number.ilike.${pattern},shipping_tracking_number.ilike.${pattern}`)
      .limit(6),
    supabase
      .from("billing_invoices")
      .select("id, invoice_number, total, status")
      .eq("environment", "live")
      .or(`invoice_number.ilike.${pattern}`)
      .limit(6),
    supabase
      .from("billing_payments")
      .select("id, payment_number, amount, method, status, reference")
      .eq("environment", "live")
      .or(`payment_number.ilike.${pattern},reference.ilike.${pattern}`)
      .limit(6),
  ]);

  if (profiles.data) {
    for (const p of profiles.data) {
      results.push({
        id: p.user_id,
        type: "customer",
        title: p.full_name || p.email || "Client",
        subtitle: [p.email, p.phone, p.client_number].filter(Boolean).join(" · "),
        badge: null,
        href: employeePath(`/clients/${p.user_id}`),
      });
    }
  }

  if (accounts.data) {
    for (const a of accounts.data) {
      results.push({
        id: a.id,
        type: "account",
        title: a.account_number,
        subtitle: a.account_name || null,
        badge: a.status || null,
        href: employeePath(`/clients/${a.client_id}`),
      });
    }
  }

  if (orders.data) {
    for (const o of orders.data) {
      results.push({
        id: o.id,
        type: "order",
        title: o.order_number || o.id.slice(0, 8),
        subtitle: o.service_type || null,
        badge: o.status || null,
        href: employeePath(`/orders/${o.id}`),
      });
    }
  }

  if (invoices.data) {
    for (const inv of invoices.data) {
      results.push({
        id: inv.id,
        type: "invoice",
        title: inv.invoice_number,
        subtitle: inv.total != null ? `${inv.total.toFixed(2)} $` : null,
        badge: inv.status || null,
        href: employeePath(`/payments?invoice=${inv.id}`),
      });
    }
  }

  if (payments.data) {
    for (const p of payments.data) {
      results.push({
        id: p.id,
        type: "payment",
        title: p.payment_number,
        subtitle: [p.amount != null ? `${p.amount.toFixed(2)} $` : null, p.method, p.reference].filter(Boolean).join(" · "),
        badge: p.status || null,
        href: employeePath(`/payments?id=${p.id}`),
      });
    }
  }

  return results;
}

export default function EmployeeOmniSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: results = [], isLoading } = useQuery<SearchResult[]>({
    queryKey: ["employee-omni-search", query],
    queryFn: () => searchAll(query),
    enabled: query.trim().length >= 2,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = useCallback((href: string) => {
    setOpen(false);
    setQuery("");
    navigate(href);
  }, [navigate]);

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ||= []).push(r);
    return acc;
  }, {});

  const typeOrder: SearchResult["type"][] = ["customer", "account", "order", "invoice", "payment"];

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Rechercher client, commande, facture… (Ctrl+K)"
          className="w-full pl-10 pr-10 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-border bg-card shadow-2xl max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Aucun résultat pour « {query} »
            </div>
          ) : (
            <div className="py-1">
              {typeOrder.map(type => {
                const items = grouped[type];
                if (!items?.length) return null;
                const meta = TYPE_META[type];
                return (
                  <div key={type}>
                    <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
                      <meta.icon className={cn("h-3 w-3", meta.color)} />
                      <span className={cn("text-[10px] font-semibold uppercase tracking-wider", meta.color)}>
                        {meta.label}s
                      </span>
                      <span className="text-[9px] text-muted-foreground ml-auto">{items.length}</span>
                    </div>
                    {items.map(item => (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSelect(item.href)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/50 transition-colors text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground font-medium truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
                          )}
                        </div>
                        {item.badge && (
                          <span className={cn(
                            "ml-2 shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium",
                            item.badge === "paid" || item.badge === "active" || item.badge === "completed" || item.badge === "confirmed"
                              ? "text-emerald-400 bg-emerald-500/10"
                              : item.badge === "cancelled" || item.badge === "failed"
                              ? "text-red-400 bg-red-500/10"
                              : "text-muted-foreground bg-secondary"
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
