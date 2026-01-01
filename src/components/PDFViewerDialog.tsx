import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, FileText, AlertCircle, Loader2 } from "lucide-react";
import { safePDFDownload, safePDFPrint, getPDFBlobUrl } from "@/lib/pdfUtils";

interface PDFViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBlob: Blob | null;
  title: string;
  filename: string;
  isLoading?: boolean;
  error?: string | null;
}

const PDFViewerDialog = ({
  open,
  onOpenChange,
  pdfBlob,
  title,
  filename,
  isLoading = false,
  error = null,
}: PDFViewerDialogProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

  // Create blob URL when dialog opens with a valid blob
  useEffect(() => {
    if (open && pdfBlob && pdfBlob.size > 0) {
      const { url, cleanup } = getPDFBlobUrl(pdfBlob);
      setBlobUrl(url);
      setViewerError(null);
      
      return () => {
        cleanup();
        setBlobUrl(null);
      };
    } else if (open && !pdfBlob && !isLoading) {
      setViewerError("Le document PDF n'est pas disponible");
    }
    
    return () => {
      setBlobUrl(null);
    };
  }, [open, pdfBlob, isLoading]);

  const handleDownload = useCallback(() => {
    if (pdfBlob) {
      safePDFDownload(pdfBlob, filename);
    }
  }, [pdfBlob, filename]);

  const handlePrint = useCallback(() => {
    if (pdfBlob) {
      safePDFPrint(pdfBlob);
    }
  }, [pdfBlob]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const displayError = error || viewerError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-cyan-500" />
              {title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={!pdfBlob || isLoading}
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimer
              </Button>
              <Button
                variant="hero"
                size="sm"
                onClick={handleDownload}
                disabled={!pdfBlob || isLoading}
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </Button>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-muted/20">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
              <p className="text-muted-foreground">Chargement du document...</p>
            </div>
          ) : displayError ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
              <AlertCircle className="w-16 h-16 text-destructive" />
              <div className="text-center">
                <p className="text-lg font-medium text-destructive mb-2">
                  Erreur de chargement
                </p>
                <p className="text-muted-foreground max-w-md">
                  {displayError}
                </p>
              </div>
              <Button variant="outline" onClick={handleClose}>
                Fermer
              </Button>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={title}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <FileText className="w-16 h-16 text-muted-foreground" />
              <p className="text-muted-foreground">Aucun document à afficher</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewerDialog;
