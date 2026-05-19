/**
 * CrmQuickActions — Per-contact dropdown of quick actions on a prospect card.
 * Options: leave note, claim/lock, change status, mark in-progress/sold,
 * schedule callback (sends email reminder), sale note, transfer (coming soon).
 */
import { useState } from "react";
import { MoreVertical, StickyNote, Lock, ListChecks, Calendar, ShoppingBag, ArrowRightLeft, Loader2, PhoneCall, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useCrmLock } from "../hooks/useCrmLock";
import { CALL_STATUS_META, type CrmCallStatus, type CrmContact } from "../lib/crmTypes";

interface Props {
  contact: CrmContact;
  onOpenNote: (c: CrmContact) => void;
  onOpenCallback: (c: CrmContact) => void;
  onStartCall: (c: CrmContact) => void;
  onSell: (c: CrmContact) => void;
  isDark?: boolean;
}

const STATUS_OPTIONS: CrmCallStatus[] = [
  "not_called", "called", "no_answer", "message_left",
  "callback", "in_progress", "sold", "not_interested", "do_not_call",
];

export function CrmQuickActions({ contact, onOpenNote, onOpenCallback, onStartCall, onSell, isDark }: Props) {
  const { lock } = useCrmLock();
  const [busy, setBusy] = useState(false);

  const handleStatus = async (status: CrmCallStatus) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("crm_set_status", { p_contact_id: contact.id, p_status: status });
    setBusy(false);
    const res = data as any;
    if (error || !res?.ok) {
      toast.error(`Erreur : ${res?.error ?? error?.message ?? "inconnue"}`);
      return;
    }
    toast.success(`Statut → ${CALL_STATUS_META[status]?.label ?? status}`);
  };

  const handleClaim = async () => {
    setBusy(true);
    const ok = await lock(contact.id);
    setBusy(false);
    if (ok) toast.success("🔒 Prospect verrouillé pour vous (30 min)");
  };

  const handleTransfer = () => {
    toast.info("🚧 Transfert de vente — Bientôt disponible", {
      description: "Cette fonctionnalité permettra de passer la vente à un autre vendeur.",
    });
  };

  const handleToggleDnc = async () => {
    const next = !contact.is_dnc;
    let reason: string | null = null;
    if (next) {
      reason = window.prompt("Raison LNNTE (optionnel) — ex : « Demande de ne plus être appelé »") || "Marqué LNNTE par agent";
    } else {
      if (!window.confirm("Retirer ce contact de la liste LNNTE ?")) return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("crm_toggle_dnc", {
      p_contact_id: contact.id,
      p_dnc: next,
      p_reason: reason,
    });
    setBusy(false);
    const res = data as any;
    if (error || !res?.ok) {
      toast.error(`Erreur LNNTE : ${res?.error ?? error?.message ?? "inconnue"}`);
      return;
    }
    toast.success(next ? "🛑 Marqué LNNTE — ne plus appeler" : "✅ Retiré du LNNTE");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Actions rapides"
          className={`inline-flex items-center justify-center h-10 w-10 rounded-lg border transition-colors ${
            isDark
              ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600"
              : "bg-background text-foreground border-border hover:bg-muted"
          }`}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 z-50 bg-background">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Actions rapides
        </DropdownMenuLabel>

        <DropdownMenuItem onClick={() => onOpenNote(contact)}>
          <StickyNote className="h-4 w-4 mr-2 text-amber-500" />
          Laisser une note sur l'appel
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleClaim}>
          <Lock className="h-4 w-4 mr-2 text-violet-500" />
          Sélectionner / verrouiller ce profil
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => onStartCall(contact)}>
          <PhoneCall className="h-4 w-4 mr-2 text-emerald-500" />
          Commencer l'appel (avec script)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ListChecks className="h-4 w-4 mr-2 text-blue-500" />
            Donner le statut de l'appel
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="z-50 bg-background">
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem key={s} onClick={() => handleStatus(s)}>
                {CALL_STATUS_META[s]?.label ?? s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onClick={() => handleStatus("in_progress")}>
          <ShoppingBag className="h-4 w-4 mr-2 text-cyan-500" />
          🟡 Marquer "Vente en cours"
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => onSell(contact)}>
          <ShoppingBag className="h-4 w-4 mr-2 text-emerald-600" />
          🟢 Vendre maintenant
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => onOpenCallback(contact)}>
          <Calendar className="h-4 w-4 mr-2 text-cyan-500" />
          Planifier un rappel (+ courriel)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleToggleDnc}>
          {contact.is_dnc ? (
            <>
              <ShieldCheck className="h-4 w-4 mr-2 text-emerald-500" />
              Retirer du LNNTE
            </>
          ) : (
            <>
              <ShieldAlert className="h-4 w-4 mr-2 text-rose-500" />
              🛑 Marquer LNNTE (Ne pas appeler)
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />


        <DropdownMenuItem onClick={handleTransfer} disabled className="opacity-60">
          <ArrowRightLeft className="h-4 w-4 mr-2 text-rose-500" />
          Transférer à un autre vendeur
          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 border border-amber-500/40 font-semibold">
            Bientôt
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
