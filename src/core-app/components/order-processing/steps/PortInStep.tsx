/**
 * PortInStep — Number port-in transfer management.
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

const CARRIERS = ["Rogers", "Bell", "Telus", "Fido", "Koodo", "Vidéotron", "Fizz", "Public Mobile", "Autre"];
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

  useEffect(() => { if (mf.port_in_status) setStatusUpdate(mf.port_in_status); }, [mf.port_in_status]);

  const currentStage = stageIndex(mf.port_in_status);
  const isCancelled = mf.port_in_status === "cancelled";
  const isFailed = mf.port_in_status === "failed";

  const isValidPhone = (v: string) => /^[\d\s\-\+\(\)]{10,20}$/.test(v.trim());

  const handleSubmit = async () => {
    if (!isValidPhone(number)) { toast.error("Numéro de téléphone invalide"); return; }
    if (!accountNumber.trim()) { toast.error("Numéro de compte requis"); return; }
    setBusy(true);
    try {
      await proc.submitPortIn({
        number: number.trim(), current_operator: carrier, account_number: accountNumber.trim(),
        pin: pin.trim() || null, requested_date: requestedDate || null, time_slot: timeSlot,
      });
    } finally { setBusy(false); }
  };

  const handleUpdateStatus = async () => {
    setBusy(true);
    try { await proc.updatePortInStatus(statusUpdate); } finally { setBusy(false); }
  };

  const handleCancel = async () => {
    if (!confirm("Annuler ce port-in ?")) return;
    setBusy(true);
    try { await proc.cancelPortIn(); } finally { setBusy(false); }
  };

  const handleReschedule = () => {
    setRequestedDate(""); setTimeSlot("asap");
    toast.info("Replanifiez la date puis cliquez 'Soumettre demande port-in'");
  };

  const attempts = Array.isArray((mf as any).portin_attempts) ? (mf as any).portin_attempts : [];

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Port-in numéro</div>

      {/* Pipeline */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
          <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pipeline de transfert</h3>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            {PIPELINE_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const reached = currentStage >= idx;
              const active = currentStage === idx;
              const completed = currentStage > idx;
              return (
                <div key={stage.id} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center text-center">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                      completed && "border-green-500 bg-green-900/50 text-green-300",
                      active && !completed && "border-blue-500 bg-blue-900/50 text-blue-300 ring-4 ring-blue-500/20",
                      !reached && "border-slate-700 bg-[#0d1421] text-slate-500",
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn(
                      "mt-2 text-xs font-medium",
                      completed && "text-green-300",
                      active && !completed && "text-blue-300",
                      !reached && "text-slate-500",
                    )}>{stage.label}</span>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <div className={cn(
                      "mx-2 h-0.5 flex-1",
                      currentStage > idx ? "bg-green-500" : "bg-slate-700",
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          {(isCancelled || isFailed) && (
            <p className="mt-3 text-xs text-red-300">Statut actuel: {isCancelled ? "Annulé" : "Échoué"}</p>
          )}
        </div>
      </div>

      {/* Info alert */}
      <div className="bg-amber-950/50 border border-amber-700/50 text-amber-300 rounded-lg px-3 py-2 text-sm mb-4 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Le transfert prend 2–4 heures ouvrables. Informer le client de garder son ancienne SIM active jusqu'à confirmation.</span>
      </div>

      {/* Form */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
          <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <PhoneForwarded className="h-3.5 w-3.5" /> Demande de port-in
          </h3>
        </div>
        <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Numéro à transférer</Label>
            <Input type="tel" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+1 514 555 0000"
              className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Opérateur actuel</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Numéro de compte</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="123456789"
              className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Code PIN / mot de passe</Label>
            <Input value={pin} onChange={(e) => setPin(e.target.value)} maxLength={6} placeholder="••••"
              className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Date de port souhaitée</Label>
            <Input type="date" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)}
              className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Plage horaire</Label>
            <Select value={timeSlot} onValueChange={setTimeSlot}>
              <SelectTrigger className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{TIME_SLOTS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
            <Button onClick={handleSubmit} disabled={busy} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
              <Send className="mr-1 h-4 w-4" /> Soumettre demande
            </Button>
            <Button onClick={handleReschedule} disabled={busy} className="text-sm bg-transparent border border-slate-600 text-slate-300 hover:bg-slate-800">
              <CalendarClock className="mr-1 h-4 w-4" /> Replanifier
            </Button>
            <Button onClick={handleCancel} disabled={busy || !mf.port_in_status || isCancelled} className="text-sm bg-red-700 hover:bg-red-800 text-white">
              <XCircle className="mr-1 h-4 w-4" /> Annuler
            </Button>
          </div>
        </div>
      </div>

      {/* Status update */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
          <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Mettre à jour statut
          </h3>
        </div>
        <div className="p-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Nouveau statut</Label>
            <Select value={statusUpdate} onValueChange={setStatusUpdate}>
              <SelectTrigger className="bg-[#0d1421] border-slate-700 text-slate-100 text-sm rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleUpdateStatus} disabled={busy} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
            <RefreshCw className="mr-1 h-4 w-4" /> Mettre à jour
          </Button>
        </div>
      </div>

      {/* Attempt history */}
      {attempts.length > 0 && (
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Historique des tentatives</h3>
          </div>
          <div className="p-4">
            <ul className="space-y-3">
              {attempts.map((att: any, i: number) => (
                <li key={i} className="flex gap-3 border-l-2 border-slate-700 pl-3">
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">{att.date ? new Date(att.date).toLocaleString("fr-CA") : "—"}</p>
                    <p className="text-sm font-medium text-slate-100">{att.status || "—"}</p>
                    {att.note && <p className="text-xs text-slate-400">{att.note}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
