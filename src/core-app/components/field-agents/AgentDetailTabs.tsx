import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, AlertTriangle, CheckCircle2, ShieldCheck, Mail, Phone, MapPin, CreditCard, Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  conjoint: "Conjoint(e)",
  parent: "Parent",
  enfant: "Enfant",
  frere_soeur: "Frère / Sœur",
  ami: "Ami(e)",
  autre: "Autre",
};

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
        .select("first_name, last_name, full_name, email, phone, hire_date, date_of_birth, address_street, address_city, address_province, address_postal, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, payment_method, bank_institution, bank_transit, bank_account, interac_email, terms_accepted_at, terms_accepted_version, mfa_method, mfa_configured_at" as any)
        .eq("user_id", userId as any)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const ac = commissions;
  const p = (profile || {}) as any;
  const fullAddress = [p.address_street, p.address_city, p.address_province, p.address_postal].filter(Boolean).join(", ");

  return (
    <Tabs defaultValue="grids" className="w-full">
      <TabsList className="w-full justify-start flex-wrap h-auto">
        <TabsTrigger value="grids">Grilles & Commissions</TabsTrigger>
        <TabsTrigger value="profile">Profil complet</TabsTrigger>
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

      {/* === Profil complet === */}
      <TabsContent value="profile" className="space-y-4 mt-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Informations personnelles */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Mail className="h-4 w-4" /> Informations personnelles</h3>
            <dl className="space-y-1.5 text-xs">
              <Row label="Nom complet" value={p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()} />
              <Row label="Courriel" value={p.email} />
              <Row label="Téléphone" value={p.phone} />
              <Row label="Date d'embauche" value={p.hire_date} />
              <Row label="Date de naissance" value={p.date_of_birth} />
            </dl>
          </div>

          {/* Adresse */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" /> Adresse</h3>
            {fullAddress ? <p className="text-xs text-foreground">{fullAddress}</p> : <p className="text-xs text-muted-foreground">Aucune adresse renseignée</p>}
          </div>

          {/* Contact d'urgence */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Phone className="h-4 w-4" /> Contact d'urgence</h3>
            <dl className="space-y-1.5 text-xs">
              <Row label="Nom" value={p.emergency_contact_name} />
              <Row label="Lien" value={RELATION_LABELS[p.emergency_contact_relation] || p.emergency_contact_relation} />
              <Row label="Téléphone" value={p.emergency_contact_phone} />
            </dl>
          </div>

          {/* Méthode de paiement */}
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
            ) : (
              <p className="text-xs text-muted-foreground">Aucune méthode configurée</p>
            )}
          </div>
        </div>
      </TabsContent>

      {/* === Documents RH === */}
      <TabsContent value="documents" className="space-y-4 mt-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Documents d'emploi</h3>
          <DocRow title="Offre d'emploi" subtitle="Document signé à la création" actionLabel="Téléverser" disabled />
          <DocRow title="Contrat d'emploi" subtitle="Contrat de travail officiel" actionLabel="Téléverser" disabled />
          <DocRow title="Lettre d'emploi" subtitle="Génération à la demande" actionLabel="Générer (bientôt)" disabled />
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Conditions d'utilisation</h3>
          {p.terms_accepted_at ? (
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-foreground">
                Acceptées le <strong>{format(new Date(p.terms_accepted_at), "dd MMM yyyy")}</strong>
                {p.terms_accepted_version ? <> — version <strong>{p.terms_accepted_version}</strong></> : null}
              </span>
            </div>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Non acceptées
            </Badge>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Authentification multi-facteurs (MFA)</h3>
          {p.mfa_configured_at && p.mfa_method ? (
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-foreground">
                MFA actif — <strong>{p.mfa_method === "email" ? "Email" : "Application TOTP"}</strong> ✓
                {" — configuré le "}
                <strong>{format(new Date(p.mfa_configured_at), "dd MMM yyyy")}</strong>
              </span>
            </div>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> ⚠️ MFA non configuré
            </Badge>
          )}
        </div>

        <TaxDocumentsSection userId={userId} />
      </TabsContent>
    </Tabs>
  );
}

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
      // Create draft row first
      const { data: created, error: insertErr } = await supabase
        .from("tax_documents")
        .insert({ user_id: userId, document_type: docType, tax_year: year, status: "draft" })
        .select("id")
        .single();
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

  const findDoc = (type: string, year: number) =>
    docs.find((d: any) => d.document_type === type && d.tax_year === year);

  const renderRow = (type: "t4" | "rl1", year: number) => {
    const doc = findDoc(type, year);
    const label = type === "t4" ? "T4" : "RL-1";
    const subtitle = type === "t4"
      ? `Sommaire fédéral interne — ${year}`
      : `Sommaire provincial interne — ${year}`;
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
          <Button
            size="sm"
            variant={doc ? "ghost" : "default"}
            onClick={() => handleGenerate(type, year)}
            disabled={isGenerating}
          >
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

function DocRow({ title, subtitle, actionLabel, disabled }: { title: string; subtitle: string; actionLabel: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded border border-border">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      <Button size="sm" variant="outline" disabled={disabled}>{actionLabel}</Button>
    </div>
  );
}
