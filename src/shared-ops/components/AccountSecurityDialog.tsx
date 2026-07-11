/**
 * AccountSecurityDialog — Phase 12
 * Staff-only security console: login attempts, active access sessions,
 * security lock state, pending login PINs, security events.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShieldAlert, RefreshCw, Loader2, LogOut, Unlock, KeyRound, XCircle,
  CheckCircle2, AlertTriangle, Activity, Monitor, Trash2,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  clientEmail?: string | null;
}

interface Overview {
  login_attempts: any[];
  access_sessions: any[];
  security: any | null;
  login_pins: any[];
  security_events: any[];
}

function shortUA(ua?: string | null) {
  if (!ua) return "—";
  return ua.length > 70 ? ua.slice(0, 70) + "…" : ua;
}

export function AccountSecurityDialog({ open, onClose, clientUserId, clientName, clientEmail }: Props) {
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState("sessions");

  const load = async () => {
    if (!clientUserId) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("security-account-actions", {
        body: {
          action: "list_overview",
          client_user_id: clientUserId,
          client_email: clientEmail ?? null,
        },
      });
      if (error) throw error;
      if (!res?.ok) throw new Error(res?.error || "Erreur");
      setData(res as Overview);
    } catch (e: any) {
      toast.error("Erreur chargement sécurité", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, clientUserId, clientEmail]);

  const runAction = async (action: string, extra: Record<string, any> = {}, label = action) => {
    const reason = window.prompt(`Raison pour « ${label} » (audit) :`);
    if (reason === null) return;
    if (!reason.trim()) {
      toast.warning("Une raison est requise");
      return;
    }
    setActing(action);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { data: res, error } = await supabase.functions.invoke("security-account-actions", {
        body: {
          action,
          client_user_id: clientUserId,
          client_email: clientEmail ?? null,
          reason: reason.trim(),
          idempotency_key: idempotencyKey,
          ...extra,
        },
      });
      if (error) throw error;
      if (!res?.ok) throw new Error(res?.error || "Erreur");
      toast.success("Action exécutée");
      await load();
    } catch (e: any) {
      toast.error("Action échouée", { description: e.message });
    } finally {
      setActing(null);
    }
  };

  const lockActive = useMemo(() => {
    const until = data?.security?.lock_until ? new Date(data.security.lock_until) : null;
    return until && until.getTime() > Date.now();
  }, [data]);

  const activeSessions = (data?.access_sessions ?? []).filter(
    (s) => !s.revoked_at && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now())
  );
  const pendingPins = (data?.login_pins ?? []).filter(
    (p) => !p.used && new Date(p.expires_at).getTime() > Date.now()
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-violet-400" />
            Sécurité &amp; sessions — {clientName}
          </DialogTitle>
          <DialogDescription>
            Console staff : tentatives de connexion, sessions d'accès actives, verrouillage PIN, NIP de connexion en attente, événements de sécurité.
          </DialogDescription>
        </DialogHeader>

        {lockActive && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
              <span>
                Compte verrouillé jusqu'au {new Date(data!.security!.lock_until).toLocaleString("fr-CA")}
                {` `}({data!.security!.pin_attempts} tentatives PIN)
              </span>
              <Button size="sm" variant="outline" onClick={() => runAction("clear_security_lock", {}, "Lever le verrouillage")} disabled={acting !== null}>
                <Unlock className="h-3.5 w-3.5 mr-1.5" /> Lever
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            {data ? `${activeSessions.length} session(s) active(s) · ${pendingPins.length} NIP en attente` : "—"}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => runAction("force_signout_all", {}, "Forcer déconnexion globale")}
              disabled={acting !== null}
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Forcer déconnexion (admin)
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="sessions">Sessions ({(data?.access_sessions ?? []).length})</TabsTrigger>
            <TabsTrigger value="attempts">Connexions ({(data?.login_attempts ?? []).length})</TabsTrigger>
            <TabsTrigger value="pins">NIP login ({(data?.login_pins ?? []).length})</TabsTrigger>
            <TabsTrigger value="events">Événements ({(data?.security_events ?? []).length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 -mx-6 px-6 mt-2">
            <TabsContent value="sessions" className="space-y-2 mt-0">
              {(data?.access_sessions ?? []).length === 0 ? (
                <EmptyState text="Aucune session d'accès staff." />
              ) : (
                data!.access_sessions.map((s) => {
                  const active = !s.revoked_at && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now());
                  return (
                    <div key={s.id} className="rounded-md border border-border/60 bg-card/40 p-3 flex items-start gap-3">
                      <Monitor className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={active ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]" : "text-[10px]"}>
                            {active ? "Active" : s.revoked_at ? "Révoquée" : "Expirée"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{s.ip_address || "IP inconnue"}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{shortUA(s.user_agent)}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Créée {new Date(s.created_at).toLocaleString("fr-CA")}
                          {s.expires_at && ` · expire ${new Date(s.expires_at).toLocaleString("fr-CA")}`}
                        </div>
                      </div>
                      {active && (
                        <Button size="sm" variant="outline" onClick={() => runAction("revoke_access_session", { session_id: s.id }, "Révoquer session")} disabled={acting !== null}>
                          <XCircle className="h-3.5 w-3.5 mr-1.5" /> Révoquer
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="attempts" className="space-y-2 mt-0">
              {(data?.login_attempts ?? []).length === 0 ? (
                <EmptyState text="Aucune tentative de connexion enregistrée." />
              ) : (
                data!.login_attempts.map((a) => (
                  <div key={a.id} className="rounded-md border border-border/60 bg-card/40 p-3 flex items-start gap-3">
                    {a.success ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5 text-red-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{a.success ? "Succès" : "Échec"}</span>
                        {a.portal && <Badge variant="outline" className="text-[10px]">{a.portal}</Badge>}
                        {a.failure_reason && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-300 border-red-500/30">{a.failure_reason}</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{a.ip_address || "IP inconnue"} · {shortUA(a.user_agent)}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleString("fr-CA")}</div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="pins" className="space-y-2 mt-0">
              {pendingPins.length > 0 && (
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="outline" onClick={() => runAction("invalidate_login_pins", {}, "Invalider NIP en attente")} disabled={acting !== null}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Invalider tous ({pendingPins.length})
                  </Button>
                </div>
              )}
              {(data?.login_pins ?? []).length === 0 ? (
                <EmptyState text="Aucun NIP de connexion." />
              ) : (
                data!.login_pins.map((p) => {
                  const valid = !p.used && new Date(p.expires_at).getTime() > Date.now();
                  return (
                    <div key={p.id} className="rounded-md border border-border/60 bg-card/40 p-3 flex items-start gap-3">
                      <KeyRound className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={valid ? "bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]" : "text-[10px]"}>
                            {valid ? "Valide" : p.used ? "Utilisé" : "Expiré"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{p.email}</span>
                          <span className="text-[10px] text-muted-foreground">{p.attempts ?? 0} tentative(s)</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Créé {new Date(p.created_at).toLocaleString("fr-CA")} · expire {new Date(p.expires_at).toLocaleString("fr-CA")}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="events" className="space-y-2 mt-0">
              {(data?.security_events ?? []).length === 0 ? (
                <EmptyState text="Aucun événement de sécurité." />
              ) : (
                data!.security_events.map((ev) => (
                  <div key={ev.id} className="rounded-md border border-border/60 bg-card/40 p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{ev.event_type}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        ev.severity === "critical" || ev.severity === "high"
                          ? "bg-red-500/15 text-red-300 border-red-500/30"
                          : ev.severity === "medium"
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                      }`}>{ev.severity || "info"}</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">{new Date(ev.created_at).toLocaleString("fr-CA")}</span>
                    </div>
                    {ev.details && (
                      <pre className="mt-1 text-[10px] bg-muted/30 rounded p-2 overflow-x-auto max-h-32">
{JSON.stringify(ev.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-8 text-sm text-muted-foreground">{text}</div>;
}
