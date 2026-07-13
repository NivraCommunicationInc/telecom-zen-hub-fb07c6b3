/**
 * CorePaymentOptionsPanel — Options de paiement pour une commande non payée,
 * accessible depuis CoreOrderDetail. 100% Square, aucun lien PayPal.
 *
 *   1. 📧 Envoyer lien de paiement (Square) par courriel
 *   2. 🔗 Ouvrir la page de paiement Square (nouvel onglet)
 *   3. 💳 Encaisser par Square dans Core
 *   4. ✅ Confirmer paiement reçu manuellement
 *
 * Backend:
 *   - email_queue (template `payment_link`) pour OPTION 1
 *   - PayerCommande (/pay/:id) — utilise SquarePaymentForm côté client
 *   - RPC `admin_promote_order_to_confirmed` pour OPTION 3
 */
import { useState } from "react";
import { Loader2, Mail, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SquarePaymentForm } from "@/components/payment/SquarePaymentForm";

const getPaymentErrorMessage = (error: any, data?: any) => {
  if (data?.error) return String(data.error);
  if (error?.context?.error) return String(error.context.error);
  if (error?.message && error.message !== "Edge Function returned a non-2xx status code") {
    return error.message;
  }
  return "Impossible de créer le lien Square. Vérifie que la commande a un montant à payer et réessaie.";
};

const openPaymentUrl = (url: string) => {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
};

interface Props {
  orderId: string;
  orderNumber: string;
  totalAmount: number | null;
  clientEmail: string | null;
  paymentStatus: string | null;
  orderStatus: string | null;
  onChanged?: () => void;
  onManualConfirm?: () => Promise<void>;
}

export function CorePaymentOptionsPanel({
  orderId,
  orderNumber,
  totalAmount,
  clientEmail,
  paymentStatus,
  orderStatus,
  onChanged,
  onManualConfirm,
}: Props) {
  const [busy, setBusy] = useState<null | "email" | "direct" | "manual">(null);
  const [showCardForm, setShowCardForm] = useState(false);

  if (paymentStatus === "paid" || orderStatus === "cancelled") {
    return null;
  }

  const amountLabel = totalAmount != null
    ? `${Number(totalAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
    : "—";

  async function createPaymentIntent(mode: "email" | "direct"): Promise<{ payment_url: string | null; intent_id: string | null }> {
    const { data, error } = await supabase.functions.invoke("core-square-payment-link", {
      body: {
        order_id: orderId,
        customer_email: clientEmail || undefined,
        mode: mode === "email" ? "email" : undefined,
      },
    });
    if (error || !(data as any)?.ok) throw new Error(getPaymentErrorMessage(error, data));
    return {
      payment_url: ((data as any).payment_url as string) || null,
      intent_id: ((data as any).intent_id as string) || null,
    };
  }

  async function sendByEmail() {
    if (!clientEmail) {
      toast.error("Aucun courriel client sur cette commande.");
      return;
    }
    setBusy("email");
    try {
      await createPaymentIntent("email");
      toast.success(`Lien de paiement Square envoyé à ${clientEmail}`);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'envoi du lien");
    } finally {
      setBusy(null);
    }
  }

  async function openDirect() {
    setBusy("direct");
    try {
      const { payment_url: url } = await createPaymentIntent("direct");
      if (!url) throw new Error("Lien indisponible");
      openPaymentUrl(url);
      toast.info("Page de paiement ouverte");
    } catch (e: any) {
      toast.error(e?.message || "Échec d'ouverture du lien");
    } finally {
      setBusy(null);
    }
  }

  async function confirmManually() {
    if (!window.confirm("Confirmer que le paiement a bien été reçu pour cette commande ?")) return;
    setBusy("manual");
    try {
      if (onManualConfirm) {
        await onManualConfirm();
      } else {
        const { data, error } = await supabase.rpc(
          "admin_promote_order_to_confirmed" as any,
          { p_order_id: orderId },
        );
        if (error) throw error;
        if ((data as any)?.ok === false) throw new Error((data as any)?.error || "Échec de la confirmation");
      }
      toast.success(`Paiement confirmé pour ${orderNumber}`);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Échec de la confirmation");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-[#1e2535] bg-[#0f1623] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#6b7a90]">Options de paiement</div>
          <div className="text-sm text-white mt-0.5">
            <span className="font-mono text-[#90caf9]">{orderNumber}</span>
            <span className="text-[#3a4456] mx-2">·</span>
            <span className="text-[#81c784] font-semibold">{amountLabel}</span>
            {paymentStatus && (
              <>
                <span className="text-[#3a4456] mx-2">·</span>
                <span className="text-[11px] text-[#8b9ab0]">statut: {paymentStatus}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <button
          onClick={sendByEmail}
          disabled={busy !== null || !clientEmail}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[#1565c0] hover:bg-[#1976d2] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors"
          title={!clientEmail ? "Courriel client manquant" : `Envoyer à ${clientEmail}`}
        >
          {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          📧 Envoyer lien Square
        </button>

        <button
          onClick={openDirect}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[#7C3AED] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          🔗 Ouvrir la page de paiement
        </button>

        <button
          onClick={() => setShowCardForm((v) => !v)}
          disabled={busy !== null || !totalAmount || totalAmount <= 0}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[#0f766e] hover:bg-[#0d9488] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          💳 Prendre paiement Square
        </button>

        <button
          onClick={confirmManually}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[#2e7d32] hover:bg-[#388e3c] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors"
        >
          {busy === "manual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          ✅ Confirmer paiement reçu
        </button>
      </div>

      {showCardForm && totalAmount && totalAmount > 0 && (
        <div className="mt-3 rounded-md border border-[#164e63] bg-[#082f49]/40 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-[#7dd3fc]">
            Paiement carte Square — Core
          </div>
          <SquarePaymentForm
            amount={Number(totalAmount)}
            customerEmail={clientEmail || undefined}
            invoiceNumber={orderNumber}
            paymentSource="core_pos"
            onBeforeCharge={async () => {
              const intent = await createPaymentIntent("direct");
              if (!intent.intent_id) throw new Error("Intent Square indisponible");
              return { intent_id: intent.intent_id };
            }}
            onSuccess={(_receiptUrl, paymentId) => {
              toast.success(`Paiement Square encaissé${paymentId ? ` — ${paymentId}` : ""}`);
              setShowCardForm(false);
              onChanged?.();
            }}
          />
        </div>
      )}

      <p className="text-[10px] text-[#6b7a90] mt-2">
        Le client paie par carte de crédit ou Interac via Square depuis la page de paiement. Confirmation manuelle réservée aux paiements hors ligne (comptant, virement).
      </p>
    </div>
  );
}
