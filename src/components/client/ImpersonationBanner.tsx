/**
 * ImpersonationBanner — Discreet banner shown at the top of the client portal
 * when an admin is viewing the account in "assistance" mode.
 *
 * The token is read from the URL on mount, validated server-side via
 * `validate_impersonation_token` (which marks it consumed), and the resulting
 * client identity is persisted in sessionStorage so a refresh keeps the banner.
 *
 * Read-only enforcement: the banner exposes the active state via
 * `useImpersonationContext` so child pages / write actions can warn or block.
 */
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STORAGE_KEY = "nivra_impersonation_v1";

interface ImpersonationState {
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

function loadStored(): ImpersonationState | null {
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

interface ProviderProps {
  children: ReactNode;
}

export function ImpersonationProvider({ children }: ProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<ImpersonationState | null>(() => loadStored());
  const [validating, setValidating] = useState(false);

  // Detect ?impersonate=… on every navigation that includes it
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("impersonate");
    if (!token) return;

    setValidating(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc("validate_impersonation_token", { _token: token });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row?.is_valid) {
          toast.error("Lien d'assistance invalide ou expiré");
          return;
        }
        const next: ImpersonationState = {
          token,
          clientId: row.client_id,
          clientName: row.client_full_name,
          clientEmail: row.client_email,
          expiresAt: row.expires_at,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setState(next);
        toast.success(`Mode assistance — ${next.clientName || next.clientEmail}`, {
          description: "Session valide 30 minutes. Toutes les actions sont enregistrées.",
        });
      } catch (err: any) {
        console.error("[Impersonation] validate failed", err);
        toast.error("Impossible de valider la session d'assistance");
      } finally {
        setValidating(false);
        // Strip the token from the URL so it isn't re-used on refresh
        params.delete("impersonate");
        const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
        navigate(next, { replace: true });
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
      supabase.rpc("end_impersonation", { _token: state.token }).catch(() => {});
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setState(null);
    toast.success("Mode assistance terminé");
    window.close();
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
              <span className="font-semibold">Mode assistance</span>
              <span className="text-violet-100 truncate">
                — Vous consultez le compte de {state.clientName || state.clientEmail}
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
