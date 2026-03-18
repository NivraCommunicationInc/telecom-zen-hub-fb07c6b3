/**
 * Account360QuickActions — Visible action bar for the Account 360 workspace.
 * All critical actions as direct buttons (no hidden dropdowns per policy).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { corePath } from "@/core-app/lib/corePaths";
import {
  ShoppingCart, FileText, CreditCard, PauseCircle, PlayCircle,
  MessageSquare, Mail, Calendar, AlertTriangle, DollarSign,
  StickyNote, Package, UserPen,
} from "lucide-react";

interface Props {
  accountId: string | undefined;
  clientId: string | undefined;
  accountStatus: string | null;
  onRefresh: () => void;
  onNavigateSection: (section: string) => void;
  onEditProfile: () => void;
}

export function Account360QuickActions({ accountId, clientId, accountStatus, onRefresh, onNavigateSection, onEditProfile }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: string) => {
    if (!accountId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("accounts").update({
        status: newStatus, updated_at: new Date().toISOString(),
      }).eq("id", accountId);
      if (error) throw error;
      toast.success(`Compte ${newStatus === "suspended" ? "suspendu" : "réactivé"}`);
      onRefresh();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
  };

  const actions = [
    { icon: UserPen, label: "Modifier le profil", onClick: onEditProfile, color: "emerald" },
    { icon: ShoppingCart, label: "Nouvelle commande", onClick: () => onNavigateSection("orders"), color: "default" },
    { icon: FileText, label: "Ouvrir facture", onClick: () => onNavigateSection("invoices"), color: "default" },
    { icon: CreditCard, label: "Enregistrer paiement", onClick: () => onNavigateSection("payments"), color: "default" },
    ...(accountStatus !== "suspended"
      ? [{ icon: PauseCircle, label: "Suspendre", onClick: () => updateStatus("suspended"), color: "warning" as const }]
      : [{ icon: PlayCircle, label: "Réactiver", onClick: () => updateStatus("active"), color: "success" as const }]
    ),
    { icon: MessageSquare, label: "Ticket support", onClick: () => onNavigateSection("tickets"), color: "default" },
    { icon: Mail, label: "Envoyer rappel", onClick: () => onNavigateSection("tickets"), color: "default" },
    { icon: Package, label: "Assigner équipement", onClick: () => onNavigateSection("equipment"), color: "default" },
    { icon: Calendar, label: "Planifier RDV", onClick: () => onNavigateSection("appointments"), color: "default" },
    { icon: AlertTriangle, label: "Cas recouvrement", onClick: () => onNavigateSection("invoices"), color: "warning" },
    { icon: DollarSign, label: "Litige facturation", onClick: () => onNavigateSection("invoices"), color: "warning" },
    { icon: StickyNote, label: "Note interne", onClick: () => onNavigateSection("timeline"), color: "default" },
  ];

  const colorMap: Record<string, string> = {
    default: "text-core-text-secondary hover:text-core-text-primary hover:border-emerald-500/30",
    emerald: "text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40 bg-emerald-500/5",
    warning: "text-amber-400 hover:text-amber-300 hover:border-amber-500/40",
    success: "text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40",
  };

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-2">
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            disabled={loading}
            className={`flex items-center gap-1.5 rounded-md border border-[hsl(220,15%,18%)] px-2.5 py-1.5 text-[10px] font-medium transition-all disabled:opacity-40 ${colorMap[a.color]}`}
          >
            <a.icon className="h-3 w-3 shrink-0" />
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
