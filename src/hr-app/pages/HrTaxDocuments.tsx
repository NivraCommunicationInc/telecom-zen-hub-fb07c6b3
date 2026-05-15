/**
 * HrTaxDocuments — Employee's tax document summaries (read-only).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  generated: { label: "Généré", variant: "outline" },
  sent: { label: "Envoyé", variant: "default" },
  acknowledged: { label: "Reçu", variant: "default" },
};

export default function HrTaxDocuments() {
  const { data: docs, isLoading } = useQuery({
    queryKey: ["rh-tax-documents"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("tax_documents")
        .select("*")
        .eq("employee_id", user.id)
        .order("tax_year", { ascending: false });
      return data ?? [];
    },
  });

  const handleDownload = async (pdfUrl: string) => {
    if (!pdfUrl) return;
    const { data } = await supabase.storage.from("tax-documents").createSignedUrl(pdfUrl, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" />
          Mes documents fiscaux
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sommaires fiscaux internes (T4 / RL-1)
        </p>
      </div>

      {!docs?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun document fiscal disponible.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {docs.map((doc: any) => {
            const status = STATUS_MAP[doc.status] || { label: doc.status, variant: "secondary" as const };
            return (
              <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {doc.document_type?.toUpperCase() || "Document"} — {doc.tax_year}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sommaire fiscal interne — À titre informatif uniquement
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.pdf_url && (
                      <Button size="sm" variant="outline" onClick={() => handleDownload(doc.pdf_url)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> PDF
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
