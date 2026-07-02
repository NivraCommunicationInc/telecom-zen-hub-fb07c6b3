import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { AlertCircle, Copy, Send, CreditCard, Loader2, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { invalidateAfterPayment } from "@/lib/queryInvalidation";

const INTERAC_EMAIL = "support@nivra-telecom.ca";
const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";
const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const ClientPayBalanceCard = () => {
  const { user } = useClientAuth();
  const qc = useQueryClient();
  const { data: canonicalData, isLoading } = useCanonicalClientData(user?.id);

  const accountNumber =
    (canonicalData?.profile as any)?.account_number ||
    (canonicalData?.account as any)?.account_number ||
    "—";

  const { data } = useQuery({
    queryKey: ["client-balance-summary", user?.id],
    enabled: !!user?.id,
    queryFn: () => {
      const invoices = canonicalData?.invoices || [];
      const CLOSED = ["void", "cancelled", "refunded", "paid", "paid_by_promo"];
      const unpaid = invoices.filter(
        (i: any) => !CLOSED.includes(String(i.status || "")) && Number(i.balance_due) > 0
      );
      const total = Math.round(
        unpaid.reduce((s: number, i: any) => s + (Number(i.balance_due) || 0), 0) * 100
      ) / 100;
      return { totalBalance: total, invoiceCount: unpaid.length, unpaidInvoices: unpaid };
    },
    staleTime: 30_000,
  });

  const [tab, setTab] = useState<"card" | "interac">("card");
  const [sqLoading, setSqLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [allPaid, setAllPaid] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));

  // Load Square widget when "card" tab is active and there's a balance
  useEffect(() => {
    if (tab !== "card" || !data?.totalBalance || allPaid) return;

    let destroyed = false;
    setSqLoading(true);

    const init = async () => {
      try {
        if (!(window as any).Square) {
          await new Promise<void>((resolve, reject) => {
            if (document.querySelector('script[src*="web.squarecdn.com"]')) {
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
        setSqLoading(false);
      } catch (e: any) {
        if (!destroyed) {
          toast.error("Erreur Square : " + (e?.message || String(e)));
          setSqLoading(false);
        }
      }
    };

    init();
    return () => {
      destroyed = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, [tab, data?.totalBalance, allPaid]);

  const handlePayAll = async () => {
    if (!cardRef.current || !data?.unpaidInvoices?.length) return;
    setPaying(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        toast.error(result.errors?.[0]?.message || "Informations de carte invalides");
        return;
      }
      const source_id = result.token;

      let anyFailed = false;
      const squareRefs: string[] = [];
      for (const inv of data.unpaidInvoices) {
        const res = await fetch(`${BACKEND_URL}/functions/v1/square-charge-invoice`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BACKEND_ANON_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ source_id, invoice_id: inv.id }),
        });
        const d = await res.json();
        if (!d?.ok) {
          anyFailed = true;
          // Message Square VERBATIM.
          toast.error(`Facture ${inv.invoice_number || inv.id}: ${d?.error || "Paiement refusé"}`);
        } else {
          const ref = d.square_payment_id || d.payment_id;
          if (ref) squareRefs.push(ref);
        }
      }
      if (!anyFailed) {
        setAllPaid(true);
        const refStr = squareRefs.length ? ` — Référence(s) Square : ${squareRefs.join(", ")}` : "";
        toast.success(`Paiement approuvé par Square${refStr}`);
        invalidateAfterPayment(qc);
      }
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setPaying(false);
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.totalBalance <= 0 || allPaid) {
    if (allPaid) return (
      <Card className="border-emerald-300/50 bg-emerald-50/30">
        <CardContent className="p-6 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
          <p className="font-semibold text-emerald-700">Toutes les factures sont payées !</p>
        </CardContent>
      </Card>
    );
    return null;
  }

  return (
    <Card className="border-amber-300/50 bg-amber-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700">
          <AlertCircle className="w-5 h-5" />
          Solde total à payer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground mb-1">
            {data.invoiceCount} facture{data.invoiceCount > 1 ? "s" : ""} impayée{data.invoiceCount > 1 ? "s" : ""}
          </p>
          <p className="text-3xl font-bold text-amber-700">
            {data.totalBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          </p>
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("card")}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === "card"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Carte
          </button>
          <button
            onClick={() => setTab("interac")}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
              tab === "interac"
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Send className="w-4 h-4" />
            Interac
          </button>
        </div>

        {/* Card tab */}
        {tab === "card" && (
          <div className="space-y-3">
            <div ref={containerRef} id="sq-balance-card-container" className="min-h-[90px]" />
            {sqLoading && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement du formulaire…
              </div>
            )}
            <Button
              onClick={handlePayAll}
              disabled={sqLoading || paying}
              className="w-full"
              size="lg"
            >
              {paying
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Traitement…</>
                : <><CreditCard className="w-4 h-4 mr-2" />
                    Payer {data.totalBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} par carte</>}
            </Button>
            <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" />
              Paiement sécurisé — Square PCI-DSS
            </p>
          </div>
        )}

        {/* Interac tab */}
        {tab === "interac" && (
          <div className="rounded-xl border border-border bg-background divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Adresse courriel</p>
                <p className="text-sm font-semibold">{INTERAC_EMAIL}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(INTERAC_EMAIL, "Courriel")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Montant</p>
                <p className="text-sm font-semibold">
                  {data.totalBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(data.totalBalance.toFixed(2), "Montant")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Réponse à la question de sécurité</p>
                <p className="text-sm font-bold">{accountNumber}</p>
                <p className="text-xs text-amber-600 mt-0.5">⚠️ Utilisez exactement ce numéro</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(String(accountNumber), "Numéro de compte")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Traitement automatique dès réception du paiement.
        </p>
      </CardContent>
    </Card>
  );
};

export default ClientPayBalanceCard;
