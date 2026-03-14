/**
 * CoreClientProfile — Full CRM client profile for Nivra Core.
 * Quick actions bar + data blocks: subscriptions, equipment, invoices, payments, tickets, notes, timeline.
 */
import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  UserCircle, Mail, Phone, MapPin, Shield, ExternalLink,
  ShoppingCart, FileText, Clock, StickyNote, ArrowLeft, Hash,
  CheckCircle, AlertTriangle, XCircle, CreditCard, Package,
  Tv, Wifi, Plus, PauseCircle, PlayCircle, Loader2, Send,
  Calendar, DollarSign, Wrench, TicketIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

// ── Section wrapper ──
const Section = ({ title, icon: Icon, children, action }: { title: string; icon: any; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-emerald-400" />
      <h3 className="text-[13px] font-semibold text-white flex-1">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between py-1.5 border-b border-[hsl(220,15%,14%)] last:border-0">
    <span className="text-[11px] text-[hsl(220,10%,45%)]">{label}</span>
    <span className="text-[11px] text-white text-right max-w-[60%] truncate">{value || "—"}</span>
  </div>
);

const CoreClientProfile = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // ── Profile ──
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["core-client-profile", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", clientId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // ── Account ──
  const { data: account } = useQuery({
    queryKey: ["core-client-account", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  // ── Orders ──
  const { data: orders = [] } = useQuery({
    queryKey: ["core-client-orders", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("id, order_number, status, created_at, service_type, total_amount, payment_status")
        .eq("user_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!clientId,
  });

  // ── Billing Customer (resolved once, used by subscriptions/invoices/payments) ──
  const { data: billingCustomer } = useQuery({
    queryKey: ["core-client-billing-customer", clientId],
    queryFn: async () => {
      // Try by user_id first, then by email
      const { data: byUserId } = await supabase.from("billing_customers")
        .select("id").eq("user_id", clientId!).maybeSingle();
      if (byUserId) return byUserId;
      if (profile?.email) {
        const { data: byEmail } = await supabase.from("billing_customers")
          .select("id").eq("email", profile.email).maybeSingle();
        return byEmail;
      }
      return null;
    },
    enabled: !!clientId,
  });

  // ── Subscriptions ──
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["core-client-subscriptions", clientId, billingCustomer?.id],
    queryFn: async () => {
      if (!billingCustomer) return [];
      const { data } = await supabase.from("billing_subscriptions")
        .select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date, service_category")
        .eq("customer_id", billingCustomer.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!billingCustomer,
  });

  // ── Equipment ──
  const { data: equipment = [] } = useQuery({
    queryKey: ["core-client-equipment", clientId],
    queryFn: async () => {
      if (!account) return [];
      const { data } = await supabase.from("equipment_inventory")
        .select("id, catalog_name, serial_number, status, price_client, assigned_at")
        .eq("account_id", account.id)
        .order("assigned_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!clientId && !!account,
  });

  // ── Invoices ──
  const { data: invoices = [] } = useQuery({
    queryKey: ["core-client-invoices", clientId, billingCustomer?.id],
    queryFn: async () => {
      if (!billingCustomer) return [];
      const { data } = await supabase.from("billing_invoices")
        .select("id, invoice_number, total, balance_due, status, due_date, created_at")
        .eq("customer_id", billingCustomer.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!billingCustomer,
  });

  // ── Payments ──
  const { data: payments = [] } = useQuery({
    queryKey: ["core-client-payments", clientId, billingCustomer?.id],
    queryFn: async () => {
      if (!billingCustomer) return [];
      const { data } = await supabase.from("billing_payments")
        .select("id, payment_number, amount, method, status, created_at, reference")
        .eq("customer_id", billingCustomer.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!billingCustomer,
  });

  // ── KYC ──
  const { data: kyc = [] } = useQuery({
    queryKey: ["core-client-kyc", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("kyc_verifications").select("*").eq("user_id", clientId!)
        .order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!clientId,
  });

  // ── Internal notes ──
  const { data: notes = [] } = useQuery({
    queryKey: ["core-client-notes", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("client_internal_notes")
        .select("id, body, note_type, created_by_name, created_by_role, created_at")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!clientId,
  });

  // ── Activity ──
  const { data: activityLogs = [] } = useQuery({
    queryKey: ["core-client-activity", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs")
        .select("id, action, entity_type, created_at, details, changed_field, old_value, new_value")
        .eq("user_id", clientId!)
        .order("created_at", { ascending: false }).limit(30);
      return data || [];
    },
    enabled: !!clientId,
  });

  // ── Add note mutation ──
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Non authentifié");
      const { data: prof } = await supabase.from("profiles")
        .select("full_name").eq("user_id", currentUser.id).maybeSingle();
      const { error } = await supabase.from("client_internal_notes").insert({
        client_id: clientId!,
        note_type: "admin",
        body: newNote.trim(),
        created_by_user_id: currentUser.id,
        created_by_role: "admin",
        created_by_name: prof?.full_name || currentUser.email || "Agent",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-client-notes", clientId] });
      setNewNote("");
      setAddingNote(false);
      toast.success("Note ajoutée");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  if (loadingProfile) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div>;
  }

  if (!profile) {
    return (
      <div className="text-center py-16 text-[hsl(220,10%,40%)]">
        <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Client introuvable</p>
        <Link to={corePath("/clients")} className="text-emerald-400 text-xs hover:underline mt-2 inline-block">← Retour</Link>
      </div>
    );
  }

  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "—";

  // Quick action button component
  const QAction = ({ icon: Icon, label, onClick, color = "emerald" }: { icon: any; label: string; onClick: () => void; color?: string }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-[10px] font-medium transition-colors min-w-[80px]",
        `border-${color}-500/20 text-${color}-400 hover:bg-${color}-500/10`
      )}
      style={{
        borderColor: `hsl(var(--${color === "emerald" ? "primary" : color === "blue" ? "accent" : color === "amber" ? "warning" : "destructive"}) / 0.2)`,
      }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={corePath("/clients")} className="h-8 w-8 rounded-md border border-[hsl(220,15%,18%)] flex items-center justify-center text-[hsl(220,10%,45%)] hover:text-white hover:border-emerald-500/30 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white tracking-tight">{displayName}</h1>
          <p className="text-[11px] text-[hsl(220,10%,45%)]">Dossier CRM · {profile.email}</p>
        </div>
        {account && (
          <Link to={corePath(`/accounts/${account.id}`)}>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20">
              <Hash className="h-3 w-3 mr-1" />Compte #{account.account_number}
            </Badge>
          </Link>
        )}
      </div>

      {/* ═══ QUICK ACTIONS BAR ═══ */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A1A1AA] mb-2">Actions rapides</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => navigate(corePath("/pos"))} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-emerald-500/20 text-[10px] font-medium text-emerald-400 hover:bg-emerald-500/10 min-w-[80px]">
            <ShoppingCart className="h-4 w-4" /> Commande
          </button>
          <button onClick={() => navigate(corePath("/pos"))} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-blue-500/20 text-[10px] font-medium text-blue-400 hover:bg-blue-500/10 min-w-[80px]">
            <Plus className="h-4 w-4" /> Service
          </button>
          <button onClick={() => navigate(corePath("/equipment"))} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-cyan-500/20 text-[10px] font-medium text-cyan-400 hover:bg-cyan-500/10 min-w-[80px]">
            <Package className="h-4 w-4" /> Équipement
          </button>
          <button onClick={() => toast.info("Paiement: ouvrir depuis Factures")} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-amber-500/20 text-[10px] font-medium text-amber-400 hover:bg-amber-500/10 min-w-[80px]">
            <DollarSign className="h-4 w-4" /> Paiement
          </button>
          <button onClick={() => toast.info("Envoi facture")} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-purple-500/20 text-[10px] font-medium text-purple-400 hover:bg-purple-500/10 min-w-[80px]">
            <Send className="h-4 w-4" /> Facture
          </button>
          <button onClick={() => setAddingNote(true)} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-slate-500/20 text-[10px] font-medium text-slate-400 hover:bg-slate-500/10 min-w-[80px]">
            <StickyNote className="h-4 w-4" /> Note
          </button>
          <button onClick={() => navigate(corePath("/appointments"))} className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-pink-500/20 text-[10px] font-medium text-pink-400 hover:bg-pink-500/10 min-w-[80px]">
            <Calendar className="h-4 w-4" /> RDV
          </button>
        </div>
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Identity */}
        <Section title="Identité" icon={UserCircle}>
          <InfoRow label="Nom complet" value={displayName} />
          <InfoRow label="Prénom" value={profile.first_name} />
          <InfoRow label="Nom" value={profile.last_name} />
          <InfoRow label="Langue" value={profile.language || "fr"} />
          <InfoRow label="Inscrit le" value={profile.created_at ? format(new Date(profile.created_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"} />
        </Section>

        {/* Contact */}
        <Section title="Contact" icon={Mail}>
          <InfoRow label="Courriel" value={profile.email} />
          <InfoRow label="Téléphone" value={profile.phone} />
          <InfoRow label="Adresse" value={profile.address} />
          <InfoRow label="Ville" value={profile.city} />
          <InfoRow label="Code postal" value={profile.postal_code} />
          <InfoRow label="Province" value={profile.province} />
        </Section>

        {/* Account */}
        <Section title="Compte lié" icon={Hash}>
          {account ? (
            <>
              <InfoRow label="N° compte" value={<span className="font-mono">{account.account_number}</span>} />
              <InfoRow label="Statut" value={<StatusBadge label={account.status || "active"} variant={statusToVariant(account.status || "active")} size="sm" />} />
              <InfoRow label="Adresse de service" value={account.primary_service_address} />
              <InfoRow label="Classe crédit" value={account.credit_class || "standard"} />
              <div className="mt-2">
                <Link to={corePath(`/accounts/${account.id}`)}>
                  <button className="w-full h-8 flex items-center justify-center gap-1.5 rounded-md border border-emerald-500/20 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" /> Console du compte
                  </button>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-400/40" />
              <p className="text-[11px] text-[hsl(220,10%,40%)]">Aucun compte lié</p>
            </div>
          )}
        </Section>

        {/* KYC */}
        <Section title="Vérification KYC" icon={Shield}>
          {kyc.length > 0 ? (
            <div className="space-y-2">
              {kyc.map((k: any) => (
                <div key={k.id} className="flex items-center justify-between py-1.5 border-b border-[hsl(220,15%,14%)] last:border-0">
                  <div className="flex items-center gap-2">
                    {k.status === "verified" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : k.status === "rejected" ? <XCircle className="h-3.5 w-3.5 text-red-400" /> : <Clock className="h-3.5 w-3.5 text-amber-400" />}
                    <span className="text-[11px] text-white">{k.verification_type || "Document"}</span>
                  </div>
                  <span className="text-[10px] text-[hsl(220,10%,40%)]">{k.created_at ? format(new Date(k.created_at), "d MMM yyyy", { locale: fr }) : ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune vérification</p>
          )}
        </Section>
      </div>

      {/* ═══ SUBSCRIPTIONS ═══ */}
      <Section title="Abonnements actifs" icon={Wifi}>
        {subscriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[hsl(220,15%,14%)]">
                {["Forfait", "Catégorie", "Prix", "Cycle", "Statut", ""].map(h => (
                  <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {subscriptions.map((s: any) => (
                  <tr key={s.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                    <td className="px-2 py-2 text-white font-medium">{s.plan_name}</td>
                    <td className="px-2 py-2 text-[#A1A1AA]">{s.service_category || "—"}</td>
                    <td className="px-2 py-2 text-emerald-400 font-medium">{Number(s.plan_price).toFixed(2)} $/mois</td>
                    <td className="px-2 py-2 text-[#A1A1AA]">{s.cycle_start_date ? format(new Date(s.cycle_start_date), "d MMM", { locale: fr }) : ""} → {s.cycle_end_date ? format(new Date(s.cycle_end_date), "d MMM", { locale: fr }) : ""}</td>
                    <td className="px-2 py-2"><StatusBadge label={s.status || "active"} variant={statusToVariant(s.status || "active")} size="sm" /></td>
                    <td className="px-2 py-2">
                      <Link to={corePath(`/subscriptions/${s.id}`)}>
                        <button className="h-6 px-2 rounded border border-[hsl(220,15%,20%)] text-[10px] text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/40">Ouvrir</button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucun abonnement actif</p>
        )}
      </Section>

      {/* ═══ EQUIPMENT ═══ */}
      <Section title="Équipements attribués" icon={Package} action={
        <Link to={corePath("/equipment")}><button className="text-[10px] text-emerald-400 hover:underline">Gérer →</button></Link>
      }>
        {equipment.length > 0 ? (
          <div className="space-y-2">
            {equipment.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 p-2 rounded bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)]">
                <Package className="h-4 w-4 text-cyan-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">{e.catalog_name}</p>
                  <p className="text-[10px] text-[#A1A1AA]">S/N: {e.serial_number || "—"}</p>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">{Number(e.price_client).toFixed(2)} $</span>
                <StatusBadge label={e.status} variant={statusToVariant(e.status === "assigned" ? "active" : e.status)} size="sm" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucun équipement attribué</p>
        )}
      </Section>

      {/* ═══ INVOICES ═══ */}
      <Section title="Factures récentes" icon={FileText}>
        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[hsl(220,15%,14%)]">
                {["N° Facture", "Total", "Solde dû", "Statut", "Date", ""].map(h => (
                  <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                    <td className="px-2 py-2 font-mono text-white">{inv.invoice_number}</td>
                    <td className="px-2 py-2 text-white">{Number(inv.total).toFixed(2)} $</td>
                    <td className="px-2 py-2 text-amber-400">{Number(inv.balance_due || 0).toFixed(2)} $</td>
                    <td className="px-2 py-2"><StatusBadge label={inv.status || "unpaid"} variant={statusToVariant(inv.status || "unpaid")} size="sm" /></td>
                    <td className="px-2 py-2 text-[#A1A1AA]">{inv.created_at ? format(new Date(inv.created_at), "d MMM yyyy", { locale: fr }) : "—"}</td>
                    <td className="px-2 py-2">
                      <Link to={corePath(`/invoices/${inv.id}`)}>
                        <button className="h-6 px-2 rounded border border-[hsl(220,15%,20%)] text-[10px] text-[hsl(220,10%,50%)] hover:text-white">Ouvrir</button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune facture</p>
        )}
      </Section>

      {/* ═══ PAYMENTS ═══ */}
      <Section title="Paiements récents" icon={CreditCard}>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[hsl(220,15%,14%)]">
                {["N° Paiement", "Montant", "Méthode", "Réf.", "Statut", "Date"].map(h => (
                  <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                    <td className="px-2 py-2 font-mono text-white">{p.payment_number}</td>
                    <td className="px-2 py-2 text-emerald-400 font-medium">{Number(p.amount).toFixed(2)} $</td>
                    <td className="px-2 py-2 text-[#A1A1AA] capitalize">{p.method}</td>
                    <td className="px-2 py-2 text-[#A1A1AA] font-mono text-[10px]">{p.reference || "—"}</td>
                    <td className="px-2 py-2"><StatusBadge label={p.status || "confirmed"} variant={statusToVariant(p.status || "confirmed")} size="sm" /></td>
                    <td className="px-2 py-2 text-[#A1A1AA]">{p.created_at ? format(new Date(p.created_at), "d MMM yyyy", { locale: fr }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucun paiement</p>
        )}
      </Section>

      {/* ═══ ORDERS ═══ */}
      <Section title="Commandes" icon={ShoppingCart}>
        {orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-[hsl(220,15%,14%)]">
                {["N° commande", "Type", "Total", "Paiement", "Statut", "Date", ""].map(h => (
                  <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                    <td className="px-2 py-2 font-mono text-white">{o.order_number}</td>
                    <td className="px-2 py-2 text-[#A1A1AA]">{o.service_type || "—"}</td>
                    <td className="px-2 py-2 text-white">{o.total_amount ? `${Number(o.total_amount).toFixed(2)} $` : "—"}</td>
                    <td className="px-2 py-2"><StatusBadge label={o.payment_status || "pending"} variant={statusToVariant(o.payment_status || "pending")} size="sm" /></td>
                    <td className="px-2 py-2"><StatusBadge label={o.status} variant={statusToVariant(o.status)} size="sm" /></td>
                    <td className="px-2 py-2 text-[#A1A1AA]">{o.created_at ? format(new Date(o.created_at), "d MMM yyyy", { locale: fr }) : "—"}</td>
                    <td className="px-2 py-2">
                      <Link to={corePath(`/orders/${o.id}`)}>
                        <button className="h-6 px-2 rounded border border-[hsl(220,15%,20%)] text-[10px] text-[hsl(220,10%,50%)] hover:text-white">Ouvrir</button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune commande</p>
        )}
      </Section>

      {/* ═══ NOTES ═══ */}
      <Section title="Notes internes" icon={StickyNote} action={
        <button onClick={() => setAddingNote(!addingNote)} className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1">
          <Plus className="h-3 w-3" /> Ajouter
        </button>
      }>
        {addingNote && (
          <div className="mb-3 p-2 rounded bg-[hsl(220,20%,9%)] border border-emerald-500/20">
            <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Écrire une note..."
              rows={2} className="bg-transparent border-none text-white text-xs p-0 focus-visible:ring-0 resize-none" />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" onClick={() => setAddingNote(false)} className="h-6 text-[10px] text-[#A1A1AA]">Annuler</Button>
              <Button size="sm" onClick={() => addNoteMutation.mutate()} disabled={!newNote.trim() || addNoteMutation.isPending}
                className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white">
                {addNoteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sauvegarder"}
              </Button>
            </div>
          </div>
        )}
        {notes.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {notes.map((n: any) => (
              <div key={n.id} className="rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-2.5">
                <p className="text-[11px] text-white whitespace-pre-wrap">{n.body}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[hsl(220,10%,35%)]">
                  <span>{n.created_by_name || "Agent"}</span>
                  <span>·</span>
                  <span className="capitalize">{n.created_by_role || ""}</span>
                  <span>·</span>
                  <span>{n.created_at ? format(new Date(n.created_at), "d MMM yyyy HH:mm", { locale: fr }) : ""}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune note</p>
        )}
      </Section>

      {/* ═══ ACTIVITY TIMELINE ═══ */}
      <Section title="Chronologie d'activité" icon={Clock}>
        {activityLogs.length > 0 ? (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {activityLogs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-[hsl(220,15%,14%)] last:border-0">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white truncate">
                    <span className="text-emerald-400">{log.action}</span>
                    {log.entity_type && <span className="text-[hsl(220,10%,45%)]"> · {log.entity_type}</span>}
                  </p>
                  {log.changed_field && (
                    <p className="text-[10px] text-[hsl(220,10%,35%)]">{log.changed_field}: {log.old_value} → {log.new_value}</p>
                  )}
                </div>
                <span className="text-[10px] text-[hsl(220,10%,30%)] shrink-0">
                  {log.created_at ? format(new Date(log.created_at), "d MMM HH:mm", { locale: fr }) : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune activité enregistrée</p>
        )}
      </Section>
    </div>
  );
};

export default CoreClientProfile;
