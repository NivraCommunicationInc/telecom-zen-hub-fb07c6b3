/**
 * CoreActivityTimeline — Dark-native activity timeline
 * Replaces CSS-overridden white version with native ops-grade component
 */
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Clock, Plus, User, ChevronDown, ChevronUp, Send, Loader2 } from "lucide-react";

interface Log {
  id: string;
  action: string;
  actor_name?: string;
  actor_role?: string;
  created_at: string;
  details?: any;
  changed_field?: string;
  old_value?: string;
  new_value?: string;
}

interface Props {
  logs: Log[];
  onAddNote: (note: string) => Promise<void>;
}

export function CoreActivityTimeline({ logs, onAddNote }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!noteText.trim()) return;
    setSubmitting(true);
    try {
      await onAddNote(noteText.trim());
      setNoteText("");
      setNoteOpen(false);
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
        <button
          onClick={() => setNoteOpen(!noteOpen)}
          className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,20%)] bg-[hsl(220,20%,13%)] px-2 py-1 text-[10px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors"
        >
          <Plus className="w-3 h-3" /> Note
        </button>
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

      {/* Timeline entries */}
      {expanded && (
        <div className="max-h-[280px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Clock className="h-5 w-5 mx-auto mb-2 text-[hsl(220,10%,25%)]" />
              <p className="text-[11px] text-[hsl(220,10%,30%)]">Aucune activité enregistrée</p>
            </div>
          ) : (
            <div>
              {logs.map((log, idx) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-4 py-2.5 border-b border-[hsl(220,15%,13%)] last:border-0 hover:bg-[hsl(220,20%,12%)] transition-colors"
                >
                  {/* Timeline dot */}
                  <div className="mt-1 shrink-0">
                    <div className={`h-2 w-2 rounded-full ${idx === 0 ? "bg-emerald-400" : "bg-[hsl(220,15%,25%)]"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-medium text-white">
                        {log.actor_name || "Système"}
                      </span>
                      {log.actor_role && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(220,15%,16%)] text-[hsl(220,10%,45%)] uppercase tracking-wider font-medium">
                          {log.actor_role}
                        </span>
                      )}
                      <span className="text-[10px] text-[hsl(220,10%,30%)] font-mono ml-auto shrink-0">
                        {format(new Date(log.created_at), "d MMM HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[hsl(220,10%,55%)] mt-0.5 leading-relaxed">
                      {log.action}
                      {log.changed_field && (
                        <span className="text-[hsl(220,10%,38%)]">
                          {" "}— {log.changed_field}:{" "}
                          <span className="text-red-400 line-through">{log.old_value}</span>
                          {" → "}
                          <span className="text-emerald-400">{log.new_value}</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
