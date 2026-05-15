import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Trash2, FileText, AlertTriangle, CheckCircle2, ShieldCheck, Mail, Phone, MapPin,
  CreditCard, Download, Loader2, Edit3, Save, X as XIcon, Calendar, Plus,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import CommissionGridTables from "@/components/commissions/CommissionGridTables";

const RULE_TYPES: Record<string, string> = {
  flat_per_sale: "Forfait/vente",
  percentage_revenue: "% du revenu",
  tier_volume: "Palier de volume",
};

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  approved: { cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", label: "Approuvé" },
  pending: { cls: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", label: "Attente" },
  validated: { cls: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", label: "Validé" },
  paid: { cls: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", label: "Payé" },
  rejected: { cls: "border-red-300 bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300", label: "Rejeté" },
};

const RELATION_LABELS: Record<string, string> = {
  conjoint: "Conjoint(e)", parent: "Parent", enfant: "Enfant", frere_soeur: "Frère / Sœur", ami: "Ami(e)", autre: "Autre",
};

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAYS_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const SERVICES: Array<{ key: string; label: string }> = [
  { key: "internet", label: "Internet" },
  { key: "tv", label: "TV" },
  { key: "mobile", label: "Mobile" },
  { key: "all", label: "Tous services" },
];

const fmtMoney = (n: number) => `${(n || 0).toFixed(2)} $`;
const maskAccount = (v?: string | null, keep: number = 3) => {
  if (!v) return "—";
  const s = String(v);
  if (s.length <= keep) return "•".repeat(s.length);
  return "•".repeat(Math.max(0, s.length - keep)) + s.slice(-keep);
};

interface Props {
  userId: string;
  assignments: any[];
  rules: any[];
  commissions: any[];
  onDeleteAssignment: (id: string) => void;
  onMarkPaid: (id: string) => void;
}

export default function AgentDetailTabs({ userId, assignments, rules, commissions, onDeleteAssignment, onMarkPaid }: Props) {
  const { data: profile } = useQuery({
    queryKey: ["core-field", "profile-full", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, full_name, email, phone, hire_date, date_of_birth, address_street, address_city, address_province, address_postal, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, payment_method, bank_institution, bank_transit, bank_account, interac_email, terms_accepted_at, terms_accepted_version, mfa_method, mfa_configured_at, sector_tags, agent_number, professional_email" as any)
        .eq("user_id", userId as any)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  /* Realtime — keep agent profile, commissions and orders in sync. */
  usePortalRealtime(
    ["field_commissions", "orders", "sales_targets"],
    [
      ["core-field", "profile-full", userId],
      ["core-field", "agent-commissions", userId],
      ["core-field", "agent-orders", userId],
    ],
  );

  const ac = commissions;

  return (
    <Tabs defaultValue="grids" className="w-full">
      <TabsList className="w-full justify-start flex-wrap h-auto">
        <TabsTrigger value="grids">Grilles & Commissions</TabsTrigger>
        <TabsTrigger value="commission_grid">Commissions & Bonus</TabsTrigger>
        <TabsTrigger value="profile">Profil complet</TabsTrigger>
        <TabsTrigger value="schedule">Horaire</TabsTrigger>
        <TabsTrigger value="documents">Documents RH</TabsTrigger>
      </TabsList>

      {/* === Grilles & commissions === */}
      <TabsContent value="grids" className="space-y-4 mt-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-2">Grilles assignées</h3>
          {assignments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Aucune grille assignée</p>
          ) : assignments.map((as: any) => {
            const rule = rules.find((r: any) => r.id === as.rule_id);
            return (
              <div key={as.id} className="flex items-center justify-between p-2 rounded border border-border mb-1">
                <div>
                  <p className="text-sm font-medium text-foreground">{rule?.rule_name || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{RULE_TYPES[rule?.rule_type] || rule?.rule_type} · {rule?.bonus_amount > 0 ? `${rule.bonus_amount}$` : `${rule?.bonus_percentage}%`}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onDeleteAssignment(as.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>

        <CustomRatesSection userId={userId} />

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-2">Historique commissions</h3>
          {ac.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">Aucune</p> : ac.slice(0, 30).map((c: any) => {
            const b = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
            return (
              <div key={c.id} className="flex items-center justify-between p-2 rounded border border-border mb-1">
                <div>
                  <span className="text-sm font-semibold text-foreground">{fmtMoney(Number(c.commission_amount))}</span>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border ml-1", b.cls)}>{b.label}</span>
                  <p className="text-[10px] text-muted-foreground">{fmtMoney(Number(c.sale_amount))} @ {(Number(c.commission_rate) * 100).toFixed(0)}%</p>
                </div>
                <div className="flex items-center gap-1">
                  {c.status === "validated" && <Button size="sm" variant="outline" onClick={() => onMarkPaid(c.id)}>Payer</Button>}
                  <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yy")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>

      {/* === Commission & Bonus grids + agent commissions + targets === */}
      <TabsContent value="commission_grid" className="space-y-4 mt-4">
        <CommissionAndBonusTab userId={userId} commissions={ac} />
      </TabsContent>

      {/* === Profil complet (editable) === */}
      <TabsContent value="profile" className="space-y-4 mt-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground mb-2">Identifiants Nivra (lecture seule)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Numéro d'agent</p>
              <p className="font-mono font-semibold text-foreground">{profile?.agent_number || "En cours d'attribution"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Badge</p>
              <p className="font-mono font-semibold text-foreground">{profile?.agent_number || "En cours d'attribution"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Courriel professionnel</p>
              <p className="text-foreground">{profile?.professional_email ? `${profile.professional_email} (à venir)` : "À venir"}</p>
            </div>
          </div>
        </div>
        <EditableProfileSection userId={userId} profile={profile} />
      </TabsContent>

      {/* === Horaire === */}
      <TabsContent value="schedule" className="space-y-4 mt-4">
        <ScheduleSection userId={userId} />
      </TabsContent>

      {/* === Documents RH === */}
      <TabsContent value="documents" className="space-y-4 mt-4">
        <EmploymentDocsSection userId={userId} agentName={profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "agent"} />

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Conditions d'utilisation</h3>
          {profile?.terms_accepted_at ? (
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-foreground">
                Acceptées le <strong>{format(new Date(profile.terms_accepted_at), "dd MMM yyyy")}</strong>
                {profile.terms_accepted_version ? <> — version <strong>{profile.terms_accepted_version}</strong></> : null}
              </span>
            </div>
          ) : (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Non acceptées</Badge>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Authentification multi-facteurs (MFA)</h3>
          {profile?.mfa_configured_at && profile?.mfa_method ? (
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-foreground">
                MFA actif — <strong>{profile.mfa_method === "email" ? "Email" : "Application TOTP"}</strong> ✓
                {" — configuré le "}<strong>{format(new Date(profile.mfa_configured_at), "dd MMM yyyy")}</strong>
              </span>
            </div>
          ) : (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> ⚠️ MFA non configuré</Badge>
          )}
        </div>

        <TaxDocumentsSection userId={userId} />
      </TabsContent>
    </Tabs>
  );
}

/* ════════════════════════════════════════════════════════════════
   EDITABLE PROFILE SECTION
   ════════════════════════════════════════════════════════════════ */
function EditableProfileSection({ userId, profile }: { userId: string; profile: any }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<any>({});
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const { data: targets = [] } = useQuery({
    queryKey: ["agent-targets", userId, currentYear, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_targets")
        .select("id, service_type, target_count, target_amount")
        .eq("employee_id", userId)
        .eq("period_year", currentYear)
        .eq("period_month", currentMonth);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!profile) return;
    const tMap = (svc: string) => targets.find((t: any) => t.service_type === svc);
    setForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      address_street: profile.address_street || "",
      address_city: profile.address_city || "",
      address_province: profile.address_province || "QC",
      address_postal: profile.address_postal || "",
      date_of_birth: profile.date_of_birth || "",
      hire_date: profile.hire_date || "",
      emergency_contact_name: profile.emergency_contact_name || "",
      emergency_contact_relation: profile.emergency_contact_relation || "",
      emergency_contact_phone: profile.emergency_contact_phone || "",
      payment_method: profile.payment_method || "direct_deposit",
      bank_institution: profile.bank_institution || "",
      bank_transit: profile.bank_transit || "",
      bank_account: profile.bank_account || "",
      interac_email: profile.interac_email || "",
      territory: (Array.isArray(profile.sector_tags) && profile.sector_tags[0]) || "",
      target_internet: String(tMap("internet")?.target_count ?? 0),
      target_tv: String(tMap("tv")?.target_count ?? 0),
      target_mobile: String(tMap("mobile")?.target_count ?? 0),
      target_total_sales: String(tMap("total_sales")?.target_count ?? 0),
      target_revenue: String(tMap("revenue")?.target_amount ?? 0),
    });
  }, [profile, targets]);

  const save = useMutation({
    mutationFn: async () => {
      // 1) admin-manage-staff for full_name/email/phone (handles auth.email rotation)
      const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
      const { data: r1, error: e1 } = await supabase.functions.invoke("admin-manage-staff", {
        body: {
          action: "update_profile",
          user_id: userId,
          full_name: fullName || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
        },
      });
      if (e1) throw e1;
      const r1p = typeof r1 === "string" ? JSON.parse(r1) : r1;
      if (!r1p?.ok && !r1p?.success) throw new Error(r1p?.error?.message || r1p?.message || "Échec mise à jour profil");

      // 2) profiles direct update for extended fields
      const profileUpdate: Record<string, any> = {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        address_street: form.address_street.trim() || null,
        address_city: form.address_city.trim() || null,
        address_province: form.address_province.trim() || null,
        address_postal: form.address_postal.trim().toUpperCase() || null,
        date_of_birth: form.date_of_birth || null,
        hire_date: form.hire_date || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_relation: form.emergency_contact_relation.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        payment_method: form.payment_method,
        sector_tags: form.territory ? [form.territory.trim()] : [],
      };
      if (form.payment_method === "direct_deposit") {
        profileUpdate.bank_institution = form.bank_institution.trim() || null;
        profileUpdate.bank_transit = form.bank_transit.trim() || null;
        profileUpdate.bank_account = form.bank_account.trim() || null;
        profileUpdate.interac_email = null;
      } else if (form.payment_method === "interac") {
        profileUpdate.interac_email = form.interac_email.trim().toLowerCase() || null;
        profileUpdate.bank_institution = null;
        profileUpdate.bank_transit = null;
        profileUpdate.bank_account = null;
      }
      const { error: e2 } = await supabase.from("profiles").update(profileUpdate as any).eq("user_id", userId as any);
      if (e2) throw e2;

      // 2b) Territory assignment — create territory if needed, end prior, insert new
      const territoryName = (form.territory || "").trim();
      if (territoryName) {
        const { data: existingTerr } = await supabase
          .from("field_territories")
          .select("id, name")
          .ilike("name", territoryName)
          .maybeSingle();
        let territoryId = existingTerr?.id as string | undefined;
        if (!territoryId) {
          const code = territoryName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 24) || `TERR_${Date.now()}`;
          const { data: created, error: ctErr } = await supabase
            .from("field_territories")
            .insert({ name: territoryName, territory_code: code, status: "active" } as any)
            .select("id")
            .single();
          if (ctErr) throw ctErr;
          territoryId = created!.id as string;
        }
        // End any active prior assignment for this user
        await supabase
          .from("field_territory_assignments")
          .update({ status: "ended", assigned_to: new Date().toISOString() } as any)
          .eq("user_id", userId as any)
          .eq("status", "active");
        // Insert new active assignment (skip if already active on this territory)
        const { data: stillActive } = await supabase
          .from("field_territory_assignments")
          .select("id")
          .eq("user_id", userId as any)
          .eq("territory_id", territoryId as any)
          .eq("status", "active")
          .maybeSingle();
        if (!stillActive) {
          const { error: aErr } = await supabase.from("field_territory_assignments").insert({
            user_id: userId,
            territory_id: territoryId,
            status: "active",
            assigned_from: new Date().toISOString(),
          } as any);
          if (aErr) throw aErr;
        }
      }

      // 3) sales_targets upsert per service for current month
      const targetsRows = [
        { service_type: "internet", target_count: parseInt(form.target_internet) || 0, target_amount: 0 },
        { service_type: "tv", target_count: parseInt(form.target_tv) || 0, target_amount: 0 },
        { service_type: "mobile", target_count: parseInt(form.target_mobile) || 0, target_amount: 0 },
        { service_type: "total_sales", target_count: parseInt(form.target_total_sales) || 0, target_amount: 0 },
        { service_type: "revenue", target_count: 0, target_amount: parseFloat(form.target_revenue) || 0 },
      ];
      for (const t of targetsRows) {
        if (t.target_count <= 0 && t.target_amount <= 0) continue;
        await supabase.from("sales_targets").upsert(
          {
            employee_id: userId,
            role: "field_sales",
            service_type: t.service_type,
            target_count: t.target_count,
            target_amount: t.target_amount,
            period_month: currentMonth,
            period_year: currentYear,
          } as any,
          { onConflict: "employee_id,service_type,period_month,period_year" }
        );
      }
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      qc.invalidateQueries({ queryKey: ["core-field"] });
      qc.invalidateQueries({ queryKey: ["agent-targets", userId] });
      setEdit(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur sauvegarde profil"),
  });

  const fullAddress = [profile?.address_street, profile?.address_city, profile?.address_province, profile?.address_postal].filter(Boolean).join(", ");
  const p = profile || {};

  if (!edit) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEdit(true)}><Edit3 className="h-3 w-3 mr-1" /> Modifier</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Mail className="h-4 w-4" /> Informations personnelles</h3>
            <dl className="space-y-1.5 text-xs">
              <Row label="Prénom" value={p.first_name} />
              <Row label="Nom" value={p.last_name} />
              <Row label="Courriel" value={p.email} />
              <Row label="Téléphone" value={p.phone} />
              <Row label="Date d'embauche" value={p.hire_date} />
              <Row label="Date de naissance" value={p.date_of_birth} />
              <Row label="Territoire" value={Array.isArray(p.sector_tags) ? p.sector_tags[0] : null} />
            </dl>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" /> Adresse</h3>
            {fullAddress ? <p className="text-xs text-foreground">{fullAddress}</p> : <p className="text-xs text-muted-foreground">Aucune adresse renseignée</p>}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Phone className="h-4 w-4" /> Contact d'urgence</h3>
            <dl className="space-y-1.5 text-xs">
              <Row label="Nom" value={p.emergency_contact_name} />
              <Row label="Lien" value={RELATION_LABELS[p.emergency_contact_relation] || p.emergency_contact_relation} />
              <Row label="Téléphone" value={p.emergency_contact_phone} />
            </dl>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Méthode de paiement</h3>
            {p.payment_method === "direct_deposit" ? (
              <dl className="space-y-1.5 text-xs">
                <Row label="Méthode" value="Dépôt direct" />
                <Row label="Institution" value={p.bank_institution} />
                <Row label="Transit" value={p.bank_transit} />
                <Row label="No. de compte" value={maskAccount(p.bank_account)} />
              </dl>
            ) : p.payment_method === "interac" ? (
              <dl className="space-y-1.5 text-xs">
                <Row label="Méthode" value="Virement Interac" />
                <Row label="Destinataire" value={p.interac_email} />
              </dl>
            ) : <p className="text-xs text-muted-foreground">Aucune méthode configurée</p>}
          </div>
          <div className="bg-card border border-border rounded-xl p-4 md:col-span-2">
            <h3 className="text-sm font-bold text-foreground mb-3">Objectifs ({currentMonth}/{currentYear})</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              {[
                { l: "Internet", v: targets.find((t: any) => t.service_type === "internet")?.target_count ?? 0 },
                { l: "TV", v: targets.find((t: any) => t.service_type === "tv")?.target_count ?? 0 },
                { l: "Mobile", v: targets.find((t: any) => t.service_type === "mobile")?.target_count ?? 0 },
                { l: "Total", v: targets.find((t: any) => t.service_type === "total_sales")?.target_count ?? 0 },
                { l: "Revenu ($)", v: Number(targets.find((t: any) => t.service_type === "revenue")?.target_amount ?? 0).toFixed(2) },
              ].map((k) => (
                <div key={k.l} className="text-center"><p className="text-muted-foreground">{k.l}</p><p className="font-bold text-foreground mt-0.5">{k.v}</p></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setEdit(false)}><XIcon className="h-3 w-3 mr-1" /> Annuler</Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Sauvegarder
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><Mail className="h-4 w-4" /> Identité</h3>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Prénom</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label className="text-xs">Nom</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Courriel</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label className="text-xs">Téléphone</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Date d'embauche</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
            <div><Label className="text-xs">Date de naissance</Label><Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">Territoire</Label><Input value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} placeholder="Ex: Montréal Nord" /></div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><MapPin className="h-4 w-4" /> Adresse</h3>
          <div><Label className="text-xs">Rue</Label><Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} placeholder="123 rue Exemple" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Ville</Label><Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Province</Label>
              <Select value={form.address_province} onValueChange={(v) => setForm({ ...form, address_province: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["QC", "ON", "NB", "NS", "PE", "NL", "MB", "SK", "AB", "BC", "YT", "NT", "NU"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Code postal</Label><Input value={form.address_postal} onChange={(e) => setForm({ ...form, address_postal: e.target.value.toUpperCase() })} maxLength={7} placeholder="H1A 1A1" /></div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><Phone className="h-4 w-4" /> Contact d'urgence</h3>
          <div><Label className="text-xs">Nom complet</Label><Input value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} /></div>
          <div>
            <Label className="text-xs">Lien</Label>
            <Select value={form.emergency_contact_relation} onValueChange={(v) => setForm({ ...form, emergency_contact_relation: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {Object.entries(RELATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Téléphone</Label><Input type="tel" value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} /></div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Méthode de paiement</h3>
          <div>
            <Label className="text-xs">Méthode</Label>
            <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="direct_deposit">Dépôt direct</SelectItem>
                <SelectItem value="interac">Virement Interac</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.payment_method === "direct_deposit" ? (
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Institution (3)</Label><Input inputMode="numeric" maxLength={3} value={form.bank_institution} onChange={(e) => setForm({ ...form, bank_institution: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></div>
              <div><Label className="text-xs">Transit (5)</Label><Input inputMode="numeric" maxLength={5} value={form.bank_transit} onChange={(e) => setForm({ ...form, bank_transit: e.target.value.replace(/\D/g, "").slice(0, 5) })} /></div>
              <div><Label className="text-xs">Compte</Label><Input inputMode="numeric" value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value.replace(/\D/g, "") })} /></div>
            </div>
          ) : (
            <div><Label className="text-xs">Courriel Interac</Label><Input value={form.interac_email} onChange={(e) => setForm({ ...form, interac_email: e.target.value })} /></div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 md:col-span-2">
          <h3 className="text-sm font-bold text-foreground mb-2">Objectifs ({currentMonth}/{currentYear})</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div><Label className="text-xs">Internet</Label><Input type="number" min="0" value={form.target_internet} onChange={(e) => setForm({ ...form, target_internet: e.target.value })} /></div>
            <div><Label className="text-xs">TV</Label><Input type="number" min="0" value={form.target_tv} onChange={(e) => setForm({ ...form, target_tv: e.target.value })} /></div>
            <div><Label className="text-xs">Mobile</Label><Input type="number" min="0" value={form.target_mobile} onChange={(e) => setForm({ ...form, target_mobile: e.target.value })} /></div>
            <div><Label className="text-xs">Total ventes</Label><Input type="number" min="0" value={form.target_total_sales} onChange={(e) => setForm({ ...form, target_total_sales: e.target.value })} /></div>
            <div><Label className="text-xs">Revenu ($)</Label><Input type="number" min="0" step="0.01" value={form.target_revenue} onChange={(e) => setForm({ ...form, target_revenue: e.target.value })} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SCHEDULE SECTION (7-day grid + per-day editor)
   ════════════════════════════════════════════════════════════════ */
function ScheduleSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Record<number, { active: boolean; start: string; end: string; id?: string }>>({});

  const { data: schedules = [] } = useQuery({
    queryKey: ["agent-schedules", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_schedules")
        .select("id, day_of_week, start_time, end_time, is_active")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const byDay = useMemo(() => {
    const m: Record<number, any> = {};
    schedules.forEach((s: any) => { m[s.day_of_week] = s; });
    return m;
  }, [schedules]);

  useEffect(() => {
    if (!edit) return;
    const d: Record<number, { active: boolean; start: string; end: string; id?: string }> = {};
    for (let i = 0; i < 7; i++) {
      const s = byDay[i];
      d[i] = s
        ? { active: true, start: (s.start_time || "09:00").slice(0, 5), end: (s.end_time || "17:00").slice(0, 5), id: s.id }
        : { active: false, start: "09:00", end: "17:00" };
    }
    setDraft(d);
  }, [edit, byDay]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      for (let i = 0; i < 7; i++) {
        const slot = draft[i];
        const existing = byDay[i];
        if (slot.active) {
          if (existing) {
            const { error } = await supabase.from("staff_schedules")
              .update({ start_time: slot.start, end_time: slot.end, is_active: true } as any)
              .eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("staff_schedules").insert({
              user_id: userId, day_of_week: i, start_time: slot.start, end_time: slot.end,
              is_active: true, effective_from: new Date().toISOString().slice(0, 10),
              created_by: user?.id,
            } as any);
            if (error) throw error;
          }
        } else if (existing) {
          const { error } = await supabase.from("staff_schedules")
            .update({ is_active: false } as any).eq("id", existing.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Horaire mis à jour");
      qc.invalidateQueries({ queryKey: ["agent-schedules", userId] });
      setEdit(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur sauvegarde horaire"),
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Horaire hebdomadaire</h3>
        {!edit ? (
          <Button size="sm" onClick={() => setEdit(true)}><Edit3 className="h-3 w-3 mr-1" /> Modifier l'horaire</Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEdit(false)}><XIcon className="h-3 w-3 mr-1" /> Annuler</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />} Sauvegarder
            </Button>
          </div>
        )}
      </div>

      {!edit ? (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 0].map((i) => {
            const s = byDay[i];
            return (
              <div key={i} className={cn("rounded-lg border p-2 text-center", s ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/20" : "border-border bg-muted/30")}>
                <p className="text-[11px] font-bold text-foreground">{DAYS_FR[i]}</p>
                {s ? (
                  <p className="text-[10px] text-muted-foreground mt-1">{(s.start_time || "").slice(0, 5)}–{(s.end_time || "").slice(0, 5)}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1">Repos</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((i) => {
            const slot = draft[i] || { active: false, start: "09:00", end: "17:00" };
            return (
              <div key={i} className="flex items-center gap-3 p-2 rounded border border-border">
                <span className="w-20 text-xs font-medium text-foreground">{DAYS_FULL[i]}</span>
                <div className="flex items-center gap-2">
                  <Switch checked={slot.active} onCheckedChange={(v) => setDraft({ ...draft, [i]: { ...slot, active: v } })} />
                  <span className="text-[10px] text-muted-foreground w-12">{slot.active ? "Travail" : "Repos"}</span>
                </div>
                <Input type="time" value={slot.start} disabled={!slot.active} onChange={(e) => setDraft({ ...draft, [i]: { ...slot, start: e.target.value } })} className="h-8 w-28" />
                <span className="text-xs text-muted-foreground">à</span>
                <Input type="time" value={slot.end} disabled={!slot.active} onChange={(e) => setDraft({ ...draft, [i]: { ...slot, end: e.target.value } })} className="h-8 w-28" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   EMPLOYMENT DOCS (Offre / Contrat / Lettre confirmation)
   Wires to existing employment_letters + generate-employment-letter-pdf
   ════════════════════════════════════════════════════════════════ */
const DOC_TYPES: Array<{ key: string; label: string; subtitle: string }> = [
  { key: "offer", label: "Offre d'emploi", subtitle: "Lettre d'offre formelle" },
  { key: "contract", label: "Contrat d'emploi", subtitle: "Contrat de travail officiel" },
  { key: "confirmation", label: "Lettre d'emploi", subtitle: "Confirmation d'emploi actuel" },
];

function EmploymentDocsSection({ userId, agentName }: { userId: string; agentName: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["employment-letters", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employment_letters")
        .select("id, letter_type, status, pdf_url, generated_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const findLatest = (type: string) => docs.find((d: any) => d.letter_type === type);

  const generate = async (type: string) => {
    setBusy(type);
    try {
      let letterId = findLatest(type)?.id;
      if (!letterId) {
        const { data: created, error } = await supabase
          .from("employment_letters")
          .insert({ user_id: userId, letter_type: type, status: "draft" } as any)
          .select("id").single();
        if (error) throw error;
        letterId = (created as any).id;
      }
      const { error: genErr } = await supabase.functions.invoke("generate-employment-letter-pdf", {
        body: { employment_letter_id: letterId },
      });
      if (genErr) throw genErr;
      toast.success("Document généré");
      qc.invalidateQueries({ queryKey: ["employment-letters", userId] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur génération");
    } finally {
      setBusy(null);
    }
  };

  const download = async (pdfUrl: string) => {
    const { data, error } = await supabase.storage.from("hr-documents").createSignedUrl(pdfUrl, 300);
    if (error || !data?.signedUrl) {
      toast.error("Lien indisponible");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Documents d'emploi</h3>
      {DOC_TYPES.map((d) => {
        const doc = findLatest(d.key);
        const isBusy = busy === d.key;
        return (
          <div key={d.key} className="flex items-center justify-between p-2 rounded border border-border">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{d.label}</p>
              <p className="text-[10px] text-muted-foreground">{d.subtitle}</p>
              {doc?.generated_at && (
                <Badge variant="outline" className="text-[9px] mt-1">
                  Généré le {format(new Date(doc.generated_at), "dd MMM yyyy")}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {doc?.pdf_url && (
                <Button size="sm" variant="outline" onClick={() => download(doc.pdf_url)}>
                  <Download className="h-3 w-3 mr-1" /> Télécharger
                </Button>
              )}
              <Button size="sm" variant={doc ? "ghost" : "default"} onClick={() => generate(d.key)} disabled={isBusy}>
                {isBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                {doc?.pdf_url ? "Régénérer" : "Générer"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   CUSTOM RATES per agent (commission_rules table)
   ════════════════════════════════════════════════════════════════ */
function CustomRatesSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [pct, setPct] = useState<string>("0");
  const [minM, setMinM] = useState<string>("0");

  const { data: rows = [] } = useQuery({
    queryKey: ["agent-custom-rates", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("id, applies_to, percentage, min_monthly, is_active")
        .eq("employee_id", userId)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const findRow = (svc: string) => rows.find((r: any) => r.applies_to === svc);

  const save = useMutation({
    mutationFn: async (svc: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const existing = findRow(svc);
      const payload: any = {
        applies_to: svc,
        percentage: parseFloat(pct) || 0,
        min_monthly: parseFloat(minM) || 0,
      };
      if (existing) {
        const { error } = await supabase.from("commission_rules").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("commission_rules").insert({
          ...payload, employee_id: userId, role: "field_sales", is_active: true,
          effective_from: new Date().toISOString().slice(0, 10), created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Taux mis à jour");
      qc.invalidateQueries({ queryKey: ["agent-custom-rates", userId] });
      setEditKey(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur sauvegarde"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_rules").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Taux supprimé");
      qc.invalidateQueries({ queryKey: ["agent-custom-rates", userId] });
    },
  });

  const startEdit = (svc: string) => {
    const row = findRow(svc);
    setPct(String(row?.percentage ?? 0));
    setMinM(String(row?.min_monthly ?? 0));
    setEditKey(svc);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-bold text-foreground mb-2">Taux personnalisés par service</h3>
      <p className="text-[10px] text-muted-foreground mb-3">Ces taux remplacent les grilles assignées pour cet agent.</p>
      <div className="space-y-1">
        {SERVICES.map((s) => {
          const row = findRow(s.key);
          const isEdit = editKey === s.key;
          return (
            <div key={s.key} className="flex items-center justify-between p-2 rounded border border-border">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                {!isEdit && row && (
                  <p className="text-[10px] text-muted-foreground">
                    {Number(row.percentage).toFixed(2)}% · min ${Number(row.min_monthly).toFixed(2)}/mois
                  </p>
                )}
                {!isEdit && !row && <p className="text-[10px] text-muted-foreground">Aucun taux personnalisé</p>}
              </div>
              {isEdit ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Input className="h-8 w-20" type="number" step="0.01" min="0" value={pct} onChange={(e) => setPct(e.target.value)} />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input className="h-8 w-20" type="number" step="0.01" min="0" value={minM} onChange={(e) => setMinM(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={() => save.mutate(s.key)} disabled={save.isPending}>
                    {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditKey(null)}><XIcon className="h-3 w-3" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(s.key)}>
                    <Edit3 className="h-3 w-3 mr-1" /> {row ? "Modifier" : "Définir"}
                  </Button>
                  {row && (
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(row.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TAX DOCUMENTS (T4 / RL-1)
   ════════════════════════════════════════════════════════════════ */
function TaxDocumentsSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const [genLoading, setGenLoading] = useState<string | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["agent-tax-docs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_documents")
        .select("id, document_type, tax_year, status, pdf_url, generated_at, created_at")
        .eq("user_id", userId)
        .order("tax_year", { ascending: false })
        .order("document_type", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleDownload = async (pdfUrl: string) => {
    const { data, error } = await supabase.storage.from("tax-documents").createSignedUrl(pdfUrl, 300);
    if (error || !data?.signedUrl) {
      toast.error("Impossible de générer le lien de téléchargement");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleGenerate = async (docType: "t4" | "rl1", year: number) => {
    const key = `${docType}-${year}`;
    setGenLoading(key);
    try {
      const { data: created, error: insertErr } = await supabase
        .from("tax_documents")
        .insert({ user_id: userId, document_type: docType, tax_year: year, status: "draft" })
        .select("id").single();
      if (insertErr) throw insertErr;
      const { error: genErr } = await supabase.functions.invoke("generate-tax-document-pdf", {
        body: { tax_document_id: created.id },
      });
      if (genErr) throw genErr;
      toast.success(`${docType.toUpperCase()} ${year} généré`);
      qc.invalidateQueries({ queryKey: ["agent-tax-docs", userId] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération");
    } finally {
      setGenLoading(null);
    }
  };

  const findDoc = (type: string, year: number) => docs.find((d: any) => d.document_type === type && d.tax_year === year);

  const renderRow = (type: "t4" | "rl1", year: number) => {
    const doc = findDoc(type, year);
    const label = type === "t4" ? "T4" : "RL-1";
    const subtitle = type === "t4" ? `Sommaire fédéral interne — ${year}` : `Sommaire provincial interne — ${year}`;
    const key = `${type}-${year}`;
    const isGenerating = genLoading === key;
    return (
      <div key={key} className="flex items-center justify-between p-2 rounded border border-border">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label} <span className="text-muted-foreground font-normal">— {year}</span></p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          {doc && (
            <Badge variant="outline" className="text-[9px] mt-1">
              {doc.status === "draft" ? "Brouillon" : doc.status === "generated" ? "Généré" : doc.status === "sent" ? "Envoyé" : doc.status}
              {doc.generated_at ? ` · ${format(new Date(doc.generated_at), "dd MMM yyyy")}` : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {doc?.pdf_url && (
            <Button size="sm" variant="outline" onClick={() => handleDownload(doc.pdf_url)}>
              <Download className="h-3 w-3 mr-1" /> PDF
            </Button>
          )}
          <Button size="sm" variant={doc ? "ghost" : "default"} onClick={() => handleGenerate(type, year)} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
            {doc ? "Régénérer" : `Générer ${label}`}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4" /> Documents fiscaux (sommaires internes)
        </h3>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Sommaires fiscaux internes Nivra — À titre informatif uniquement (ne remplacent pas les T4/RL-1 officiels émis par la paie).
      </p>
      <div className="space-y-2">
        {renderRow("t4", lastYear)}
        {renderRow("rl1", lastYear)}
        {renderRow("t4", currentYear)}
        {renderRow("rl1", currentYear)}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground text-right">{value || "—"}</dd>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   COMMISSIONS & BONUS TAB
   ════════════════════════════════════════════════════════════════ */
function CommissionAndBonusTab({ userId, commissions }: { userId: string; commissions: any[] }) {
  const qc = useQueryClient();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthStart = new Date(currentYear, currentMonth - 1, 1).toISOString();
  const monthEnd = new Date(currentYear, currentMonth, 1).toISOString();

  // Field commissions for this agent
  const { data: fieldComms = [] } = useQuery({
    queryKey: ["agent-field-commissions", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_commissions")
        .select("id, amount, status, commission_type, description, order_id, created_at, paid_at")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Count current month activated sales (for bonus progress)
  const { data: monthSales = 0 } = useQuery({
    queryKey: ["agent-month-sales", userId, currentYear, currentMonth],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("created_by_agent_id", userId)
        .gte("created_at", monthStart)
        .lt("created_at", monthEnd)
        .in("status", ["activated", "completed", "active"]);
      return count ?? 0;
    },
  });

  // Existing targets for this month
  const { data: targets = [] } = useQuery({
    queryKey: ["agent-targets-tab", userId, currentYear, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_targets")
        .select("id, service_type, target_count, target_amount, period_month, period_year")
        .eq("employee_id", userId)
        .eq("period_year", currentYear)
        .eq("period_month", currentMonth);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [showTargetForm, setShowTargetForm] = useState(false);
  const [weeklyTarget, setWeeklyTarget] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState("");
  const [targetMonth, setTargetMonth] = useState<string>(`${currentYear}-${String(currentMonth).padStart(2, "0")}`);

  useEffect(() => {
    const weekly = targets.find((t: any) => t.service_type === "weekly_sales")?.target_count ?? "";
    const monthly = targets.find((t: any) => t.service_type === "total_sales")?.target_count ?? "";
    setWeeklyTarget(String(weekly || ""));
    setMonthlyTarget(String(monthly || ""));
  }, [targets]);

  const saveTargets = useMutation({
    mutationFn: async () => {
      const [yearStr, monthStr] = targetMonth.split("-");
      const y = parseInt(yearStr);
      const m = parseInt(monthStr);
      const rows = [
        { service_type: "weekly_sales", target_count: parseInt(weeklyTarget) || 0 },
        { service_type: "total_sales", target_count: parseInt(monthlyTarget) || 0 },
      ];
      for (const r of rows) {
        // Check existing for the chosen month
        const { data: existing } = await supabase
          .from("sales_targets")
          .select("id")
          .eq("employee_id", userId)
          .eq("period_year", y)
          .eq("period_month", m)
          .eq("service_type", r.service_type)
          .maybeSingle();
        if (existing?.id) {
          await supabase.from("sales_targets").update({ target_count: r.target_count, target_amount: 0 } as any).eq("id", existing.id);
        } else if (r.target_count > 0) {
          await supabase.from("sales_targets").insert({
            employee_id: userId,
            role: "field_sales",
            service_type: r.service_type,
            target_count: r.target_count,
            target_amount: 0,
            period_month: m,
            period_year: y,
          } as any);
        }
      }
    },
    onSuccess: () => {
      toast.success("Objectifs enregistrés");
      qc.invalidateQueries({ queryKey: ["agent-targets-tab", userId] });
      qc.invalidateQueries({ queryKey: ["agent-targets", userId] });
      setShowTargetForm(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erreur sauvegarde objectifs"),
  });

  const STATUS_BADGE_LOCAL: Record<string, { cls: string; label: string }> = {
    pending: { cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400", label: "En attente" },
    approved: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400", label: "Approuvée" },
    paid: { cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400", label: "Payée" },
    clawback: { cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400", label: "Récupérée" },
    rejected: { cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400", label: "Rejetée" },
    validated: { cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400", label: "Validée" },
  };

  const weeklyT = targets.find((t: any) => t.service_type === "weekly_sales")?.target_count ?? 0;
  const monthlyT = targets.find((t: any) => t.service_type === "total_sales")?.target_count ?? 0;
  const monthlyPct = monthlyT > 0 ? Math.min(100, Math.round((monthSales / monthlyT) * 100)) : 0;

  return (
    <div className="space-y-4">
      {/* Section 1 + 2: official grids */}
      <CommissionGridTables variant="light" currentSales={monthSales} />

      {/* Section 4: Sales targets */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Objectifs de vente
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowTargetForm((v) => !v)}>
            <Plus className="h-3 w-3 mr-1" /> Définir les objectifs
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground">Objectif hebdomadaire</p>
            <p className="text-lg font-bold text-foreground">{weeklyT} ventes</p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground">Objectif mensuel</p>
            <p className="text-lg font-bold text-foreground">
              {monthSales} / {monthlyT} <span className="text-xs text-muted-foreground">ventes</span>
            </p>
            {monthlyT > 0 && (
              <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${monthlyPct}%` }} />
              </div>
            )}
          </div>
        </div>

        {showTargetForm && (
          <div className="mt-4 p-3 border border-border rounded-lg space-y-3 bg-muted/10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Objectif hebdomadaire</Label>
                <Input type="number" min="0" value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Objectif mensuel</Label>
                <Input type="number" min="0" value={monthlyTarget} onChange={(e) => setMonthlyTarget(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Mois cible</Label>
                <Input type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowTargetForm(false)}>Annuler</Button>
              <Button size="sm" onClick={() => saveTargets.mutate()} disabled={saveTargets.isPending}>
                {saveTargets.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Agent commissions list */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Commissions de cet agent
        </h3>
        {fieldComms.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Aucune commission</p>
        ) : (
          <div className="space-y-1.5">
            {fieldComms.map((c: any) => {
              const b = STATUS_BADGE_LOCAL[c.status] || STATUS_BADGE_LOCAL.pending;
              return (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{fmtMoney(Number(c.amount))}</span>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", b.cls)}>{b.label}</span>
                      {c.commission_type && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{c.commission_type}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {c.description || (c.order_id ? `Commande ${String(c.order_id).slice(0, 8)}` : "—")}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                    {format(new Date(c.created_at), "dd/MM/yy")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
