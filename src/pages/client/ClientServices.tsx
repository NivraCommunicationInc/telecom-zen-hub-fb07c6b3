import { useState } from "react";
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
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

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

/* ─── Dark tokens ───────────────────────────────────────────── */
const D = {
  bg:        "#0A0A0F",
  card:      "#111122",
  border:    "rgba(124,58,237,0.2)",
  borderLt:  "rgba(124,58,237,0.12)",
  text:      "#FFFFFF",
  textSec:   "#A0A0B8",
  textMuted: "#6B6B85",
  accent:    "#7C3AED",
  accentLt:  "#a78bfa",
  warning:   "rgba(245,158,11,0.12)",
  warningTx: "#fbbf24",
  warningBd: "rgba(245,158,11,0.3)",
  success:   "rgba(16,185,129,0.12)",
  successTx: "#34d399",
  info:      "rgba(59,130,246,0.12)",
  infoTx:    "#60a5fa",
  infoBd:    "rgba(59,130,246,0.3)",
  error:     "rgba(239,68,68,0.12)",
  errorTx:   "#f87171",
};

const ClientServicePauseCard = ({ userId, canonicalData, loading }: { userId: string; canonicalData: any; loading: boolean }) => {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number>(7);
  const [customDate, setCustomDate] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [resuming, setResuming] = useState(false);

  const subscription = ((canonicalData?.subscriptions || []) as Subscription[])
    .filter((sub) => ["active", "pause_requested", "paused"].includes(String(sub.status || "").toLowerCase()))
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null;
  const accountId = canonicalData?.identifiers?.accountId || canonicalData?.account?.id || null;
  const accountNumber = canonicalData?.account?.account_number || null;

  const resumeDate = customDate ? new Date(customDate) : addDays(new Date(), days);
  const resumeLabel = format(resumeDate, "d MMMM yyyy", { locale: fr });
  const effectiveDays = customDate
    ? Math.max(1, Math.ceil((resumeDate.getTime() - Date.now()) / 86400000))
    : days;

  const handleConfirm = async () => {
    if (!subscription || !accountId) { toast.error("Compte introuvable"); return; }
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
        <div className="rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <div className="flex items-start gap-3">
            <Pause className="w-5 h-5 mt-0.5" style={{ color: D.warningTx }} />
            <div>
              <div className="font-semibold" style={{ color: D.warningTx }}>
                Service suspendu jusqu'au{" "}
                {subscription.pause_until
                  ? format(new Date(subscription.pause_until), "d MMMM yyyy", { locale: fr })
                  : "—"}
              </div>
              <div className="text-sm mt-0.5" style={{ color: D.textSec }}>
                Votre service reprendra automatiquement. Aucune facturation pendant la suspension.
              </div>
            </div>
          </div>
          <Button
            onClick={handleResumeNow}
            disabled={resuming}
            className="flex items-center gap-2"
            style={{ background: "rgba(245,158,11,0.2)", color: D.warningTx, border: "1px solid rgba(245,158,11,0.4)" }}
          >
            {resuming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Reprendre maintenant
          </Button>
        </div>
      )}

      {status === "pause_requested" && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <Info className="w-5 h-5 mt-0.5" style={{ color: D.warningTx }} />
          <div>
            <div className="font-semibold" style={{ color: D.warningTx }}>En attente d'approbation</div>
            <div className="text-sm mt-0.5" style={{ color: D.textSec }}>
              Votre demande de suspension est en cours de traitement par notre équipe (sous 24 h).
            </div>
          </div>
        </div>
      )}

      {status === "active" && (
        <div className="rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ background: D.card, border: `1px solid ${D.border}` }}>
          <div>
            <div className="font-semibold" style={{ color: D.text }}>Suspendre temporairement</div>
            <div className="text-sm mt-0.5" style={{ color: D.textSec }}>
              Partez en voyage ou prenez une pause — votre service peut être suspendu sans frais.
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2"
            style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}
          >
            <Pause className="w-4 h-4" />
            Suspendre temporairement
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" style={{ background: "#111122", border: "1px solid rgba(124,58,237,0.25)", color: "#FFFFFF" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#FFFFFF" }}>Suspendre votre service temporairement</DialogTitle>
            <DialogDescription style={{ color: "#A0A0B8" }}>
              Choisissez une durée. Votre service reprendra automatiquement à la date choisie.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2" style={{ color: D.textSec }}>Durée</div>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => (
                  <Button
                    key={p.days}
                    type="button"
                    size="sm"
                    onClick={() => { setDays(p.days); setCustomDate(""); }}
                    style={!customDate && days === p.days
                      ? { background: "#7C3AED", color: "#FFFFFF", border: "none" }
                      : { background: "transparent", color: D.textSec, border: `1px solid ${D.border}` }
                    }
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
                  style={{ background: "#1A1A2E", color: "#FFFFFF", borderColor: D.border }}
                />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2" style={{ color: D.textSec }}>Raison (optionnel)</div>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <Button
                    key={r}
                    type="button"
                    size="sm"
                    onClick={() => setReason(reason === r ? "" : r)}
                    style={reason === r
                      ? { background: "#7C3AED", color: "#FFFFFF", border: "none" }
                      : { background: "transparent", color: D.textSec, border: `1px solid ${D.border}` }
                    }
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>


            <div className="p-3 rounded-md text-sm" style={{ background: D.info, border: `1px solid ${D.infoBd}`, color: D.infoTx }}>
              Votre service sera suspendu après approbation. La facturation est mise en pause pendant la
              suspension. Votre service reprendra automatiquement le{" "}
              <strong style={{ color: "#FFFFFF" }}>{resumeLabel}</strong>.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}
              style={{ borderColor: D.border, color: D.textSec, background: "transparent" }}>
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={submitting}
              style={{ background: "#7C3AED", color: "#FFFFFF" }}>
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
  const { data: canonicalData, isLoading } = useCanonicalClientData(user?.id);

  return (
    <ClientLayout>
      <div className="space-y-6" style={{ color: "#FFFFFF" }}>
        {/* Page header */}
        <div className="rounded-2xl overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0A0A0F 0%,#1A0A2E 60%,#0D0D1F 100%)", border: "1px solid rgba(124,58,237,0.2)", padding: "24px 28px" }}>
          <div className="absolute rounded-full pointer-events-none" style={{ width: 300, height: 300, top: -80, right: -60, background: "radial-gradient(circle, rgba(124,58,237,0.12), transparent)", filter: "blur(40px)" }} />
          <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: "#FFFFFF" }}>Utilisation et services</h1>
              <p className="mt-1" style={{ color: "#A0A0B8" }}>Gérez vos services, équipements et forfaits</p>
            </div>
            <ClientOutageReportButton />
          </div>
        </div>

        {user?.id && <ClientServicePauseCard userId={user.id} canonicalData={canonicalData} loading={isLoading} />}

        <ClientOrdersInProgress />

        <ClientMyServices />

        {user?.id && <PaymentHistoryV2 userId={user.id} />}
      </div>
    </ClientLayout>
  );
};

export default ClientServices;
