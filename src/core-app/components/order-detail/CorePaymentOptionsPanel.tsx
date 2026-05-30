/**
 * CorePaymentOptionsPanel — Trio d'options de paiement pour une commande
 * non encore payée, accessible depuis CoreOrderDetail.
 *
 *   1. 📧 Envoyer lien de paiement par courriel (PayPal)
 *   2. 🔗 Générer un lien PayPal immédiat (ouvre nouvel onglet)
 *   3. ✅ Confirmer paiement reçu manuellement
 *
 * Backend:
 *   - Edge function `core-paypal-order-link` pour OPTION 1 et 2
 *   - RPC `admin_promote_order_to_confirmed` pour OPTION 3
 *   - Webhook `paypal-webhook` finalise automatiquement sur capture
 */
import { useState } from "react";
import { Loader2, Mail, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  orderId: string;
  orderNumber: string;
  totalAmount: number | null;
  clientEmail: string | null;
  paymentStatus: string | null;
  orderStatus: string | null;
  onChanged?: () => void;
}

export function CorePaymentOptionsPanel({
  orderId,
  orderNumber,
  totalAmount,
  clientEmail,
  paymentStatus,
  orderStatus,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState<null | "email" | "direct" | "manual">(null);

  // Hide once already paid
  if (paymentStatus === "paid" || orderStatus === "cancelled") {
    return null;
  }

  const amountLabel = totalAmount != null
    ? `${Number(totalAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
    : "—";

  async function sendByEmail() {
    if (!clientEmail) {
      toast.error("Aucun courriel client sur cette commande.");
      return;
    }
    setBusy("email");
    try {
      const { data, error } = await supabase.functions.invoke("core-paypal-order-link", {
        body: { order_id: orderId, mode: "email", to_email: clientEmail, amount: totalAmount },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Erreur inconnue");
      }
      toast.success(`Lien envoyé à ${clientEmail}`);
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
      const { data, error } = await supabase.functions.invoke("core-paypal-order-link", {
        body: { order_id: orderId, mode: "direct", amount: totalAmount },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Erreur inconnue");
      }
      const url = (data as any)?.approval_url;
      if (!url) throw new Error("Aucun lien d'approbation retourné");
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Lien PayPal ouvert dans un nouvel onglet");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || "Échec de la génération du lien");
    } finally {
      setBusy(null);
    }
  }

  async function confirmManually() {
    if (!window.confirm("Confirmer que le paiement a bien été reçu pour cette commande ?")) return;
    setBusy("manual");
    try {
      const { error } = await supabase.rpc(
        "admin_promote_order_to_confirmed" as any,
        { p_order_id: orderId },
      );
      if (error) throw error;
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <button
          onClick={sendByEmail}
          disabled={busy !== null || !clientEmail}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[#1565c0] hover:bg-[#1976d2] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors"
          title={!clientEmail ? "Courriel client manquant" : `Envoyer à ${clientEmail}`}
        >
          {busy === "email"
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Mail className="h-4 w-4" />}
          📧 Envoyer lien de paiement
        </button>

        <button
          onClick={openDirect}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[#0070ba] hover:bg-[#005ea6] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors"
        >
          {busy === "direct"
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ExternalLink className="h-4 w-4" />}
          🔗 Lien PayPal immédiat
        </button>

        <button
          onClick={confirmManually}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[#2e7d32] hover:bg-[#388e3c] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-colors"
        >
          {busy === "manual"
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <CheckCircle2 className="h-4 w-4" />}
          ✅ Confirmer paiement reçu
        </button>
      </div>

      <p className="text-[10px] text-[#6b7a90] mt-2">
        Les options 1 et 2 génèrent un lien PayPal sécurisé (valide 48 h). Le paiement est automatiquement
        confirmé à la réception via webhook.
      </p>
    </div>
  );
}
