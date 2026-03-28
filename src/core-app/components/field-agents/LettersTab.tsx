import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FileText, Plus, Download, Send, Loader2, Eye } from "lucide-react";

interface Agent {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface LettersTabProps {
  agents: Agent[];
  getName: (id: string) => string;
  invalidateAll: () => void;
  logAudit: (action: string, entityType: string, entityId: string, details?: Record<string, unknown>) => void;
  notifyEmployee: (userId: string, title: string, message: string, type?: string) => void;
}

const LETTER_TYPES: Record<string, string> = {
  confirmation: "Confirmation d'emploi",
  offer: "Offre d'emploi",
  reference: "Lettre de référence",
  termination: "Fin d'emploi",
  promotion: "Promotion",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  sent: { label: "Envoyée", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  viewed: { label: "Consultée", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
  acknowledged: { label: "Confirmée", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
};

export default function LettersTab({ agents, getName, invalidateAll, logAudit, notifyEmployee }: LettersTabProps) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [letterType, setLetterType] = useState("confirmation");
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: letters = [], isLoading } = useQuery({
    queryKey: ["employment-letters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employment_letters")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const agent = agents.find((a) => a.user_id === selectedAgent);
      if (!agent) throw new Error("Agent non trouvé");

      const { data, error } = await supabase
        .from("employment_letters")
        .insert({
          user_id: selectedAgent,
          letter_type: letterType,
          status: "draft",
          notes,
          created_by: (await supabase.auth.getUser()).data.user?.id || "",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Lettre créée avec succès");
      logAudit("create_employment_letter", "employment_letter", data.id, { letter_type: letterType, employee_id: selectedAgent });
      queryClient.invalidateQueries({ queryKey: ["employment-letters"] });
      setShowCreate(false);
      setSelectedAgent("");
      setNotes("");
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const handleGeneratePdf = async (letter: any) => {
    setGenerating(letter.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("generate-employment-letter-pdf", {
        body: { employment_letter_id: letter.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (res.error) throw res.error;
      toast.success("PDF généré avec succès");
      logAudit("generate_letter_pdf", "employment_letter", letter.id);
      queryClient.invalidateQueries({ queryKey: ["employment-letters"] });
    } catch (e: any) {
      toast.error("Erreur génération PDF: " + (e.message || "inconnue"));
    } finally {
      setGenerating(null);
    }
  };

  const handleSend = async (letter: any) => {
    const { error } = await supabase
      .from("employment_letters")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", letter.id);

    if (error) {
      toast.error("Erreur lors de l'envoi");
      return;
    }

    notifyEmployee(
      letter.user_id,
      "Nouvelle lettre d'emploi",
      `Une lettre de type "${LETTER_TYPES[letter.letter_type] || letter.letter_type}" est disponible dans votre portail.`,
      "document"
    );
    logAudit("send_employment_letter", "employment_letter", letter.id);
    toast.success("Lettre envoyée et employé notifié");
    queryClient.invalidateQueries({ queryKey: ["employment-letters"] });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Lettres d'emploi</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle lettre
        </Button>
      </div>

      {letters.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>Aucune lettre d'emploi</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Employé</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Statut</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Créée le</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {letters.map((letter: any) => {
                const badge = STATUS_BADGE[letter.status] || STATUS_BADGE.draft;
                return (
                  <tr key={letter.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{getName(letter.employee_id)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{LETTER_TYPES[letter.letter_type] || letter.letter_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(letter.created_at), "d MMM yyyy", { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={generating === letter.id}
                        onClick={() => handleGeneratePdf(letter)}
                      >
                        {generating === letter.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                      </Button>
                      {letter.pdf_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={letter.pdf_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      {letter.status === "draft" && letter.pdf_url && (
                        <Button size="sm" variant="default" onClick={() => handleSend(letter)}>
                          <Send className="h-3 w-3 mr-1" /> Envoyer
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle lettre d'emploi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employé</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un employé" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email || a.user_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type de lettre</Label>
              <Select value={letterType} onValueChange={setLetterType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LETTER_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optionnel)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes internes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button disabled={!selectedAgent || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
