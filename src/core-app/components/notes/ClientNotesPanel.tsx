import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronDown, ChevronUp, Copy, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ClientNotesPanelProps {
  clientId?: string;
  compact?: boolean;
  className?: string;
  onMutationSuccess?: () => void;
}

interface ClientInternalNote {
  id: string;
  body: string;
  note_type: string;
  created_by_name: string | null;
  created_by_role: string;
  created_by_user_id: string;
  created_at: string;
}

const LONG_NOTE_THRESHOLD = 280;
const PAGE_SIZE = 15;

const FILTER_TABS = [
  { key: "all", label: "Tous" },
  { key: "system", label: "Système" },
  { key: "admin", label: "Admin" },
  { key: "call", label: "Appel" },
  { key: "ticket", label: "Ticket" },
];

const NOTE_BADGE: Record<string, string> = {
  system: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  system_auto: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  admin: "bg-purple-500/10 text-purple-400 border border-purple-500/30",
  call: "bg-teal-500/10 text-teal-400 border border-teal-500/30",
  ticket: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
};

const NOTE_LABEL: Record<string, string> = {
  system: "Système",
  system_auto: "Auto",
  admin: "Admin",
  call: "Appel",
  ticket: "Ticket",
};

export function ClientNotesPanel({ clientId, compact = false, className, onMutationSuccess }: ClientNotesPanelProps) {
  const queryClient = useQueryClient();
  const notesScrollRef = useRef<HTMLDivElement | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [filterType, setFilterType] = useState("all");
  const [notesPage, setNotesPage] = useState(1);

  const notesQueryKey = useMemo(() => ["client-internal-notes-shared", clientId], [clientId]);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: notesQueryKey,
    queryFn: async () => {
      if (!clientId) return [] as ClientInternalNote[];

      const { data, error } = await supabase
        .from("client_internal_notes")
        .select("id, body, note_type, created_by_name, created_by_role, created_by_user_id, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      return (data ?? []) as ClientInternalNote[];
    },
    enabled: !!clientId,
  });

  const filteredNotes = useMemo(() => {
    if (filterType === "all") return notes;
    return notes.filter(n => n.note_type === filterType || (filterType === "system" && n.note_type === "system_auto"));
  }, [notes, filterType]);

  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / PAGE_SIZE));
  const pagedNotes = filteredNotes.slice((notesPage - 1) * PAGE_SIZE, notesPage * PAGE_SIZE);

  const handleFilterChange = (key: string) => {
    setFilterType(key);
    setNotesPage(1);
  };

  const refreshNotes = async () => {
    if (!clientId) return;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notesQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["core-client-notes", clientId] }),
      queryClient.invalidateQueries({ queryKey: ["account-360-notes", clientId] }),
    ]);

    onMutationSuccess?.();
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Client manquant");
      if (!noteText.trim()) throw new Error("La note est vide");

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      const { error } = await supabase.from("client_internal_notes").insert({
        client_id: clientId,
        note_type: "admin",
        body: noteText.trim(),
        created_by_user_id: currentUser.id,
        created_by_role: "admin",
        created_by_name: profile?.full_name || currentUser.email || "Agent",
      });

      if (error) {
        console.error("[ClientNotesPanel] insert failed:", error);
        throw error;
      }
    },
    onSuccess: async () => {
      setNoteText("");
      setComposerOpen(false);
      await refreshNotes();
      toast.success("Note ajoutée");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Impossible d'ajouter la note");
    },
  });

  const toggleExpand = (noteId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const copyNote = async (body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Note copiée");
    } catch {
      toast.error("Impossible de copier la note");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {!composerOpen ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setComposerOpen(true)}
          className={cn("w-full justify-center", compact ? "h-7 text-[10px]" : "h-8 text-xs")}
        >
          <Plus className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          Ajouter une note
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
          <Textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Écrire une note interne..."
            rows={compact ? 2 : 3}
            className={cn(compact ? "text-[11px]" : "text-xs")}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setComposerOpen(false);
                setNoteText("");
              }}
              className={cn(compact ? "h-7 text-[10px]" : "h-8 text-xs")}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !noteText.trim()}
              className={cn(compact ? "h-7 text-[10px]" : "h-8 text-xs")}
            >
              {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {!isLoading && notes.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={cn(
                "h-6 px-2 rounded text-[10px] font-medium transition-colors border",
                filterType === tab.key
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "border-[hsl(220,15%,20%)] text-[hsl(220,10%,45%)] hover:text-white hover:border-emerald-500/20"
              )}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1 opacity-60">
                  ({notes.filter(n => tab.key === "system" ? (n.note_type === "system" || n.note_type === "system_auto") : n.note_type === tab.key).length})
                </span>
              )}
            </button>
          ))}
          {filteredNotes.length > 0 && (
            <span className="ml-auto text-[10px] text-[hsl(220,10%,38%)] self-center">
              {filteredNotes.length} note{filteredNotes.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : pagedNotes.length > 0 ? (
        <>
          <div
            ref={notesScrollRef}
            className="space-y-2 pr-1"
          >
            {pagedNotes.map((note) => {
              const isLong = note.body.length > LONG_NOTE_THRESHOLD || note.body.split("\n").length > 5;
              const isExpanded = expandedIds.has(note.id);
              const displayBody = isLong && !isExpanded ? `${note.body.slice(0, LONG_NOTE_THRESHOLD)}…` : note.body;
              const badgeClass = NOTE_BADGE[note.note_type] || "bg-slate-500/10 text-slate-400 border border-slate-500/30";
              const badgeLabel = NOTE_LABEL[note.note_type] || note.note_type;

              return (
                <div key={note.id} className="rounded-md border border-border bg-card p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded", badgeClass)}>
                        {badgeLabel}
                      </span>
                      <p className={cn("truncate font-medium text-foreground", compact ? "text-[10px]" : "text-[11px]")}>
                        {note.created_by_name || "Agent"}
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
                      {note.created_at ? format(new Date(note.created_at), "d MMM yyyy HH:mm", { locale: fr }) : ""}
                    </span>
                  </div>

                  <p className={cn("mt-2 whitespace-pre-wrap text-foreground", compact ? "text-[10px]" : "text-[11px]")}>{displayBody}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => copyNote(note.body)}
                      className={cn(compact ? "h-6 px-2 text-[10px]" : "h-7 px-2 text-[11px]")}
                    >
                      <Copy className="h-3 w-3" />
                      Copier
                    </Button>

                    {isLong && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(note.id)}
                        className={cn(compact ? "h-6 px-2 text-[10px]" : "h-7 px-2 text-[11px]")}
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? "Réduire" : "Développer"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2 border-t border-[hsl(220,15%,14%)]">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setNotesPage(p)}
                  className={cn(
                    "h-6 min-w-[24px] px-2 rounded text-[10px] font-medium transition-colors",
                    p === notesPage
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "border border-[hsl(220,15%,20%)] text-[hsl(220,10%,45%)] hover:text-white hover:border-emerald-500/20"
                  )}
                >
                  {p}
                </button>
              ))}
              <span className="text-[10px] text-[hsl(220,10%,38%)] ml-1">
                Page {notesPage}/{totalPages}
              </span>
            </div>
          )}
        </>
      ) : (
        <p className={cn("text-center text-muted-foreground", compact ? "py-2 text-[10px]" : "py-3 text-xs")}>
          {filterType === "all" ? "Aucune note" : "Aucune note dans cette catégorie"}
        </p>
      )}
    </div>
  );
}

export default ClientNotesPanel;
