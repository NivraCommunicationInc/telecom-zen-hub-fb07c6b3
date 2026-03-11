/**
 * Subscription management actions for Account 360.
 * Suspend, resume, cancel, add service, change plan.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, PauseCircle, PlayCircle, XCircle, AlertTriangle, Plus, ArrowRightLeft } from "lucide-react";

const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const btnPrimary = "rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors";
const btnSecondary = "rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors";
const btnDanger = "rounded-md bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition-colors";

interface Props {
  subscriptions: any[];
  customerId: string | undefined;
  onRefresh: () => void;
}

type ModalType = null | "suspend" | "resume" | "cancel" | "addService" | "changePlan";

export function SubscriptionActionMenu({ subscriptions, customerId, onRefresh }: Props) {
  const [modal, setModal] = useState<ModalType>(null);

  const active = subscriptions.filter((s: any) => s.status === "active");
  const suspended = subscriptions.filter((s: any) => s.status === "suspended");
  const manageable = subscriptions.filter((s: any) => s.status !== "cancelled");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2 py-1 text-[10px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            Actions <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white">
          <DropdownMenuLabel className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider">Ajouter / Modifier</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setModal("addService")} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <Plus className="h-3.5 w-3.5" /> Ajouter un service
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModal("changePlan")} disabled={manageable.length === 0} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <ArrowRightLeft className="h-3.5 w-3.5" /> Changer de forfait
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[hsl(220,15%,16%)]" />
          <DropdownMenuLabel className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider">Gestion de service</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setModal("suspend")} disabled={active.length === 0} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <PauseCircle className="h-3.5 w-3.5" /> Suspendre un service
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModal("resume")} disabled={suspended.length === 0} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <PlayCircle className="h-3.5 w-3.5" /> Reprendre un service
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[hsl(220,15%,16%)]" />
          <DropdownMenuItem onClick={() => setModal("cancel")} disabled={manageable.length === 0} className="text-[11px] gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-300">
            <XCircle className="h-3.5 w-3.5" /> Annuler un abonnement
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {modal === "suspend" && <StatusModal action="suspend" subs={active} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "resume" && <StatusModal action="resume" subs={suspended} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "cancel" && <CancelModal subs={manageable} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "addService" && <AddServiceModal customerId={customerId} subscriptions={subscriptions} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "changePlan" && <ChangePlanModal subs={manageable} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
    </>
  );
}

function StatusModal({ action, subs, customerId, onClose, onRefresh }: { action: "suspend" | "resume"; subs: any[]; customerId?: string; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(subs[0]?.id || "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const isSuspend = action === "suspend";
  const newStatus = isSuspend ? "suspended" : "active";

  const handleSubmit = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("billing_subscriptions").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", selectedId);
      if (error) throw error;

      if (customerId) {
        await supabase.from("billing_subscription_trace_audit").insert({
          subscription_id: selectedId,
          customer_id: customerId,
          action: isSuspend ? "service_suspended" : "service_resumed",
          reason: reason || null,
          details: { source: "account_360" },
        });
      }

      toast.success(`Service ${isSuspend ? "suspendu" : "repris"}`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            {isSuspend ? <PauseCircle className="h-4 w-4 text-amber-400" /> : <PlayCircle className="h-4 w-4 text-emerald-400" />}
            {isSuspend ? "Suspendre un service" : "Reprendre un service"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Abonnement</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {subs.map((s: any) => (
                <option key={s.id} value={s.id}>{s.plan_name} — {s.plan_price?.toFixed(2)} $/mois</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Raison (optionnel)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison de la modification" className={inputCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleSubmit} disabled={loading} className={isSuspend ? `${btnPrimary} !bg-amber-600 hover:!bg-amber-500` : btnPrimary}>{loading ? "…" : "Confirmer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelModal({ subs, customerId, onClose, onRefresh }: { subs: any[]; customerId?: string; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(subs[0]?.id || "");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!selectedId || confirmText !== "ANNULER") return;
    setLoading(true);
    try {
      const { error } = await supabase.from("billing_subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", selectedId);
      if (error) throw error;

      if (customerId) {
        await supabase.from("billing_subscription_trace_audit").insert({
          subscription_id: selectedId,
          customer_id: customerId,
          action: "subscription_cancelled",
          reason: reason || null,
          details: { source: "account_360" },
        });
      }

      toast.success("Abonnement annulé");
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-400"><XCircle className="h-4 w-4" /> Annuler un abonnement</DialogTitle>
        </DialogHeader>
        {subs.length === 0 ? (
          <p className="text-[11px] text-[hsl(220,10%,45%)] py-4">Aucun abonnement actif.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-red-300">Cette action est irréversible. Le service sera désactivé immédiatement.</p>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Abonnement</label>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
                {subs.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.plan_name} — {s.plan_code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Raison</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison de l'annulation" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Tapez ANNULER pour confirmer</label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="ANNULER" className={inputCls} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Retour</button>
          {subs.length > 0 && <button onClick={handleCancel} disabled={loading || confirmText !== "ANNULER"} className={btnDanger}>{loading ? "…" : "Annuler l'abonnement"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Add Service Modal ── */
function AddServiceModal({ customerId, subscriptions, onClose, onRefresh }: { customerId?: string; subscriptions: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedSubId, setSelectedSubId] = useState(subscriptions.filter((s: any) => s.status === "active")[0]?.id || subscriptions[0]?.id || "");
  const [serviceName, setServiceName] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [serviceType, setServiceType] = useState("addon");
  const [unitPrice, setUnitPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!selectedSubId || !serviceName.trim() || !serviceCode.trim()) {
      toast.error("Veuillez remplir le nom et le code du service");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("billing_subscription_services").insert({
        subscription_id: selectedSubId,
        service_name: serviceName.trim(),
        service_code: serviceCode.trim(),
        service_type: serviceType,
        unit_price: parseFloat(unitPrice) || 0,
        quantity: 1,
        is_active: true,
      });
      if (error) throw error;

      if (customerId) {
        await supabase.from("billing_subscription_trace_audit").insert({
          subscription_id: selectedSubId,
          customer_id: customerId,
          action: "service_added",
          details: { service_name: serviceName, service_code: serviceCode, source: "account_360" },
        });
      }

      toast.success(`Service "${serviceName}" ajouté`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-400" /> Ajouter un service</DialogTitle>
        </DialogHeader>
        {subscriptions.length === 0 ? (
          <p className="text-[11px] text-[hsl(220,10%,45%)] py-4">Aucun abonnement disponible.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Abonnement cible</label>
              <select value={selectedSubId} onChange={e => setSelectedSubId(e.target.value)} className={inputCls}>
                {subscriptions.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.plan_name} ({s.status})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Nom du service</label>
                <input value={serviceName} onChange={e => setServiceName(e.target.value)} placeholder="Ex: Appels illimités" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Code</label>
                <input value={serviceCode} onChange={e => setServiceCode(e.target.value)} placeholder="Ex: ADDON-CALLS" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Type</label>
                <select value={serviceType} onChange={e => setServiceType(e.target.value)} className={inputCls}>
                  <option value="addon">Option</option>
                  <option value="base">Service de base</option>
                  <option value="equipment">Équipement</option>
                  <option value="fee">Frais</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Prix mensuel ($)</label>
                <input type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" className={inputCls} />
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          {subscriptions.length > 0 && <button onClick={handleAdd} disabled={loading} className={btnPrimary}>{loading ? "…" : "Ajouter le service"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Change Plan Modal ── */
function ChangePlanModal({ subs, customerId, onClose, onRefresh }: { subs: any[]; customerId?: string; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(subs[0]?.id || "");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanCode, setNewPlanCode] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const sub = subs.find((s: any) => s.id === selectedId);

  const handleChange = async () => {
    if (!selectedId || !newPlanName.trim() || !newPlanCode.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    try {
      const price = parseFloat(newPrice) || 0;
      const { error } = await supabase.from("billing_subscriptions").update({
        plan_name: newPlanName.trim(),
        plan_code: newPlanCode.trim(),
        plan_price: price,
        updated_at: new Date().toISOString(),
      }).eq("id", selectedId);
      if (error) throw error;

      if (customerId) {
        await supabase.from("billing_subscription_trace_audit").insert({
          subscription_id: selectedId,
          customer_id: customerId,
          action: "plan_changed",
          reason: reason || null,
          details: {
            old_plan: sub?.plan_name,
            old_code: sub?.plan_code,
            old_price: sub?.plan_price,
            new_plan: newPlanName,
            new_code: newPlanCode,
            new_price: price,
            source: "account_360",
          },
        });
      }

      toast.success(`Forfait changé vers "${newPlanName}"`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-emerald-400" /> Changer de forfait</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Abonnement actuel</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {subs.map((s: any) => (
                <option key={s.id} value={s.id}>{s.plan_name} — {s.plan_price?.toFixed(2)} $/mois ({s.plan_code})</option>
              ))}
            </select>
          </div>
          {sub && (
            <div className="rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,16%)] p-2.5 text-[10px] text-[hsl(220,10%,45%)]">
              Forfait actuel : <span className="text-white font-medium">{sub.plan_name}</span> · {sub.plan_price?.toFixed(2)} $/mois
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Nouveau forfait</label>
              <input value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="Ex: Internet 100" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Code</label>
              <input value={newPlanCode} onChange={e => setNewPlanCode(e.target.value)} placeholder="Ex: INT-100" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Nouveau prix mensuel ($)</label>
            <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Raison (optionnel)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison du changement" className={inputCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleChange} disabled={loading} className={btnPrimary}>{loading ? "…" : "Changer le forfait"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
