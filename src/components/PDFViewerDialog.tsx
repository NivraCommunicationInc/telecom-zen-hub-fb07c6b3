import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, FileText, AlertCircle, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { safePDFDownload, safePDFPrint, safePDFOpen, createStablePDFUrl } from "@/lib/pdfUtils";
import { toast } from "sonner";

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
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Create blob URL when dialog opens with a valid blob
  useEffect(() => {
    // Cleanup previous URL
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (open && pdfBlob && pdfBlob.size > 0) {
      try {
        // Ensure we have a proper PDF blob
        const validBlob = pdfBlob.type === "application/pdf"
          ? pdfBlob
          : new Blob([pdfBlob], { type: "application/pdf" });

        const { url, cleanup } = createStablePDFUrl(validBlob);
        
        if (url) {
          setBlobUrl(url);
          setViewerError(null);
          setIframeLoaded(false);
          cleanupRef.current = cleanup;
        } else {
          setViewerError("Impossible de créer l'URL du document");
        }
      } catch (err) {
        console.error("Error creating PDF URL:", err);
        setViewerError("Erreur lors du chargement du document");
      }
    } else if (open && !pdfBlob && !isLoading) {
      setViewerError("Le document PDF n'est pas disponible");
    }
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setBlobUrl(null);
      setIframeLoaded(false);
    };
  }, [open, pdfBlob, isLoading, retryCount]);

  const handleDownload = useCallback(() => {
    if (pdfBlob) {
      const result = safePDFDownload(pdfBlob, filename);
      if (result.success) {
        toast.success("Téléchargement démarré");
      }
    }
  }, [pdfBlob, filename]);

  const handlePrint = useCallback(() => {
    if (pdfBlob) {
      safePDFPrint(pdfBlob);
    }
  }, [pdfBlob]);

  const handleOpenExternal = useCallback(() => {
    if (pdfBlob) {
      safePDFOpen(pdfBlob, filename);
    }
  }, [pdfBlob, filename]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
    setViewerError(null);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    setViewerError(null);
  }, []);

  const handleIframeError = useCallback(() => {
    setViewerError("Erreur lors du chargement du visualiseur PDF");
  }, []);

  const displayError = error || viewerError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={handleClose}
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
                variant="ghost"
                size="sm"
                onClick={handleOpenExternal}
                disabled={!pdfBlob || isLoading}
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Nouvel onglet
              </Button>
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
        <div className="flex-1 overflow-hidden bg-muted/20 relative">
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
                <p className="text-muted-foreground max-w-md mb-4">
                  {displayError}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Réessayer
                </Button>
                {pdfBlob && (
                  <Button variant="default" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger à la place
                  </Button>
                )}
                <Button variant="ghost" onClick={handleClose}>
                  Fermer
                </Button>
              </div>
            </div>
          ) : blobUrl ? (
            <>
              {/* Loading overlay while iframe loads */}
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                    <p className="text-sm text-muted-foreground">Rendu du PDF...</p>
                  </div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={`${blobUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
                className="w-full h-full border-0"
                title={title}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <FileText className="w-16 h-16 text-muted-foreground" />
              <p className="text-muted-foreground">Aucun document à afficher</p>
              <Button variant="outline" onClick={handleClose}>
                Fermer
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewerDialog;
