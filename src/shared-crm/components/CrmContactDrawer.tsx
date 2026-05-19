/**
 * CrmContactDrawer — Side drawer showing full contact details + call history.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCrmContactCallHistory } from "../hooks/useCrmLeaderboard";
import { useCrmAssignmentHistory } from "../hooks/useCrmAssignmentHistory";
import { type CrmContact, OUTCOME_META, displayName, CALL_STATUS_META } from "../lib/crmTypes";
import { Phone, Mail, MapPin, Calendar, User, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  contact: CrmContact | null;
  onClose: () => void;
}

export function CrmContactDrawer({ contact, onClose }: Props) {
  const { data: history = [] } = useCrmContactCallHistory(contact?.id ?? null);
  const { data: assignHistory = [] } = useCrmAssignmentHistory(contact?.id ?? null);
  if (!contact) return null;

  const meta = CALL_STATUS_META[contact.call_status ?? "not_called"] ?? CALL_STATUS_META.not_called;

  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{displayName(contact)}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border", meta.cls)}>
            {meta.label}
          </span>

          <div className="space-y-2 text-sm">
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={`tel:${contact.phone}`} className="text-violet-600 font-semibold">{contact.phone}</a>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{contact.email}</span>
              </div>
            )}
            {(contact.address || contact.city) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                <span>{[contact.address, contact.city, contact.postal_code].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {contact.date_of_birth && (
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Né(e) : {contact.date_of_birth}</span>
              </div>
            )}
            {contact.desired_install_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Installation souhaitée : {contact.desired_install_date}</span>
              </div>
            )}
            {contact.territory && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Territoire : {contact.territory}</span>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
            <div>Tentatives : {contact.call_attempts ?? 0}</div>
            {contact.last_called_at && (
              <div>Dernier appel : {format(new Date(contact.last_called_at), "PPp", { locale: fr })}</div>
            )}
            {contact.next_callback_at && (
              <div className="text-cyan-600 font-medium">Rappel prévu : {format(new Date(contact.next_callback_at), "PPp", { locale: fr })}</div>
            )}
            <div>Source : {contact.source ?? "—"}</div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Historique d'appels ({history.length})
            </h3>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun appel encore.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((log) => {
                  const om = OUTCOME_META[log.outcome as keyof typeof OUTCOME_META];
                  return (
                    <li key={log.id} className="border border-border rounded-lg p-2 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold">
                          {om?.emoji} {om?.label ?? log.outcome}
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {format(new Date(log.started_at), "Pp", { locale: fr })}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        par {log.agent_name ?? "Agent"} · {log.agent_portal}
                      </div>
                      {log.notes && <p className="mt-1 text-foreground/80">{log.notes}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
