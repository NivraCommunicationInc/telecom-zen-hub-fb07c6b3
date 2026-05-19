/**
 * ActionCatalog — grille filtrable de toutes les actions Core.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Search, ExternalLink, AlertCircle } from "lucide-react";
import {
  ACTIONS, CATEGORY_LABEL, CATEGORY_ORDER, filterActions,
  type ActionCategory,
} from "./actionsRegistry";
import type { PickedClient } from "./ClientPicker";

interface Props {
  client: PickedClient | null;
  category: ActionCategory | "all";
  onCategoryChange: (c: ActionCategory | "all") => void;
}

export default function ActionCatalog({ client, category, onCategoryChange }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => filterActions(q, category), [q, category]);

  const grouped = useMemo(() => {
    const byCat = new Map<ActionCategory, typeof ACTIONS>();
    for (const a of filtered) {
      if (!byCat.has(a.category)) byCat.set(a.category, []);
      byCat.get(a.category)!.push(a);
    }
    return byCat;
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-core-text-label" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une action (suspension, recouvrement, sla, dispatch, kyc…)"
            className="pl-9 bg-core-card-raised border-core-border-strong text-core-text-primary"
          />
        </div>
        <span className="text-xs text-core-text-label shrink-0">
          {filtered.length} action{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        <CategoryChip active={category === "all"} onClick={() => onCategoryChange("all")}>
          Toutes
        </CategoryChip>
        {CATEGORY_ORDER.map((c) => (
          <CategoryChip key={c} active={category === c} onClick={() => onCategoryChange(c)}>
            {CATEGORY_LABEL[c]}
          </CategoryChip>
        ))}
      </div>

      <div className="space-y-4">
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;
          return (
            <section key={cat}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-core-text-label mb-2">
                {CATEGORY_LABEL[cat]}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map((a) => {
                  const Icon = a.icon;
                  const href = a.hrefBuilder({
                    customerId: client?.id ?? null,
                    userId: client?.user_id ?? null,
                    email: client?.email ?? null,
                  });
                  const disabled = a.requiresClient && !client;
                  return (
                    <Link
                      key={a.id}
                      to={disabled ? "#" : href}
                      onClick={(e) => disabled && e.preventDefault()}
                      className={`group p-3 rounded-lg border bg-core-card transition flex items-start gap-2.5 ${
                        disabled
                          ? "border-core-border opacity-50 cursor-not-allowed"
                          : "border-core-border hover:border-core-accent/50 hover:bg-core-card-raised"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-core-accent/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-core-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-core-text-primary flex items-center gap-1.5">
                          <span className="truncate">{a.label}</span>
                          {!disabled && <ExternalLink className="w-3 h-3 text-core-text-label opacity-0 group-hover:opacity-100 transition" />}
                        </p>
                        <p className="text-xs text-core-text-secondary line-clamp-2">{a.description}</p>
                        {disabled && (
                          <p className="text-[10px] text-core-warning flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3" /> Sélectionnez un client
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-core-text-label text-sm">Aucune action ne correspond à votre recherche.</div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
        active
          ? "bg-core-accent text-white"
          : "bg-core-card-raised border border-core-border-strong text-core-text-secondary hover:text-core-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
