/**
 * PhoneDetail — public detail page for one phone.
 *
 * Route: /telephones/:id
 * Reads phone_inventory by id (public RLS allows reading available items).
 * If status !== 'available', shows "no longer available" notice.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Shield, Smartphone, Loader2, AlertTriangle } from "lucide-react";
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
  status: string;
  available_colors: string[] | null;
  available_storage: string[] | null;
};

// Storage upcharges relative to the base (default) configuration
const STORAGE_UPCHARGE: Record<string, number> = {
  "64GB": 0,
  "128GB": 0,
  "256GB": 0,
  "512GB": 100,
  "1TB": 200,
};

const condLabel = (c: string, fr: boolean) =>
  c === "new" ? (fr ? "Neuf" : "New")
  : c === "refurbished" ? (fr ? "Remis à neuf" : "Refurbished")
  : (fr ? "Usagé" : "Used");

const condStyle = (c: string) =>
  c === "new" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
  : c === "refurbished" ? "bg-blue-500/15 text-blue-700 border-blue-500/30"
  : "bg-muted text-muted-foreground border-border";

export default function PhoneDetail() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const isFr = language === "fr";
  const navigate = useNavigate();

  const [phone, setPhone] = useState<Phone | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedStorage, setSelectedStorage] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("phone_inventory")
        .select("id, brand, model, storage, color, condition, price_cad, photos, warranty_days, description, status, available_colors, available_storage")
        .eq("id", id)
        .maybeSingle();
      if (error) console.error("[phone-detail]", error);
      const p = data as Phone | null;
      setPhone(p);
      if (p) {
        setSelectedColor(p.color);
        setSelectedStorage(p.storage);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </>
    );
  }

  if (!phone) {
    return (
      <>
        <Header />
        <main id="main-content" className="min-h-screen pt-20">
          <div className="container mx-auto px-4 py-16 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold mb-2">{isFr ? "Appareil introuvable" : "Phone not found"}</h1>
            <p className="text-muted-foreground mb-6">
              {isFr ? "Cet appareil n'est plus disponible." : "This device is no longer available."}
            </p>
            <Button asChild>
              <Link to="/telephones">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isFr ? "Retour au catalogue" : "Back to catalog"}
              </Link>
            </Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const isAvailable = phone.status === "available";
  const colors = (phone.available_colors && phone.available_colors.length > 0)
    ? phone.available_colors
    : [phone.color];
  const storages = (phone.available_storage && phone.available_storage.length > 0)
    ? phone.available_storage
    : [phone.storage];
  const basePrice = Number(phone.price_cad);
  const baseUpcharge = STORAGE_UPCHARGE[phone.storage] ?? 0;
  const selectedUpcharge = STORAGE_UPCHARGE[selectedStorage] ?? 0;
  const displayPrice = +(basePrice - baseUpcharge + selectedUpcharge).toFixed(2);

  return (
    <>
      <Header />
      <main id="main-content" className="min-h-screen bg-background pt-20">
        <div className="container mx-auto px-4 py-10">
          <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isFr ? "Retour" : "Back"}
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Photos */}
            <div>
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden mb-3">
                {phone.photos?.[activePhoto] ? (
                  <img src={phone.photos[activePhoto]} alt={`${phone.brand} ${phone.model}`} className="w-full h-full object-cover" />
                ) : (
                  <Smartphone className="w-32 h-32 text-muted-foreground/40" />
                )}
              </div>
              {phone.photos.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {phone.photos.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhoto(i)}
                      className={`aspect-square rounded border-2 overflow-hidden ${i === activePhoto ? "border-primary" : "border-transparent"}`}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              <Badge variant="outline" className={`mb-3 ${condStyle(phone.condition)}`}>
                {condLabel(phone.condition, isFr)}
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {phone.brand} {phone.model}
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                {selectedStorage} · {selectedColor}
              </p>

              <div className="text-4xl font-bold text-foreground mb-2">
                {displayPrice.toFixed(2)}$
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                <Shield className="w-4 h-4" />
                {isFr ? `Garantie ${phone.warranty_days} jours` : `${phone.warranty_days}-day warranty`}
              </div>

              {/* Color selector */}
              {colors.length > 0 && (
                <div className="mb-5">
                  <Label className="text-sm font-medium mb-2 block">
                    {isFr ? "Couleur" : "Color"} : <span className="text-muted-foreground font-normal">{selectedColor}</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`px-3 py-2 rounded-full border text-sm transition ${
                          selectedColor === c
                            ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                            : "border-border hover:border-primary/50 text-foreground"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Storage selector */}
              {storages.length > 0 && (
                <div className="mb-6">
                  <Label className="text-sm font-medium mb-2 block">
                    {isFr ? "Stockage" : "Storage"}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {storages.map((s) => {
                      const upcharge = (STORAGE_UPCHARGE[s] ?? 0) - baseUpcharge;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedStorage(s)}
                          className={`px-4 py-2 rounded-full border text-sm transition ${
                            selectedStorage === s
                              ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/30"
                              : "border-border hover:border-primary/50 text-foreground"
                          }`}
                        >
                          {s}
                          {upcharge !== 0 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {upcharge > 0 ? `+${upcharge}$` : `${upcharge}$`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const cleanDesc = (phone.description || "").split("---NIVRA_META---")[0].trim();
                return cleanDesc ? (
                  <Card className="mb-6">
                    <CardContent className="pt-6">
                      <p className="text-sm text-foreground whitespace-pre-line">{cleanDesc}</p>
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              {isAvailable ? (
                <Button asChild size="lg" className="w-full">
                  <Link to={`/telephones/${phone.id}/commander?color=${encodeURIComponent(selectedColor)}&storage=${encodeURIComponent(selectedStorage)}`}>
                    {isFr ? "Commander cet appareil" : "Order this device"}
                  </Link>
                </Button>
              ) : (
                <Button size="lg" className="w-full" disabled>
                  {isFr ? "Indisponible" : "Unavailable"}
                </Button>
              )}

              <p className="text-xs text-muted-foreground text-center mt-3">
                {isFr
                  ? "Vérification d'identité requise après paiement."
                  : "Identity verification required after payment."}
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
