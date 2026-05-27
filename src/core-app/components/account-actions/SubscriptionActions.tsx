/**
 * Subscription management visible action bar for Account 360.
 * NO DROPDOWNS — all actions are visible buttons.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PauseCircle, PlayCircle, XCircle, AlertTriangle, Plus, ArrowRightLeft } from "lucide-react";

const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const btnPrimary = "rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors";
const btnSecondary = "rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors";
const btnDanger = "rounded-md bg-red-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-40 transition-colors";

const actionBtn = "flex items-center gap-1.5 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2.5 py-1.5 text-[10px] font-medium transition-all whitespace-nowrap disabled:opacity-30";
const actionDefault = `${actionBtn} text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30`;
const actionAccent = `${actionBtn} text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40`;
const actionWarning = `${actionBtn} text-amber-400 hover:text-amber-300 hover:border-amber-500/40`;
const actionDanger = `${actionBtn} text-red-400 hover:text-red-300 hover:border-red-500/40`;

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
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setModal("addService")} className={actionAccent}>
          <Plus className="h-3 w-3" /> Service
        </button>
        <button onClick={() => setModal("changePlan")} disabled={manageable.length === 0} className={actionDefault}>
          <ArrowRightLeft className="h-3 w-3" /> Changer forfait
        </button>
        <button onClick={() => setModal("suspend")} disabled={active.length === 0} className={actionWarning}>
          <PauseCircle className="h-3 w-3" /> Suspendre
        </button>
        <button onClick={() => setModal("resume")} disabled={suspended.length === 0} className={actionDefault}>
          <PlayCircle className="h-3 w-3" /> Reprendre
        </button>
        <button onClick={() => setModal("cancel")} disabled={manageable.length === 0} className={actionDanger}>
          <XCircle className="h-3 w-3" /> Annuler
        </button>
      </div>

      {modal === "suspend" && <StatusModal action="suspend" subs={active} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "resume" && <StatusModal action="resume" subs={suspended} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "cancel" && <CancelModal subs={manageable} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "addService" && <AddServiceModal customerId={customerId} subscriptions={subscriptions} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "changePlan" && <ChangePlanModal subs={manageable} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
    </>
  );
}

// ── StatusModal, CancelModal, AddServiceModal, ChangePlanModal remain the same ──

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
          subscription_id: selectedId, customer_id: customerId,
          action: isSuspend ? "service_suspended" : "service_resumed",
          reason: reason || null, details: { source: "account_360" },
        });
      }
      toast.success(`Service ${isSuspend ? "suspendu" : "repris"}`);
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
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
              {subs.map((s: any) => (<option key={s.id} value={s.id}>{s.plan_name} — {s.plan_price?.toFixed(2)} $/mois</option>))}
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
          subscription_id: selectedId, customer_id: customerId,
          action: "subscription_cancelled", reason: reason || null,
          details: { source: "account_360" },
        });
      }
      toast.success("Abonnement annulé");
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
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
                {subs.map((s: any) => (<option key={s.id} value={s.id}>{s.plan_name} — {s.plan_code}</option>))}
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

function AddServiceModal({ customerId, subscriptions, onClose, onRefresh }: { customerId?: string; subscriptions: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedSubId, setSelectedSubId] = useState(subscriptions.filter((s: any) => s.status === "active")[0]?.id || subscriptions[0]?.id || "");
  const [serviceName, setServiceName] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [serviceType, setServiceType] = useState("addon");
  const [unitPrice, setUnitPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!selectedSubId || !serviceName.trim() || !serviceCode.trim()) { toast.error("Veuillez remplir le nom et le code du service"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from("billing_subscription_services").insert({
        subscription_id: selectedSubId, service_name: serviceName.trim(), service_code: serviceCode.trim(),
        service_type: serviceType, unit_price: parseFloat(unitPrice) || 0, quantity: 1, is_active: true,
      });
      if (error) throw error;
      if (customerId) {
        await supabase.from("billing_subscription_trace_audit").insert({
          subscription_id: selectedSubId, customer_id: customerId, action: "service_added",
          details: { service_name: serviceName, service_code: serviceCode, source: "account_360" },
        });
      }
      toast.success(`Service "${serviceName}" ajouté`);
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
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
                {subscriptions.map((s: any) => (<option key={s.id} value={s.id}>{s.plan_name} ({s.status})</option>))}
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

function ChangePlanModal({ subs, customerId, onClose, onRefresh }: { subs: any[]; customerId?: string; onClose: () => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState(subs[0]?.id || "");
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [newPlanId, setNewPlanId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const sub = subs.find((s: any) => s.id === selectedId);

  useEffect(() => {
    supabase
      .from("services")
      .select("id, name, plan_code, category, price, is_active")
      .eq("is_active", true)
      .neq("category", "Équipement")
      .order("category")
      .order("name")
      .then(({ data }) => {
        setCatalog(data || []);
        setCatalogLoading(false);
      });
  }, []);

  // Filter catalog to match current subscription category when possible
  const matchedCategory = (sub?.plan_code || "").toLowerCase();
  const filteredCatalog = catalog.filter((p: any) => {
    if (!sub) return true;
    if (sub.service_type) {
      const t = String(sub.service_type).toLowerCase();
      return p.category?.toLowerCase().includes(t) || t.includes(p.category?.toLowerCase());
    }
    return true;
  });
  const visibleCatalog = filteredCatalog.length > 0 ? filteredCatalog : catalog;

  const handleChange = async () => {
    const newPlan = catalog.find((p: any) => p.id === newPlanId);
    if (!selectedId || !newPlan) { toast.error("Sélectionnez un forfait du catalogue"); return; }
    setLoading(true);
    try {
      const price = Number(newPlan.price) || 0;
      const { error } = await supabase.from("billing_subscriptions").update({
        plan_name: newPlan.name, plan_code: newPlan.plan_code || newPlan.id, plan_price: price, updated_at: new Date().toISOString(),
      }).eq("id", selectedId);
      if (error) throw error;
      if (customerId) {
        await supabase.from("billing_subscription_trace_audit").insert({
          subscription_id: selectedId, customer_id: customerId, action: "plan_changed", reason: reason || null,
          details: { old_plan: sub?.plan_name, old_code: sub?.plan_code, old_price: sub?.plan_price, new_plan: newPlan.name, new_code: newPlan.plan_code, new_price: price, catalog_id: newPlan.id, source: "account_360" },
        });
      }
      toast.success(`Forfait changé vers "${newPlan.name}"`);
      onRefresh(); onClose();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-emerald-400" /> Changer de forfait</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Abonnement</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
              {subs.map((s: any) => (<option key={s.id} value={s.id}>{s.plan_name} — {s.plan_price?.toFixed(2)} $/mois</option>))}
            </select>
          </div>
          {sub && (
            <div className="rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,16%)] p-2.5 text-[10px] text-[hsl(220,10%,45%)]">
              Actuel: <span className="text-white font-medium">{sub.plan_name}</span> ({sub.plan_code}) — {sub.plan_price?.toFixed(2)} $/mois
            </div>
          )}
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Nouveau forfait (catalogue Nivra)</label>
            {catalogLoading ? (
              <p className="text-[10px] text-[hsl(220,10%,45%)] py-2">Chargement du catalogue…</p>
            ) : (
              <select value={newPlanId} onChange={e => setNewPlanId(e.target.value)} className={inputCls}>
                <option value="">— Sélectionner un forfait —</option>
                {visibleCatalog.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    [{p.category}] {p.name} — {Number(p.price).toFixed(2)} $/mois{p.plan_code ? ` (${p.plan_code})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Raison</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Optionnel" className={inputCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleChange} disabled={loading || !newPlanId} className={btnPrimary}>{loading ? "…" : "Changer le forfait"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
