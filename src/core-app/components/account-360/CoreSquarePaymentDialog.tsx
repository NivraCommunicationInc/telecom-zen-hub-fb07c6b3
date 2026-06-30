/**
 * CoreSquarePaymentDialog — Charge a client's invoice by card directly from Nivra Core.
 * Agent selects an unpaid invoice, enters the client's card details (dictated by phone),
 * and fires a one-time Square charge. No card saving.
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BACKEND_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SQUARE_APP_ID = "sq0idp-MFFFKgiNraeBXx-h1mruxw";
const SQUARE_LOCATION_ID = "LQW27N70DQ2N8";

interface UnpaidInvoice {
  id: string;
  invoice_number?: string | null;
  balance_due?: number | null;
  total?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unpaidInvoices: UnpaidInvoice[];
  accountId?: string;
  customerName?: string | null;
  customerEmail?: string | null;
  onSuccess?: () => void;
}

export const CoreSquarePaymentDialog = ({
  open, onOpenChange, unpaidInvoices, accountId, customerName, customerEmail, onSuccess,
}: Props) => {
  const qc = useQueryClient();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [done, setDone] = useState(false);
  const [paying, setPaying] = useState(false);
  const [sqLoading, setSqLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);

  const selectedInvoice = unpaidInvoices.find((i) => i.id === selectedInvoiceId);
  const balanceDue = selectedInvoice
    ? Number(selectedInvoice.balance_due ?? selectedInvoice.total ?? 0)
    : 0;

  // Pre-select first invoice
  useEffect(() => {
    if (open && unpaidInvoices.length > 0 && !selectedInvoiceId) {
      setSelectedInvoiceId(unpaidInvoices[0].id);
    }
  }, [open, unpaidInvoices]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedInvoiceId("");
      setDone(false);
      setSqLoading(true);
      cardRef.current?.destroy?.();
      cardRef.current = null;
    }
  }, [open]);

  // Load Square widget
  useEffect(() => {
    if (!open || done) return;
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
  }, [open, done]);

  const handleCharge = async () => {
    if (!selectedInvoiceId) { toast.error("Sélectionnez une facture"); return; }
    if (!cardRef.current) { toast.error("Formulaire non prêt"); return; }
    setPaying(true);
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        toast.error(result.errors?.[0]?.message || "Informations de carte invalides");
        return;
      }

      const res = await fetch(`${BACKEND_URL}/functions/v1/square-charge-invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${BACKEND_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: result.token, invoice_id: selectedInvoiceId }),
      });
      const data = await res.json();
      if (!data?.ok) { toast.error(data?.error || "Paiement refusé"); return; }

      // Activity log (best-effort)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("activity_logs").insert({
          action: "manual_square_charge",
          entity_type: "billing_invoice",
          entity_id: selectedInvoiceId,
          user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
          actor_email: user?.email ?? null,
          details: { amount: balanceDue, account_id: accountId ?? null, payment_id: data.payment_id },
        });
      } catch {}

      qc.invalidateQueries({ queryKey: ["account-profile-invoices"] });
      qc.invalidateQueries({ queryKey: ["account-profile-payments"] });
      toast.success(`${balanceDue.toFixed(2)} $ débité par carte Square`);
      setDone(true);
      onSuccess?.();
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!paying) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Paiement par carte — Square
          </DialogTitle>
          <DialogDescription>
            {customerName && <span className="font-medium text-foreground">{customerName}</span>}
            {customerEmail && <span className="text-muted-foreground"> · {customerEmail}</span>}
            {!customerName && "Saisissez la carte du client (dictée par téléphone)."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="font-semibold">Paiement accepté !</p>
            <p className="text-sm text-muted-foreground">
              {balanceDue.toFixed(2)} $ débité — facture marquée payée.
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-2">Fermer</Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Facture à régler</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId} disabled={paying}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.map((inv) => {
                    const bal = Number(inv.balance_due ?? inv.total ?? 0);
                    return (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number ?? inv.id.slice(0, 8)} — {bal.toFixed(2)} $
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedInvoice && (
                <p className="text-xs text-muted-foreground">
                  Solde : <span className="font-semibold text-foreground">{balanceDue.toFixed(2)} $</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Carte de crédit du client</Label>
              <div ref={containerRef} id="sq-core-card" className="min-h-[90px]" />
              {sqLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Chargement…
                </div>
              )}
            </div>
          </div>
        )}

        {!done && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={paying}>
              Annuler
            </Button>
            <Button onClick={handleCharge} disabled={paying || sqLoading || !selectedInvoiceId}>
              {paying
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Traitement…</>
                : <><CreditCard className="h-4 w-4 mr-1" /> Débiter {balanceDue.toFixed(2)} $</>}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
