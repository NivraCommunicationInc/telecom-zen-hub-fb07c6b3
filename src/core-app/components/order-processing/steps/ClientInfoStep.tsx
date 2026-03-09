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
    await proc.changeStatus("fraud", "Flagged as potential fraud by admin");
    toast.warning("Commande marquée comme fraude potentielle");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">Information client</h3>
        <div className="flex gap-2">
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="text-xs h-7 border-gray-300 text-gray-700">
              <Edit2 className="w-3 h-3 mr-1" /> Modifier
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="text-xs h-7 border-gray-300 text-gray-700">
                <X className="w-3 h-3 mr-1" /> Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={proc.isUpdating} className="text-xs h-7 bg-gray-900 text-white hover:bg-gray-800">
                <Save className="w-3 h-3 mr-1" /> Sauvegarder
              </Button>
            </>
          )}
        </div>
      </div>

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

      {/* Account info from profile */}
      {profile && (
        <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Profil lié</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-500">Nom complet:</span> <span className="text-gray-900 font-medium">{profile.full_name || "—"}</span></div>
            <div><span className="text-gray-500">Courriel:</span> <span className="text-gray-900">{profile.email || "—"}</span></div>
            <div><span className="text-gray-500">Téléphone:</span> <span className="text-gray-900">{profile.phone || "—"}</span></div>
            <div><span className="text-gray-500">Numéro compte:</span> <span className="text-gray-900 font-mono">{profile.account_number || proc.account?.account_number || "—"}</span></div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
        <Button size="sm" variant="outline" onClick={() => { proc.setActiveStep("order_review"); }} className="text-xs h-8 border-gray-300 text-gray-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Valider et continuer
        </Button>
        <Button size="sm" variant="outline" onClick={handleFlagFraud} className="text-xs h-8 border-red-300 text-red-600 hover:bg-red-50">
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
      <Label className="text-xs text-gray-500 mb-1">{label}</Label>
      {editing ? (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm border-gray-300 text-gray-900" />
      ) : (
        <p className="text-sm font-medium text-gray-900 py-1">{value || "—"}</p>
      )}
    </div>
  );
}
