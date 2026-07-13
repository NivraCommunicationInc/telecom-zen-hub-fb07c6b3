/**
 * TechStock — Real van stock backed by equipment_inventory.
 * Shows category totals + itemised list with search, from live DB.
 */
import { useMemo, useState } from "react";
import { Package, Wifi, Tv, Radio, Search, AlertTriangle, ScanLine, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import TechHeader from "../components/TechHeader";
import { useVanStock, classifyTechItem, type TechCategory } from "../lib/useVanStock";

const CATEGORY_META: Record<TechCategory, { label: string; Icon: typeof Wifi; color: string }> = {
  borne: { label: "Borne WiFi", Icon: Wifi, color: "#a78bfa" },
  terminal: { label: "Terminal TV", Icon: Tv, color: "#22d3ee" },
  pod: { label: "POD WiFi", Icon: Radio, color: "#34d399" },
};

function categoryOf(item: { catalog_name: string | null; category: string | null; sku: string | null }) {
  const key = classifyTechItem(item);
  if (!key) return { key: "other" as const, label: "Autre", Icon: Package, color: "#94a3b8" };
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
      <TechHeader title="Stock van" />

      <div className="px-4 pt-4 pb-6 space-y-4">
        {/* KPI row — only equipment techniciens installent (Borne WiFi, Terminal TV, POD WiFi) */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Bornes WiFi", val: data?.bornes ?? 0, Icon: Wifi, color: "#a78bfa" },
            { label: "Terminaux TV", val: data?.terminals ?? 0, Icon: Tv, color: "#22d3ee" },
            { label: "POD WiFi", val: data?.pods ?? 0, Icon: Radio, color: "#34d399" },
          ].map(({ label, val, Icon, color }) => (
            <div key={label} className="tp-card p-3">
              <Icon className="h-4 w-4" style={{ color }} />
              <p className="tp-kpi text-[24px] mt-1.5" style={{ color: "var(--tp-text)" }}>{val}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--tp-text-dim)" }}>{label}</p>
            </div>
          ))}
        </div>

        {data?.lowStock && (
          <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--tp-warning)" }} />
            <p className="text-[12px] font-semibold" style={{ color: "var(--tp-warning)" }}>Stock bas — pensez à réapprovisionner</p>
          </div>
        )}

        {/* Search + scan */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-11 rounded-xl px-3 flex items-center gap-2 tp-card">
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--tp-text-dim)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (nom, SKU, série)…"
              className="flex-1 bg-transparent outline-none text-[13px]"
              style={{ color: "var(--tp-text)" }}
            />
          </div>
          <Link
            to="/tech/scanner"
            className="h-11 w-11 rounded-xl flex items-center justify-center tp-btn-primary"
            aria-label="Scanner"
          >
            <ScanLine className="h-5 w-5 text-white" />
          </Link>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--tp-primary)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="tp-card p-6 text-center">
            <Package className="h-10 w-10 mx-auto mb-2" style={{ color: "var(--tp-text-dim)", opacity: 0.6 }} />
            <p className="text-[13px]" style={{ color: "var(--tp-text-muted)" }}>Aucun équipement disponible.</p>
          </div>
        ) : (
          <div className="tp-card divide-y" style={{ borderColor: "var(--tp-border)" }}>
            {filtered.map((it) => {
              const cat = categoryOf(it);
              return (
                <div key={it.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}44` }}
                  >
                    <cat.Icon className="h-4 w-4" style={{ color: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate" style={{ color: "var(--tp-text)" }}>
                      {it.catalog_name || cat.label}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--tp-text-dim)" }}>
                      {[it.sku, it.serial_number, it.warehouse_location].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {it.stock_scope === "my_mission" && (
                      <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--tp-info)" }}>
                        Réservé à une de vos installations
                      </p>
                    )}
                  </div>
                  <span
                    className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full shrink-0"
                    style={{
                      background: it.status === "in_stock" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                      color: it.status === "in_stock" ? "var(--tp-success-glow)" : "var(--tp-warning)",
                    }}
                  >
                    {it.status === "in_stock" ? "Dispo" : "Réservé"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="w-full h-10 rounded-xl text-[12px] font-bold tp-card disabled:opacity-60"
          style={{ color: "var(--tp-text-muted)" }}
        >
          {isRefetching ? "Actualisation…" : "Actualiser"}
        </button>
      </div>
    </div>
  );
}
