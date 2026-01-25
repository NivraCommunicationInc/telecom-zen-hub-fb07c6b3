/**
 * StaffNotes - View internal notes (read-only for staff)
 * Staff portal - completely isolated from admin
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, User, Calendar, Tag, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";

const noteTypeColors: Record<string, string> = {
  general: "bg-slate-500/20 text-slate-400",
  billing: "bg-green-500/20 text-green-400",
  support: "bg-blue-500/20 text-blue-400",
  service: "bg-purple-500/20 text-purple-400",
  fraud: "bg-red-500/20 text-red-400",
  exception: "bg-yellow-500/20 text-yellow-400",
};

interface NoteWithProfile {
  id: string;
  client_id: string;
  body: string;
  note_type: string;
  created_at: string;
  created_by_name: string | null;
  created_by_role: string;
  profile: { full_name: string | null } | null;
}

export default function StaffNotes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: notes, isLoading } = useQuery({
    queryKey: ["staff-internal-notes"],
    queryFn: async (): Promise<NoteWithProfile[]> => {
      const { data: notesData, error } = await supabase
        .from("client_internal_notes")
        .select("id, client_id, body, note_type, created_at, created_by_name, created_by_role")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch profiles separately
      const results: NoteWithProfile[] = [];
      
      for (const note of notesData || []) {
        let profile = null;
        if (note.client_id) {
          const { data: p } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", note.client_id)
            .maybeSingle();
          profile = p;
        }
        results.push({ ...note, profile });
      }

      return results;
    },
  });

  const filteredNotes = notes?.filter((note) => {
    const matchesSearch = !search || 
      note.body?.toLowerCase().includes(search.toLowerCase()) ||
      note.profile?.full_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = typeFilter === "all" || note.note_type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const noteTypes = ["all", "general", "billing", "support", "service", "fraud", "exception"];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/staff");
  };

  return (
    <div className="min-h-screen flex relative">
      <StaffBackground />
      <StaffSidebar onSignOut={handleSignOut} />
      
      <main className="flex-1 p-6 overflow-auto z-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/staff/dashboard")}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FileText className="h-6 w-6 text-teal-400" />
              Notes internes
            </h1>
          </div>
          <p className="text-slate-400 ml-14">Consultation des notes internes clients (lecture seule)</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher dans les notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {noteTypes.map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(type)}
                className={typeFilter === type ? "bg-teal-600" : ""}
              >
                {type === "all" ? "Tous" : type}
              </Button>
            ))}
          </div>
        </div>

        {/* Notes List */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Chargement...</div>
        ) : filteredNotes?.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            Aucune note trouvée
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes?.map((note) => (
              <Card key={note.id} className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500" />
                        <span className="text-white font-medium">
                          {note.profile?.full_name || "Client inconnu"}
                        </span>
                      </div>
                      <Badge className={noteTypeColors[note.note_type] || noteTypeColors.general}>
                        <Tag className="h-3 w-3 mr-1" />
                        {note.note_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(note.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 whitespace-pre-wrap mb-3">{note.body}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Par: {note.created_by_name || "Inconnu"} ({note.created_by_role})
                    </p>
                    {note.client_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/staff/clients/${note.client_id}`)}
                        className="text-teal-400 hover:text-teal-300"
                      >
                        Voir le client →
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
