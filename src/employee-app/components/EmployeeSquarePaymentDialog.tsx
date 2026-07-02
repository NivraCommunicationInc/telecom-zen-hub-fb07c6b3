/**
 * EmployeeSquarePaymentDialog — Take a payment on behalf of a client.
 * Three modes:
 *   • direct  — Square card form inline (agent reads card details by phone)
 *   • link    — Generate a payment link, copy/send to client
 *   • manual  — RecordPaymentDialog (Interac, cash, etc.)
 */
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CreditCard, CheckCircle2, Copy, Link2, ExternalLink } from "lucide-react";
import { RecordPaymentDialog } from "@/shared-ops/components/RecordPaymentDialog";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateAfterPayment } from "@/lib/queryInvalidation";

const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";
const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface Invoice {
  id: string;
  invoice_number?: string;
  total: number;
  balance_due?: number | null;
  customer_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: Invoice;
  clientEmail?: string | null;
  clientName?: string | null;
  onSuccess?: () => void;
}

type Mode = "choose" | "direct" | "link" | "manual";

export function EmployeeSquarePaymentDialog({
  open, onOpenChange, invoice, clientEmail, clientName, onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("choose");
  const [paid, setPaid] = useState(false);
  const [squareRef, setSquareRef] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Square widget state (for "direct" mode)
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [sqLoading, setSqLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const balanceDue = Number(invoice.balance_due ?? invoice.total ?? 0);

  useEffect(() => {
    if (!open) {
      setMode("choose");
      setPaid(false);
      setPaymentLink(null);
      setLinkSent(false);
      setSqLoading(true);
      cardRef.current?.destroy?.();
      cardRef.current = null;
    }
  }, [open]);

  // Load Square widget when "direct" mode is active
  useEffect(() => {
    if (mode !== "direct" || paid) return;
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
        if (!destroyed) { toast.error("Erreur Square : " + (e?.message || String(e))); setSqLoading(false); }
      }
    };

    init();
    return () => {
      destroyed = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, [mode, paid]);

  const handleDirectPay = async () => {
    if (!cardRef.current) return;
    setPaying(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        toast.error(result.errors?.[0]?.message || "Informations invalides");
        return;
      }
      const res = await fetch(`${BACKEND_URL}/functions/v1/square-charge-invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${BACKEND_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: result.token, invoice_id: invoice.id, customer_email: clientEmail }),
      });
      const data = await res.json();
      if (!data?.ok) {
        // Message Square VERBATIM — pas de traduction ni reformulation.
        toast.error(data?.error || "Paiement refusé");
        return;
      }

      const sqRef: string | null = data.square_payment_id || data.payment_id || null;
      setSquareRef(sqRef);

      await logInternalAudit({
        action: "square_direct_payment_completed",
        category: "operations",
        portal: "employee",
        targetType: "invoice",
        targetId: invoice.id,
        details: { payment_id: sqRef, amount: balanceDue },
      });
      toast.success(data.message || `Paiement approuvé par Square — Référence : ${sqRef}`);
      setPaid(true);
      invalidateAfterPayment(qc);
      onSuccess?.();
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setPaying(false);
    }
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const res = await fetch(`${BACKEND_URL}/functions/v1/core-square-payment-link`, {
        method: "POST",
        headers: { Authorization: `Bearer ${BACKEND_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoice.id,
          customer_email: clientEmail || null,
          customer_name: clientName || null,
          mode: clientEmail ? "email" : "direct",
        }),
      });
      const data = await res.json();
      if (!data?.ok) { toast.error(data?.error || "Erreur génération lien"); return; }
      setPaymentLink(data.payment_url);
      if (clientEmail && data.email_sent) {
        setLinkSent(true);
        toast.success("Lien envoyé par courriel au client");
      }
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = () => {
    if (!paymentLink) return;
    navigator.clipboard.writeText(paymentLink);
    toast.success("Lien copié !");
  };

  if (mode === "manual") {
    return (
      <RecordPaymentDialog
        open={open}
        onOpenChange={onOpenChange}
        invoiceId={invoice.id}
        customerId={invoice.customer_id}
        invoiceNumber={invoice.invoice_number}
        balanceDue={balanceDue}
        portal="employee"
        onSuccess={() => onSuccess?.()}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Prendre un paiement
          </DialogTitle>
          <DialogDescription>
            Facture {invoice.invoice_number ?? invoice.id.slice(0, 8)} —{" "}
            <span className="font-semibold text-foreground">{balanceDue.toFixed(2)} $</span>
          </DialogDescription>
        </DialogHeader>

        {paid ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium">Paiement approuvé par Square</p>
            {squareRef && (
              <p className="text-xs text-muted-foreground">
                Référence Square :{" "}
                <span className="font-mono font-semibold text-foreground">{squareRef}</span>
              </p>
            )}
            {clientEmail && <p className="text-xs text-muted-foreground">Reçu envoyé à {clientEmail}.</p>}
            <Button onClick={() => onOpenChange(false)} className="mt-2">Fermer</Button>
          </div>
        ) : mode === "choose" ? (
          <div className="space-y-2 py-2">
            <Button
              onClick={() => setMode("direct")}
              className="w-full justify-start gap-2"
              variant="default"
            >
              <CreditCard className="h-4 w-4" />
              Carte — saisie directe (par téléphone)
            </Button>
            <Button
              onClick={() => { setMode("link"); handleGenerateLink(); }}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              <Link2 className="h-4 w-4" />
              Lien de paiement Square (client sur son appareil)
            </Button>
            <Button
              onClick={() => setMode("manual")}
              variant="outline"
              className="w-full justify-start gap-2"
            >
              Enregistrement manuel (Interac, comptant…)
            </Button>
          </div>
        ) : mode === "direct" ? (
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Demandez la carte au client et saisissez les informations ci-dessous.
            </p>
            <div ref={containerRef} id="sq-employee-card" className="min-h-[90px]" />
            {sqLoading && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Chargement…
              </div>
            )}
            <Button onClick={handleDirectPay} disabled={sqLoading || paying} className="w-full">
              {paying
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Traitement…</>
                : <><CreditCard className="w-4 h-4 mr-2" />Payer {balanceDue.toFixed(2)} $ par carte</>}
            </Button>
          </div>
        ) : mode === "link" ? (
          <div className="space-y-3 py-2">
            {generatingLink ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : paymentLink ? (
              <>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Lien de paiement</p>
                  <p className="text-xs font-mono break-all text-foreground">{paymentLink}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={copyLink} variant="outline" size="sm" className="flex-1">
                    <Copy className="h-3 w-3 mr-1" /> Copier
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <a href={paymentLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Ouvrir
                    </a>
                  </Button>
                </div>
                {linkSent && (
                  <p className="text-xs text-emerald-600 text-center flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Lien envoyé par courriel à {clientEmail}
                  </p>
                )}
                <p className="text-xs text-muted-foreground text-center">
                  Le client clique le lien, entre sa carte, et paie directement.
                </p>
              </>
            ) : null}
          </div>
        ) : null}

        {!paid && (
          <DialogFooter className="gap-2">
            {mode !== "choose" && (
              <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>
                ← Méthode
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="ml-auto">
              Annuler
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
