/**
 * CoreGrilleCanaux — Grille des canaux TV pour Nivra Core
 * Affiche les 91 chaînes avec identification des chaînes de base (de base)
 */
import { useState, useMemo } from "react";
import { Search, X, Tv } from "lucide-react";
import { CHANNELS, ALL_CATEGORIES, getCatColor } from "@/data/channels";

const BASE_FILTER_OPTIONS = ["Toutes", "De base", "Premium"];

export default function CoreGrilleCanaux() {
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const [baseFilter, setBaseFilter] = useState("Toutes");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<typeof CHANNELS[0] | null>(null);

  const usedCategories = useMemo(() => {
    const set = new Set(CHANNELS.map(c => c.category));
    return ALL_CATEGORIES.filter(c => c === "Toutes" || set.has(c));
  }, []);

  const filtered = useMemo(() => {
    let list = [...CHANNELS];
    if (activeCategory !== "Toutes") list = list.filter(c => c.category === activeCategory);
    if (baseFilter === "De base") list = list.filter(c => c.is_base);
    if (baseFilter === "Premium") list = list.filter(c => !c.is_base);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.number.toString().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.number - b.number);
  }, [activeCategory, baseFilter, search]);

  const baseCount = CHANNELS.filter(c => c.is_base).length;

  return (
    <div className="min-h-screen" style={{ background: "#020209", color: "#fff" }}>
      {/* Header */}
      <div style={{ padding: "24px 24px 0" }}>
        <div className="flex items-center gap-3 mb-1">
          <Tv className="w-5 h-5" style={{ color: "#A78BFA" }} />
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: "-0.5px" }}>
            Grille des canaux TV
          </h1>
        </div>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 20 }}>
          {CHANNELS.length} chaînes · <span style={{ color: "#A78BFA" }}>{baseCount} de base</span> · {CHANNELS.filter(c => c.hd).length} HD · {CHANNELS.filter(c => c.category.includes("4K")).length} 4K
        </p>

        {/* Search */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative" style={{ minWidth: 260 }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou numéro…"
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 32px 7px 36px", color: "#fff", fontSize: 13, outline: "none" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Base filter */}
          <div className="flex gap-1.5">
            {BASE_FILTER_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setBaseFilter(opt)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: "pointer",
                  border: baseFilter === opt ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.1)",
                  background: baseFilter === opt ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                  color: baseFilter === opt ? "#A78BFA" : "rgba(255,255,255,0.5)",
                  transition: "all .15s",
                }}
              >
                {opt === "De base" ? `⭐ De base (${baseCount})` : opt === "Premium" ? `Premium (${CHANNELS.length - baseCount})` : opt}
              </button>
            ))}
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
          {usedCategories.map(cat => {
            const active = activeCategory === cat;
            const color = getCatColor(cat);
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0,
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: "pointer",
                  transition: "all .15s",
                  border: active ? `1px solid ${color.border}` : "1px solid rgba(255,255,255,0.08)",
                  background: active ? color.bg : "rgba(255,255,255,0.02)",
                  color: active ? color.text : "rgba(255,255,255,0.45)",
                  whiteSpace: "nowrap",
                }}
              >
                {cat === "Toutes" ? `Toutes (${CHANNELS.length})` : cat}
              </button>
            );
          })}
        </div>

        <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", marginBottom: 16 }}>
          {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Grid */}
      <div style={{ padding: "0 24px 40px" }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {filtered.map(ch => {
            const color = getCatColor(ch.category);
            return (
              <button
                key={ch.number}
                onClick={() => setSelected(ch)}
                className="text-left rounded-xl relative"
                style={{
                  background: ch.is_base ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.03)",
                  border: ch.is_base ? "1px solid rgba(124,58,237,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "border-color .15s, box-shadow .15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = color.border;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${color.bg}`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = ch.is_base ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {/* De base badge */}
                {ch.is_base && (
                  <span style={{ position: "absolute", top: 8, right: 8, fontSize: 8, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.05em" }}>
                    BASE
                  </span>
                )}

                <div className="flex items-center gap-2 mb-1.5">
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, color: color.text, letterSpacing: "-0.5px" }}>
                    {ch.number}
                  </span>
                  <div className="flex gap-1">
                    {ch.hd && <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#67E8F9", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", borderRadius: 3, padding: "1px 4px" }}>HD</span>}
                    {ch.category.includes("4K") && <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#FCD34D", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 3, padding: "1px 4px" }}>4K</span>}
                  </div>
                </div>

                <div className="font-bold text-white mb-1.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, lineHeight: 1.3 }}>
                  {ch.name}
                </div>

                <span style={{ fontSize: 9, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: color.text, background: color.bg, border: `1px solid ${color.border}`, borderRadius: 4, padding: "1px 6px" }}>
                  {ch.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="relative rounded-2xl w-full max-w-sm"
            style={{ background: "#0F0820", border: "1px solid rgba(124,58,237,0.4)", boxShadow: "0 32px 64px rgba(0,0,0,0.8)", padding: "24px" }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>
              <X className="w-3.5 h-3.5" />
            </button>

            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 40, color: getCatColor(selected.category).text, letterSpacing: "-1.5px", lineHeight: 1, marginBottom: 4 }}>
              {selected.number}
            </div>
            <h3 className="font-extrabold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, letterSpacing: "-0.5px" }}>
              {selected.name}
            </h3>

            <div className="flex flex-wrap gap-2 mb-4">
              <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: getCatColor(selected.category).text, background: getCatColor(selected.category).bg, border: `1px solid ${getCatColor(selected.category).border}`, borderRadius: 5, padding: "2px 8px" }}>
                {selected.category}
              </span>
              {selected.is_base && (
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 5, padding: "2px 8px" }}>
                  ⭐ CHAÎNE DE BASE
                </span>
              )}
              {selected.hd && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#67E8F9", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 5, padding: "2px 8px" }}>HD</span>}
              {selected.category.includes("4K") && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#FCD34D", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 5, padding: "2px 8px" }}>4K UHD</span>}
            </div>

            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)", marginBottom: 14 }} />

            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.65 }}>
              {selected.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
