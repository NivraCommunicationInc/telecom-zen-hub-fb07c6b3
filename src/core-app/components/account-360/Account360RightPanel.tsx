/**
 * Account360RightPanel — Persistent right-side summary panel for Account 360.
 * Shows account info, billing cycle, financial summary, KYC, and notes.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { Panel, PanelHeader, InfoLine, fmtCAD, fmtDate, label } from "./Account360Helpers";
import {
  CircleDot, Clock, DollarSign, User, Shield, StickyNote, MapPin,
} from "lucide-react";

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
  const [noteText, setNoteText] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);

  const addNote = async () => {
    if (!noteText.trim() || !clientId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: (await supabase.auth.getUser()).data.user?.id || "unknown",
        action_type: "internal_note", summary: noteText.trim(),
        entity_type: "account", entity_id: accountId,
      });
      if (error) throw error;
      toast.success("Note ajoutée");
      setNoteText(""); setShowNote(false); onRefresh();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setSaving(false); }
  };

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
        <PanelHeader icon={StickyNote} title="Note interne" />
        <div className="p-2">
          {!showNote ? (
            <button onClick={() => setShowNote(true)} className="w-full text-[10px] text-core-text-label hover:text-core-text-primary transition-colors py-1">
              + Ajouter une note
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
                <button onClick={addNote} disabled={saving || !noteText.trim()} className="flex-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors">Enregistrer</button>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
