import { useState, useMemo, useRef } from "react";
import { X, Search, Tv, Wifi } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { CHANNELS, ALL_CATEGORIES, getCatColor } from "@/data/channels";
import type { Channel } from "@/data/channels";

export default function GrilleCanaux() {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Channel | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = CHANNELS;
    if (activeCategory !== "Toutes") list = list.filter(c => c.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.number.toString().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.number - b.number);
  }, [activeCategory, search]);

  const usedCategories = useMemo(() => {
    const set = new Set(CHANNELS.map(c => c.category));
    return ALL_CATEGORIES.filter(c => c === "Toutes" || set.has(c));
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#020209" }}>
      <SEOHead
        title={isFr ? "Grille des canaux TV | Nivra Telecom" : "TV Channel Guide | Nivra Telecom"}
        description={isFr
          ? `Découvrez les ${CHANNELS.length} chaînes TV disponibles chez Nivra Telecom — Généralistes, Sports, Cinéma, Nouvelles et plus.`
          : `Explore the ${CHANNELS.length} TV channels available with Nivra Telecom — General, Sports, Movies, News and more.`}
      />
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ paddingTop: 96, paddingBottom: 48 }}>
        <div aria-hidden style={{ position: "absolute", top: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 65%)", animation: "n-aurora-1 16s ease-in-out infinite", pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", bottom: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.1) 0%, transparent 65%)", animation: "n-aurora-2 20s ease-in-out infinite", pointerEvents: "none" }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

        <div className="max-w-[1200px] mx-auto px-4 sm:px-10 relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 100 }}>
            <Tv className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {isFr ? "Grille des canaux" : "Channel Guide"}
            </span>
          </div>
          <h1 className="font-extrabold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 5vw, 52px)", letterSpacing: "-1.5px", lineHeight: 1.08 }}>
            {isFr ? <>Vos <span className="n-shimmer-text">{CHANNELS.length} chaînes</span> TV</> : <>Your <span className="n-shimmer-text">{CHANNELS.length} TV channels</span></>}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, maxWidth: 560 }}>
            {isFr
              ? "Généralistes, sports, cinéma, nouvelles, documentaires et plus — tout inclus dans votre forfait Télévision Nivra."
              : "General, sports, movies, news, documentaries and more — all included in your Nivra TV plan."}
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 mt-8">
            {[
              { val: `${CHANNELS.filter(c => c.hd).length}+`, label: isFr ? "Chaînes HD" : "HD Channels" },
              { val: `${CHANNELS.filter(c => c.category.includes("4K")).length}`, label: "Chaînes 4K" },
              { val: `${usedCategories.length - 1}`, label: isFr ? "Catégories" : "Categories" },
              { val: `${CHANNELS.filter(c => c.category === "Sports" || c.category === "Sports 4K").length}`, label: isFr ? "Chaînes sport" : "Sport channels" },
            ].map(s => (
              <div key={s.label}>
                <div className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, letterSpacing: "-1px", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sticky filter bar ── */}
      <div ref={filterRef} style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(2,2,9,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(124,58,237,0.15)", paddingTop: 12, paddingBottom: 12 }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-10">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isFr ? "Rechercher par nom ou numéro…" : "Search by name or number…"}
              style={{ width: "100%", maxWidth: 400, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px 8px 36px", color: "#fff", fontSize: 13, outline: "none" }}
              className="focus:border-purple-500/50"
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", cursor: "pointer", background: "none", border: "none" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {usedCategories.map(cat => {
              const active = activeCategory === cat;
              const color = getCatColor(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    flexShrink: 0,
                    padding: "5px 14px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    transition: "all .18s",
                    border: active ? `1px solid ${color.border}` : "1px solid rgba(255,255,255,0.1)",
                    background: active ? color.bg : "rgba(255,255,255,0.03)",
                    color: active ? color.text : "rgba(255,255,255,0.5)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat === "Toutes" ? `${isFr ? "Toutes" : "All"} (${CHANNELS.length})` : cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Channel grid ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px 80px" }} className="sm:px-10">
        {filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.35)", fontSize: 15 }}>
            {isFr ? "Aucune chaîne trouvée." : "No channels found."}
          </div>
        ) : (
          <>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", marginBottom: 20, letterSpacing: "0.05em" }}>
              {filtered.length} {isFr ? "chaîne" : "channel"}{filtered.length > 1 ? "s" : ""}
            </p>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {filtered.map(ch => {
                const color = getCatColor(ch.category);
                return (
                  <button
                    key={ch.number}
                    onClick={() => setSelected(ch)}
                    className="text-left rounded-2xl transition-all group"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      padding: "16px",
                      cursor: "pointer",
                      transition: "border-color .2s, box-shadow .2s, transform .15s",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = color.border;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${color.bg}`;
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      (e.currentTarget as HTMLElement).style.transform = "none";
                    }}
                  >
                    {/* Number + badges row */}
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, color: color.text, letterSpacing: "-0.5px" }}>
                        {ch.number}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ch.hd && (
                          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#67E8F9", background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 4, padding: "2px 6px" }}>
                            HD
                          </span>
                        )}
                        {ch.category.includes("4K") && (
                          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#FCD34D", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "2px 6px" }}>
                            4K
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Channel name */}
                    <div className="font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, lineHeight: 1.3 }}>
                      {ch.name}
                    </div>

                    {/* Category badge */}
                    <div className="mb-2">
                      <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", color: color.text, background: color.bg, border: `1px solid ${color.border}`, borderRadius: 6, padding: "2px 8px" }}>
                        {ch.category}
                      </span>
                    </div>

                    {/* Description preview */}
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11.5, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {ch.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* ── Channel detail modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="relative rounded-2xl w-full max-w-md"
            style={{ background: "linear-gradient(135deg, rgba(20,10,40,0.98) 0%, rgba(10,5,20,0.98) 100%)", border: "1px solid rgba(124,58,237,0.4)", boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.2)", padding: "28px" }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Number */}
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 48, lineHeight: 1, color: getCatColor(selected.category).text, letterSpacing: "-2px", marginBottom: 4 }}>
              {selected.number}
            </div>

            {/* Name */}
            <h2 className="font-extrabold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
              {selected.name}
            </h2>

            {/* Badges */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: getCatColor(selected.category).text, background: getCatColor(selected.category).bg, border: `1px solid ${getCatColor(selected.category).border}`, borderRadius: 6, padding: "3px 10px" }}>
                {selected.category}
              </span>
              {selected.hd && (
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#67E8F9", background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 4, padding: "3px 8px" }}>
                  HD
                </span>
              )}
              {selected.category.includes("4K") && (
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#FCD34D", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "3px 8px" }}>
                  4K UHD
                </span>
              )}
              {!selected.hd && !selected.category.includes("4K") && (
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "3px 8px" }}>
                  SD
                </span>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)", marginBottom: 16 }} />

            {/* Description */}
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.7 }}>
              {selected.description}
            </p>

            {/* CTA */}
            <a
              href="/tv"
              className="flex items-center justify-center gap-2 font-bold text-white mt-6"
              style={{ height: 46, borderRadius: 10, fontSize: 14, textDecoration: "none", fontFamily: "'Space Grotesk', sans-serif", background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", boxShadow: "0 0 0 1px rgba(124,58,237,0.5), 0 6px 20px rgba(124,58,237,0.35)" }}
            >
              <Tv className="w-4 h-4" />
              {isFr ? "Voir les forfaits TV" : "See TV plans"}
            </a>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
