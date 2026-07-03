import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import GuestCheckout from "@/pages/GuestCheckout";

export default function OrderEntryRouter() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quoteId = searchParams.get("quote_id");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!quoteId) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("field-payment-link-create", {
          body: { quote_id: quoteId, mode: "link_only" },
        });
        if (cancelled) return;
        if (error || !data?.ok || !data?.intent_id) throw error || new Error(data?.error || "Lien invalide");
        navigate(`/ma-commande/${data.intent_id}`, { replace: true });
      } catch (err) {
        console.warn("[OrderEntryRouter] legacy quote redirect failed", err);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, quoteId]);

  if (!quoteId) return <GuestCheckout />;

  if (failed) {
    return (
      <main className="min-h-screen bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Lien de commande introuvable</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Ce lien n'est plus valide. Contactez votre représentant Nivra pour recevoir un nouveau lien sécurisé.
          </p>
          <a className="mt-5 inline-flex text-sm font-semibold text-primary underline" href="mailto:support@nivra-telecom.ca">
            support@nivra-telecom.ca
          </a>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}