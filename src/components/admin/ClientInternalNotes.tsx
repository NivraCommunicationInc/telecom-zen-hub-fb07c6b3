import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Plus, Send, User, Shield, Loader2, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ClientInternalNotesProps {
  clientId: string;
  clientEmail?: string;
}

interface InternalNote {
  id: string;
  note_type: "admin" | "employee";
  body: string;
  created_by_user_id: string;
  created_by_role: string;
  created_by_name: string | null;
  created_at: string;
}

export const ClientInternalNotes = ({ clientId, clientEmail }: ClientInternalNotesProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isEmployee } = useRoleAccess();
  const queryClient = useQueryClient();
  
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<"admin" | "employee">(isAdmin ? "admin" : "employee");
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show for admin or employee
  if (!isAdmin && !isEmployee) {
    return null;
  }

  // Fetch internal notes for this client
  const { data: notes, isLoading } = useQuery({
    queryKey: ["client-internal-notes", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_internal_notes")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as InternalNote[];
    },
    enabled: !!clientId,
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async (noteData: { body: string; note_type: "admin" | "employee" }) => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Get user profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", currentUser.id)
        .single();

      const { error } = await supabase
        .from("client_internal_notes")
        .insert({
          client_id: clientId,
          note_type: noteData.note_type,
          body: noteData.body,
          created_by_user_id: currentUser.id,
          created_by_role: isAdmin ? "admin" : "employee",
          created_by_name: profile?.full_name || currentUser.email,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-internal-notes", clientId] });
      toast({ title: "Note ajoutée", description: "La note interne a été enregistrée" });
      setNewNote("");
      setIsExpanded(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible d'ajouter la note", 
        variant: "destructive" 
      });
    },
  });

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addNoteMutation.mutate({ body: newNote.trim(), note_type: noteType });
  };

  const noteTypeConfig = {
    admin: { 
      label: "Note Admin", 
      color: "bg-red-500/20 text-red-400 border-red-500/30",
      icon: Shield 
    },
    employee: { 
      label: "Note Employé", 
      color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      icon: User 
    },
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Notes internes
            <Badge variant="outline" className="ml-2 text-xs">
              Admin/Employé seulement
            </Badge>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        {isExpanded && (
          <div className="space-y-3 p-4 border border-border rounded-lg bg-accent/30">
            <div className="flex items-center gap-3">
              <Label className="w-24">Type de note:</Label>
              <Select 
                value={noteType} 
                onValueChange={(v) => setNoteType(v as "admin" | "employee")}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && (
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-red-400" />
                        Note Admin
                      </div>
                    </SelectItem>
                  )}
                  <SelectItem value="employee">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      Note Employé
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Textarea
                placeholder="Écrire une note interne..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsExpanded(false)}>
                Annuler
              </Button>
              <Button 
                size="sm" 
                onClick={handleAddNote}
                disabled={!newNote.trim() || addNoteMutation.isPending}
              >
                {addNoteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Send className="w-4 h-4 mr-1" />
                )}
                Enregistrer
              </Button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes && notes.length > 0 ? (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-3 pr-2">
              {notes.map((note) => {
                const config = noteTypeConfig[note.note_type];
                const NoteIcon = config.icon;
                return (
                  <div
                    key={note.id}
                    className="p-3 border border-border rounded-lg bg-background space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className={config.color}>
                        <NoteIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(note.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </div>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.body}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      {note.created_by_name || "Utilisateur"} ({note.created_by_role})
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune note interne</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientInternalNotes;
