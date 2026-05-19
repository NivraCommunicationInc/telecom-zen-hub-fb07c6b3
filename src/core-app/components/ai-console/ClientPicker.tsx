/**
 * ClientPicker — combobox de recherche client (billing_customers).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, X, User } from "lucide-react";

export interface PickedClient {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Props {
  value: PickedClient | null;
  onChange: (c: PickedClient | null) => void;
}

export default function ClientPicker({ value, onChange }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["ai-console-client-search", debounced],
    enabled: open && debounced.length >= 2,
    queryFn: async () => {
      const term = `%${debounced}%`;
      const { data, error } = await supabase
        .from("billing_customers")
        .select("id, user_id, first_name, last_name, email")
        .or(`email.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as PickedClient[];
    },
  });

  const label = useMemo(() => {
    if (!value) return "";
    return [value.first_name, value.last_name].filter(Boolean).join(" ") || value.email || value.id.slice(0, 8);
  }, [value]);

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-core-border-strong bg-core-card-raised">
        <User className="w-4 h-4 text-core-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-core-text-primary truncate">{label}</p>
          <p className="text-xs text-core-text-secondary truncate">{value.email ?? "—"}</p>
        </div>
        <button onClick={() => { onChange(null); setQ(""); }} className="p-1 rounded hover:bg-core-card text-core-text-label" aria-label="Changer de client">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-core-text-label" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Rechercher un client par email ou nom…"
          className="pl-9 bg-core-card-raised border-core-border-strong text-core-text-primary"
        />
      </div>
      {open && debounced.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-core-border-strong bg-core-card shadow-xl max-h-80 overflow-y-auto">
          {isFetching && <div className="p-3 text-sm text-core-text-label">Recherche…</div>}
          {!isFetching && results.length === 0 && <div className="p-3 text-sm text-core-text-label">Aucun résultat</div>}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(c); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-core-card-raised border-b border-core-border/50 last:border-0"
            >
              <p className="text-sm font-medium text-core-text-primary truncate">
                {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
              </p>
              <p className="text-xs text-core-text-secondary truncate">{c.email ?? "—"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
