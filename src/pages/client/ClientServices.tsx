import { useEffect, useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import ClientMyServices from "@/components/client/ClientMyServices";
import ClientOrdersInProgress from "@/components/client/ClientOrdersInProgress";
import { PaymentHistoryV2 } from "@/components/client/PaymentHistoryV2";
import { ClientOutageReportButton } from "@/components/client/ClientOutageReportButton";
import { useClientAuth } from "@/hooks/useClientAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pause, Play, Loader2, Info } from "lucide-react";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";

type Subscription = {
  id: string;
  customer_id: string;
  plan_name: string | null;
  plan_price: number | null;
  status: string;
  paused_at: string | null;
  pause_until: string | null;
  pause_reason: string | null;
  paypal_subscription_id: string | null;
};

const DURATION_PRESETS: { label: string; days: number }[] = [
  { label: "1 semaine", days: 7 },
  { label: "2 semaines", days: 14 },
  { label: "1 mois", days: 30 },
];

const REASONS = ["Voyage", "Difficultés financières", "Déménagement", "Autre"];

const ClientServicePauseCard = ({ userId }: { userId: string }) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number>(7);
  const [customDate, setCustomDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [resuming, setResuming] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data: customer } = await portalSupabase
      .from("billing_customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!customer) {
      setLoading(false);
      return;
    }
    const { data: sub } = await portalSupabase
      .from("billing_subscriptions")
      .select("id, customer_id, plan_name, plan_price, status, paused_at, pause_until, pause_reason, paypal_subscription_id")
      .eq("customer_id", customer.id)
      .in("status", ["active", "pause_requested", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((sub as Subscription | null) ?? null);

    const { data: acc } = await portalSupabase
      .from("accounts")
      .select("id, account_number")
      .eq("client_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAccountId(acc?.id ?? null);
    setAccountNumber(acc?.account_number ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [userId]);

  const resumeDate = customDate
    ? new Date(customDate)
    : addDays(new Date(), days);
  const resumeLabel = format(resumeDate, "d MMMM yyyy", { locale: fr });
  const effectiveDays = customDate
    ? Math.max(1, Math.ceil((resumeDate.getTime() - Date.now()) / 86400000))
    : days;

  const handleConfirm = async () => {
    if (!subscription || !accountId) {
      toast.error("Compte introuvable");
      return;
    }
    setSubmitting(true);
    try {
      const todayLabel = format(new Date(), "d MMMM yyyy", { locale: fr });
      const { error: insertErr } = await portalSupabase
        .from("suspension_requests")
        .insert({
          account_id: accountId,
          client_id: userId,
          subscription_id: subscription.id,
          requested_by: userId,
          requested_for: resumeDate.toISOString(),
          pause_duration_days: effectiveDays,
          reason: reason || null,
          status: "pending",
          notes: `Client self-serve pause request via portal.`,
        });
      if (insertErr) throw insertErr;

      const { error: updErr } = await portalSupabase
        .from("billing_subscriptions")
        .update({ status: "pause_requested" })
        .eq("id", subscription.id);
      if (updErr) throw updErr;

      await portalSupabase.from("email_queue").insert({
        to_email: (await portalSupabase.auth.getUser()).data.user?.email,
        template_key: "service_pause_requested",
        event_key: "service_pause_requested",
        message_type: "transactional",
        template_vars: {
          client_name: (await portalSupabase.auth.getUser()).data.user?.user_metadata?.first_name || "Client",
          pause_from: todayLabel,
          pause_until: resumeLabel,
          pause_reason: reason || "Non précisée",
        },
      });

      await portalSupabase.from("email_queue").insert({
        to_email: "support@nivra-telecom.ca",
        template_key: "service_pause_admin_alert",
        event_key: "service_pause_admin_alert",
        message_type: "transactional",
        template_vars: {
          client_name: (await portalSupabase.auth.getUser()).data.user?.user_metadata?.first_name || "Client",
          account_number: accountNumber,
          pause_from: todayLabel,
          pause_until: resumeLabel,
          pause_reason: reason || "Non précisée",
        },
      });

      toast.success("Demande envoyée — vous serez notifié dès l'approbation.");
      setOpen(false);
      void refresh();
    } catch (e: any) {
      console.error("[ClientServicePauseCard]", e);
      toast.error(e?.message || "Erreur lors de l'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResumeNow = async () => {
    if (!subscription) return;
    if (!confirm("Reprendre votre service immédiatement ?")) return;
    setResuming(true);
    try {
      const { error } = await portalSupabase.rpc("client_resume_paused_service", {
        p_subscription_id: subscription.id,
      });
      if (error) throw error;
      toast.success("Service réactivé");
      void refresh();
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setResuming(false);
    }
  };

  if (loading || !subscription) return null;

  const status = subscription.status;

  return (
    <>
      {status === "paused" && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Pause className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <div className="font-semibold text-orange-900">
                  ⏸ Service suspendu jusqu'au{" "}
                  {subscription.pause_until
                    ? format(new Date(subscription.pause_until), "d MMMM yyyy", { locale: fr })
                    : "—"}
                </div>
                <div className="text-sm text-orange-800 mt-0.5">
                  Votre service reprendra automatiquement. Aucune facturation pendant la suspension.
                </div>
              </div>
            </div>
            <Button
              onClick={handleResumeNow}
              disabled={resuming}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {resuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Reprendre maintenant
            </Button>
          </CardContent>
        </Card>
      )}

      {status === "pause_requested" && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-700 mt-0.5" />
            <div>
              <div className="font-semibold text-yellow-900">
                En attente d'approbation
              </div>
              <div className="text-sm text-yellow-800 mt-0.5">
                Votre demande de suspension est en cours de traitement par notre équipe (sous 24 h).
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {status === "active" && (
        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">Suspendre temporairement</div>
              <div className="text-sm text-slate-600 mt-0.5">
                Partez en voyage ou prenez une pause — votre service peut être suspendu sans frais.
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setOpen(true)}
              className="flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              Suspendre temporairement
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Suspendre votre service temporairement</DialogTitle>
            <DialogDescription>
              Choisissez une durée. Votre service reprendra automatiquement à la date choisie.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Durée</div>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => (
                  <Button
                    key={p.days}
                    type="button"
                    size="sm"
                    variant={!customDate && days === p.days ? "default" : "outline"}
                    onClick={() => {
                      setDays(p.days);
                      setCustomDate("");
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
                <Input
                  type="date"
                  className="h-9 w-44"
                  min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  placeholder="Autre date"
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Raison (optionnel)</div>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    size="sm"
                    variant={reason === r ? "default" : "outline"}
                    onClick={() => setReason(reason === r ? "" : r)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>

            {subscription?.paypal_subscription_id && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-900">
                ⚠️ Votre abonnement PayPal continuera d'être débité pendant la suspension.
                Contactez-nous à support@nivra-telecom.ca pour suspendre votre paiement PayPal.
              </div>
            )}

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900">
              Votre service sera suspendu après approbation. La facturation est mise en pause pendant la
              suspension. Votre service reprendra automatiquement le{" "}
              <strong>{resumeLabel}</strong>.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Suspendre le service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ClientServices = () => {
  const { user } = useClientAuth();

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Utilisation et services</h1>
            <p className="text-slate-500 mt-1">Gérez vos services, équipements et forfaits</p>
          </div>
          <ClientOutageReportButton />
        </div>

        {user?.id && <ClientServicePauseCard userId={user.id} />}

        <ClientOrdersInProgress />

        <ClientMyServices />

        {user?.id && <PaymentHistoryV2 userId={user.id} />}
      </div>
    </ClientLayout>
  );
};

export default ClientServices;
