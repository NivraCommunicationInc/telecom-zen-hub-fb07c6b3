/**
 * ClientAutoPayLog
 * Lists every pre-authorized PayPal enrollment attempt for the current client,
 * with full step-by-step traceability.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClientAuth } from "@/hooks/useClientAuth";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

interface Attempt {
  id: string;
  status: string;
  current_step: string;
  steps: Array<{ step: string; status: string; at: string; [k: string]: unknown }>;
  paypal_subscription_id: string | null;
  paypal_plan_id: string | null;
  paypal_debug_id: string | null;
  error_message: string | null;
  http_status: number | null;
  started_at: string;
  completed_at: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  started: { label: "Démarré", cls: "bg-slate-500 text-white" },
  awaiting_approval: { label: "En attente d'approbation", cls: "bg-amber-500 text-white" },
  approved: { label: "Approuvé", cls: "bg-emerald-600 text-white" },
  active: { label: "Actif", cls: "bg-emerald-600 text-white" },
  failed: { label: "Échec", cls: "bg-red-600 text-white" },
  cancelled: { label: "Annulé", cls: "bg-slate-400 text-white" },
};

const ClientAutoPayLog = () => {
  const { user } = useClientAuth();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["client-autopay-attempts", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Attempt[]> => {
      const { data, error } = await portalSupabase
        .from("paypal_autopay_attempts" as any)
        .select(
          "id, status, current_step, steps, paypal_subscription_id, paypal_plan_id, paypal_debug_id, error_message, http_status, started_at, completed_at",
        )
        .eq("user_id", user!.id)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as Attempt[]) || [];
    },
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="container max-w-3xl py-6 space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/portal">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour au portail
        </Link>
      </Button>

      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-semibold">Journal du paiement pré-autorisé PayPal</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Toutes vos tentatives d'activation du paiement pré-autorisé, avec chaque étape.
      </p>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (!attempts || attempts.length === 0) && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Aucune tentative enregistrée.
          </CardContent>
        </Card>
      )}

      {attempts?.map((a) => {
        const isOpen = expanded.has(a.id);
        const badge = STATUS_BADGE[a.status] || { label: a.status, cls: "bg-muted text-foreground" };
        return (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-sm font-medium">
                    Tentative du{" "}
                    {new Date(a.started_at).toLocaleString("fr-CA", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">{a.id}</p>
                </div>
                <Badge className={badge.cls}>{badge.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Étape actuelle</p>
                  <p className="font-mono">{a.current_step}</p>
                </div>
                {a.paypal_subscription_id && (
                  <div>
                    <p className="text-muted-foreground">PayPal sub ID</p>
                    <p className="font-mono truncate">{a.paypal_subscription_id}</p>
                  </div>
                )}
                {a.paypal_debug_id && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">PayPal debug_id</p>
                    <p className="font-mono truncate">{a.paypal_debug_id}</p>
                  </div>
                )}
                {a.error_message && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Erreur</p>
                    <p className="text-destructive break-words">{a.error_message}</p>
                  </div>
                )}
              </div>

              <Button variant="ghost" size="sm" onClick={() => toggle(a.id)}>
                {isOpen ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                {isOpen ? "Masquer" : "Voir"} les étapes ({a.steps?.length || 0})
              </Button>

              {isOpen && Array.isArray(a.steps) && (
                <ol className="space-y-1 text-xs border-l-2 border-muted pl-3 ml-1">
                  {a.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full ${
                          s.status === "ok"
                            ? "bg-emerald-500"
                            : s.status === "error"
                            ? "bg-red-500"
                            : "bg-slate-400"
                        }`}
                      />
                      <div className="flex-1">
                        <p className="font-mono">{s.step}</p>
                        <p className="text-muted-foreground">
                          {new Date(s.at).toLocaleString("fr-CA", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ClientAutoPayLog;
