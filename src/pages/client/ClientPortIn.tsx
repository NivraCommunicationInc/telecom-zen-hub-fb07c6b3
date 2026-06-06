/**
 * ClientPortIn — /portal/port-in
 * Self-service port-in request for existing Nivra clients.
 * Client fills in port-in details → inserted into port_in_requests table
 * → admin notified by email to process manually with wholesale carrier.
 */
import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { portalClient as supabase } from "@/integrations/backend";
import { backendClient } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Smartphone, CheckCircle2, Loader2, AlertCircle, ArrowLeft, Phone,
  Building2, Hash, Lock, Clock, Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const CARRIERS = [
  "Rogers", "Bell", "Telus", "Fido", "Koodo",
  "Vidéotron", "Fizz", "Public Mobile", "Freedom Mobile",
  "Eastlink", "Autre",
];

interface PortInRequest {
  id: string;
  number_to_port: string;
  current_carrier: string;
  status: string;
  created_at: string;
}

function stripDigits(v: string) {
  return v.replace(/\D/g, "");
}

export default function ClientPortIn() {
  const navigate = useNavigate();
  const { user } = useClientAuth();
  const { account, subscriptions, profile } = useCanonicalClientData();

  const [numberToPort, setNumberToPort] = useState("");
  const [carrier, setCarrier] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [pin, setPin] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<PortInRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Find active mobile subscription
  const mobileSub = Array.isArray(subscriptions)
    ? subscriptions.find((s: any) => s.status === "active" && /mobile/i.test(s.type || s.name || ""))
    : null;

  const digits = stripDigits(numberToPort);
  const canSubmit =
    digits.length >= 10 &&
    carrier.length > 0 &&
    accountNumber.trim().length > 0 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user?.id) return;
    setSubmitting(true);
    setError(null);

    try {
      // Insert port-in request
      const { data: req, error: insertErr } = await supabase
        .from("port_in_requests")
        .insert({
          user_id: user.id,
          account_id: account?.id ?? null,
          subscription_id: mobileSub?.id ?? null,
          number_to_port: digits,
          current_carrier: carrier,
          account_number_at_carrier: accountNumber.trim(),
          pin_at_carrier: pin.trim() || null,
          notes: notes.trim() || null,
          status: "pending",
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Queue admin alert email
      const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";
      const clientEmail = user.email || "";

      await supabase.from("email_queue").insert([
        {
          to_email: "support@nivra-telecom.ca",
          template_key: "port_in_admin_alert",
          variables: {
            client_name: clientName,
            client_email: clientEmail,
            number_to_port: digits,
            current_carrier: carrier,
            account_number_at_carrier: accountNumber.trim(),
            pin_at_carrier: pin.trim() || "N/A",
            request_id: req.id,
            core_url: `https://nivra-telecom.ca/core/accounts`,
          },
          event_key: `port_in_admin_${req.id}`,
          status: "queued",
        } as any,
      ]);

      // Queue client confirmation email
      if (clientEmail) {
        await supabase.from("email_queue").insert([
          {
            to_email: clientEmail,
            template_key: "port_in_request_received",
            variables: {
              first_name: profile?.first_name || "Client",
              number_to_port: digits,
              current_carrier: carrier,
              request_id: req.id,
            },
            event_key: `port_in_client_${req.id}`,
            status: "queued",
          } as any,
        ]);
      }

      setSubmitted(req as PortInRequest);
    } catch (err: any) {
      setError(err?.message ?? "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <ClientLayout>
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-5"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)" }}
            >
              <CheckCircle2 size={40} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Demande soumise !</h1>
            <p className="text-white/60 max-w-sm mx-auto">
              Votre demande de transfert a été reçue. Notre équipe la traitera dans les prochains 1-3 jours ouvrables.
            </p>
          </div>

          <div
            className="rounded-2xl p-5 mb-6 space-y-3"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(124,58,237,0.25)",
            }}
          >
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Résumé</h2>
            {[
              ["Numéro à transférer", submitted.number_to_port],
              ["Transporteur actuel", submitted.current_carrier],
              ["Statut", "En attente de traitement"],
              ["Référence", submitted.id.slice(0, 8).toUpperCase()],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-white/50">{label}</span>
                <span className="text-sm font-medium text-white">{value}</span>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl px-4 py-3 mb-6 flex items-start gap-3"
            style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}
          >
            <Info size={16} className="text-cyan-400 mt-0.5 shrink-0" />
            <p className="text-sm text-white/60">
              Votre service actuel reste actif jusqu'à la complétion du transfert. Vous recevrez un courriel de confirmation à chaque étape.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate("/portal/dashboard")}
              className="h-11"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)" }}
            >
              Retour au tableau de bord
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setSubmitted(null); setNumberToPort(""); setCarrier(""); setAccountNumber(""); setPin(""); setNotes(""); }}
              className="h-11 text-white/50 hover:text-white"
            >
              Soumettre une autre demande
            </Button>
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => navigate("/portal/dashboard")}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Retour au tableau de bord
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}
            >
              <Smartphone size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Transférer mon numéro</h1>
          </div>
          <p className="text-white/55 text-sm">
            Gardez votre numéro actuel en le transférant vers Nivra. Notre équipe effectue le transfert auprès de votre opérateur actuel dans les 1-3 jours ouvrables.
          </p>
        </div>

        {/* Info banner */}
        <div
          className="rounded-xl px-4 py-3 mb-6 flex items-start gap-3"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
        >
          <AlertCircle size={15} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-white/55 leading-relaxed">
            Ayez votre facture ou contrat de votre opérateur actuel sous la main — vous aurez besoin de votre numéro de compte et du PIN de transfert (si applicable).
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div
            className="rounded-2xl p-6 space-y-5"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(124,58,237,0.25)",
            }}
          >
            {/* Number */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm flex items-center gap-2">
                <Phone size={14} /> Numéro à transférer *
              </Label>
              <Input
                value={numberToPort}
                onChange={(e) => setNumberToPort(e.target.value)}
                placeholder="514 555-1234"
                inputMode="numeric"
                maxLength={16}
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-violet-500 h-11"
              />
              {digits.length > 0 && digits.length < 10 && (
                <p className="text-xs text-amber-400">Numéro incomplet ({digits.length}/10 chiffres)</p>
              )}
            </div>

            {/* Carrier */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm flex items-center gap-2">
                <Building2 size={14} /> Opérateur actuel *
              </Label>
              <Select value={carrier} onValueChange={setCarrier} required>
                <SelectTrigger className="bg-white/5 border-white/20 text-white h-11 focus:border-violet-500">
                  <SelectValue placeholder="Sélectionnez votre opérateur" />
                </SelectTrigger>
                <SelectContent>
                  {CARRIERS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account number */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm flex items-center gap-2">
                <Hash size={14} /> Numéro de compte chez l'opérateur *
              </Label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Ex: 12345678"
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-violet-500 h-11"
              />
              <p className="text-xs text-white/35">
                Visible sur votre facture ou dans votre espace client chez votre opérateur actuel.
              </p>
            </div>

            {/* PIN */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm flex items-center gap-2">
                <Lock size={14} /> NIP / PIN de transfert{" "}
                <span className="text-white/35 font-normal">(si requis)</span>
              </Label>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-8 chiffres"
                maxLength={8}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-violet-500 h-11"
              />
              <p className="text-xs text-white/35">
                Certains opérateurs (ex: Vidéotron, Bell) exigent un PIN pour autoriser le transfert.
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">
                Notes supplémentaires <span className="text-white/35 font-normal">(optionnel)</span>
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: numéro de ligne secondaire, forfait corporatif…"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-violet-500 resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Timeline */}
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock size={12} /> Déroulement du transfert
            </p>
            <div className="space-y-2.5">
              {[
                ["Réception de la demande", "Immédiat"],
                ["Soumission au grossiste", "1 jour ouvrable"],
                ["Transfert effectué", "1-3 jours ouvrables"],
                ["Service Nivra activé", "Automatique après transfert"],
              ].map(([step, timing], i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{step}</span>
                  <span className="text-xs text-violet-400 font-medium">{timing}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 text-base font-semibold"
            style={canSubmit ? { background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)" } : undefined}
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" />Soumission en cours…</>
            ) : (
              "Soumettre la demande de transfert"
            )}
          </Button>

          <p className="text-xs text-center text-white/35">
            En soumettant ce formulaire, vous autorisez Nivra Telecom à initier le transfert de votre numéro auprès de votre opérateur actuel. Aucuns frais supplémentaires.
          </p>
        </form>
      </div>
    </ClientLayout>
  );
}
