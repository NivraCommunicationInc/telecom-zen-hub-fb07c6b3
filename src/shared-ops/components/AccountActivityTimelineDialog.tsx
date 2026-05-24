/**
 * AccountActivityTimelineDialog — Phase 10
 * Unified, read-only timeline merging admin_audit_log entries (account_ops.*)
 * with email_send_log entries for the client. Staff-only view.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, History, Mail, Shield, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  clientUserId: string;
  clientName: string;
  clientEmail?: string | null;
  accountId?: string | null;
}

type TimelineItem = {
  id: string;
  kind: "audit" | "email";
  ts: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: "default" | "success" | "warning" | "danger" | "violet";
  details?: Record<string, any> | null;
  actor?: string | null;
};

const toneClass: Record<string, string> = {
  default: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

function emailStatusTone(status: string): TimelineItem["badgeTone"] {
  if (status === "sent") return "success";
  if (status === "pending") return "default";
  if (status === "failed" || status === "dlq" || status === "bounced" || status === "complained") return "danger";
  return "default";
}

function auditTone(action: string): TimelineItem["badgeTone"] {
  if (action.includes("cancel") || action.includes("reject") || action.includes("suspend") || action.includes("restrict")) return "danger";
  if (action.includes("approve") || action.includes("activate") || action.includes("paid") || action.includes("resolved")) return "success";
  if (action.includes("pause") || action.includes("reminder") || action.includes("warning") || action.includes("collections")) return "warning";
  if (action.startsWith("account_ops.")) return "violet";
  return "default";
}

function humanizeAction(action: string): string {
  return action
    .replace(/^account_ops\./, "")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AccountActivityTimelineDialog({
  open, onClose, clientUserId, clientName, clientEmail, accountId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [tab, setTab] = useState<"all" | "audit" | "email">("all");

  const load = async () => {
    if (!clientUserId) return;
    setLoading(true);
    try {
      const ids = [clientUserId, accountId].filter(Boolean) as string[];
      const auditQ = supabase
        .from("admin_audit_log")
        .select("id, action, details, created_at, admin_email, target_type, target_id, target_email")
        .in("target_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);

      const emailQ = clientEmail
        ? supabase
            .from("email_send_log")
            .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at")
            .eq("recipient_email", clientEmail)
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] as any[], error: null });

      const [{ data: audit, error: auditErr }, { data: emails, error: emailErr }] = await Promise.all([
        auditQ, emailQ as any,
      ]);
      if (auditErr) throw auditErr;
      if (emailErr) throw emailErr;

      const list: TimelineItem[] = [];
      for (const a of audit ?? []) {
        list.push({
          id: `a-${a.id}`,
          kind: "audit",
          ts: a.created_at,
          title: humanizeAction(a.action),
          subtitle: a.target_type ? `Cible: ${a.target_type}` : undefined,
          badge: a.action.startsWith("account_ops.") ? "Action staff" : "Audit",
          badgeTone: auditTone(a.action),
          details: a.details,
          actor: a.admin_email,
        });
      }
      // Deduplicate emails by message_id (keep latest status)
      const seen = new Set<string>();
      for (const e of emails ?? []) {
        const key = e.message_id || e.id;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({
          id: `e-${e.id}`,
          kind: "email",
          ts: e.created_at,
          title: e.template_name || "Email",
          subtitle: e.recipient_email,
          badge: e.status,
          badgeTone: emailStatusTone(e.status),
          details: { error: e.error_message, ...(e.metadata as any) },
        });
      }
      list.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
      setItems(list);
    } catch (e: any) {
      toast.error("Erreur chargement historique", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (open) {
      load();
    }
  }, [open, clientUserId, clientEmail, accountId]);

  const filtered = useMemo(
    () => items.filter((i) => tab === "all" || i.kind === tab),
    [items, tab]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-violet-400" />
            Historique & activité — {clientName}
          </DialogTitle>
          <DialogDescription>
            Journal unifié des actions staff et des emails envoyés (lecture seule).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1">
            <TabsList>
              <TabsTrigger value="all">Tout ({items.length})</TabsTrigger>
              <TabsTrigger value="audit">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Actions ({items.filter((i) => i.kind === "audit").length})
              </TabsTrigger>
              <TabsTrigger value="email">
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Emails ({items.filter((i) => i.kind === "email").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucune entrée dans cette catégorie.
            </div>
          ) : (
            <ol className="relative border-l border-border/60 ml-3 space-y-3 py-2">
              {filtered.map((it) => (
                <li key={it.id} className="ml-4">
                  <span className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border ${
                    it.kind === "email" ? "bg-blue-500/40 border-blue-500" : "bg-violet-500/40 border-violet-500"
                  }`} />
                  <div className="rounded-md border border-border/60 bg-card/40 p-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{it.title}</span>
                          {it.badge && (
                            <Badge variant="outline" className={`text-[10px] ${toneClass[it.badgeTone || "default"]}`}>
                              {it.badge}
                            </Badge>
                          )}
                        </div>
                        {it.subtitle && (
                          <div className="text-xs text-muted-foreground mt-0.5">{it.subtitle}</div>
                        )}
                        {it.actor && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">Par {it.actor}</div>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(it.ts).toLocaleString("fr-CA")}
                      </div>
                    </div>
                    {it.details && Object.keys(it.details).some((k) => it.details![k] != null) && (
                      <details className="mt-2">
                        <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                          Détails
                        </summary>
                        <pre className="mt-1 text-[10px] bg-muted/30 rounded p-2 overflow-x-auto max-h-48">
{JSON.stringify(it.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
