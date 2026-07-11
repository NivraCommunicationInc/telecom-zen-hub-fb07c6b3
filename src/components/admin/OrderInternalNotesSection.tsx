import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus, User, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { writeAccountJournal } from "@/lib/writeAccountJournal";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface OrderInternalNotesSectionProps {
  orderId: string;
  orderNumber?: string;
  currentUserId: string;
  currentUserName?: string;
  currentUserRole: string;
}

interface OrderNote {
  id: string;
  order_id: string;
  body: string;
  created_by_user_id: string;
  created_by_role: string;
  created_by_name: string | null;
  created_at: string;
}

export const OrderInternalNotesSection = ({
  orderId,
  orderNumber,
  currentUserId,
  currentUserName,
  currentUserRole,
}: OrderInternalNotesSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Fetch notes for this order
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["order-internal-notes", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_internal_notes")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrderNote[];
    },
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      const minuteBucket = new Date().toISOString().slice(0, 16);
      await writeAccountJournal({
        targetTable: "order_internal_notes",
        eventKey: `note:order:${orderId}:${currentUserId}:${minuteBucket}`,
        visibility: "staff",
        payload: {
          order_id: orderId,
          body: body.trim(),
        },
      });
    },
    onSuccess: () => {
      toast({ title: "Note ajoutée" });
      setNewNote("");
      setIsAdding(false);
      queryClient.invalidateQueries({ queryKey: ["order-internal-notes", orderId] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter la note",
        variant: "destructive",
      });
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNoteMutation.mutate(newNote);
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") return <Badge className="bg-red-500/20 text-red-500 text-xs">Admin</Badge>;
    if (role === "employee") return <Badge className="bg-blue-500/20 text-blue-500 text-xs">Employé</Badge>;
    return <Badge variant="outline" className="text-xs">{role}</Badge>;
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-500" />
            Notes internes de commande
            {orderNumber && <Badge variant="outline" className="text-xs">{orderNumber}</Badge>}
            <Badge className="bg-amber-500/20 text-amber-500 text-xs">{notes.length}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
            Ajouter
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add Note Form */}
        {isAdding && (
          <div className="p-3 bg-background border rounded-lg space-y-2">
            <Textarea
              placeholder="Écrire une note interne..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setNewNote(""); }}>
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!newNote.trim() || addNoteMutation.isPending}
              >
                {addNoteMutation.isPending ? "Ajout..." : "Ajouter la note"}
              </Button>
            </div>
          </div>
        )}

        {/* Notes List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Chargement...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune note interne pour cette commande.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notes.map((note) => (
              <div key={note.id} className="p-3 bg-background border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span className="font-medium">{note.created_by_name || "Inconnu"}</span>
                    {getRoleBadge(note.created_by_role)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(new Date(note.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.body}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderInternalNotesSection;
