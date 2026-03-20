/**
 * ClientInfoStep — Step 1: Client information validation
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Edit2, AlertTriangle, Save, X } from "lucide-react";
import { toast } from "sonner";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";

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
        <h3 className="text-base font-bold text-foreground">Information client</h3>
        <div className="flex gap-2">
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="text-xs h-7 border-border text-foreground">
              <Edit2 className="w-3 h-3 mr-1" /> Modifier
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="text-xs h-7 border-border text-foreground">
                <X className="w-3 h-3 mr-1" /> Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={proc.isUpdating} className="text-xs h-7 bg-primary text-primary-foreground hover:bg-primary/90">
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
          {editing ? (
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Adresse</Label>
              <AddressAutocomplete
                value={fields.client_full_address}
                onValueChange={(v) => setFields({ ...fields, client_full_address: v })}
                onSelect={(addr: AddressValue) => {
                  setFields({ ...fields, client_full_address: addr.formatted || addr.line1 });
                }}
                placeholder="Commencez à taper l'adresse..."
                restrictToQuebec={true}
                className="h-9 text-sm border-input text-foreground bg-background"
              />
            </div>
          ) : (
            <FieldBlock label="Adresse" value={fields.client_full_address} editing={false} onChange={() => {}} />
          )}
        </div>
      </div>

      {/* Account info from profile */}
      {profile && (
        <div className="mt-6 p-3 bg-secondary rounded-lg border border-border">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Profil lié</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Nom complet:</span> <span className="text-foreground font-medium">{profile.full_name || "—"}</span></div>
            <div><span className="text-muted-foreground">Courriel:</span> <span className="text-foreground">{profile.email || "—"}</span></div>
            <div><span className="text-muted-foreground">Téléphone:</span> <span className="text-foreground">{profile.phone || "—"}</span></div>
            <div><span className="text-muted-foreground">Numéro compte:</span> <span className="text-foreground font-mono">{proc.account?.account_number || "—"}</span></div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-6 pt-4 border-t border-border">
        <Button size="sm" variant="outline" onClick={() => { proc.setActiveStep("order_review"); }} className="text-xs h-8 border-border text-foreground">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Valider et continuer
        </Button>
        <Button size="sm" variant="outline" onClick={handleFlagFraud} className="text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/10">
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
      <Label className="text-xs text-muted-foreground mb-1">{label}</Label>
      {editing ? (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm border-input text-foreground bg-background" />
      ) : (
        <p className="text-sm font-medium text-foreground py-1">{value || "—"}</p>
      )}
    </div>
  );
}
