/**
 * ClientInfoStep — Step 1: Client information validation
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Edit2, AlertTriangle, Save, X } from "lucide-react";
import { toast } from "sonner";

interface Props { proc: any; }

export function ClientInfoStep({ proc }: Props) {
  const { order, profile } = proc;
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    client_first_name: order.client_first_name || "",
    client_last_name: order.client_last_name || "",
    client_email: order.client_email || profile?.email || "",
    client_phone: order.client_phone || profile?.phone || "",
    client_dob: order.client_dob || "",
    client_full_address: order.client_full_address || "",
  });

  const handleSave = async () => {
    await proc.updateOrder(fields);
    setEditing(false);
    toast.success("Informations client mises à jour");
  };

  const handleFlagFraud = async () => {
    try {
      // Use addNote + status change → "cancelled" with reason logs to audit trail
      await proc.addNote("⚠ Signalée comme fraude potentielle par l'agent");
      await proc.updateOrder({ payment_status: "failed", internal_notes: `${order.internal_notes || ""}\n[FRAUD FLAG] ${new Date().toISOString()}` });
      toast.warning("Commande marquée comme fraude potentielle");
    } catch (err: any) {
      console.error("[ClientInfo] Flag fraud failed:", err);
      toast.error(err?.message || "Erreur lors du signalement");
    }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Étape 1</div>

      <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
        <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Information client</h3>
          <div className="flex gap-2">
            {!editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="text-xs h-7 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800">
                <Edit2 className="w-3 h-3 mr-1" /> Modifier
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="text-xs h-7 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800">
                  <X className="w-3 h-3 mr-1" /> Annuler
                </Button>
                <Button size="sm" onClick={handleSave} disabled={proc.isUpdating} className="text-xs h-7 bg-blue-600 hover:bg-blue-700 text-white">
                  <Save className="w-3 h-3 mr-1" /> Sauvegarder
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldBlock label="Prénom" value={fields.client_first_name} editing={editing} onChange={(v) => setFields({ ...fields, client_first_name: v })} />
            <FieldBlock label="Nom" value={fields.client_last_name} editing={editing} onChange={(v) => setFields({ ...fields, client_last_name: v })} />
            <FieldBlock label="Courriel" value={fields.client_email} editing={editing} onChange={(v) => setFields({ ...fields, client_email: v })} />
            <FieldBlock label="Téléphone" value={fields.client_phone} editing={editing} onChange={(v) => setFields({ ...fields, client_phone: v })} />
            <FieldBlock label="Date de naissance" value={fields.client_dob} editing={editing} onChange={(v) => setFields({ ...fields, client_dob: v })} type="date" />
            <div className="md:col-span-2">
              <FieldBlock label="Adresse" value={fields.client_full_address} editing={editing} onChange={(v) => setFields({ ...fields, client_full_address: v })} />
            </div>
          </div>
        </div>
      </div>

      {/* Account info from profile */}
      {profile && (
        <div className="bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden mb-4">
          <div className="bg-[#0d1421] px-3 py-2 border-b border-slate-700/50">
            <h4 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Profil lié</h4>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-slate-500">Nom complet:</span> <span className="text-slate-100 font-medium ml-1">{profile.full_name || "—"}</span></div>
            <div><span className="text-slate-500">Courriel:</span> <span className="text-slate-100 ml-1">{profile.email || "—"}</span></div>
            <div><span className="text-slate-500">Téléphone:</span> <span className="text-slate-100 ml-1">{profile.phone || "—"}</span></div>
            <div><span className="text-slate-500">Numéro compte:</span> <span className="text-slate-100 font-mono ml-1">{proc.account?.account_number || "—"}</span></div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-slate-700/50">
        <Button size="sm" onClick={() => { proc.setActiveStep("order_review"); }} className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Valider et continuer
        </Button>
        <Button size="sm" onClick={handleFlagFraud} className="text-sm bg-red-700 hover:bg-red-800 text-white">
          <AlertTriangle className="w-3 h-3 mr-1" /> Signaler fraude
        </Button>
      </div>
    </div>
  );
}

function FieldBlock({ label, value, editing, onChange, type = "text" }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">{label}</Label>
      {editing ? (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm bg-[#0d1421] border-slate-700 text-slate-100 rounded-lg" />
      ) : (
        <p className="text-sm font-medium text-slate-100 py-1">{value || "—"}</p>
      )}
    </div>
  );
}
