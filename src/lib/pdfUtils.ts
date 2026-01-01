/**
 * Unified PDF utilities for safe open, download, and print operations.
 * Prevents Chrome blocks, blank screens, and redirect errors.
 */

import { toast } from "sonner";

export interface PDFResult {
  success: boolean;
  error?: string;
  blobUrl?: string;
}

/**
 * Safely opens a PDF blob in a new tab using object URL.
 * Falls back to download if popup is blocked.
 */
export const safePDFOpen = (blob: Blob, filename: string): PDFResult => {
  try {
    if (!blob || blob.size === 0) {
      toast.error("Le fichier PDF est vide ou invalide");
      return { success: false, error: "Empty or invalid PDF blob" };
    }

    const url = URL.createObjectURL(blob);
    
    // Try to open in new tab
    const newWindow = window.open(url, "_blank", "noopener,noreferrer");
    
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      // Popup blocked - fallback to download
      console.warn("Popup blocked, falling back to download");
      safePDFDownload(blob, filename);
      toast.info("Fenêtre bloquée - téléchargement du PDF à la place");
      return { success: true, blobUrl: url };
    }

    // Clean up URL after a delay to allow the new tab to load
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000); // 1 minute delay

    return { success: true, blobUrl: url };
  } catch (error) {
    console.error("Error opening PDF:", error);
    toast.error("Erreur lors de l'ouverture du PDF");
    return { success: false, error: String(error) };
  }
};

/**
 * Safely downloads a PDF blob as a file.
 */
export const safePDFDownload = (blob: Blob, filename: string): PDFResult => {
  try {
    if (!blob || blob.size === 0) {
      toast.error("Le fichier PDF est vide ou invalide");
      return { success: false, error: "Empty or invalid PDF blob" };
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    link.style.display = "none";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up URL after download starts
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    return { success: true, blobUrl: url };
  } catch (error) {
    console.error("Error downloading PDF:", error);
    toast.error("Erreur lors du téléchargement du PDF");
    return { success: false, error: String(error) };
  }
};

/**
 * Safely prints a PDF blob.
 */
export const safePDFPrint = (blob: Blob): PDFResult => {
  try {
    if (!blob || blob.size === 0) {
      toast.error("Le fichier PDF est vide ou invalide");
      return { success: false, error: "Empty or invalid PDF blob" };
    }

    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    
    if (printWindow) {
      printWindow.onload = () => {
        try {
          printWindow.print();
        } catch (e) {
          console.error("Print error:", e);
        }
      };
      
      // Cleanup after print dialog closes
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
      
      return { success: true, blobUrl: url };
    } else {
      toast.error("Impossible d'ouvrir la fenêtre d'impression");
      URL.revokeObjectURL(url);
      return { success: false, error: "Print window blocked" };
    }
  } catch (error) {
    console.error("Error printing PDF:", error);
    toast.error("Erreur lors de l'impression");
    return { success: false, error: String(error) };
  }
};

/**
 * Gets a blob URL for embedding in an iframe viewer.
 * Returns the URL and a cleanup function.
 */
export const getPDFBlobUrl = (blob: Blob): { url: string | null; cleanup: () => void } => {
  try {
    if (!blob || blob.size === 0) {
      return { url: null, cleanup: () => {} };
    }

    const url = URL.createObjectURL(blob);
    return {
      url,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    console.error("Error creating blob URL:", error);
    return { url: null, cleanup: () => {} };
  }
};

/**
 * Validates that a PDF blob is valid.
 */
export const validatePDFBlob = (blob: Blob): boolean => {
  if (!blob) return false;
  if (blob.size === 0) return false;
  if (blob.type && !blob.type.includes("pdf") && !blob.type.includes("octet-stream")) {
    return false;
  }
  return true;
};
