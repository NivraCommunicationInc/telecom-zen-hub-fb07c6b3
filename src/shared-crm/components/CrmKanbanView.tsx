/**
 * CrmKanbanView — Pipeline Kanban view grouped by call_status.
 * 7 columns: À appeler · En cours · Rappel · Message laissé · Pas de réponse · Pas intéressé · Vendu.
 * Each card is clickable → opens contact drawer.
 */
import { Phone, Lock, ShieldAlert, Timer } from "lucide-react";
import { CALL_STATUS_META, displayName, type CrmContact } from "../lib/crmTypes";
import { cn } from "@/lib/utils";

const COLUMNS: Array<{ key: string; label: string; accent: string }> = [
  { key: "not_called",     label: "À appeler",      accent: "border-violet-500/40 bg-violet-500/5" },
  { key: "in_progress",    label: "🔴 En appel",    accent: "border-red-500/40 bg-red-500/5" },
  { key: "callback",       label: "Rappel prévu",   accent: "border-cyan-500/40 bg-cyan-500/5" },
  { key: "message_left",   label: "Message laissé", accent: "border-blue-500/40 bg-blue-500/5" },
  { key: "no_answer",      label: "Pas de réponse", accent: "border-amber-500/40 bg-amber-500/5" },
  { key: "not_interested", label: "Pas intéressé",  accent: "border-gray-500/40 bg-gray-500/5" },
  { key: "sold",           label: "🟢 Vendu",       accent: "border-emerald-500/50 bg-emerald-500/10" },
];

interface Props {
  contacts: CrmContact[];
  isDark: boolean;
  onOpen: (c: CrmContact) => void;
  onStartCall: (c: CrmContact) => void;
  duplicateIds: Set<string>;
}

export function CrmKanbanView({ contacts, isDark, onOpen, onStartCall, duplicateIds }: Props) {
  const byStatus = new Map<string, CrmContact[]>();
  for (const col of COLUMNS) byStatus.set(col.key, []);
  contacts.forEach((c) => {
    const k = c.call_status ?? "not_called";
    if (!byStatus.has(k)) byStatus.set(k, []);
    byStatus.get(k)!.push(c);
  });

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
      {COLUMNS.map((col) => {
        const list = byStatus.get(col.key) ?? [];
        return (
          <div
            key={col.key}
            className={cn(
              "shrink-0 w-[260px] rounded-xl border p-2 max-h-[70vh] overflow-y-auto",
              col.accent,
              isDark ? "bg-gray-800/40" : "bg-card"
            )}
          >
            <div className="sticky top-0 z-10 -m-2 mb-2 p-2 backdrop-blur bg-inherit border-b border-border/40">
              <div className={cn("text-xs font-bold flex items-center justify-between", isDark ? "text-white" : "text-foreground")}>
                <span>{col.label}</span>
                <span className="px-2 py-0.5 rounded-full bg-background/80 border border-border text-[10px]">
                  {list.length}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {list.length === 0 ? (
                <div className={cn("text-[11px] italic text-center py-4", isDark ? "text-gray-500" : "text-muted-foreground")}>
                  Aucun contact
                </div>
              ) : (
                list.slice(0, 50).map((c) => {
                  const lockedByOther = c.is_locked && c.locked_until && new Date(c.locked_until).getTime() > Date.now();
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "rounded-lg border p-2 text-xs cursor-pointer hover:border-violet-500/60 transition-colors",
                        isDark ? "bg-gray-900 border-gray-700 text-gray-200" : "bg-background border-border"
                      )}
                      onClick={() => onOpen(c)}
                    >
                      <div className="font-semibold truncate flex items-center gap-1">
                        {duplicateIds.has(c.id) && (
                          <span title="Déjà client" className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-700 border border-amber-500/40">CLIENT</span>
                        )}
                        {c.is_dnc && <ShieldAlert className="h-3 w-3 text-rose-500 shrink-0" />}
                        {lockedByOther && <Lock className="h-3 w-3 text-red-500 shrink-0 animate-pulse" />}
                        <span className="truncate">{displayName(c)}</span>
                      </div>
                      {c.city && <div className="text-[10px] opacity-70 truncate">{c.city}</div>}
                      {c.phone && (
                        <div className="text-[10px] text-violet-500 truncate">{c.phone}</div>
                      )}
                      {(c.call_attempts ?? 0) > 0 && (
                        <div className="text-[9px] opacity-60 flex items-center gap-1">
                          <Timer className="h-2.5 w-2.5" />
                          {c.call_attempts} tentative{(c.call_attempts || 0) > 1 ? "s" : ""}
                        </div>
                      )}
                      {col.key !== "sold" && !c.is_dnc && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onStartCall(c); }}
                          disabled={!!lockedByOther}
                          className="mt-1 w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                        >
                          <Phone className="h-2.5 w-2.5" /> Appeler
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              {list.length > 50 && (
                <div className="text-[10px] text-center opacity-60 py-1">+{list.length - 50} de plus…</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
