/**
 * PhoneCatalog — public catalog of phones for sale.
 *
 * Reads `phone_inventory` where status = 'available'. Public RLS allows
 * anonymous reads. Filters apply via URL params: ?brand=…&condition=…&maxPrice=…
 *
 * Route: /telephones
 */
import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Shield, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Phone = {
  id: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: "new" | "refurbished" | "used";
  price_cad: number;
  photos: string[];
  warranty_days: number;
  description: string | null;
};

const conditionLabel = (c: Phone["condition"], fr: boolean) => {
  if (c === "new") return fr ? "Neuf" : "New";
  if (c === "refurbished") return fr ? "Remis à neuf" : "Refurbished";
  return fr ? "Usagé" : "Used";
};

const conditionStyle = (c: Phone["condition"]) => {
  if (c === "new") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (c === "refurbished") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  return "bg-muted text-muted-foreground border-border";
};

export default function PhoneCatalog() {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();

  const brand = params.get("brand") ?? "all";
  const condition = params.get("condition") ?? "all";
  const maxPrice = params.get("maxPrice") ?? "";

  const { data: phones = [], isLoading: loading } = useQuery({
    queryKey: ["public-phone-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("phone_inventory")
        .select("id, brand, model, storage, color, condition, price_cad, photos, warranty_days, description")
        .eq("status", "available")
        .eq("is_visible_on_site", true)
        .order("price_cad", { ascending: true });
      if (error) {
        console.error("[phones]", error);
        throw error;
      }
      return (data as Phone[]) ?? [];
    },
    staleTime: 30_000,
  });

  // Realtime: refresh catalog instantly when admin toggles visibility / status
  useEffect(() => {
    const channel = supabase
      .channel("phone-catalog-public")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "phone_inventory" },
        () => qc.invalidateQueries({ queryKey: ["public-phone-catalog"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const brands = useMemo(
    () => Array.from(new Set(phones.map((p) => p.brand))).sort(),
    [phones],
  );

  const filtered = useMemo(() => {
    return phones.filter((p) => {
      if (brand !== "all" && p.brand !== brand) return false;
      if (condition !== "all" && p.condition !== condition) return false;
      if (maxPrice && Number(p.price_cad) > Number(maxPrice)) return false;
      return true;
    });
  }, [phones, brand, condition, maxPrice]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <>
      <Header />
      <main id="main-content" style={{ minHeight: '100vh', background: '#020209', paddingTop: 64 }}>
        {/* Hero */}
        <section className="relative overflow-hidden" style={{ paddingTop: 80, paddingBottom: 48, textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="n-animate-in inline-flex items-center gap-2 mb-5" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 100, padding: '6px 16px' }}>
              <Smartphone style={{ width: 14, height: 14, color: '#7C3AED' }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#A78BFA', letterSpacing: '0.08em' }}>{isFr ? 'CATALOGUE' : 'CATALOG'}</span>
            </div>
            <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(36px, 5.5vw, 60px)', letterSpacing: '-2.5px', lineHeight: 1.0, marginBottom: 12, color: '#fff' }}>
              {isFr ? <>Nos <span className="n-shimmer-text">téléphones</span></> : <>Our <span className="n-shimmer-text">phones</span></>}
            </h1>
            <p className="n-animate-in-delay-2" style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>
              {isFr ? "Appareils neufs, remis à neuf et usagés" : "New, refurbished and used devices"}
            </p>
          </div>
        </section>
        <div className="container mx-auto px-4 py-4">

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>{isFr ? "Marque" : "Brand"}</Label>
                <Select value={brand} onValueChange={(v) => updateParam("brand", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isFr ? "Toutes" : "All"}</SelectItem>
                    {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isFr ? "Condition" : "Condition"}</Label>
                <Select value={condition} onValueChange={(v) => updateParam("condition", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isFr ? "Toutes" : "All"}</SelectItem>
                    <SelectItem value="new">{conditionLabel("new", isFr)}</SelectItem>
                    <SelectItem value="refurbished">{conditionLabel("refurbished", isFr)}</SelectItem>
                    <SelectItem value="used">{conditionLabel("used", isFr)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isFr ? "Prix max (CAD)" : "Max price (CAD)"}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="1500"
                  value={maxPrice}
                  onChange={(e) => updateParam("maxPrice", e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setParams(new URLSearchParams(), { replace: true })}
                >
                  {isFr ? "Réinitialiser" : "Reset"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{isFr ? "Aucun appareil disponible pour le moment." : "No devices available right now."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((p) => (
                <Card key={p.id} className="group hover:shadow-lg transition-shadow flex flex-col">
                  <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center overflow-hidden">
                    {p.photos?.[0] ? (
                      <img src={p.photos[0]} alt={`${p.brand} ${p.model}`} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Smartphone className="w-20 h-20 text-muted-foreground/40" />
                    )}
                  </div>
                  <CardContent className="p-4 flex flex-col flex-1">
                    <Badge variant="outline" className={`self-start mb-2 ${conditionStyle(p.condition)}`}>
                      {conditionLabel(p.condition, isFr)}
                    </Badge>
                    <h3 className="font-semibold text-foreground">
                      {p.brand} {p.model}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {p.storage} · {p.color}
                    </p>
                    <div className="text-2xl font-bold text-foreground mb-1">
                      {Number(p.price_cad).toFixed(2)}$
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                      <Shield className="w-3.5 h-3.5" />
                      {isFr ? `Garantie ${p.warranty_days} jours` : `${p.warranty_days}-day warranty`}
                    </div>
                    <Button asChild className="mt-auto w-full">
                      <Link to={`/telephones/${p.id}`}>
                        {isFr ? "Commander" : "Order"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
