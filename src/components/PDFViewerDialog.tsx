import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, FileText, AlertCircle, Loader2, RefreshCw } from "lucide-react";
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Create blob URL when dialog opens with a valid blob
  useEffect(() => {
    // Cleanup previous URL
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }

    if (open && pdfBlob && pdfBlob.size > 0) {
      try {
        // Ensure we have a proper PDF blob
        const validBlob = pdfBlob.type === "application/pdf"
          ? pdfBlob
          : new Blob([pdfBlob], { type: "application/pdf" });

        const url = URL.createObjectURL(validBlob);
        setBlobUrl(url);
        setViewerError(null);
        setIframeLoaded(false);
      } catch (err) {
        console.error("Error creating PDF URL:", err);
        setViewerError("Erreur lors du chargement du document");
      }
    } else if (open && !pdfBlob && !isLoading) {
      setViewerError("Le document PDF n'est pas disponible");
    }
    
    // Cleanup on unmount or when dialog closes
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [open, pdfBlob, isLoading, retryCount]);

  // Direct download - no popup, no new tab
  const handleDownload = useCallback(() => {
    if (!pdfBlob) return;
    
    try {
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up after download starts
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Téléchargement démarré");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Erreur lors du téléchargement");
    }
  }, [pdfBlob, filename]);

  // Print using iframe's contentWindow - no popup
  // Fallback to new tab if iframe print fails (cross-origin, mobile restrictions)
  const handlePrint = useCallback(() => {
    // Attempt 1: Direct iframe print
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.print();
        return;
      } catch {
        // Silent fail, try fallback
      }
    }
    
    // Attempt 2: Open in new tab for print (works on mobile + cross-origin)
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(url, "_blank");
      
      if (printWindow) {
        // Try to trigger print after load
        printWindow.onload = () => {
          try {
            printWindow.focus();
            printWindow.print();
          } catch {
            // User can print manually from the new tab
          }
        };
        toast.info("Le PDF s'ouvre dans un nouvel onglet. Utilisez Ctrl+P pour imprimer.");
      } else {
        // Popup blocked - offer download instead
        toast.error("Fenêtre bloquée. Téléchargez le PDF pour l'imprimer.");
      }
      
      // Cleanup after 2 minutes
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } else {
      toast.error("Le document n'est pas prêt pour l'impression");
    }
  }, [pdfBlob]);

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
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={!pdfBlob || isLoading || !iframeLoaded}
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
