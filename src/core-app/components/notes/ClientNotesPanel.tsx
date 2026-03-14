import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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

export function ClientNotesPanel({ clientId, compact = false, className, onMutationSuccess }: ClientNotesPanelProps) {
  const queryClient = useQueryClient();
  const notesScrollRef = useRef<HTMLDivElement | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      if (error) throw error;
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!clientId || !editingId) throw new Error("Note introuvable");
      if (!editingBody.trim()) throw new Error("La note est vide");

      const { error } = await supabase
        .from("client_internal_notes")
        .update({ body: editingBody.trim() })
        .eq("id", editingId)
        .eq("client_id", clientId);

      if (error) throw error;
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditingBody("");
      await refreshNotes();
      toast.success("Note modifiée");
    },
    onError: (error: any) => {
      toast.error(error?.message || "Impossible de modifier la note");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      if (!clientId) throw new Error("Client manquant");

      const { error } = await supabase
        .from("client_internal_notes")
        .delete()
        .eq("id", noteId)
        .eq("client_id", clientId);

      if (error) throw error;
    },
    onSuccess: async () => {
      setDeletingId(null);
      await refreshNotes();
      toast.success("Note supprimée");
    },
    onError: (error: any) => {
      setDeletingId(null);
      toast.error(error?.message || "Impossible de supprimer la note");
    },
  });

  const startEdit = (note: ClientInternalNote) => {
    setEditingId(note.id);
    setEditingBody(note.body);
    setExpandedIds((previous) => new Set(previous).add(note.id));
  };

  const toggleExpand = (noteId: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
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

  const requestDelete = (noteId: string) => {
    if (deletingId === noteId || deleteMutation.isPending) return;
    if (!window.confirm("Supprimer cette note ?")) return;
    setDeletingId(noteId);
    deleteMutation.mutate(noteId);
  };

  const scrollNotes = (direction: "top" | "bottom") => {
    const container = notesScrollRef.current;
    if (!container) return;

    container.scrollTo({
      top: direction === "top" ? 0 : container.scrollHeight,
      behavior: "smooth",
    });
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

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length > 0 ? (
        <>
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => scrollNotes("top")}
              className={cn(compact ? "h-6 px-2 text-[10px]" : "h-7 px-2 text-[11px]")}
            >
              <ChevronUp className="h-3 w-3" />
              Haut
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => scrollNotes("bottom")}
              className={cn(compact ? "h-6 px-2 text-[10px]" : "h-7 px-2 text-[11px]")}
            >
              <ChevronDown className="h-3 w-3" />
              Bas
            </Button>
          </div>

          <div
            ref={notesScrollRef}
            className={cn(
              "space-y-2 overflow-y-auto pr-1",
              compact ? "max-h-[320px]" : "max-h-[420px]",
            )}
          >
            {notes.map((note) => {
              const isEditing = editingId === note.id;
              const isLong = note.body.length > LONG_NOTE_THRESHOLD || note.body.split("\n").length > 5;
              const isExpanded = expandedIds.has(note.id);
              const displayBody = isLong && !isExpanded ? `${note.body.slice(0, LONG_NOTE_THRESHOLD)}…` : note.body;

              return (
                <div key={note.id} className="rounded-md border border-border bg-card p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn("truncate font-medium text-foreground", compact ? "text-[10px]" : "text-[11px]")}>
                        {note.created_by_name || "Agent"}
                        <span className="ml-1 text-muted-foreground">({note.created_by_role || "staff"})</span>
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
                      {note.created_at ? format(new Date(note.created_at), "d MMM yyyy HH:mm", { locale: fr }) : ""}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editingBody}
                        onChange={(event) => setEditingBody(event.target.value)}
                        rows={compact ? 3 : 4}
                        className={cn(compact ? "text-[11px]" : "text-xs")}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingId(null);
                            setEditingBody("");
                          }}
                          className={cn(compact ? "h-6 px-2 text-[10px]" : "h-7 px-2 text-[11px]")}
                        >
                          <X className="h-3 w-3" />
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => updateMutation.mutate()}
                          disabled={updateMutation.isPending || !editingBody.trim()}
                          className={cn(compact ? "h-6 px-2 text-[10px]" : "h-7 px-2 text-[11px]")}
                        >
                          {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
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

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(note)}
                          className={cn(compact ? "h-6 px-2 text-[10px]" : "h-7 px-2 text-[11px]")}
                        >
                          <Pencil className="h-3 w-3" />
                          Modifier
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => requestDelete(note.id)}
                          disabled={deletingId === note.id}
                          className={cn(compact ? "h-6 px-2 text-[10px]" : "h-7 px-2 text-[11px]")}
                        >
                          {deletingId === note.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Supprimer
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
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className={cn("text-center text-muted-foreground", compact ? "py-2 text-[10px]" : "py-3 text-xs")}>Aucune note</p>
      )}
    </div>
  );
}

export default ClientNotesPanel;
