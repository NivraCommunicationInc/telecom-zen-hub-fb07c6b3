/**
 * Account360RightPanel — Persistent right-side summary panel for Account 360.
 * Shows account info, billing cycle, financial summary, KYC, and notes.
 */
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { Panel, PanelHeader, InfoLine, fmtCAD, fmtDate, label } from "./Account360Helpers";
import { CircleDot, Clock, DollarSign, User, Shield, StickyNote, MapPin } from "lucide-react";
import { ClientNotesPanel } from "@/core-app/components/notes/ClientNotesPanel";

interface Props {
  account: any;
  profile: any;
  clientName: string;
  latestKyc: any;
  totalDue: number;
  totalPaid: number;
  monthlyRevenue: number;
  unpaidCount: number;
  accountId: string | undefined;
  clientId: string | undefined;
  onRefresh: () => void;
}

export function Account360RightPanel({
  account, profile, clientName, latestKyc, totalDue, totalPaid,
  monthlyRevenue, unpaidCount, accountId, clientId, onRefresh,
}: Props) {
  const acct = account;

  return (
    <div className="space-y-3 self-start lg:sticky lg:top-4">
      {/* Account */}
      <Panel>
        <PanelHeader icon={CircleDot} title="Compte" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Numéro" value={acct.account_number} mono accent />
          <InfoLine label="Statut" value={<StatusBadge label={label(acct.status)} variant={statusToVariant(acct.status || "active")} size="sm" />} />
          <InfoLine label="Classe crédit" value={acct.credit_class || "C"} />
          <InfoLine label="Créé le" value={fmtDate(acct.created_at)} />
        </div>
      </Panel>

      {/* Billing cycle */}
      <Panel>
        <PanelHeader icon={Clock} title="Cycle facturation" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Jour de cycle" value={acct.billing_cycle_day ? `Le ${acct.billing_cycle_day}` : "—"} accent />
          <InfoLine label="Prochaine fact." value={fmtDate(acct.next_invoice_date)} accent />
          <InfoLine label="Montant mensuel" value={fmtCAD(monthlyRevenue)} accent />
          <InfoLine label="Solde impayé" value={
            <span className={totalDue > 0 ? "text-red-400 font-semibold" : "text-emerald-400"}>{fmtCAD(totalDue)}</span>
          } />
          <InfoLine label="Fact. impayées" value={
            <span className={unpaidCount > 0 ? "text-red-400" : "text-emerald-400"}>{unpaidCount}</span>
          } />
        </div>
      </Panel>

      {/* Financial */}
      <Panel>
        <PanelHeader icon={DollarSign} title="Résumé financier" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Total payé" value={fmtCAD(totalPaid)} />
          <InfoLine label="Rev. mensuel" value={fmtCAD(monthlyRevenue)} accent />
        </div>
      </Panel>

      {/* Identity */}
      <Panel>
        <PanelHeader icon={User} title="Contact" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Nom" value={clientName} />
          <InfoLine label="Courriel" value={profile?.email || "—"} />
          <InfoLine label="Téléphone" value={profile?.phone || "—"} />
        </div>
      </Panel>

      {/* Address */}
      <Panel>
        <PanelHeader icon={MapPin} title="Adresses" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Service" value={[acct.primary_service_address, acct.primary_service_city].filter(Boolean).join(", ") || "—"} />
          <InfoLine label="Facturation" value={[acct.billing_address, acct.billing_city].filter(Boolean).join(", ") || "—"} />
        </div>
      </Panel>

      {/* KYC */}
      <Panel>
        <PanelHeader icon={Shield} title="KYC" />
        <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
          <InfoLine label="Statut" value={
            latestKyc
              ? <StatusBadge label={label(latestKyc.status)} variant={statusToVariant(latestKyc.status)} size="sm" />
              : <span className="text-core-text-disabled text-[10px]">Non vérifié</span>
          } />
          {latestKyc && (
            <>
              <InfoLine label="Document" value={latestKyc.document_type || "—"} />
              <InfoLine label="Révisé" value={fmtDate(latestKyc.reviewed_at)} />
            </>
          )}
        </div>
      </Panel>

      {/* Notes */}
      <Panel>
        <PanelHeader icon={StickyNote} title="Notes internes" />
        <div className="p-2 space-y-2">
          {!showNote ? (
            <button onClick={() => setShowNote(true)} className="w-full flex items-center justify-center gap-1 text-[10px] text-core-text-label hover:text-core-text-primary transition-colors py-1">
              <Plus className="h-3 w-3" /> Ajouter une note
            </button>
          ) : (
            <div className="space-y-1.5">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Note interne…"
                rows={2}
                className="w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-core-text-primary placeholder:text-core-text-disabled outline-none focus:border-emerald-500/50 resize-none"
              />
              <div className="flex gap-1.5">
                <button onClick={() => setShowNote(false)} className="flex-1 rounded-md border border-[hsl(220,15%,16%)] px-2 py-1 text-[10px] text-core-text-label hover:text-core-text-primary transition-colors">Annuler</button>
                <button onClick={addNote} disabled={saving || !noteText.trim()} className="flex-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Enregistrer"}
                </button>
              </div>
            </div>
          )}

          {/* Existing notes list */}
          {loadingNotes ? (
            <div className="flex justify-center py-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-core-text-disabled" /></div>
          ) : notes.length > 0 ? (
            <>
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => scrollNotes("top")}
                  className="h-6 px-2 rounded-md border border-[hsl(220,15%,16%)] text-[10px] text-core-text-label hover:text-core-text-primary transition-colors inline-flex items-center gap-1"
                >
                  <ChevronUp className="h-3 w-3" /> Haut
                </button>
                <button
                  onClick={() => scrollNotes("bottom")}
                  className="h-6 px-2 rounded-md border border-[hsl(220,15%,16%)] text-[10px] text-core-text-label hover:text-core-text-primary transition-colors inline-flex items-center gap-1"
                >
                  <ChevronDown className="h-3 w-3" /> Bas
                </button>
              </div>

              <div ref={notesScrollRef} className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                {notes.map((n: any) => (
                  <div key={n.id} className="rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-2">
                    <p className="text-[10px] text-core-text-primary whitespace-pre-wrap leading-relaxed">{n.body}</p>
                    <div className="flex items-center gap-1 mt-1 text-[9px] text-core-text-disabled">
                      <span>{n.created_by_name || "Agent"}</span>
                      <span>·</span>
                      <span>{n.created_at ? format(new Date(n.created_at), "d MMM yyyy HH:mm", { locale: fr }) : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[10px] text-core-text-disabled text-center py-2">Aucune note</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
