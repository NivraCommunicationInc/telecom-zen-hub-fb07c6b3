/**
 * Shared micro-components and helpers for Account 360 sections.
 */
import React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* ── Formatters ── */
export const fmtCAD = (n: number | null | undefined) => (n != null ? `${n.toFixed(2)} $` : "—");
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};
export const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Actif", pending: "En attente", suspended: "Suspendu", cancelled: "Annulé",
  closed: "Fermé", open: "Ouvert", in_progress: "En cours", resolved: "Résolu",
  waiting_client: "Attente client", completed: "Terminé", confirmed: "Confirmé",
  scheduled: "Planifié", approved: "Approuvé", rejected: "Rejeté",
  pending_review: "En révision", submitted: "Soumis", manual_review: "Révision manuelle",
  paid: "Payé", overdue: "En souffrance", draft: "Brouillon", voided: "Annulée",
  installation_completed: "Installation terminée", activated: "Activé",
};
export const label = (s: string | null | undefined) => STATUS_LABELS[s || ""] || s || "—";

/* ── Micro components ── */
export const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] ${className}`}>{children}</div>
);

export const PanelHeader = ({ icon: Icon, title, count, actions }: { icon: any; title: string; count?: number; actions?: React.ReactNode }) => (
  <div className="border-b border-[hsl(220,15%,14%)]">
    <div className="flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[11px] font-semibold text-core-text-primary">{title}</span>
        {count != null && (
          <span className="text-[10px] text-core-text-label bg-[hsl(220,15%,14%)] px-1.5 py-0.5 rounded-full tabular-nums font-medium ml-1">{count}</span>
        )}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  </div>
);

export const InfoLine = ({ label: l, value, mono, accent }: { label: string; value: React.ReactNode; mono?: boolean; accent?: boolean }) => (
  <div className="flex items-center justify-between py-1.5 px-3">
    <span className="text-[10px] text-core-text-label uppercase tracking-wide">{l}</span>
    <span className={`text-[11px] text-right ${mono ? "font-mono" : ""} ${accent ? "text-emerald-400 font-medium" : "text-core-text-primary"}`}>{value}</span>
  </div>
);

export const MiniTable = ({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: boolean }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-[hsl(220,15%,14%)]">
          {headers.map(h => (
            <th key={h} className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-core-text-label whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {empty ? (
          <tr><td colSpan={headers.length} className="text-center py-6 text-core-text-disabled text-[11px]">Aucune donnée</td></tr>
        ) : children}
      </tbody>
    </table>
  </div>
);

export const trClass = "border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors";
