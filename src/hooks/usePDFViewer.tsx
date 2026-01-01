import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface PDFViewerState {
  isOpen: boolean;
  pdfBlob: Blob | null;
  title: string;
  filename: string;
  isLoading: boolean;
  error: string | null;
}

const initialState: PDFViewerState = {
  isOpen: false,
  pdfBlob: null,
  title: "",
  filename: "",
  isLoading: false,
  error: null,
};

/**
 * Hook for managing PDF viewer state and operations.
 * Provides a consistent interface for opening, generating, and viewing PDFs.
 */
export const usePDFViewer = () => {
  const [state, setState] = useState<PDFViewerState>(initialState);
  const generatorRef = useRef<(() => Blob) | null>(null);

  /**
   * Opens the PDF viewer with a pre-generated blob
   */
  const openWithBlob = useCallback((blob: Blob, title: string, filename: string) => {
    if (!blob || blob.size === 0) {
      toast.error("Le document PDF est vide ou invalide");
      return;
    }

    setState({
      isOpen: true,
      pdfBlob: blob,
      title,
      filename,
      isLoading: false,
      error: null,
    });
  }, []);

  /**
   * Opens the PDF viewer and generates the PDF using a generator function.
   * Shows loading state while generating.
   */
  const openWithGenerator = useCallback(
    async (
      generator: () => Blob | Promise<Blob>,
      title: string,
      filename: string
    ) => {
      setState((prev) => ({
        ...prev,
        isOpen: true,
        title,
        filename,
        isLoading: true,
        error: null,
        pdfBlob: null,
      }));

      try {
        const blob = await Promise.resolve(generator());
        
        if (!blob || blob.size === 0) {
          throw new Error("Le document généré est vide");
        }

        setState((prev) => ({
          ...prev,
          pdfBlob: blob,
          isLoading: false,
          error: null,
        }));
      } catch (error) {
        console.error("PDF generation error:", error);
        const errorMessage = error instanceof Error ? error.message : "Erreur lors de la génération du PDF";
        
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        
        toast.error(errorMessage);
      }
    },
    []
  );

  /**
   * Closes the PDF viewer and resets state
   */
  const close = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Updates the open state
   */
  const setOpen = useCallback((open: boolean) => {
    if (!open) {
      close();
    } else {
      setState((prev) => ({ ...prev, isOpen: true }));
    }
  }, [close]);

  /**
   * Retry loading the PDF
   */
  const retry = useCallback(() => {
    if (generatorRef.current) {
      const generator = generatorRef.current;
      openWithGenerator(generator, state.title, state.filename);
    }
  }, [openWithGenerator, state.title, state.filename]);

  return {
    // State
    isOpen: state.isOpen,
    pdfBlob: state.pdfBlob,
    title: state.title,
    filename: state.filename,
    isLoading: state.isLoading,
    error: state.error,
    
    // Actions
    openWithBlob,
    openWithGenerator,
    close,
    setOpen,
    retry,
  };
};

export default usePDFViewer;
