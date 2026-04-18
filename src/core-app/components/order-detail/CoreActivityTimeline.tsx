/**
 * CoreActivityTimeline — Self-contained, realtime activity log for an order.
 *
 * Design goals (per ops feedback):
 *  - Always reflects the latest activity_logs rows for this order
 *  - Subscribes to postgres_changes so new mutations appear without manual refresh
 *  - Relative time ("il y a 2 minutes") for recent events
 *  - Colored icon per category: green=success, blue=info, amber=warning, red=failure
 *  - Always renders any attached note/details, regardless of action type
 *
 * It still accepts `logs` and `onAddNote` from the parent for backward
 * compatibility, but it owns its own query so a stale parent never blanks it out.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Clock, Plus, ChevronDown, ChevronUp, Send, Loader2,
  ShoppingCart, CreditCard, Shield, Wrench, Package,
  Wifi, FileText, Truck, MessageSquare, AlertTriangle,
  CheckCircle2, XCircle, Edit, Mail, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Log {
  id: string;
  action: string;
  actor_name?: string | null;
  actor_role?: string | null;
  created_at: string;
  details?: any;
  changed_field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  reason?: string | null;
}

interface Props {
  logs: Log[];                                  // initial / fallback data
  onAddNote: (note: string) => Promise<void>;
  orderId?: string;                             // preferred — enables self-fetch + realtime
}

/* ─── Tone palette (green/blue/amber/red as requested) ─── */
type Tone = "success" | "info" | "warning" | "danger" | "neutral";
const TONE: Record<Tone, { text: string; bg: string; ring: string }> = {
  success: { text: "text-emerald-400", bg: "bg-emerald-500/10",  ring: "ring-emerald-500/20" },
  info:    { text: "text-sky-400",     bg: "bg-sky-500/10",      ring: "ring-sky-500/20" },
  warning: { text: "text-amber-400",   bg: "bg-amber-500/10",    ring: "ring-amber-500/20" },
  danger:  { text: "text-red-400",     bg: "bg-red-500/10",      ring: "ring-red-500/20" },
  neutral: { text: "text-[hsl(220,10%,55%)]", bg: "bg-[hsl(220,15%,16%)]", ring: "ring-[hsl(220,15%,22%)]" },
};

/* ─── Event mapping (icon + tone + French label) ─── */
const EVENT_CONFIG: Record<string, { icon: any; tone: Tone; label: string }> = {
  // Order lifecycle
  order_created:           { icon: ShoppingCart,  tone: "info",    label: "Commande créée" },
  status_change:           { icon: Edit,          tone: "info",    label: "Changement de statut" },
  completed:               { icon: CheckCircle2,  tone: "success", label: "Commande complétée" },
  cancelled:               { icon: XCircle,       tone: "danger",  label: "Commande annulée" },

  // Payment
  payment_confirmed:       { icon: CreditCard,    tone: "success", label: "Paiement confirmé" },
  payment_received:        { icon: CreditCard,    tone: "success", label: "Paiement reçu" },
  payment_partial:         { icon: CreditCard,    tone: "warning", label: "Paiement partiel" },
  payment_invalidated:     { icon: XCircle,       tone: "danger",  label: "Paiement invalidé" },
  payment_failed:          { icon: AlertTriangle, tone: "danger",  label: "Paiement échoué" },

  // KYC
  kyc_requested:           { icon: Shield,        tone: "warning", label: "Vérification KYC demandée" },
  kyc_resubmission_requested: { icon: RefreshCw,  tone: "warning", label: "Resoumission KYC demandée" },
  kyc_submitted:           { icon: Shield,        tone: "info",    label: "Documents KYC soumis" },
  kyc_approved:            { icon: Shield,        tone: "success", label: "KYC approuvé" },
  kyc_rejected:            { icon: Shield,        tone: "danger",  label: "KYC rejeté" },

  // Operations
  technician_assigned:     { icon: Wrench,        tone: "info",    label: "Technicien assigné" },
  equipment_assigned:      { icon: Package,       tone: "info",    label: "Équipement assigné" },
  shipment_updated:        { icon: Truck,         tone: "info",    label: "Expédition mise à jour" },
  fulfillment_assigned:    { icon: Truck,         tone: "info",    label: "Fulfillment assigné" },
  service_activated:       { icon: Wifi,          tone: "success", label: "Service activé" },
  installation_completed:  { icon: CheckCircle2,  tone: "success", label: "Installation terminée" },
  installation_failed:     { icon: AlertTriangle, tone: "danger",  label: "Installation échouée" },
  contract_signed_admin:   { icon: FileText,      tone: "success", label: "Contrat signé (agent)" },
  contract_signed_client:  { icon: FileText,      tone: "success", label: "Contrat signé (client)" },

  // Communication
  notification_sent:       { icon: Mail,          tone: "info",    label: "Notification envoyée" },
  email_sent:              { icon: Mail,          tone: "info",    label: "Courriel envoyé" },
  note_added:              { icon: MessageSquare, tone: "neutral", label: "Note ajoutée" },
};

/* ─── Heuristic fallback so unmapped actions still get a sensible color ─── */
function getEventConfig(action: string) {
  const cfg = EVENT_CONFIG[action];
  if (cfg) return cfg;
  const a = (action || "").toLowerCase();
  let tone: Tone = "neutral";
  if (/(approved|confirmed|completed|activated|success|received|signed)/.test(a)) tone = "success";
  else if (/(rejected|failed|invalidated|cancelled|error|denied)/.test(a))         tone = "danger";
  else if (/(requested|warning|pending|expir)/.test(a))                            tone = "warning";
  else if (/(sent|notified|created|updated|assigned|change)/.test(a))              tone = "info";
  return { icon: Clock, tone, label: action.replace(/_/g, " ") };
}

/* ─── Pretty time helpers ─── */
function relativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const ms = Date.now() - date.getTime();
    if (ms < 60_000) return "à l'instant";
    if (ms < 7 * 24 * 60 * 60 * 1000) {
      return formatDistanceToNow(date, { addSuffix: true, locale: fr });
    }
    return format(date, "d MMM yyyy", { locale: fr });
  } catch {
    return iso;
  }
}

/* ─── Pull a human-readable note out of details/reason/changed_field ─── */
function extractNote(log: Log): string | null {
  if (log.reason && typeof log.reason === "string") return log.reason;
  const d = log.details;
  if (d && typeof d === "object") {
    if (typeof d.note === "string" && d.note.trim()) return d.note;
    if (typeof d.reason === "string" && d.reason.trim()) return d.reason;
    if (typeof d.message === "string" && d.message.trim()) return d.message;
    if (typeof d.notes === "string" && d.notes.trim()) return d.notes;
  }
  return null;
}

export function CoreActivityTimeline({ logs: initialLogs, onAddNote, orderId }: Props) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Self-fetch — guarantees the timeline is never blank when DB has rows */
  const { data: fetched, refetch } = useQuery({
    queryKey: ["core-activity-logs", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_type", "order")
        .eq("entity_id", orderId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as Log[];
    },
    initialData: initialLogs as Log[],
    staleTime: 0,
  });

  /* Realtime — append new rows the moment they're inserted */
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`activity_logs:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
          filter: `entity_id=eq.${orderId}`,
        },
        () => {
          refetch();
          // Also nudge the parent hook so other panels stay aligned
          queryClient.invalidateQueries({ queryKey: ["admin-order-detail", orderId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, refetch, queryClient]);

  // Merge + dedupe (initial props + fetched + realtime updates)
  const logs = useMemo<Log[]>(() => {
    const map = new Map<string, Log>();
    [...(initialLogs || []), ...(fetched || [])].forEach((l) => { if (l?.id) map.set(l.id, l); });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [initialLogs, fetched]);

  const handleSubmit = async () => {
    if (!noteText.trim()) return;
    setSubmitting(true);
    try {
      await onAddNote(noteText.trim());
      setNoteText("");
      setNoteOpen(false);
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(220,15%,14%)]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-[11px] font-semibold text-[hsl(220,10%,60%)] hover:text-white transition-colors"
        >
          <Clock className="w-3.5 h-3.5 text-[hsl(220,10%,40%)]" />
          Historique d'activité
          <span className="text-[10px] font-mono text-[hsl(220,10%,40%)] bg-[hsl(220,15%,14%)] px-1.5 py-0.5 rounded-full">
            {logs.length}
          </span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => refetch()}
            title="Actualiser"
            className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,20%)] bg-[hsl(220,20%,13%)] px-2 py-1 text-[10px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-sky-500/30 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            onClick={() => setNoteOpen(!noteOpen)}
            className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,20%)] bg-[hsl(220,20%,13%)] px-2 py-1 text-[10px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors"
          >
            <Plus className="w-3 h-3" /> Note
          </button>
        </div>
      </div>

      {/* Add note */}
      {noteOpen && (
        <div className="px-4 py-3 border-b border-[hsl(220,15%,14%)] bg-[hsl(220,20%,10%)]">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Ajouter une note interne…"
            className="w-full min-h-[60px] rounded-md border border-[hsl(220,15%,22%)] bg-[hsl(220,20%,8%)] px-3 py-2 text-xs text-[hsl(220,10%,85%)] placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/40 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setNoteOpen(false); setNoteText(""); }}
              className="px-2.5 py-1 rounded-md border border-[hsl(220,15%,20%)] text-[10px] text-[hsl(220,10%,50%)] hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={!noteText.trim() || submitting}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {expanded && (
        <div className="max-h-[420px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Clock className="h-5 w-5 mx-auto mb-2 text-[hsl(220,10%,25%)]" />
              <p className="text-[11px] text-[hsl(220,10%,30%)]">Aucune activité enregistrée</p>
            </div>
          ) : (
            <div>
              {logs.map((log, idx) => {
                const cfg = getEventConfig(log.action);
                const tone = TONE[cfg.tone];
                const Icon = cfg.icon;
                const note = extractNote(log);

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-4 py-2.5 border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)] transition-colors"
                  >
                    {/* Icon */}
                    <div className="mt-0.5 shrink-0">
                      <div className={`h-7 w-7 rounded-md flex items-center justify-center ring-1 ${tone.bg} ${tone.ring} ${idx === 0 ? "shadow-sm" : ""}`}>
                        <Icon className={`h-3.5 w-3.5 ${tone.text}`} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10.5px] font-semibold ${tone.text}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] font-medium text-white">
                          {log.actor_name || "Système"}
                        </span>
                        {log.actor_role && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(220,15%,16%)] text-[hsl(220,10%,55%)] uppercase tracking-wider font-medium">
                            {log.actor_role}
                          </span>
                        )}
                        <span
                          className="text-[10px] text-[hsl(220,10%,40%)] font-mono ml-auto shrink-0"
                          title={format(new Date(log.created_at), "d MMM yyyy HH:mm:ss", { locale: fr })}
                        >
                          {relativeTime(log.created_at)}
                        </span>
                      </div>

                      {/* Field-change diff (if any) */}
                      {log.changed_field && (
                        <p className="text-[11px] text-[hsl(220,10%,55%)] mt-0.5">
                          <span className="text-[hsl(220,10%,38%)]">{log.changed_field}:</span>{" "}
                          <span className="text-red-400 line-through">{log.old_value || "—"}</span>
                          {" → "}
                          <span className="text-emerald-400">{log.new_value || "—"}</span>
                        </p>
                      )}

                      {/* Attached note / reason / message */}
                      {note && (
                        <p className="text-[11px] text-[hsl(220,10%,65%)] mt-1 pl-2 border-l-2 border-[hsl(220,15%,22%)] italic">
                          {note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
