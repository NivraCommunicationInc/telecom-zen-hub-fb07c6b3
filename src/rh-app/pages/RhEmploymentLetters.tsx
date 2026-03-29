/**
 * RhEmploymentLetters — Employee's employment letters (read-only + acknowledge).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Download, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  sent: { label: "Envoyé", variant: "outline" },
  viewed: { label: "Consulté", variant: "outline" },
  acknowledged: { label: "Accusé reçu", variant: "default" },
};

const TYPE_LABELS: Record<string, string> = {
  offer: "Lettre d'offre",
  confirmation: "Confirmation d'emploi",
  reference: "Lettre de référence",
  termination: "Avis de cessation",
  promotion: "Avis de promotion",
};

export default function RhEmploymentLetters() {
  const queryClient = useQueryClient();

  const { data: letters, isLoading } = useQuery({
    queryKey: ["rh-employment-letters"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("employment_letters")
        .select("*")
        .eq("employee_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
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
  });

  const handleDownload = async (pdfUrl: string) => {
    if (!pdfUrl) return;
    const { data } = await supabase.storage.from("employment-letters").createSignedUrl(pdfUrl, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Mail className="h-6 w-6 text-indigo-600" />
          Mes lettres d'emploi
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Offres, confirmations et documents d'emploi</p>
      </div>

      {!letters?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune lettre d'emploi disponible.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {letters.map((letter: any) => {
            const status = STATUS_MAP[letter.status] || { label: letter.status, variant: "secondary" as const };
            const canAcknowledge = letter.status === "sent" || letter.status === "viewed";
            return (
              <Card key={letter.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {TYPE_LABELS[letter.letter_type] || letter.letter_type}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(letter.created_at).toLocaleDateString("fr-CA")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {letter.pdf_url && (
                      <Button size="sm" variant="outline" onClick={() => handleDownload(letter.pdf_url)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> PDF
                      </Button>
                    )}
                    {canAcknowledge && (
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-violet-600 hover:bg-violet-700"
                        onClick={() => acknowledgeMutation.mutate(letter.id)}
                        disabled={acknowledgeMutation.isPending}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Accuser réception
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
