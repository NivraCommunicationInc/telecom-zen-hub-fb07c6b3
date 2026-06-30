import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";

// Must call functions on the production project, not the Lovable project
const BACKEND_URL = "https://lacxnbjvcyvhrttprkxr.supabase.co";
const BACKEND_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhY3huYmp2Y3l2aHJ0dHBya3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjI2NjMsImV4cCI6MjA5NTk5ODY2M30.Jcc89WC7CofMuMc9IRpxzsDsEb-_C7AVgLEbNzdLa2g";

interface Props {
  customerId: string;
  onSaved: (cardBrand: string, last4: string) => void;
}

export function SquareCardForm({ customerId, onSaved }: Props) {
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);

  // Load Square.js once
  useEffect(() => {
    if ((window as any).Square) { setSdkReady(true); return; }
    if (document.querySelector('script[src*="web.squarecdn.com"]')) {
      // Script already injected but not yet loaded — wait for it
      const poll = setInterval(() => {
        if ((window as any).Square) { clearInterval(poll); setSdkReady(true); }
      }, 100);
      return () => clearInterval(poll);
    }
    const script = document.createElement("script");
    script.src = "https://web.squarecdn.com/v1/square.js";
    script.onload = () => setSdkReady(true);
    script.onerror = () => toast.error("Impossible de charger Square — rechargez la page.");
    document.head.appendChild(script);
  }, []);

  // Attach card widget once SDK is ready and container is mounted
  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    let active = true;

    (async () => {
      try {
        const payments = (window as any).Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const c = await payments.card();
        await c.attach(containerRef.current!);
        if (!active) { c.destroy(); return; }
        cardRef.current = c;
        setCardReady(true);
      } catch (e: any) {
        if (active) toast.error("Erreur Square : " + (e?.message || String(e)));
      }
    })();

    return () => {
      active = false;
      if (cardRef.current) {
        cardRef.current.destroy?.();
        cardRef.current = null;
      }
      setCardReady(false);
    };
  }, [sdkReady]);

  const handleSave = async () => {
    if (!cardRef.current) {
      toast.error("Formulaire non prêt — rechargez la page.");
      return;
    }
    setSaving(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        const msg = result.errors?.[0]?.message || "Informations de carte invalides";
        toast.error("Erreur : " + msg);
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
        toast.error(data?.error || "Erreur lors de l'enregistrement de la carte");
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
      {!sdkReady && (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Chargement du formulaire de paiement...</span>
        </div>
      )}

      {/* Square injects the card widget into this div */}
      <div
        ref={containerRef}
        id="sq-card-container"
        className={`min-h-[90px] ${!sdkReady ? "hidden" : ""}`}
      />

      {sdkReady && !cardReady && (
        <div className="flex items-center justify-center py-3 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Initialisation...</span>
        </div>
      )}

      {sdkReady && (
        <Button
          onClick={handleSave}
          disabled={saving || !cardReady}
          className="w-full"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enregistrement...</>
            : <><CreditCard className="w-4 h-4 mr-2" />Enregistrer ma carte</>}
        </Button>
      )}
    </div>
  );
}
