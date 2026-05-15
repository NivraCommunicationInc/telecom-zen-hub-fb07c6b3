/**
 * FieldProfile — Professional agent profile with 5 sections:
 *  1. Identity (avatar, name, role, contact)
 *  2. Employment (start date, territory, status)
 *  3. Performance this month (sales, commissions)
 *  4. Pay info (cadence, data allowance)
 *  5. Actions (edit, password, 2FA)
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  User, Mail, Phone, Shield, Loader2, Edit2, Check, X, MapPin,
  Calendar, TrendingUp, DollarSign, Award, KeyRound, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(n || 0);

const BONUS_TIERS = [
  { count: 10, bonus: 100 },
  { count: 20, bonus: 250 },
  { count: 30, bonus: 450 },
  { count: 50, bonus: 750 },
];

function getInitials(name?: string | null, email?: string | null) {
  const src = (name || email || "").trim();
  if (!src) return "AG";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const PROVINCES = ["QC", "ON", "NB", "NS", "PE", "NL", "MB", "SK", "AB", "BC", "YT", "NT", "NU"];

const PAYMENT_LABELS: Record<string, string> = {
  interac: "Virement Interac",
  direct_deposit: "Dépôt direct",
  paypal: "PayPal",
  cheque: "Chèque",
};

const RELATION_OPTIONS = ["Conjoint/e", "Parent", "Frère/Sœur", "Enfant", "Ami/e", "Autre"];

export default function FieldProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    address_street: "",
    address_city: "",
    address_province: "QC",
    address_postal: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["field-profile-pro"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const monthStart = startOfMonth(new Date()).toISOString();

      const [profileRes, roleRes, territoryRes, commRes] = await Promise.all([
        supabase.from("profiles")
          .select("full_name, email, phone, avatar_url, address_street, address_city, address_province, address_postal, date_of_birth, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, payment_method")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("user_roles")
          .select("role, created_at, is_active")
          .eq("user_id", user.id)
          .eq("role", "field_sales")
          .maybeSingle(),
        supabase.from("field_territory_assignments")
          .select("territory_id, status, assigned_from, field_territories(name, territory_code, city)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("assigned_from", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("field_commissions")
          .select("id, amount, status")
          .eq("agent_id", user.id)
          .gte("earned_at", monthStart),
      ]);

      const commissions = commRes.data || [];
      const monthSales = commissions.length;
      const totalAmount = commissions.reduce((s, c: any) => s + Number(c.amount || 0), 0);
      const pendingAmount = commissions.filter((c: any) => c.status === "pending").reduce((s, c: any) => s + Number(c.amount || 0), 0);
      const approvedAmount = commissions.filter((c: any) => ["approved", "validated", "paid"].includes(c.status)).reduce((s, c: any) => s + Number(c.amount || 0), 0);

      const nextTier = BONUS_TIERS.find((t) => monthSales < t.count);
      const nextTierRemaining = nextTier ? nextTier.count - monthSales : 0;

      const p: any = profileRes.data || {};
      const terr: any = (territoryRes.data as any)?.field_territories || null;

      return {
        userId: user.id,
        email: user.email || p.email || "",
        fullName: p.full_name || "",
        phone: p.phone || "",
        avatarUrl: p.avatar_url || null,
        addressStreet: p.address_street || "",
        addressCity: p.address_city || "",
        addressProvince: p.address_province || "QC",
        addressPostal: p.address_postal || "",
        dateOfBirth: p.date_of_birth || null,
        emergencyName: p.emergency_contact_name || "",
        emergencyPhone: p.emergency_contact_phone || "",
        emergencyRelation: p.emergency_contact_relation || "",
        paymentMethod: p.payment_method || "",
        role: roleRes.data?.role || "field_sales",
        startDate: roleRes.data?.created_at || null,
        isActive: roleRes.data?.is_active ?? true,
        territoryName: terr?.name || (terr?.territory_code ? `${terr.territory_code}${terr.city ? " — " + terr.city : ""}` : null),
        territoryFrom: territoryRes.data?.assigned_from || null,
        monthSales,
        totalAmount,
        pendingAmount,
        approvedAmount,
        nextTier,
        nextTierRemaining,
      };
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const { error } = await supabase.from("profiles").update({
        full_name: payload.full_name.trim(),
        phone: payload.phone.trim() || null,
        address_street: payload.address_street.trim() || null,
        address_city: payload.address_city.trim() || null,
        address_province: payload.address_province || null,
        address_postal: payload.address_postal.trim().toUpperCase() || null,
        emergency_contact_name: payload.emergency_contact_name.trim() || null,
        emergency_contact_phone: payload.emergency_contact_phone.trim() || null,
        emergency_contact_relation: payload.emergency_contact_relation.trim() || null,
      } as any).eq("user_id", data!.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["field-profile-pro"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la mise à jour"),
  });

  const sendPasswordReset = async () => {
    if (!data?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/portal/creer-mot-de-passe`,
    });
    if (error) toast.error(error.message);
    else toast.success("Lien de réinitialisation envoyé à votre courriel");
  };

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[#7C3AED]" />
      </div>
    );
  }

  const startEdit = () => {
    setFormData({
      full_name: data.fullName,
      phone: data.phone,
      address_street: data.addressStreet,
      address_city: data.addressCity,
      address_province: data.addressProvince,
      address_postal: data.addressPostal,
      emergency_contact_name: data.emergencyName,
      emergency_contact_phone: data.emergencyPhone,
      emergency_contact_relation: data.emergencyRelation,
    });
    setEditing(true);
  };

  const initials = getInitials(data.fullName, data.email);
  const dobLabel = data.dateOfBirth
    ? format(new Date(data.dateOfBirth), "d MMMM yyyy", { locale: fr })
    : "Non renseigné";
  const homeAddrLabel = [data.addressStreet, data.addressCity, data.addressProvince, data.addressPostal]
    .filter(Boolean).join(", ") || "Non renseigné";

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#111827]">Mon profil</h1>
        {!editing && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#7C3AED] hover:bg-[#EDE9FE] transition-colors min-h-[44px]"
          >
            <Edit2 className="h-3.5 w-3.5" /> Modifier
          </button>
        )}
      </div>

      {/* SECTION 1 — Identity */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          {data.avatarUrl ? (
            <img src={data.avatarUrl} alt={data.fullName} className="h-20 w-20 rounded-2xl object-cover shadow-md" />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center shadow-md text-white text-2xl font-bold">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="text-lg font-bold text-[#111827] border-b-2 border-[#7C3AED] bg-transparent outline-none pb-0.5 w-full"
                placeholder="Nom complet"
              />
            ) : (
              <p className="text-lg font-bold text-[#111827] truncate">{data.fullName || "Non renseigné"}</p>
            )}
            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#6D28D9] text-[10px] font-semibold">
              Agent terrain
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-[#F3F4F6]">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-[#9CA3AF]" />
            <span className="text-sm text-[#374151] truncate">{data.email || "Non renseigné"}</span>
            <span className="ml-auto text-[9px] uppercase tracking-wider text-[#9CA3AF]">Lecture seule</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-[#9CA3AF]" />
            {editing ? (
              <input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Numéro de téléphone"
                className="text-sm text-[#374151] border-b border-[#E5E7EB] bg-transparent outline-none focus:border-[#7C3AED] pb-0.5 flex-1"
              />
            ) : (
              <span className="text-sm text-[#374151]">{data.phone || "Non renseigné"}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-[#9CA3AF]" />
            <div className="flex-1">
              <p className="text-[10px] text-[#9CA3AF]">Date de naissance</p>
              <p className="text-sm text-[#374151]">{dobLabel}</p>
            </div>
            <span className="text-[9px] uppercase tracking-wider text-[#9CA3AF]">Lecture seule</span>
          </div>
        </div>

        {editing && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => updateMutation.mutate(formData)}
              disabled={updateMutation.isPending || !formData.full_name.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#7C3AED] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-colors min-h-[44px]"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Sauvegarder
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#6B7280] hover:bg-[#F9FAFB] transition-colors min-h-[44px] min-w-[44px]"
              aria-label="Annuler"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {/* SECTION — Adresse domicile (editable) */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <h2 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Adresse domicile</h2>
        {editing ? (
          <div className="space-y-3">
            <input
              value={formData.address_street}
              onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
              placeholder="Rue (adresse civique)"
              className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:border-[#7C3AED] outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={formData.address_city}
                onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                placeholder="Ville"
                className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:border-[#7C3AED] outline-none"
              />
              <select
                value={formData.address_province}
                onChange={(e) => setFormData({ ...formData, address_province: e.target.value })}
                className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:border-[#7C3AED] outline-none"
              >
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <input
              value={formData.address_postal}
              onChange={(e) => setFormData({ ...formData, address_postal: e.target.value.toUpperCase() })}
              placeholder="Code postal (H1A 1A1)"
              maxLength={7}
              className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:border-[#7C3AED] outline-none"
            />
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-[#9CA3AF] mt-0.5" />
            <p className="text-sm text-[#374151] flex-1">{homeAddrLabel}</p>
          </div>
        )}
      </section>

      {/* SECTION — Contact d'urgence (editable) */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <h2 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Contact d'urgence</h2>
        {editing ? (
          <div className="space-y-3">
            <input
              value={formData.emergency_contact_name}
              onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
              placeholder="Nom complet"
              className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:border-[#7C3AED] outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={formData.emergency_contact_phone}
                onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                placeholder="Téléphone"
                type="tel"
                className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:border-[#7C3AED] outline-none"
              />
              <select
                value={formData.emergency_contact_relation}
                onChange={(e) => setFormData({ ...formData, emergency_contact_relation: e.target.value })}
                className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:border-[#7C3AED] outline-none"
              >
                <option value="">Relation…</option>
                {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-[#9CA3AF]" />
              <span className="text-sm text-[#374151]">{data.emergencyName || "Non renseigné"}</span>
              {data.emergencyRelation && (
                <span className="text-[10px] text-[#6B7280]">({data.emergencyRelation})</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-[#9CA3AF]" />
              <span className="text-sm text-[#374151]">{data.emergencyPhone || "Non renseigné"}</span>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2 — Employment (read-only) */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <h2 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Emploi <span className="text-[9px] font-normal normal-case tracking-normal text-[#9CA3AF]">— Lecture seule</span></h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-[#9CA3AF]" />
            <div className="flex-1">
              <p className="text-[10px] text-[#9CA3AF]">Date d'entrée</p>
              <p className="text-sm text-[#374151]">
                {data.startDate ? format(new Date(data.startDate), "d MMMM yyyy", { locale: fr }) : "Non renseigné"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-[#9CA3AF]" />
            <div className="flex-1">
              <p className="text-[10px] text-[#9CA3AF]">Territoire assigné</p>
              <p className="text-sm text-[#374151]">{data.territoryName || "Non assigné"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-[#9CA3AF]" />
            <div className="flex-1">
              <p className="text-[10px] text-[#9CA3AF]">Méthode de paiement</p>
              <p className="text-sm text-[#374151]">{PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod || "Non renseigné"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-[#9CA3AF]" />
            <div className="flex-1">
              <p className="text-[10px] text-[#9CA3AF]">Statut</p>
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                data.isActive ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEE2E2] text-[#B91C1C]",
              )}>
                {data.isActive ? "Actif" : "Inactif"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — Performance this month */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <h2 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">
          Performance — {format(new Date(), "MMMM yyyy", { locale: fr })}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#EDE9FE]">
            <TrendingUp className="h-5 w-5 text-[#7C3AED]" />
            <div>
              <p className="text-lg font-bold text-[#111827]">{data.monthSales}</p>
              <p className="text-[10px] text-[#6B7280]">Ventes ce mois</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#DBEAFE]">
            <DollarSign className="h-5 w-5 text-[#3B82F6]" />
            <div>
              <p className="text-lg font-bold text-[#111827]">{fmtMoney(data.totalAmount)}</p>
              <p className="text-[10px] text-[#6B7280]">Commission totale</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FEF3C7]">
            <DollarSign className="h-5 w-5 text-[#D97706]" />
            <div>
              <p className="text-lg font-bold text-[#111827]">{fmtMoney(data.pendingAmount)}</p>
              <p className="text-[10px] text-[#6B7280]">En attente</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#DCFCE7]">
            <Check className="h-5 w-5 text-[#15803D]" />
            <div>
              <p className="text-lg font-bold text-[#111827]">{fmtMoney(data.approvedAmount)}</p>
              <p className="text-[10px] text-[#6B7280]">Approuvée</p>
            </div>
          </div>
        </div>

        {data.nextTier && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] border border-[#F59E0B]/30">
            <Award className="h-5 w-5 text-[#D97706]" />
            <p className="text-xs text-[#78350F]">
              Encore <span className="font-bold">{data.nextTierRemaining} vente{data.nextTierRemaining > 1 ? "s" : ""}</span> pour atteindre le bonus de <span className="font-bold">{fmtMoney(data.nextTier.bonus)}</span>
            </p>
          </div>
        )}
      </section>

      {/* SECTION 4 — Pay */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <h2 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">Paie</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#6B7280]">Cadence des paiements</span>
            <span className="text-[#111827] font-medium">Chaque vendredi</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#6B7280]">Allocation données</span>
            <span className="text-[#111827] font-medium">40 $/mois</span>
          </div>
        </div>
      </section>

      {/* SECTION 5 — Actions */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-2">
        <h2 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">Sécurité</h2>
        <button
          onClick={sendPasswordReset}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#F9FAFB] transition-colors text-left min-h-[44px]"
        >
          <KeyRound className="h-4 w-4 text-[#7C3AED]" />
          <span className="text-sm font-medium text-[#111827] flex-1">Changer mon mot de passe</span>
        </button>
        <button
          onClick={() => navigate("/field/security")}
          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#F9FAFB] transition-colors text-left min-h-[44px]"
        >
          <Lock className="h-4 w-4 text-[#7C3AED]" />
          <span className="text-sm font-medium text-[#111827] flex-1">Sécurité 2FA</span>
        </button>
      </section>
    </div>
  );
}
