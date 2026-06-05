/**
 * useClientPDF — Server-side PDF generation for the client portal.
 *
 * Calls the `client-pdf-download` edge function which uses service role
 * to generate PDFs, bypassing all RLS and browser restrictions.
 *
 * The edge function verifies ownership before generating, so no unauthorized
 * access is possible even though it uses service role internally.
 */
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { portalClient } from "@/integrations/backend/portalClient";

export type PDFDocType = "invoice" | "receipt" | "contract" | "summary";

interface PDFState {
  loading: boolean;
  error: string | null;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-pdf-download`;

/**
 * Get the portal client's current access token.
 * Returns null if not authenticated.
 */
async function getPortalToken(): Promise<string | null> {
  const { data: { session } } = await portalClient.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Download a PDF document from the server.
 * Triggers a browser file download directly.
 */
async function downloadServerPDF(
  type: PDFDocType,
  id: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ type, id }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
    return { success: false, error: err.error ?? `Erreur ${res.status}` };
  }

  // Trigger browser download
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'";\n]+)\1/);
  const filename = match ? decodeURIComponent(match[2]) : `Nivra_${type}_${id.slice(0,8)}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return { success: true };
}

/**
 * Open a PDF in a new browser tab (for viewing).
 * Falls back to download if tab is blocked.
 */
async function openServerPDF(
  type: PDFDocType,
  id: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ type, id }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
    return { success: false, error: err.error ?? `Erreur ${res.status}` };
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  // Try to open in new tab
  const tab = window.open(url, "_blank");
  if (!tab) {
    // Popup blocked — trigger download instead
    const link = document.createElement("a");
    link.href = url;
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'";\n]+)\1/);
    link.download = match ? decodeURIComponent(match[2]) : `Nivra_${type}_${id.slice(0,8)}.pdf`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.info("Fenêtre bloquée — téléchargement démarré à la place.");
  }

  // Revoke after 3 min
  setTimeout(() => URL.revokeObjectURL(url), 180_000);
  return { success: true };
}

/* ─── Hook ───────────────────────────────────────────────────── */
export function useClientPDF() {
  const [state, setState] = useState<PDFState>({ loading: false, error: null });

  const download = useCallback(async (type: PDFDocType, id: string) => {
    setState({ loading: true, error: null });
    try {
      const token = await getPortalToken();
      if (!token) throw new Error("Vous devez être connecté pour télécharger ce document.");

      const result = await downloadServerPDF(type, id, token);
      if (!result.success) throw new Error(result.error);

      toast.success("Document téléchargé");
    } catch (e: any) {
      const msg = e.message || "Erreur lors du téléchargement";
      setState((s) => ({ ...s, error: msg }));
      toast.error(msg);
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const view = useCallback(async (type: PDFDocType, id: string) => {
    setState({ loading: true, error: null });
    try {
      const token = await getPortalToken();
      if (!token) throw new Error("Vous devez être connecté pour voir ce document.");

      const result = await openServerPDF(type, id, token);
      if (!result.success) throw new Error(result.error);
    } catch (e: any) {
      const msg = e.message || "Erreur lors de l'ouverture";
      setState((s) => ({ ...s, error: msg }));
      toast.error(msg);
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  return {
    download,
    view,
    loading: state.loading,
    error: state.error,
  };
}
