/**
 * AISuggestionPanel — appelle core-ai-suggest et affiche la suggestion + actions recommandées.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { ACTIONS } from "./actionsRegistry";
import type { PickedClient } from "./ClientPicker";

interface Suggestion {
  summary: string;
  actions: { id: string; reason: string }[];
}

interface Props {
  client: PickedClient | null;
}

export default function AISuggestionPanel({ client }: Props) {
  const [loading, setLoading] = useState(false);
  const [sugg, setSugg] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (!client) return;
    setLoading(true); setError(null); setSugg(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("core-ai-suggest", {
        body: { customerId: client.id },
      });
      if (fnErr) throw fnErr;
      setSugg(data as Suggestion);
    } catch (e: any) {
      setError(e?.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  };

  if (!client) {
    return (
      <div className="p-4 rounded-xl border border-core-border bg-core-card text-sm text-core-text-secondary">
        <Sparkles className="w-4 h-4 inline mr-2 text-core-accent" />
        Sélectionnez un client pour obtenir une suggestion IA contextuelle.
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-core-accent/30 bg-gradient-to-br from-core-accent/5 to-transparent space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-core-text-primary flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-core-accent" /> Suggestion Nivra AI
        </h3>
        <Button size="sm" variant="ghost" onClick={ask} disabled={loading} className="text-xs">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          <span className="ml-1">{sugg ? "Régénérer" : "Analyser"}</span>
        </Button>
      </div>

      {error && <div className="text-xs text-core-danger">{error}</div>}

      {!sugg && !loading && !error && (
        <p className="text-xs text-core-text-label">Cliquez sur « Analyser » pour générer une recommandation IA basée sur le profil, la facturation et les tickets du client.</p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-core-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours…
        </div>
      )}

      {sugg && (
        <>
          <p className="text-sm text-core-text-primary leading-relaxed whitespace-pre-wrap">{sugg.summary}</p>
          {sugg.actions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-core-text-label">Actions recommandées</p>
              {sugg.actions.map((rec) => {
                const action = ACTIONS.find((a) => a.id === rec.id);
                if (!action) return null;
                const Icon = action.icon;
                const href = action.hrefBuilder({ customerId: client.id, userId: client.user_id, email: client.email });
                return (
                  <Link
                    key={rec.id}
                    to={href}
                    className="flex items-center gap-2 p-2 rounded-lg border border-core-border-strong bg-core-card-raised hover:bg-core-card transition group"
                  >
                    <Icon className="w-4 h-4 text-core-accent shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-core-text-primary truncate">{action.label}</p>
                      <p className="text-xs text-core-text-secondary truncate">{rec.reason}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-core-text-label group-hover:text-core-accent shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
