/**
 * WorkbenchNotesTab - Internal notes for the order
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Props {
  orderId: string;
}

export function WorkbenchNotesTab({ orderId }: Props) {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ["workbench-notes", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_id", orderId)
        .eq("action", "internal_note")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleSubmit = async () => {
    if (!note.trim() || !user) return;
    setIsSending(true);
    try {
      await logActivity("internal_note", "order", orderId, { note: note.trim() }, {
        reason: note.trim(),
      });
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["workbench-notes", orderId] });
      queryClient.invalidateQueries({ queryKey: ["workbench-audit", orderId] });
      toast.success("Note ajoutée");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add note */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="pt-4">
          <Textarea
            placeholder="Ajouter une note interne..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-slate-900 border-slate-700 min-h-[80px]"
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={handleSubmit} disabled={!note.trim() || isSending}>
              <Send className="h-3 w-3 mr-1" /> Envoyer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes list */}
      {notes.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            Aucune note interne.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notes.map((n: any) => (
            <Card key={n.id} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-white">{n.reason || (n.details as any)?.note || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.actor_name || n.actor_email || "—"} — {format(new Date(n.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
