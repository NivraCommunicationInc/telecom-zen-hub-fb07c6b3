/**
 * EmployeePayPalPaymentDialog — Take a payment from an employee on a client invoice.
 * Two methods:
 *   • PayPal: calls paypal-create-order, shows QR + clickable approval URL,
 *     polls billing_invoices.balance_due until paid, then sends payment_receipt email.
 *   • Manual: delegates to RecordPaymentDialog (apply_payment_to_invoice RPC).
 *
 * All emails are enqueued via email_queue (template_key='payment_receipt' →
 * shell() Violet Bold from customQueueTemplates.ts). NO inline HTML.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ExternalLink, QrCode, CreditCard, CheckCircle2, Copy } from "lucide-react";
import QRCode from "qrcode";
import { RecordPaymentDialog } from "@/shared-ops/components/RecordPaymentDialog";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";

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

type Mode = "choose" | "paypal" | "manual";

export function EmployeePayPalPaymentDialog({
  open, onOpenChange, invoice, clientEmail, clientName, onSuccess,
}: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [paid, setPaid] = useState(false);
  const pollRef = useRef<number | null>(null);
  const startBalanceRef = useRef<number>(Number(invoice.balance_due ?? invoice.total ?? 0));

  const balanceDue = Number(invoice.balance_due ?? invoice.total ?? 0);

  useEffect(() => {
    if (!open) {
      setMode("choose");
      setApprovalUrl(null);
      setPaypalOrderId(null);
      setQrDataUrl(null);
      setPolling(false);
      setPaid(false);
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    }
  }, [open]);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const sendReceiptEmail = async () => {
    if (!clientEmail) return;
    try {
      await supabase.from("email_queue").insert({
        event_key: `payment_receipt_${invoice.id}_${Date.now()}`,
        to_email: clientEmail,
        template_key: "payment_receipt",
        template_vars: {
          client_name: clientName ?? "Client",
          invoice_number: invoice.invoice_number ?? "",
          amount: balanceDue,
          method: "PayPal",
          paid_at: new Date().toISOString(),
        },
        status: "queued",
      });
    } catch (e) {
      console.error("[PayPal Payment] Receipt email enqueue failed:", e);
    }
  };

  const onPaymentDetected = async () => {
    setPaid(true);
    setPolling(false);
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    await sendReceiptEmail();
    await logInternalAudit({
      action: "paypal_payment_completed",
      category: "operations",
      portal: "employee",
      targetType: "invoice",
      targetId: invoice.id,
      details: { paypal_order_id: paypalOrderId, amount: balanceDue },
    });
    toast.success("Paiement reçu — reçu envoyé au client");
    onSuccess?.();
  };

  const startPolling = () => {
    setPolling(true);
    pollRef.current = window.setInterval(async () => {
      try {
        const { data } = await supabase
          .from("billing_invoices")
          .select("balance_due, status")
          .eq("id", invoice.id)
          .maybeSingle();
        const newBalance = Number(data?.balance_due ?? startBalanceRef.current);
        if (data?.status === "paid" || newBalance < startBalanceRef.current - 0.001 || newBalance <= 0.001) {
          await onPaymentDetected();
        }
      } catch { /* keep polling */ }
    }, 5000);
  };

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("paypal-create-order", {
        body: {
          invoice_id: invoice.id,
          amount: balanceDue,
          description: `Facture ${invoice.invoice_number ?? invoice.id.slice(0, 8)} — paiement assisté`,
        },
      });
      if (error) throw error;
      const link = data?.links?.find((l: any) => l.rel === "payer-action" || l.rel === "approve");
      if (!link?.href) throw new Error("PayPal n'a pas retourné de lien d'approbation");
      setApprovalUrl(link.href);
      setPaypalOrderId(data?.paypal_order_id ?? null);
      const qr = await QRCode.toDataURL(link.href, { width: 220, margin: 1 });
      setQrDataUrl(qr);
      startPolling();
      return link.href;
    },
    onError: (err: any) => toast.error(`PayPal: ${err.message ?? "Erreur"}`),
  });

  const copyLink = () => {
    if (!approvalUrl) return;
    navigator.clipboard.writeText(approvalUrl);
    toast.success("Lien copié");
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
        onSuccess={async () => {
          await sendReceiptEmail();
          onSuccess?.();
        }}
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
            <p className="text-sm font-medium">Paiement confirmé</p>
            <p className="text-xs text-muted-foreground">
              Reçu envoyé à {clientEmail ?? "le client"}.
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-2">Fermer</Button>
          </div>
        ) : mode === "choose" ? (
          <div className="space-y-2 py-2">
            <Button
              onClick={() => { setMode("paypal"); createOrderMutation.mutate(); }}
              className="w-full justify-start gap-2"
              variant="default"
            >
              <CreditCard className="h-4 w-4" /> PayPal — QR + lien (recommandé)
            </Button>
            <Button
              onClick={() => setMode("manual")}
              variant="outline"
              className="w-full justify-start gap-2"
            >
              <CreditCard className="h-4 w-4" /> Enregistrement manuel (Interac, comptant…)
            </Button>
          </div>
        ) : (
          <div className="py-2 space-y-3">
            {createOrderMutation.isPending && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {approvalUrl && (
              <>
                <div className="flex flex-col items-center gap-2">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR PayPal" className="rounded-lg border border-border" />
                  ) : (
                    <QrCode className="h-32 w-32 text-muted-foreground" />
                  )}
                  <p className="text-[11px] text-muted-foreground text-center">
                    Le client scanne le QR ou utilise le lien ci-dessous.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <a href={approvalUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" /> Ouvrir PayPal
                    </a>
                  </Button>
                  <Button onClick={copyLink} variant="outline" size="sm" className="flex-1">
                    <Copy className="h-3 w-3 mr-1" /> Copier lien
                  </Button>
                </div>
                {polling && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground border-t border-border pt-3">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    En attente du paiement… (vérification toutes les 5s)
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!paid && (
          <DialogFooter className="gap-2">
            {mode !== "choose" && (
              <Button variant="ghost" size="sm" onClick={() => { setMode("choose"); setApprovalUrl(null); setPolling(false); if (pollRef.current) window.clearInterval(pollRef.current); }}>
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
