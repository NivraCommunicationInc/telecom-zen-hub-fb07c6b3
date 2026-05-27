/**
 * AutoDocumentsTab — affiche les documents auto-générés (Lots 2-5)
 * pour le client connecté. Lecture depuis client_auto_documents +
 * téléchargement via signed URL (bucket privé).
 */
import { portalClient as supabase } from "@/integrations/backend/portalClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Calendar, Mail, MailCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { DOC_TYPE_LABELS, type AutoDocType } from "@/lib/pdf/autoDocumentDispatcher";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

interface AutoDocumentsTabProps {
  userId: string | undefined;
}

const STORAGE_BUCKET = "client-documents";

export function AutoDocumentsTab({ userId }: AutoDocumentsTabProps) {
  const { data: canonicalData, isLoading } = useCanonicalClientData(userId);
  const docs = [
    ...((canonicalData?.autoDocuments || []).map((doc: any) => ({ ...doc, source: "auto", title: DOC_TYPE_LABELS[doc.doc_type as AutoDocType] || doc.doc_type, date: doc.created_at }))),
    ...((canonicalData?.clientDocuments || []).map((doc: any) => ({ ...doc, source: "client", title: doc.document_name || doc.document_type || "Document", date: doc.created_at, directUrl: doc.document_url }))),
    ...((canonicalData?.orderDocuments || []).map((doc: any) => ({ ...doc, source: "order", title: doc.file_name || doc.doc_type || "Document de commande", date: doc.created_at || doc.generated_at, directUrl: doc.pdf_url }))),
  ].sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const handleDownload = async (doc: any) => {
    try {
      if (doc.directUrl) {
        window.open(doc.directUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(doc.storage_path, 60);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "URL signée indisponible");
      }
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = `${doc.doc_type || doc.document_type || "document"}_${doc.doc_number || doc.id || "document"}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Document téléchargé");
    } catch (err: any) {
      console.error("download err:", err);
      toast.error("Téléchargement impossible : " + err.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-500" />
          Documents officiels
        </CardTitle>
        <CardDescription>
          Tous les documents administratifs et légaux émis automatiquement sur votre compte
          (lettre de bienvenue, avis de suspension, confirmations, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground mt-2">Chargement...</p>
          </div>
        ) : docs.length > 0 ? (
          <div className="space-y-3">
            {docs.map((doc) => {
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border hover:border-cyan-500/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border shrink-0">
                      <FileText className="w-5 h-5 text-cyan-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {doc.title}
                        {doc.doc_number ? <span className="text-muted-foreground"> — {doc.doc_number}</span> : null}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(doc.date), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                        {doc.email_sent ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-xs">
                            <MailCheck className="w-3 h-3 mr-1" />
                            Envoyé par courriel
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Mail className="w-3 h-3 mr-1" />
                            Disponible
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Télécharger</span>
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Aucun document officiel émis pour l'instant</p>
            <p className="text-xs mt-1">
              Les documents (suspension, activation, confirmations, etc.) apparaîtront ici automatiquement.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
