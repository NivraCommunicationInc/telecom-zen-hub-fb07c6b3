/**
 * PortInStep — Number port-in transfer management.
 * Reads from proc.mobileFulfillment, writes via proc.* mutations.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PhoneForwarded, Send, RefreshCw, XCircle, CalendarClock, AlertCircle,
  CheckCircle2, Clock, Hourglass, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props { proc: any; }

const CARRIERS = [
  "Rogers", "Bell", "Telus", "Fido", "Koodo", "Vidéotron", "Fizz", "Public Mobile", "Autre",
];

const TIME_SLOTS = [
  { value: "asap", label: "Le plus tôt possible" },
  { value: "morning", label: "Matin 8h–12h" },
  { value: "afternoon", label: "Après-midi 12h–17h" },
];

const STATUS_OPTIONS = [
  { value: "initiated", label: "Initié" },
  { value: "in_progress", label: "En traitement" },
  { value: "confirmed", label: "Confirmé opérateur" },
  { value: "completed", label: "Complété" },
  { value: "failed", label: "Échoué" },
];

const PIPELINE_STAGES: Array<{ id: string; label: string; icon: typeof Clock }> = [
  { id: "initiated",  label: "Initié",              icon: PhoneForwarded },
  { id: "in_progress", label: "En traitement",      icon: Hourglass },
  { id: "confirmed",  label: "Confirmé opérateur",  icon: CheckCircle2 },
  { id: "completed",  label: "Complété",            icon: ListChecks },
];

function stageIndex(status?: string): number {
  if (!status) return -1;
  const idx = PIPELINE_STAGES.findIndex((s) => s.id === status);
  if (idx >= 0) return idx;
  // Map legacy / extra statuses
  if (status === "submitted") return 0;
  if (status === "pending") return -1;
  return -1;
}

export function PortInStep({ proc }: Props) {
  const mf = proc.mobileFulfillment || {};
  const portIn = proc.portRequest || {};

  const [number, setNumber] = useState<string>(mf.port_in_number || portIn.phone_number || "");
  const [carrier, setCarrier] = useState<string>(mf.port_in_carrier || portIn.carrier || "Rogers");
  const [accountNumber, setAccountNumber] = useState<string>(mf.port_in_account_number || portIn.account_number || "");
  const [pin, setPin] = useState<string>("");
  const [requestedDate, setRequestedDate] = useState<string>("");
  const [timeSlot, setTimeSlot] = useState<string>("asap");
  const [statusUpdate, setStatusUpdate] = useState<string>(mf.port_in_status || "initiated");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mf.port_in_status) setStatusUpdate(mf.port_in_status);
  }, [mf.port_in_status]);

  const currentStage = stageIndex(mf.port_in_status);
  const isCancelled = mf.port_in_status === "cancelled";
  const isFailed = mf.port_in_status === "failed";

  const isValidPhone = (v: string) => /^[\d\s\-\+\(\)]{10,20}$/.test(v.trim());

  const handleSubmit = async () => {
    if (!isValidPhone(number)) {
      toast.error("Numéro de téléphone invalide");
      return;
    }
    if (!accountNumber.trim()) {
      toast.error("Numéro de compte requis");
      return;
    }
    setBusy(true);
    try {
      await proc.submitPortIn({
        number: number.trim(),
        current_operator: carrier,
        account_number: accountNumber.trim(),
        pin: pin.trim() || null,
        requested_date: requestedDate || null,
        time_slot: timeSlot,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateStatus = async () => {
    setBusy(true);
    try {
      await proc.updatePortInStatus(statusUpdate);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Annuler ce port-in ? Cette action met à jour le statut à 'annulé'.")) return;
    setBusy(true);
    try {
      await proc.cancelPortIn();
    } finally {
      setBusy(false);
    }
  };

  const handleReschedule = () => {
    setRequestedDate("");
    setTimeSlot("asap");
    toast.info("Replanifiez la date puis cliquez 'Soumettre demande port-in'");
  };

  const attempts = Array.isArray((mf as any).portin_attempts) ? (mf as any).portin_attempts : [];

  return (
    <div className="space-y-6">
      {/* Pipeline */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline de transfert
        </h3>
        <div className="flex items-center justify-between gap-2">
          {PIPELINE_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const reached = currentStage >= idx;
            const active = currentStage === idx;
            return (
              <div key={stage.id} className="flex flex-1 items-center">
                <div className="flex flex-col items-center text-center">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    reached
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground",
                    active && "ring-4 ring-primary/20",
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn(
                    "mt-2 text-xs font-medium",
                    reached ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {stage.label}
                  </span>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className={cn(
                    "mx-2 h-0.5 flex-1",
                    currentStage > idx ? "bg-primary" : "bg-border",
                  )} />
                )}
              </div>
            );
          })}
        </div>
        {(isCancelled || isFailed) && (
          <p className="mt-3 text-xs text-red-700">
            Statut actuel: {isCancelled ? "Annulé" : "Échoué"}
          </p>
        )}
      </section>

      {/* Info alert */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>Le transfert prend 2–4 heures ouvrables. Informer le client de garder son ancienne SIM active jusqu'à confirmation.</span>
      </div>

      {/* Form */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
          <PhoneForwarded className="h-5 w-5 text-primary" />
          Demande de port-in
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="port-number">Numéro à transférer</Label>
            <Input
              id="port-number"
              type="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="+1 514 555 0000"
            />
          </div>

          <div>
            <Label>Opérateur actuel</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="port-account">Numéro de compte chez opérateur actuel</Label>
            <Input
              id="port-account"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="123456789"
            />
          </div>

          <div>
            <Label htmlFor="port-pin">Code PIN / mot de passe compte</Label>
            <Input
              id="port-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              maxLength={6}
              placeholder="••••"
            />
          </div>

          <div>
            <Label htmlFor="port-date">Date de port souhaitée</Label>
            <Input
              id="port-date"
              type="date"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Plage horaire</Label>
            <Select value={timeSlot} onValueChange={setTimeSlot}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={handleSubmit} disabled={busy}>
            <Send className="mr-1 h-4 w-4" />
            Soumettre demande port-in
          </Button>
          <Button variant="outline" onClick={handleReschedule} disabled={busy}>
            <CalendarClock className="mr-1 h-4 w-4" />
            Replanifier
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={busy || !mf.port_in_status || isCancelled}>
            <XCircle className="mr-1 h-4 w-4" />
            Annuler port-in
          </Button>
        </div>
      </section>

      {/* Status update */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-foreground">
          <RefreshCw className="h-5 w-5 text-primary" />
          Mettre à jour statut
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label>Nouveau statut</Label>
            <Select value={statusUpdate} onValueChange={setStatusUpdate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleUpdateStatus} disabled={busy}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Mettre à jour
          </Button>
        </div>
      </section>

      {/* Attempt history */}
      {attempts.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historique des tentatives
          </h3>
          <ul className="space-y-3">
            {attempts.map((att: any, i: number) => (
              <li key={i} className="flex gap-3 border-l-2 border-border pl-3">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {att.date ? new Date(att.date).toLocaleString("fr-CA") : "—"}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {att.status || "—"}
                  </p>
                  {att.note && <p className="text-xs text-muted-foreground">{att.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
