/**
 * Unified PDF utilities for safe open, download, and print operations.
 * Prevents Chrome blocks, blank screens, and redirect errors.
 * All PDFs are served from the same domain using blob URLs.
 */

import { toast } from "sonner";

export interface PDFResult {
  success: boolean;
  error?: string;
  blobUrl?: string;
}

// Cache for active blob URLs to prevent memory leaks
const activeBlobUrls = new Map<string, { url: string; timestamp: number }>();

// Clean up old blob URLs (older than 5 minutes)
const cleanupOldBlobUrls = () => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  activeBlobUrls.forEach((value, key) => {
    if (now - value.timestamp > maxAge) {
      try {
        URL.revokeObjectURL(value.url);
      } catch (e) {
        console.warn("Failed to revoke URL:", e);
      }
      activeBlobUrls.delete(key);
    }
  });
};

// Run cleanup every minute
if (typeof window !== "undefined") {
  setInterval(cleanupOldBlobUrls, 60000);
}

/**
 * Creates a stable blob URL that won't be intercepted by React Router.
 * Uses data URI for small files, blob URL for larger ones.
 */
export const createStablePDFUrl = (blob: Blob): { url: string; cleanup: () => void } => {
  try {
    if (!blob || blob.size === 0) {
      return { url: "", cleanup: () => {} };
    }

    // Ensure correct MIME type
    const pdfBlob = blob.type === "application/pdf" 
      ? blob 
      : new Blob([blob], { type: "application/pdf" });

    const url = URL.createObjectURL(pdfBlob);
    const id = `pdf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    activeBlobUrls.set(id, { url, timestamp: Date.now() });

    return {
      url,
      cleanup: () => {
        try {
          URL.revokeObjectURL(url);
          activeBlobUrls.delete(id);
        } catch (e) {
          console.warn("Cleanup error:", e);
        }
      },
    };
  } catch (error) {
    console.error("Error creating PDF URL:", error);
    return { url: "", cleanup: () => {} };
  }
};

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

    // Ensure correct MIME type
    const pdfBlob = blob.type === "application/pdf" 
      ? blob 
      : new Blob([blob], { type: "application/pdf" });

    const url = URL.createObjectURL(pdfBlob);
    
    // Create a link element to avoid popup blockers
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    
    // Append to body temporarily
    document.body.appendChild(link);
    
    // Try to open
    const newWindow = window.open(url, "_blank", "noopener,noreferrer");
    
    // Remove link
    document.body.removeChild(link);
    
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      // Popup blocked - fallback to download
      console.warn("Popup blocked, falling back to download");
      safePDFDownload(pdfBlob, filename);
      toast.info("Fenêtre bloquée - téléchargement du PDF à la place");
      return { success: true, blobUrl: url };
    }

    // Clean up URL after a delay to allow the new tab to load
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 120000); // 2 minutes delay

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

    // Ensure correct MIME type
    const pdfBlob = blob.type === "application/pdf" 
      ? blob 
      : new Blob([blob], { type: "application/pdf" });

    const url = URL.createObjectURL(pdfBlob);
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
 * Safely prints a PDF blob using an iframe to avoid navigation issues.
 */
export const safePDFPrint = (blob: Blob): PDFResult => {
  try {
    if (!blob || blob.size === 0) {
      toast.error("Le fichier PDF est vide ou invalide");
      return { success: false, error: "Empty or invalid PDF blob" };
    }

    // Ensure correct MIME type
    const pdfBlob = blob.type === "application/pdf" 
      ? blob 
      : new Blob([blob], { type: "application/pdf" });

    const url = URL.createObjectURL(pdfBlob);
    
    // Create a hidden iframe for printing
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.src = url;
    
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          
          // Cleanup after print dialog
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          }, 1000);
        }, 500);
      } catch (e) {
        console.error("Print error:", e);
        // Fallback to window.open
        const printWindow = window.open(url, "_blank");
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
    };
    
    iframe.onerror = () => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
      toast.error("Erreur lors du chargement du document pour impression");
    };

    return { success: true, blobUrl: url };
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

    // Ensure correct MIME type for proper browser handling
    const pdfBlob = blob.type === "application/pdf" 
      ? blob 
      : new Blob([blob], { type: "application/pdf" });

    const { url, cleanup } = createStablePDFUrl(pdfBlob);
    
    return {
      url: url || null,
      cleanup,
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

/**
 * Converts a base64 string to a Blob for PDF handling.
 */
export const base64ToBlob = (base64: string, contentType = "application/pdf"): Blob => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: contentType });
  } catch (error) {
    console.error("Error converting base64 to blob:", error);
    return new Blob([], { type: contentType });
  }
};
