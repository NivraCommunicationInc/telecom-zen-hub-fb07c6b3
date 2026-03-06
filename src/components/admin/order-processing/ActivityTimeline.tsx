/**
 * ActivityTimeline — Bottom section showing order activity log + add note
 */
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Plus, User, ChevronDown, ChevronUp } from "lucide-react";

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

export function ActivityTimeline({ logs, onAddNote }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!noteText.trim()) return;
    setSubmitting(true);
    await onAddNote(noteText.trim());
    setNoteText("");
    setNoteOpen(false);
    setSubmitting(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900"
        >
          <Clock className="w-4 h-4 text-gray-500" />
          Historique d'activité ({logs.length})
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </button>
        <Button size="sm" variant="outline" onClick={() => setNoteOpen(!noteOpen)} className="text-xs h-7 border-gray-300 text-gray-700">
          <Plus className="w-3 h-3 mr-1" /> Note
        </Button>
      </div>

      {/* Add note */}
      {noteOpen && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Ajouter une note…"
            className="min-h-[60px] text-sm border-gray-300 text-gray-900 bg-white"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={() => setNoteOpen(false)} className="text-xs h-7 border-gray-300 text-gray-700">Annuler</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!noteText.trim() || submitting} className="text-xs h-7 bg-gray-900 text-white hover:bg-gray-800">
              Enregistrer
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {expanded && (
        <div className="max-h-[300px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Aucune activité enregistrée
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="mt-0.5">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-900">{log.actor_name || "Système"}</span>
                      {log.actor_role && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{log.actor_role}</span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {log.action}
                      {log.changed_field && (
                        <span className="text-gray-400"> — {log.changed_field}: {log.old_value} → {log.new_value}</span>
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
