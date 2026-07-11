/**
 * StaffClientInternalNotes - Internal notes system for client accounts
 * Displays all audit notes and allows staff to add new notes
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, Plus, User, Clock, Loader2, 
  RefreshCw, FileText, Settings, DollarSign, Package
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { writeAccountJournal } from "@/lib/writeAccountJournal";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StaffClientInternalNotesProps {
  clientId: string;
  staffUserId: string;
  staffUserName?: string;
}

export default function StaffClientInternalNotes({
  clientId,
  staffUserId,
  staffUserName,
}: StaffClientInternalNotesProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState("");

  // Fetch internal notes
  const { data: notes, isLoading, refetch } = useQuery({
    queryKey: ["staff-client-internal-notes", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_internal_notes")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("client_internal_notes").insert({
        client_id: clientId,
        note_type: "employee",
        body: body.trim(),
        created_by_user_id: staffUserId,
        created_by_role: "employee",
        created_by_name: staffUserName || "Employé",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note ajoutée");
      queryClient.invalidateQueries({ queryKey: ["staff-client-internal-notes", clientId] });
      setNewNote("");
      setIsAdding(false);
    },
    onError: (error: any) => {
      toast.error("Erreur: " + (error.message || "Impossible d'ajouter la note"));
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.error("La note ne peut pas être vide");
      return;
    }
    addNoteMutation.mutate(newNote);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500/20 text-red-400 text-xs">Admin</Badge>;
      case "employee":
        return <Badge className="bg-blue-500/20 text-blue-400 text-xs">Employé</Badge>;
      case "system":
        return <Badge className="bg-slate-500/20 text-slate-400 text-xs">Système</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{role}</Badge>;
    }
  };

  const getNoteIcon = (body: string) => {
    const lower = body.toLowerCase();
    if (lower.includes("[service_") || lower.includes("service ")) {
      return <Settings className="h-3 w-3 text-teal-400" />;
    }
    if (lower.includes("[payment_") || lower.includes("crédit") || lower.includes("frais")) {
      return <DollarSign className="h-3 w-3 text-green-400" />;
    }
    if (lower.includes("[equipment_") || lower.includes("équipement")) {
      return <Package className="h-3 w-3 text-purple-400" />;
    }
    return <FileText className="h-3 w-3 text-slate-400" />;
  };

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-amber-400" />
            Notes internes
            <Badge className="bg-amber-500/20 text-amber-400">{notes?.length || 0}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(!isAdding)}
              className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note Form */}
        {isAdding && (
          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg space-y-3">
            <Textarea
              placeholder="Écrire une note interne..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              className="bg-slate-900/50 border-slate-600 text-white resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewNote("");
                }}
                className="text-slate-400"
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={!newNote.trim() || addNoteMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {addNoteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Ajouter
              </Button>
            </div>
          </div>
        )}

        {/* Notes List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </div>
        ) : !notes?.length ? (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Aucune note interne</p>
            <p className="text-sm text-slate-500 mt-1">
              Les notes ajoutées ici seront visibles par les admins et employés
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {notes.map((note: any) => (
                <div
                  key={note.id}
                  className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-slate-500" />
                      <span className="text-sm text-slate-300 font-medium">
                        {note.created_by_name || "Inconnu"}
                      </span>
                      {getRoleBadge(note.created_by_role)}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {format(new Date(note.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    {getNoteIcon(note.body)}
                    <p className="text-sm text-slate-200 whitespace-pre-wrap flex-1">
                      {note.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
