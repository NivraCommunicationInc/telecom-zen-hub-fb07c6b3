import { useState } from "react";
import { Loader2, Lock, Send } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient } from "@/integrations/backend/adminClient";
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type AdminNote = {
  id: string;
  note: string;
  created_at: string;
  created_by: string | null;
  created_by_name?: string | null;
};

const fmt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("fr-CA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export function ClientAdminNotesSection({ clientId }: { clientId: string }) {
  const { isAdmin, isLoading: roleLoading } = useIsCoreAdmin();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: notes, isLoading } = useQuery({
    queryKey: ["client_admin_notes", clientId],
    enabled: !!clientId && isAdmin,
    queryFn: async (): Promise<AdminNote[]> => {
      const { data, error } = await adminClient
        .from("client_admin_notes")
        .select("id, note, created_at, created_by")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as AdminNote[];
      const authorIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean) as string[]));
      if (authorIds.length === 0) return rows;

      const { data: authors } = await adminClient
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", authorIds);

      const map = new Map((authors ?? []).map((a: any) => [a.user_id, a.full_name || a.email || "Admin"]));
      return rows.map((r) => ({
        ...r,
        created_by_name: r.created_by ? (map.get(r.created_by) ?? "Admin") : "Admin",
      }));
    },
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const { data: u } = await adminClient.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Session admin requise");
      const { writeAccountJournal } = await import("@/lib/writeAccountJournal");
      const minuteBucket = new Date().toISOString().slice(0, 16);
      await writeAccountJournal({
        targetTable: "client_admin_notes",
        eventKey: `admin_note:${clientId}:${uid}:${minuteBucket}`,
        visibility: "admin",
        payload: { client_id: clientId, note: text.trim() },
      });
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["client_admin_notes", clientId] });
      toast.success("Note enregistrée");
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec de l'enregistrement"),
  });

  if (roleLoading) return null;
  if (!isAdmin) return null;

  return (
    <section className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <header className="mb-3 flex items-center gap-2 border-b border-primary/20 pb-2">
        <Lock className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Notes privées — Admin Core uniquement
        </h3>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          Chargement…
        </div>
      ) : notes && notes.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border bg-card p-3 text-sm text-foreground">
              <div className="mb-1 text-[11px] text-muted-foreground">
                {n.created_by_name} · {fmt(n.created_at)}
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{n.note}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-center text-[11px] text-muted-foreground">Aucune note privée</p>
      )}

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ajouter une note privée…"
          rows={3}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => addNote.mutate(draft)}
            disabled={!draft.trim() || addNote.isPending}
            className="gap-1.5"
          >
            {addNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Enregistrer la note
          </Button>
        </div>
      </div>
    </section>
  );
}

export default ClientAdminNotesSection;
