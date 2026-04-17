/**
 * ImpersonationBanner — "Mode assistance" banner shown at the top of the
 * client portal when an admin is viewing the account in support mode.
 *
 * The token can arrive via two channels:
 *   1. URL query param ?impersonate=<token> (primary, set by the opener tab)
 *   2. localStorage key IMPERSONATION_PENDING_KEY (fallback for popups that
 *      lost the URL during navigation, set by useImpersonation BEFORE open)
 *
 * Once validated server-side via validate_impersonation_token, the resulting
 * client identity is persisted in sessionStorage so the banner survives
 * refreshes and tab navigation within the portal.
 */
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { IMPERSONATION_PENDING_KEY } from "@/hooks/useImpersonation";

const STORAGE_KEY = "nivra_impersonation_v1";

export interface ImpersonationState {
  token: string;
  clientId: string;
  clientName: string | null;
  clientEmail: string | null;
  expiresAt: string;
}

interface ImpersonationContextValue {
  active: boolean;
  state: ImpersonationState | null;
  exit: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextValue>({
  active: false,
  state: null,
  exit: () => {},
});

export function useImpersonationContext() {
  return useContext(ImpersonationContext);
}

/**
 * Synchronous reader used by ClientAuthProvider during initial render so it
 * can synthesise the impersonated identity before any data fetch fires.
 */
export function readStoredImpersonation(): ImpersonationState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImpersonationState;
    if (!parsed?.token || !parsed?.clientId) return null;
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Pull a pending token (URL or localStorage handoff) without consuming the
 * server-side session — used by ClientAuthProvider to know it must validate
 * before authorising the route.
 */
export function readPendingImpersonationToken(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("impersonate");
    if (fromUrl) return fromUrl;
    const raw = localStorage.getItem(IMPERSONATION_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; expiresAt?: string };
    if (!parsed?.token) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(IMPERSONATION_PENDING_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

interface ProviderProps {
  children: ReactNode;
}

export function ImpersonationProvider({ children }: ProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<ImpersonationState | null>(() => readStoredImpersonation());

  // Detect ?impersonate=… or localStorage handoff and validate
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlToken = params.get("impersonate");

    let pendingToken: string | null = urlToken;
    if (!pendingToken) {
      try {
        const raw = localStorage.getItem(IMPERSONATION_PENDING_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { token?: string; expiresAt?: string };
          if (parsed?.token && (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() > Date.now())) {
            pendingToken = parsed.token;
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (!pendingToken) return;

    // If we already have a valid stored session for this exact token, skip.
    if (state?.token === pendingToken) {
      // Just clean up URL/handoff
      try {
        localStorage.removeItem(IMPERSONATION_PENDING_KEY);
      } catch {
        /* ignore */
      }
      if (urlToken) {
        params.delete("impersonate");
        const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        navigate(next, { replace: true });
      }
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.rpc("validate_impersonation_token", {
          _token: pendingToken,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!(row as any)?.is_valid) {
          toast.error("Lien d'assistance invalide ou expiré");
          return;
        }
        const next: ImpersonationState = {
          token: pendingToken!,
          clientId: (row as any).client_id,
          clientName: (row as any).client_full_name,
          clientEmail: (row as any).client_email,
          expiresAt: (row as any).expires_at,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setState(next);
        toast.success(`Mode assistance — ${next.clientName || next.clientEmail || "client"}`, {
          description: "Session valide 30 minutes. Toutes les actions sont enregistrées.",
        });
      } catch (err: any) {
        console.error("[Impersonation] validate failed", err);
        toast.error("Impossible de valider la session d'assistance");
      } finally {
        try {
          localStorage.removeItem(IMPERSONATION_PENDING_KEY);
        } catch {
          /* ignore */
        }
        if (urlToken) {
          params.delete("impersonate");
          const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
          navigate(next, { replace: true });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Auto-expire timer
  useEffect(() => {
    if (!state) return;
    const ms = new Date(state.expiresAt).getTime() - Date.now();
    if (ms <= 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      setState(null);
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.removeItem(STORAGE_KEY);
      setState(null);
      toast.info("Session d'assistance expirée");
    }, ms);
    return () => clearTimeout(t);
  }, [state]);

  const exit = () => {
    if (state?.token) {
      void Promise.resolve(supabase.rpc("end_impersonation", { _token: state.token })).then(
        () => {},
        () => {},
      );
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setState(null);
    toast.success("Mode assistance terminé");
    // Try to close the tab; if the browser refuses (tab was not script-opened
    // in some cases), fall back to redirecting to the Core admin.
    setTimeout(() => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
      // If close failed (window still open), redirect to Core
      if (!window.closed) {
        window.location.href = "/core";
      }
    }, 150);
  };

  const value = useMemo<ImpersonationContextValue>(
    () => ({ active: !!state, state, exit }),
    [state],
  );

  return (
    <ImpersonationContext.Provider value={value}>
      {state && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[60] w-full bg-violet-600 text-white shadow-md"
        >
          <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="h-4 w-4 shrink-0" />
              <span className="font-semibold">👁 Mode assistance</span>
              <span className="text-violet-100 truncate">
                — Vous consultez le compte de {state.clientName || state.clientEmail || "client"}
              </span>
            </div>
            <button
              type="button"
              onClick={exit}
              className="inline-flex items-center gap-1 rounded-md bg-white/15 hover:bg-white/25 px-2.5 py-1 text-xs font-medium transition-colors shrink-0"
            >
              Quitter <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
      {children}
    </ImpersonationContext.Provider>
  );
}
