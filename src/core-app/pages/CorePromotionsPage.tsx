/**
 * CorePromotionsPage — Full Promotion Management Console
 * Ported from AdminPromotions with all features:
 * - Full CRUD (create, edit, duplicate, toggle status)
 * - 3-tab form: General, Restrictions, Preview calculator
 * - Applies-to system, scope, email domain restrictions
 * - Usage limits, stackable, new_customers_only, duration
 * - Redemption counts + unique users
 * - TPS/TVQ preview calculator
 */
import { useState, useEffect, useMemo } from "react";
import { estimateTaxes, TAX_DISPLAY } from "@/lib/pricing/serverTaxEngine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tag, Search, Plus, Edit, Copy, Eye, ToggleLeft, ToggleRight, Percent, DollarSign, RefreshCcw, XCircle, Calculator } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface Promotion {
  id: string; code: string; name: string; description: string | null;
  status: string; discount_type: string; discount_value: number;
  applies_to: Record<string, boolean>; scope: string;
  restricted_email_domains: string[] | null;
  min_subtotal: number | null; max_discount_amount: number | null;
  start_at: string | null; end_at: string | null;
  usage_limit_total: number | null; usage_limit_per_client: number | null;
  stackable: boolean; new_customers_only: boolean; duration: string | null;
  created_at: string; updated_at: string;
  redemption_count?: number; unique_users_count?: number;
}

const defaultAppliesTo = { services: true, one_time_fees: true, equipment: true, delivery: true, installation: true };

const defaultForm = {
  code: "", name: "", description: "", status: "active", discount_type: "percent", discount_value: 10,
  applies_to: { ...defaultAppliesTo } as Record<string, boolean>, scope: "global",
  restricted_email_domains: "", min_subtotal: "", max_discount_amount: "",
  start_at: "", end_at: "", usage_limit_total: "", usage_limit_per_client: "",
  stackable: false, new_customers_only: false, duration: "ongoing",
};

export default function CorePromotionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ ...defaultForm });
  const [formTab, setFormTab] = useState<"general" | "restrictions" | "preview">("general");
  const [previewSubtotal, setPreviewSubtotal] = useState(100);

  const { data: promotions = [], isLoading, refetch } = useQuery({
    queryKey: ["core-promotions"],
    queryFn: async () => {
      const { data: promos, error } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const promoIds = (promos || []).map((p: any) => p.id);
      const { data: redemptions } = await supabase.from("promotion_redemptions").select("promotion_id, client_id").in("promotion_id", promoIds.length ? promoIds : ["__none__"]);
      const countMap: Record<string, number> = {};
      const uniqueMap: Record<string, Set<string>> = {};
      (redemptions || []).forEach((r: any) => {
        countMap[r.promotion_id] = (countMap[r.promotion_id] || 0) + 1;
        if (!uniqueMap[r.promotion_id]) uniqueMap[r.promotion_id] = new Set();
        if (r.client_id) uniqueMap[r.promotion_id].add(r.client_id);
      });
      return (promos || []).map((p: any) => ({
        ...p, applies_to: p.applies_to as Record<string, boolean>,
        redemption_count: countMap[p.id] || 0,
        unique_users_count: uniqueMap[p.id]?.size || 0,
      })) as Promotion[];
    },
  });

  const filtered = useMemo(() => {
    return promotions.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [promotions, search, statusFilter]);

  const resetForm = () => { setFormData({ ...defaultForm }); setFormTab("general"); };

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) { toast.error("Code et nom requis"); return; }
    if (formData.discount_value <= 0) { toast.error("Valeur doit être positive"); return; }
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const promoData = {
        code: formData.code.trim().toUpperCase(), name: formData.name.trim(),
        description: formData.description.trim() || null, status: formData.status,
        discount_type: formData.discount_type, discount_value: formData.discount_value,
        applies_to: formData.applies_to, scope: formData.scope,
        restricted_email_domains: formData.restricted_email_domains ? formData.restricted_email_domains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean) : null,
        min_subtotal: formData.min_subtotal ? parseFloat(formData.min_subtotal) : null,
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        start_at: formData.start_at || null, end_at: formData.end_at || null,
        usage_limit_total: formData.usage_limit_total ? parseInt(formData.usage_limit_total) : null,
        usage_limit_per_client: formData.usage_limit_per_client ? parseInt(formData.usage_limit_per_client) : null,
        stackable: formData.stackable, new_customers_only: formData.new_customers_only,
        duration: formData.duration || null, created_by_admin_id: user?.id || null,
      };
      if (isEditing && selectedPromo) {
        const { error } = await supabase.from("promotions").update(promoData).eq("id", selectedPromo.id);
        if (error) throw error;
        toast.success("Promotion mise à jour");
      } else {
        const { error } = await supabase.from("promotions").insert(promoData);
        if (error) throw error;
        toast.success(`Promotion créée: ${promoData.code}`);
      }
      setShowDialog(false); resetForm(); setIsEditing(false); refetch();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Ce code existe déjà" : e.message);
    } finally { setIsSubmitting(false); }
  };

  const handleToggle = async (promo: Promotion) => {
    const newStatus = promo.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("promotions").update({ status: newStatus }).eq("id", promo.id);
    if (error) { toast.error("Erreur"); return; }
    toast.success(`Promotion ${newStatus === "active" ? "activée" : "désactivée"}`);
    refetch();
  };

  const handleEdit = (promo: Promotion) => {
    setSelectedPromo(promo);
    setFormData({
      code: promo.code, name: promo.name, description: promo.description || "",
      status: promo.status, discount_type: promo.discount_type, discount_value: promo.discount_value,
      applies_to: promo.applies_to || { ...defaultAppliesTo }, scope: promo.scope,
      restricted_email_domains: promo.restricted_email_domains?.join(", ") || "",
      min_subtotal: promo.min_subtotal?.toString() || "", max_discount_amount: promo.max_discount_amount?.toString() || "",
      start_at: promo.start_at?.slice(0, 16) || "", end_at: promo.end_at?.slice(0, 16) || "",
      usage_limit_total: promo.usage_limit_total?.toString() || "", usage_limit_per_client: promo.usage_limit_per_client?.toString() || "",
      stackable: promo.stackable, new_customers_only: promo.new_customers_only || false,
      duration: promo.duration || "ongoing",
    });
    setIsEditing(true); setFormTab("general"); setShowDialog(true);
  };

  const handleDuplicate = (promo: Promotion) => {
    handleEdit(promo);
    setFormData((prev) => ({ ...prev, code: `${promo.code}-COPY`, name: `${promo.name} (Copie)`, status: "inactive" }));
    setIsEditing(false);
  };

  const calcPreview = () => {
    if (!previewSubtotal || previewSubtotal <= 0) return 0;
    let d = formData.discount_type === "percent" ? previewSubtotal * (formData.discount_value / 100) : Math.min(formData.discount_value, previewSubtotal);
    if (formData.max_discount_amount && parseFloat(formData.max_discount_amount) > 0) d = Math.min(d, parseFloat(formData.max_discount_amount));
    return Math.round(d * 100) / 100;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Promotions & codes promo</h1>
          <p className="text-xs text-[#94A3B8]">{promotions.filter((p) => p.status === "active").length} actives • {promotions.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { resetForm(); setIsEditing(false); setShowDialog(true); }} className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nouvelle promotion
          </button>
          <Tag className="h-5 w-5 text-emerald-400" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, nom…"
            className="w-full h-8 pl-8 pr-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-emerald-500/50" />
        </div>
        <div className="flex gap-1.5">
          {["all", "active", "inactive"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${statusFilter === s ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30" : "text-[#94A3B8] border border-[hsl(220,15%,18%)] hover:text-[#CBD5E1]"}`}>
              {s === "all" ? "Toutes" : s === "active" ? "Actives" : "Inactives"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[hsl(220,15%,16%)]">
                {["Code", "Nom", "Type", "Valeur", "Statut", "Période", "Utilisations", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(220,15%,14%)]">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-3 py-3"><div className="h-4 bg-[hsl(220,15%,14%)] rounded animate-pulse" /></td></tr>)
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#64748B]">Aucune promotion</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-[hsl(220,15%,13%)] transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[#38BDF8] font-medium">{p.code}</td>
                    <td className="px-3 py-2.5 text-[#F8FAFC]">{p.name}</td>
                    <td className="px-3 py-2.5 text-[#CBD5E1]">
                      {p.discount_type === "percent" ? <><Percent className="h-3 w-3 inline mr-1" />%</> : <><DollarSign className="h-3 w-3 inline mr-1" />$</>}
                    </td>
                    <td className="px-3 py-2.5 text-[#F8FAFC] font-medium">{p.discount_type === "percent" ? `${p.discount_value}%` : `${p.discount_value.toFixed(2)} $`}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-[#64748B]/20 text-[#64748B]"}`}>
                        {p.status === "active" ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#94A3B8] text-[11px]">
                      {p.start_at && p.end_at ? `${format(new Date(p.start_at), "d MMM", { locale: fr })} - ${format(new Date(p.end_at), "d MMM yy", { locale: fr })}` :
                       p.start_at ? `Dès ${format(new Date(p.start_at), "d MMM yy", { locale: fr })}` :
                       p.end_at ? `Jusqu'au ${format(new Date(p.end_at), "d MMM yy", { locale: fr })}` : "Illimité"}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-[#F8FAFC] font-medium">{p.redemption_count || 0}{p.usage_limit_total ? ` / ${p.usage_limit_total}` : ""}</div>
                      <div className="text-[10px] text-[#94A3B8]">{p.unique_users_count || 0} client{(p.unique_users_count || 0) !== 1 ? "s" : ""}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedPromo(p); setShowDetails(true); }} className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors" title="Détails"><Eye className="h-3 w-3" /></button>
                        <button onClick={() => handleEdit(p)} className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors" title="Modifier"><Edit className="h-3 w-3" /></button>
                        <button onClick={() => handleDuplicate(p)} className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors" title="Dupliquer"><Copy className="h-3 w-3" /></button>
                        <button onClick={() => handleToggle(p)} className="h-6 w-6 flex items-center justify-center rounded border border-[hsl(220,15%,20%)] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors" title="Activer/Désactiver">
                          {p.status === "active" ? <ToggleRight className="h-3 w-3 text-emerald-400" /> : <ToggleLeft className="h-3 w-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ CREATE/EDIT DIALOG ═══ */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-2xl rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#F8FAFC]">{isEditing ? "Modifier la promotion" : "Nouvelle promotion"}</h2>
              <button onClick={() => { setShowDialog(false); resetForm(); setIsEditing(false); }} className="text-[#64748B] hover:text-[#F8FAFC]"><XCircle className="h-5 w-5" /></button>
            </div>

            {/* Form tabs */}
            <div className="flex gap-1.5 border-b border-[hsl(220,15%,14%)]">
              {(["general", "restrictions", "preview"] as const).map((t) => (
                <button key={t} onClick={() => setFormTab(t)}
                  className={`px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors ${formTab === t ? "bg-[hsl(220,15%,14%)] text-emerald-400 border border-[hsl(220,15%,18%)] border-b-transparent -mb-px" : "text-[#94A3B8] hover:text-[#CBD5E1]"}`}>
                  {t === "general" ? "Général" : t === "restrictions" ? "Restrictions" : "Aperçu"}
                </button>
              ))}
            </div>

            {formTab === "general" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Code *</label>
                    <input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                      placeholder="EX: PROMO2025" className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] font-mono placeholder:text-[#64748B] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Statut</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                      <option value="active">Actif</option><option value="inactive">Inactif</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Nom *</label>
                  <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nom de la promotion"
                    className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optionnelle…" rows={2}
                    className="w-full rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] p-3 focus:outline-none resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Type de réduction</label>
                    <select value={formData.discount_type} onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                      className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                      <option value="percent">Pourcentage (%)</option><option value="fixed_amount">Montant fixe ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Valeur *</label>
                    <input type="number" min="0" max={formData.discount_type === "percent" ? "100" : undefined} value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                      className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-2">S'applique à</label>
                  <div className="flex flex-wrap gap-2">
                    {[{ key: "services", label: "Services" }, { key: "one_time_fees", label: "Frais uniques" }, { key: "equipment", label: "Équipement" }, { key: "delivery", label: "Livraison" }, { key: "installation", label: "Installation" }].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-1.5 text-[12px] text-[#CBD5E1] cursor-pointer">
                        <input type="checkbox" checked={formData.applies_to[key]} onChange={(e) => setFormData({ ...formData, applies_to: { ...formData.applies_to, [key]: e.target.checked } })}
                          className="rounded border-[hsl(220,15%,20%)] bg-[hsl(220,20%,9%)]" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Date début</label>
                    <input type="datetime-local" value={formData.start_at} onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                      className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Date fin</label>
                    <input type="datetime-local" value={formData.end_at} onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                      className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none" />
                  </div>
                </div>
              </div>
            )}

            {formTab === "restrictions" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Portée</label>
                  <select value={formData.scope} onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                    <option value="global">Globale (tous les clients)</option><option value="restricted">Restreinte</option>
                  </select>
                </div>
                {formData.scope === "restricted" && (
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Domaines email autorisés</label>
                    <input value={formData.restricted_email_domains} onChange={(e) => setFormData({ ...formData, restricted_email_domains: e.target.value })} placeholder="ex.com, entreprise.ca"
                      className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Sous-total min ($)</label>
                    <input type="number" min="0" value={formData.min_subtotal} onChange={(e) => setFormData({ ...formData, min_subtotal: e.target.value })} placeholder="Optionnel"
                      className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Réduction max ($)</label>
                    <input type="number" min="0" value={formData.max_discount_amount} onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })} placeholder="Optionnel"
                      className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Limite totale</label>
                    <input type="number" min="0" value={formData.usage_limit_total} onChange={(e) => setFormData({ ...formData, usage_limit_total: e.target.value })} placeholder="Illimité"
                      className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Limite par client</label>
                    <input type="number" min="0" value={formData.usage_limit_per_client} onChange={(e) => setFormData({ ...formData, usage_limit_per_client: e.target.value })} placeholder="Illimité"
                      className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[12px] text-[#CBD5E1] cursor-pointer">
                    <input type="checkbox" checked={formData.stackable} onChange={(e) => setFormData({ ...formData, stackable: e.target.checked })} className="rounded" />
                    Cumulable avec d'autres promotions
                  </label>
                  <label className="flex items-center gap-2 text-[12px] text-[#CBD5E1] cursor-pointer">
                    <input type="checkbox" checked={formData.new_customers_only} onChange={(e) => setFormData({ ...formData, new_customers_only: e.target.checked })} className="rounded" />
                    Nouveaux clients uniquement
                  </label>
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Durée du rabais</label>
                  <select value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full h-8 px-2 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[12px] text-[#F8FAFC] focus:outline-none">
                    <option value="ongoing">Continu (tous les cycles)</option><option value="first_cycle_only">Premier mois seulement</option>
                  </select>
                </div>
              </div>
            )}

            {formTab === "preview" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-[#94A3B8] uppercase block mb-1">Sous-total d'exemple ($)</label>
                  <input type="number" min="0" value={previewSubtotal} onChange={(e) => setPreviewSubtotal(parseFloat(e.target.value) || 0)}
                    className="w-full h-8 px-3 rounded-md border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,11%)] text-[13px] text-[#F8FAFC] focus:outline-none" />
                </div>
                <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,14%)] p-4 space-y-2 text-[13px]">
                  <div className="flex justify-between"><span className="text-[#94A3B8]">Sous-total</span><span className="text-[#F8FAFC]">{previewSubtotal.toFixed(2)} $</span></div>
                  <div className="flex justify-between text-emerald-400"><span>Réduction ({formData.code || "CODE"})</span><span>-{calcPreview().toFixed(2)} $</span></div>
                  <div className="flex justify-between border-t border-[hsl(220,15%,18%)] pt-2 font-bold"><span className="text-[#F8FAFC]">Après réduction</span><span className="text-[#F8FAFC]">{(previewSubtotal - calcPreview()).toFixed(2)} $</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-[#94A3B8]">TPS (5%)</span><span className="text-[#CBD5E1]">{((previewSubtotal - calcPreview()) * 0.05).toFixed(2)} $</span></div>
                  <div className="flex justify-between text-[11px]"><span className="text-[#94A3B8]">TVQ (9.975%)</span><span className="text-[#CBD5E1]">{((previewSubtotal - calcPreview()) * 0.09975).toFixed(2)} $</span></div>
                  <div className="flex justify-between border-t border-[hsl(220,15%,18%)] pt-2 font-bold text-[15px]"><span className="text-[#F8FAFC]">Total</span><span className="text-[#F8FAFC]">{((previewSubtotal - calcPreview()) * 1.14975).toFixed(2)} $</span></div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowDialog(false); resetForm(); setIsEditing(false); }} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] text-[12px] font-medium">Annuler</button>
              <button onClick={handleSave} disabled={isSubmitting} className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50">
                {isEditing ? "Mettre à jour" : "Créer la promotion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DETAILS DIALOG ═══ */}
      {showDetails && selectedPromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#F8FAFC] font-mono">{selectedPromo.code}</h2>
              <button onClick={() => { setShowDetails(false); setSelectedPromo(null); }} className="text-[#64748B] hover:text-[#F8FAFC]"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3 space-y-2 text-[12px]">
              {[
                ["Nom", selectedPromo.name],
                ["Description", selectedPromo.description || "—"],
                ["Type", selectedPromo.discount_type === "percent" ? "Pourcentage" : "Montant fixe"],
                ["Valeur", selectedPromo.discount_type === "percent" ? `${selectedPromo.discount_value}%` : `${selectedPromo.discount_value.toFixed(2)} $`],
                ["Statut", selectedPromo.status === "active" ? "Actif" : "Inactif"],
                ["Portée", selectedPromo.scope],
                ["Utilisations", `${selectedPromo.redemption_count || 0}${selectedPromo.usage_limit_total ? ` / ${selectedPromo.usage_limit_total}` : ""}`],
                ["Clients uniques", `${selectedPromo.unique_users_count || 0}`],
                ["Nouveaux clients", selectedPromo.new_customers_only ? "Oui" : "Non"],
                ["Cumulable", selectedPromo.stackable ? "Oui" : "Non"],
                ["Durée", selectedPromo.duration === "first_cycle_only" ? "1er mois" : "Continu"],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between"><span className="text-[#94A3B8]">{l}</span><span className="text-[#F8FAFC] font-medium text-right max-w-[200px]">{v}</span></div>
              ))}
            </div>
            {selectedPromo.applies_to && (
              <div className="text-[12px]">
                <span className="text-[#94A3B8]">S'applique à: </span>
                <span className="text-[#CBD5E1]">
                  {Object.entries(selectedPromo.applies_to).filter(([_, v]) => v).map(([k]) => ({ services: "Services", one_time_fees: "Frais uniques", equipment: "Équipement", delivery: "Livraison", installation: "Installation" }[k] || k)).join(", ")}
                </span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowDetails(false); handleEdit(selectedPromo); }} className="h-8 px-3 rounded-md bg-[hsl(220,15%,16%)] text-[#CBD5E1] text-[12px] font-medium hover:text-[#F8FAFC] transition-colors flex items-center gap-1.5">
                <Edit className="h-3.5 w-3.5" /> Modifier
              </button>
              <button onClick={() => { handleToggle(selectedPromo); setShowDetails(false); setSelectedPromo(null); }} className="h-8 px-3 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[12px] font-medium hover:bg-emerald-600/30 transition-colors">
                {selectedPromo.status === "active" ? "Désactiver" : "Activer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
