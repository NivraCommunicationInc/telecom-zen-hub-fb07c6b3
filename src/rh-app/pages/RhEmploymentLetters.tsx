/**
 * RhEmploymentLetters — Letters with request workflow + acknowledge + PDF.
 * Fixed: uses user_id (not employee_id).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Mail, Download, CheckCircle, Loader2, Plus, FileText, Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  approved: { label: "Approuvée", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  generated: { label: "Générée", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  sent: { label: "Envoyée", cls: "bg-primary/10 text-primary" },
  viewed: { label: "Consultée", cls: "bg-primary/10 text-primary" },
  acknowledged: { label: "Accusé reçu", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  rejected: { label: "Refusée", cls: "bg-destructive/10 text-destructive" },
};

const TYPE_LABELS: Record<string, string> = {
  offer: "Lettre d'offre",
  confirmation: "Confirmation d'emploi",
  reference: "Lettre de référence",
  termination: "Avis de cessation",
  promotion: "Avis de promotion",
};

const REQUESTABLE_TYPES = [
  { value: "confirmation", label: "Confirmation d'emploi" },
  { value: "reference", label: "Lettre de référence" },
];

export default function RhEmploymentLetters() {
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestType, setRequestType] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: userId } = useQuery({
    queryKey: ["rh-user-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
  });

  const { data: letters, isLoading } = useQuery({
    queryKey: ["rh-employment-letters", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("employment_letters")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (letterId: string) => {
      const { error } = await supabase
        .from("employment_letters")
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
        .eq("id", letterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh-employment-letters"] });
      toast.success("Accusé de réception enregistré");
    },
    onError: () => toast.error("Erreur lors de l'accusé de réception"),
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !requestType) throw new Error("Données manquantes");
      const { error } = await supabase
        .from("employment_letters")
        .insert({
          user_id: userId,
          letter_type: requestType,
          status: "pending",
          notes: requestNotes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande de lettre soumise");
      setRequestOpen(false);
      setRequestType("");
      setRequestNotes("");
      queryClient.invalidateQueries({ queryKey: ["rh-employment-letters"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la demande"),
  });

  const handleDownload = async (pdfUrl: string) => {
    if (!pdfUrl) return;
    const { data } = await supabase.storage.from("employment-letters").createSignedUrl(pdfUrl, 300);
    if (data?.signedUrl) {
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = "lettre-emploi.pdf";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Téléchargement démarré");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Mes lettres d'emploi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Offres, confirmations, références et documents d'emploi</p>
        </div>
        <Button size="sm" onClick={() => setRequestOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Demander une lettre
        </Button>
      </div>

      {!letters?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p>Aucune lettre d'emploi disponible.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setRequestOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Faire une demande
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {letters.map((letter: any) => {
            const sts = STATUS_MAP[letter.status] || { label: letter.status, cls: "bg-muted text-muted-foreground" };
            const canAcknowledge = letter.status === "sent" || letter.status === "viewed";
            return (
              <Card key={letter.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {TYPE_LABELS[letter.letter_type] || letter.letter_type}
                      </span>
                      <Badge className={cn("text-[10px] font-semibold", sts.cls)}>{sts.label}</Badge>
                      {letter.letter_number && (
                        <span className="text-[10px] text-muted-foreground">#{letter.letter_number}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(letter.created_at), "d MMMM yyyy", { locale: fr })}
                      {letter.notes && <span className="ml-2 italic">· {letter.notes}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {letter.pdf_url && (
                      <Button size="sm" variant="outline" onClick={() => handleDownload(letter.pdf_url)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> PDF
                      </Button>
                    )}
                    {canAcknowledge && (
                      <Button
                        size="sm"
                        onClick={() => acknowledgeMutation.mutate(letter.id)}
                        disabled={acknowledgeMutation.isPending}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Accuser réception
                      </Button>
                    )}
                    {letter.status === "pending" && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 gap-1">
                        <Clock className="h-3 w-3" /> En traitement
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Request letter dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Demander une lettre d'emploi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type de lettre *</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger><SelectValue placeholder="Choisir un type..." /></SelectTrigger>
                <SelectContent>
                  {REQUESTABLE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Précisions sur votre demande..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Annuler</Button>
            <Button onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending || !requestType}>
              {requestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
