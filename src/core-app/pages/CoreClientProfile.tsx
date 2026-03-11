/**
 * CoreClientProfile — Client CRM profile page at /core/clients/:clientId
 * Shows identity, contact, linked account, orders, KYC, notes, activity timeline.
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  UserCircle, Mail, Phone, MapPin, Shield, ExternalLink,
  ShoppingCart, FileText, Clock, StickyNote, ArrowLeft, Hash,
  CheckCircle, AlertTriangle, XCircle,
} from "lucide-react";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-emerald-400" />
      <h3 className="text-[13px] font-semibold text-white">{title}</h3>
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

  // Profile
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["core-client-profile", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", clientId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Account
  const { data: account } = useQuery({
    queryKey: ["core-client-account", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_id", clientId!)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  // Orders
  const { data: orders } = useQuery({
    queryKey: ["core-client-orders", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, created_at, service_type")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!clientId,
  });

  // KYC
  const { data: kyc } = useQuery({
    queryKey: ["core-client-kyc", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("kyc_verifications")
        .select("*")
        .eq("user_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!clientId,
  });

  // Activity logs
  const { data: activityLogs } = useQuery({
    queryKey: ["core-client-activity", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action, entity_type, created_at, details, changed_field, old_value, new_value")
        .eq("user_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!clientId,
  });

  // Internal notes
  const { data: notes } = useQuery({
    queryKey: ["core-client-notes", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("internal_notes")
        .select("*")
        .eq("entity_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!clientId,
  });

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16 text-[hsl(220,10%,40%)]">
        <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Client introuvable</p>
        <Link to={corePath("/clients")} className="text-emerald-400 text-xs hover:underline mt-2 inline-block">
          ← Retour aux clients
        </Link>
      </div>
    );
  }

  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "—";

  return (
    <div className="space-y-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link to={corePath("/clients")} className="h-8 w-8 rounded-md border border-[hsl(220,15%,18%)] flex items-center justify-center text-[hsl(220,10%,45%)] hover:text-white hover:border-emerald-500/30 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white tracking-tight">{displayName}</h1>
          <p className="text-[11px] text-[hsl(220,10%,45%)]">
            Profil CRM · {profile.email}
          </p>
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-2">
          {account ? (
            <Link to={corePath(`/accounts/${account.id}`)}>
              <button className="h-8 px-3 flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir le compte
              </button>
            </Link>
          ) : (
            <button className="h-8 px-3 flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
              Créer un compte
            </button>
          )}
          <Link to={corePath(`/orders?newOrder=true&clientId=${clientId}`)}>
            <button className="h-8 px-3 flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-[11px] font-medium text-blue-400 hover:bg-blue-500/20 transition-colors">
              <ShoppingCart className="h-3.5 w-3.5" />
              Nouvelle commande
            </button>
          </Link>
        </div>
      </div>

      {/* Main grid: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
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

        {/* Linked Account */}
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
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ouvrir la console du compte
                  </button>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-400/40" />
              <p className="text-[11px] text-[hsl(220,10%,40%)]">Aucun compte de service lié</p>
              <button className="mt-2 h-7 px-3 rounded-md border border-amber-500/20 text-[10px] font-medium text-amber-400 hover:bg-amber-500/10 transition-colors">
                Créer un compte
              </button>
            </div>
          )}
        </Section>

        {/* KYC */}
        <Section title="Vérification d'identité (KYC)" icon={Shield}>
          {(kyc && kyc.length > 0) ? (
            <div className="space-y-2">
              {kyc.map((k: any) => (
                <div key={k.id} className="flex items-center justify-between py-1.5 border-b border-[hsl(220,15%,14%)] last:border-0">
                  <div className="flex items-center gap-2">
                    {k.status === "verified" ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    ) : k.status === "rejected" ? (
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    <span className="text-[11px] text-white">{k.verification_type || "Document"}</span>
                  </div>
                  <span className="text-[10px] text-[hsl(220,10%,40%)]">
                    {k.created_at ? format(new Date(k.created_at), "d MMM yyyy", { locale: fr }) : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune vérification</p>
          )}
        </Section>
      </div>

      {/* Orders */}
      <Section title="Commandes" icon={ShoppingCart}>
        {(orders && orders.length > 0) ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,14%)]">
                  {["N° commande", "Type", "Statut", "Date", ""].map(h => (
                    <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                    <td className="px-2 py-2 font-mono text-white">{o.order_number}</td>
                    <td className="px-2 py-2 text-[hsl(220,10%,55%)]">{o.service_type || "—"}</td>
                    <td className="px-2 py-2"><StatusBadge label={o.status} variant={statusToVariant(o.status)} size="sm" /></td>
                    <td className="px-2 py-2 text-[hsl(220,10%,45%)]">{o.created_at ? format(new Date(o.created_at), "d MMM yyyy", { locale: fr }) : "—"}</td>
                    <td className="px-2 py-2">
                      <Link to={corePath(`/orders/${o.id}`)}>
                        <button className="h-6 px-2 rounded border border-[hsl(220,15%,20%)] text-[10px] text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/40 transition-colors">
                          Ouvrir
                        </button>
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

      {/* Internal Notes */}
      <Section title="Notes internes" icon={StickyNote}>
        {(notes && notes.length > 0) ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {notes.map((n: any) => (
              <div key={n.id} className="rounded-md border border-[hsl(220,15%,14%)] bg-[hsl(220,20%,9%)] p-2.5">
                <p className="text-[11px] text-white whitespace-pre-wrap">{n.content || n.note}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[hsl(220,10%,35%)]">
                  <span>{n.created_by_name || "Agent"}</span>
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

      {/* Activity Timeline */}
      <Section title="Chronologie d'activité" icon={Clock}>
        {(activityLogs && activityLogs.length > 0) ? (
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
                    <p className="text-[10px] text-[hsl(220,10%,35%)]">
                      {log.changed_field}: {log.old_value} → {log.new_value}
                    </p>
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
