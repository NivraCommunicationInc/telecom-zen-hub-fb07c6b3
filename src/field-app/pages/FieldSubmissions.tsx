/**
 * FieldSubmissions — Mes soumissions terrain
 * Reads field_submissions for the current agent, with status badges,
 * "Renvoyer le lien" (resend email) and "Voir" (open payer page) actions.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingCart, Loader2, Send, ExternalLink, Mail, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useState } from "react";

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  pending_client: { label: "En attente client", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  completed: { label: "Payée", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expired: { label: "Expirée", classes: "bg-gray-100 text-gray-600 border-gray-200" },
  cancelled: { label: "Annulée", classes: "bg-red-50 text-red-700 border-red-200" },
};

export default function FieldSubmissions() {
  const qc = useQueryClient();
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["field-submissions-mine"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("field_submissions" as any)
        .select("*")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const handleResend = async (sub: any) => {
    if (!sub?.customer_email || !sub?.intent_id) {
      toast.error("Email ou lien de paiement manquant.");
      return;
    }
    setResendingId(sub.id);
    try {
      const services = Array.isArray(sub.services) ? sub.services : [];
      const equipment = Array.isArray(sub.equipment) ? sub.equipment : [];
      const servicesList = services
        .filter((s: any) => s?.name)
        .map((s: any) => `${s.name} — ${(s.monthlyPrice ?? s.price ?? 0)}$/mois`)
        .join(", ") || "Voir détails de la commande";
      const equipmentList = equipment
        .filter((e: any) => e?.name)
        .map((e: any) => `${e.name}${e.quantity > 1 ? ` x${e.quantity}` : ""} — ${(e.price ?? 0)}$`)
        .join(", ") || "Aucun équipement";
      const payerUrl = sub.payment_url || `https://nivra-telecom.ca/payer/${sub.intent_id}`;
      const orderNumber = `SUB-${String(sub.id).slice(0, 8).toUpperCase()}`;
      const validUntil = sub.expires_at
        ? new Date(sub.expires_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })
        : "7 jours à compter de ce courriel";

      const idempotencyKey = `field_resend:${sub.id}:${sub.email_sent_count ?? 0}`;
      const templateVars = {
        client_name: sub.customer_name || "Client",
        first_name: (sub.customer_name || "Client").split(" ")[0],
        order_number: orderNumber,
        services: servicesList,
        summary: servicesList,
        equipment: equipmentList,
        subtotal: Number(sub.subtotal || 0).toFixed(2),
        tps: Number(sub.tps || 0).toFixed(2),
        tvq: Number(sub.tvq || 0).toFixed(2),
        total: Number(sub.total || 0).toFixed(2),
        approval_url: payerUrl,
        payment_url: payerUrl,
        valid_until: validUntil,
        agent_name: sub.agent_name || "Votre conseiller Nivra",
      };

      let lastErr: any = null;
      for (let i = 1; i <= 3; i++) {
        try {
          await enqueueCommunication({
            channel: "email",
            templateKey: "payment_link_employee",
            recipient: sub.customer_email,
            idempotencyKey,
            templateVars,
          });
          lastErr = null;
          break;
        } catch (e: any) {
          lastErr = e;
          if (i < 3) await new Promise((r) => setTimeout(r, 1500));
        }
      }
      if (lastErr) throw lastErr;

      // Best-effort counter update
      await supabase.from("field_submissions" as any).update({
        last_email_sent_at: new Date().toISOString(),
        email_sent_count: (Number(sub.email_sent_count || 0) + 1),
      } as any).eq("id", sub.id);

      toast.success("Lien renvoyé au client.");
      qc.invalidateQueries({ queryKey: ["field-submissions-mine"] });
    } catch (e: any) {
      toast.error(e?.message || "Échec du renvoi du courriel.");
    } finally {
      setResendingId(null);
    }
  };

  const handleView = (sub: any) => {
    const url = sub.payment_url || `https://nivra-telecom.ca/payer/${sub.intent_id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Mes soumissions</h1>
        <p className="text-sm text-muted-foreground">
          {subs.length} soumission{subs.length !== 1 ? "s" : ""}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : subs.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucune soumission</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subs.map((sub: any) => {
            const status = STATUS_BADGE[sub.status] || STATUS_BADGE.pending_client;
            const services = Array.isArray(sub.services) ? sub.services : [];
            const serviceNames = services.map((s: any) => s.name).filter(Boolean).join(", ");
            const orderNumber = `SUB-${String(sub.id).slice(0, 8).toUpperCase()}`;
            const expiresLabel = sub.expires_at
              ? format(new Date(sub.expires_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })
              : "—";
            const isExpired = sub.status === "expired" || sub.status === "cancelled" || sub.status === "completed";
            return (
              <div key={sub.id} className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-mono font-semibold text-foreground">{orderNumber}</span>
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", status.classes)}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{sub.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub.customer_email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-foreground">{Number(sub.total || 0).toFixed(2)} $</p>
                    {Number(sub.email_sent_count || 0) > 0 && (
                      <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                        <Mail className="h-2.5 w-2.5" />
                        {sub.email_sent_count} envoi{sub.email_sent_count > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>

                {serviceNames && (
                  <p className="text-[11px] text-muted-foreground mb-2 truncate">{serviceNames}</p>
                )}

                <p className="text-[11px] text-muted-foreground mb-3">
                  Valide jusqu'au <span className="font-medium text-foreground">{expiresLabel}</span>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResend(sub)}
                    disabled={resendingId === sub.id || isExpired}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {resendingId === sub.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Renvoyer le lien
                  </button>
                  <button
                    onClick={() => handleView(sub)}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Voir
                  </button>
                </div>

                {sub.status === "completed" && (
                  <div className="mt-2 pt-2 border-t border-border flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    Paiement reçu
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
