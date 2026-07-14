/**
 * TechStock v2 — Van stock backed by equipment_inventory.
 * Migrated to tech-core.css (tc-*) with TechPageHeader.
 */
import { useMemo, useState } from "react";
import { Package, Wifi, Tv, Radio, Search, AlertTriangle, ScanLine, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import TechPageHeader from "../components/TechPageHeader";
import { useVanStock, classifyTechItem, type TechCategory } from "../lib/useVanStock";

const CATEGORY_META: Record<TechCategory, { label: string; Icon: typeof Wifi }> = {
  borne: { label: "Borne WiFi", Icon: Wifi },
  terminal: { label: "Terminal TV", Icon: Tv },
  pod: { label: "POD WiFi", Icon: Radio },
};

function categoryOf(item: { catalog_name: string | null; category: string | null; sku: string | null }) {
  const key = classifyTechItem(item);
  if (!key) return { key: "other" as const, label: "Autre", Icon: Package };
  return { key, ...CATEGORY_META[key] };
}

export default function TechStock() {
  const { data, isLoading, refetch, isRefetching } = useVanStock();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = data?.items || [];
    if (!q.trim()) return list;
    const needle = q.toLowerCase();
    return list.filter((it) =>
      [it.catalog_name, it.sku, it.serial_number, it.category, it.warehouse_location]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [data, q]);

  return (
    <div>
      <TechPageHeader
        title="Stock véhicule"
        subtitle="Équipements disponibles pour vos installations"
        right={
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="tc-btn tc-btn-ghost tc-focus-ring disabled:opacity-60"
            aria-label="Actualiser"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        }
      />

      <div className="px-4 md:px-6 py-5 space-y-5 max-w-6xl mx-auto">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bornes WiFi", val: data?.bornes ?? 0, Icon: Wifi },
            { label: "Terminaux TV", val: data?.terminals ?? 0, Icon: Tv },
            { label: "POD WiFi", val: data?.pods ?? 0, Icon: Radio },
          ].map(({ label, val, Icon }) => (
            <div key={label} className="tc-kpi">
              <div className="flex items-center justify-between">
                <span className="tc-kpi-label">{label}</span>
                <Icon className="h-4 w-4" style={{ color: "hsl(var(--primary-glow))" }} />
              </div>
              <span className="tc-kpi-value">{val}</span>
            </div>
          ))}
        </div>

        {data?.lowStock && (
          <div
            className="rounded-lg p-3 flex items-center gap-2.5"
            style={{ background: "hsl(var(--warning) / 0.1)", border: "1px solid hsl(var(--warning) / 0.35)" }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--warning))" }} />
            <p className="text-[13px] font-medium" style={{ color: "hsl(var(--warning))" }}>
              Stock bas — pensez à réapprovisionner
            </p>
          </div>
        )}

        {/* Search + scan */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 h-11 rounded-lg px-3 flex items-center gap-2"
            style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))" }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (nom, SKU, série)…"
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "hsl(var(--foreground))" }}
            />
          </div>
          <Link to="/tech/scanner" className="tc-btn tc-btn-primary tc-focus-ring" aria-label="Scanner">
            <ScanLine className="h-4 w-4" />
            <span className="hidden sm:inline">Scanner</span>
          </Link>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "hsl(var(--primary-glow))" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="tc-surface p-8 text-center">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-60" style={{ color: "hsl(var(--muted-foreground))" }} />
            <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              Aucun équipement disponible.
            </p>
          </div>
        ) : (
          <div className="tc-surface divide-y" style={{ borderColor: "hsl(var(--border))" }}>
            {filtered.map((it) => {
              const cat = categoryOf(it);
              const available = it.status === "in_stock";
              return (
                <div key={it.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "hsl(var(--primary) / 0.12)", border: "1px solid hsl(var(--primary) / 0.28)" }}
                  >
                    <cat.Icon className="h-4 w-4" style={{ color: "hsl(var(--primary-glow))" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold truncate" style={{ color: "hsl(var(--foreground))" }}>
                      {it.catalog_name || cat.label}
                    </p>
                    <p className="text-[11.5px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>
                      {[it.sku, it.serial_number, it.warehouse_location].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {it.stock_scope === "my_mission" && (
                      <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "hsl(var(--info))" }}>
                        Réservé à une de vos installations
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shrink-0"
                    style={{
                      background: available ? "hsl(var(--success) / 0.14)" : "hsl(var(--warning) / 0.14)",
                      color: available ? "hsl(var(--success))" : "hsl(var(--warning))",
                      border: `1px solid ${available ? "hsl(var(--success) / 0.35)" : "hsl(var(--warning) / 0.35)"}`,
                    }}
                  >
                    {available ? "Dispo" : "Réservé"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
