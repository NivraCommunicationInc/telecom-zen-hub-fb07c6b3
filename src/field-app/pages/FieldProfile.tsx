/**
 * FieldProfile — Agent profile using backend service layer.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAgentProfile, updateAgentProfile } from "@/field-app/lib/fieldServices";
import { User, Mail, Shield, Loader2, Phone, Edit2, Check, X, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function FieldProfile() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: "", phone: "" });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["field-profile-full"],
    queryFn: fetchAgentProfile,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { full_name: string; phone: string }) => updateAgentProfile(data),
    onSuccess: () => {
      toast.success("Profil mis à jour");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["field-profile-full"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const startEdit = () => {
    setFormData({ full_name: profile?.name ?? "", phone: profile?.phone ?? "" });
    setEditing(true);
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Mon profil</h1>
        {!editing && (
          <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
            <Edit2 className="h-3.5 w-3.5" /> Modifier
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
            <User className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            {editing ? (
              <input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="text-lg font-bold text-foreground border-b-2 border-primary bg-transparent outline-none pb-0.5 w-full" />
            ) : (
              <p className="text-lg font-bold text-foreground">{profile?.name}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{profile?.jobTitle || "Agent terrain"}</p>
            {profile?.createdAt && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Membre depuis {format(new Date(profile.createdAt), "MMMM yyyy", { locale: fr })}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{profile?.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {editing ? (
              <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Numéro de téléphone"
                className="text-sm text-foreground border-b border-border bg-transparent outline-none focus:border-primary pb-0.5 flex-1" />
            ) : (
              <span className="text-sm text-foreground">{profile?.phone || "—"}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Rôle : {profile?.role || "field_sales"}</span>
          </div>
        </div>

        {editing && (
          <div className="flex gap-2 pt-2">
            <button onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending || !formData.full_name.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-colors">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Sauvegarder
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Statistiques carrière</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Ventes totales", value: profile?.totalSales ?? 0, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Revenu généré", value: `${(profile?.totalRevenue ?? 0).toFixed(0)} $`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Commissions totales", value: `${(profile?.totalCommissions ?? 0).toFixed(0)} $`, icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Commissions payées", value: `${(profile?.paidCommissions ?? 0).toFixed(0)} $`, icon: Check, color: "text-emerald-700", bg: "bg-emerald-50" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
