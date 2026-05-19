/**
 * CrmCallDialog — Active call panel with timer, notes, and outcome buttons.
 * Opens when an agent clicks "Commencer l'appel" on a contact.
 * Includes the dynamic call script and auto-SMS after voicemail.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Clock, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { crmLogCall, useCrmLock } from "../hooks/useCrmLock";
import { type CrmContact, OUTCOME_META, displayName, type CrmCallOutcome, isWithinBusinessHours } from "../lib/crmTypes";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CrmCallScript } from "./CrmCallScript";

interface Props {
  contact: CrmContact | null;
  portal: "field" | "employee" | "core";
  onClose: () => void;
  onSold?: (contact: CrmContact) => void; // open sale flow
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const OBJECTION_TAGS = [
  "Trop cher", "Déjà engagé", "Pas intéressé", "Mauvais moment",
  "Pas le bon contact", "Veut réfléchir", "Pas de couverture", "Connaît mal Nivra",
];

export function CrmCallDialog({ contact, portal, onClose, onSold }: Props) {
  const { unlock } = useCrmLock();
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [showCallbackInput, setShowCallbackInput] = useState(false);
  const [logging, setLogging] = useState(false);
  const [sendSms, setSendSms] = useState(true);
  const [objections, setObjections] = useState<string[]>([]);

  useEffect(() => {
    if (!contact) return;
    setElapsed(0);
    setNotes(contact.call_notes ?? "");
    setShowCallbackInput(false);
    setCallbackDate("");
    setObjections([]);
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [contact?.id]);

  if (!contact) return null;

  const handleOutcome = async (outcome: CrmCallOutcome) => {
    if (outcome === "callback" && !callbackDate) {
      setShowCallbackInput(true);
      toast.info("Choisis la date et l'heure de rappel");
      return;
    }
    setLogging(true);
    const objectionLine = objections.length
      ? `[Objections: ${objections.join(", ")}]\n`
      : "";
    const finalNotes = (objectionLine + (notes.trim() || "")).trim() || undefined;
    const result = await crmLogCall({
      contactId: contact.id,
      outcome,
      notes: finalNotes,
      callbackAt: outcome === "callback" ? new Date(callbackDate).toISOString() : null,
      portal,
    });
    setLogging(false);
    if (!result.ok) {
      toast.error(`Erreur : ${result.error}`);
      return;
    }
    toast.success(`Résultat enregistré : ${OUTCOME_META[outcome].label}`);

    // Auto-SMS after a voicemail is left
    if (outcome === "voicemail" && sendSms && contact.phone) {
      const firstName = contact.first_name ?? displayName(contact).split(" ")[0] ?? "";
      const text = `Bonjour ${firstName}, ici Nivra Télécom. Je viens de vous laisser un message vocal. Internet/TV/Mobile prépayés — premier mois GRATUIT avec BIENVENUE2026. Détails : nivra-telecom.ca | Rép. STOP pour ne plus recevoir.`;
      try {
        const { error: smsErr } = await supabase.functions.invoke("openphone-sms", {
          body: { to: contact.phone, text, clientId: contact.id },
        });
        if (smsErr) toast.warning("SMS de suivi non envoyé");
        else toast.success("📱 SMS de suivi envoyé");
      } catch {
        toast.warning("SMS de suivi non envoyé");
      }
    }

    if (outcome === "sold" && onSold) {
      onSold(contact);
    }
    onClose();
  };

  const handleCancel = async () => {
    await unlock(contact.id);
    onClose();
  };

  const businessHours = isWithinBusinessHours();

  return (
    <Dialog open={!!contact} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-violet-500 animate-pulse" />
            Appel en cours — {displayName(contact)}
          </DialogTitle>
          <DialogDescription>
            <span className="flex items-center gap-1.5 text-sm">
              <Clock className="h-3.5 w-3.5" />
              <span className="font-mono font-bold text-base">{formatTimer(elapsed)}</span>
              {!businessHours && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                  ⚠️ Hors heures d'appel (9h-20h)
                </span>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {/* Dynamic call script */}
          <CrmCallScript contact={contact} />

          {/* Contact info */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`tel:${contact.phone}`} className="text-violet-600 font-semibold hover:underline">{contact.phone}</a>
              </div>
            )}
            {contact.email && <div className="text-muted-foreground text-xs">{contact.email}</div>}
            {(contact.city || contact.address) && (
              <div className="text-muted-foreground text-xs">
                {[contact.address, contact.city, contact.postal_code].filter(Boolean).join(", ")}
              </div>
            )}
            <div className="flex gap-3 text-[11px] text-muted-foreground">
              {contact.call_attempts != null && <span>Tentatives : {contact.call_attempts}</span>}
              {contact.date_of_birth && <span>DOB : {contact.date_of_birth}</span>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes d'appel</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes sur la conversation, objections, intérêt…"
              rows={3}
            />
          </div>

          {/* Callback input */}
          {showCallbackInput && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date et heure du rappel</label>
              <input
                type="datetime-local"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
                className="w-full border border-border bg-background rounded-md px-3 py-2 text-sm"
              />
            </div>
          )}

          {/* Auto-SMS after voicemail toggle */}
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2">
            <input
              type="checkbox"
              checked={sendSms}
              onChange={(e) => setSendSms(e.target.checked)}
              className="rounded"
            />
            <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
            <span>Envoyer un SMS de suivi automatiquement si je laisse un message vocal</span>
          </label>

          {/* Objection tags */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Objections rencontrées (analytics)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OBJECTION_TAGS.map((tag) => {
                const active = objections.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setObjections((p) => active ? p.filter((t) => t !== tag) : [...p, tag])}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                      active
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-background border-border text-foreground hover:border-rose-400"
                    )}
                  >
                    {active ? "✓ " : ""}{tag}
                  </button>
                );
              })}
            </div>
          </div>


          {/* Outcome buttons */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Résultat de l'appel</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">

              {(Object.keys(OUTCOME_META) as CrmCallOutcome[]).map((o) => {
                const meta = OUTCOME_META[o];
                return (
                  <button
                    key={o}
                    disabled={logging}
                    onClick={() => handleOutcome(o)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 min-h-[44px]",
                      meta.cls
                    )}
                  >
                    <span>{meta.emoji}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="ghost" onClick={handleCancel} disabled={logging}>
              <X className="h-4 w-4 mr-1" /> Annuler (déverrouille)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
