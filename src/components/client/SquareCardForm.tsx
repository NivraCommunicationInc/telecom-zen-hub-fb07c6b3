import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { portalClient } from "@/integrations/backend/portalClient";
import { toast } from "sonner";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";

interface Props {
  customerId: string;
  onSaved: (cardBrand: string, last4: string) => void;
}

export function SquareCardForm({ customerId, onSaved }: Props) {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [card, setCard] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    if ((window as any).Square) { setSdkLoaded(true); return; }
    if (document.querySelector('script[src*="web.squarecdn.com"]')) return;
    const script = document.createElement("script");
    script.src = "https://web.squarecdn.com/v1/square.js";
    script.onload = () => setSdkLoaded(true);
    script.onerror = () => toast.error("Impossible de charger Square. Rechargez la page.");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!sdkLoaded || !containerRef.current) return;
    let destroyed = false;

    (async () => {
      try {
        const payments = await (window as any).Square.payments(SQUARE_APP_ID, SQUARE_LOCATION_ID);
        const c = await payments.card();
        await c.attach(containerRef.current!);
        if (!destroyed) { cardRef.current = c; setCard(c); }
      } catch (e: any) {
        if (!destroyed) toast.error("Erreur d'initialisation Square : " + e.message);
      }
    })();

    return () => {
      destroyed = true;
      cardRef.current?.destroy?.();
    };
  }, [sdkLoaded]);

  const handleSave = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        toast.error("Erreur de carte : " + (result.errors?.[0]?.message || "Token invalide"));
        return;
      }
      const { data, error } = await portalClient.functions.invoke("square-save-card", {
        body: { source_id: result.token, customer_id: customerId },
      });
      if (error || !data?.ok) {
        toast.error(data?.error || error?.message || "Erreur lors de l'enregistrement");
        return;
      }
      toast.success("Carte enregistrée avec succès !");
      onSaved(data.card_brand || "CARD", data.last_4 || "????");
    } catch (e: any) {
      toast.error("Erreur inattendue : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!sdkLoaded) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Chargement du formulaire...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        id="sq-card-container"
        className="min-h-[90px]"
      />
      {!card && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {card && (
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enregistrement...</>
            : <><CreditCard className="w-4 h-4 mr-2" />Enregistrer ma carte</>}
        </Button>
      )}
    </div>
  );
}
