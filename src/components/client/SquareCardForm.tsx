import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";
const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface Props {
  customerId: string;
  onSaved: (cardBrand: string, last4: string) => void;
}

export function SquareCardForm({ customerId, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    let destroyed = false;

    const init = async () => {
      try {
        // Load Square.js if not already loaded
        if (!(window as any).Square) {
          await new Promise<void>((resolve, reject) => {
            if (document.querySelector('script[src*="web.squarecdn.com"]')) {
              // Already injected — poll until available
              const poll = setInterval(() => {
                if ((window as any).Square) { clearInterval(poll); resolve(); }
              }, 100);
              return;
            }
            const s = document.createElement("script");
            s.src = "https://web.squarecdn.com/v1/square.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Impossible de charger Square"));
            document.head.appendChild(s);
          });
        }

        if (destroyed) return;

        const payments = (window as any).Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        await card.attach(containerRef.current!);

        if (destroyed) { card.destroy(); return; }

        cardRef.current = card;
        setLoading(false);
      } catch (e: any) {
        if (!destroyed) {
          toast.error("Erreur Square : " + (e?.message || String(e)));
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      destroyed = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, []);

  const handleSave = async () => {
    if (!cardRef.current) {
      toast.error("Formulaire non initialisé — rechargez la page.");
      return;
    }
    setSaving(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        const msg = result.errors?.[0]?.message || "Informations de carte invalides";
        toast.error(msg);
        return;
      }

      const res = await fetch(`${BACKEND_URL}/functions/v1/square-save-card`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BACKEND_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source_id: result.token, customer_id: customerId }),
      });

      const data = await res.json();
      if (!data?.ok) {
        toast.error(data?.error || "Erreur lors de l'enregistrement");
        return;
      }

      toast.success("Carte enregistrée !");
      onSaved(data.card_brand || "CARD", data.last_4 || "????");
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Square injects card widget here */}
      <div ref={containerRef} id="sq-card-container" className="min-h-[90px]" />

      {loading && (
        <div className="flex items-center justify-center py-3 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Chargement du formulaire...</span>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving || loading} className="w-full">
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enregistrement...</>
          : <><CreditCard className="w-4 h-4 mr-2" />Enregistrer ma carte</>}
      </Button>
    </div>
  );
}
