import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useClientAccountIdentity } from "@/hooks/useClientAccountIdentity";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ClientBalanceSummary from "@/components/client/ClientBalanceSummary";
import ServiceCountdown from "@/components/client/ServiceCountdown";
import { ClientPaymentMethodCard } from "@/components/client/ClientPaymentMethodCard";
import AccountStateBanner from "@/components/client/AccountStateBanner";
import EmailClaimBanner from "@/components/client/EmailClaimBanner";
import { AlertTriangle, ChevronRight, Wifi, Smartphone, Tv, ArrowRight, Copy, FileText, CreditCard, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ReferralPopup from "@/components/client/ReferralPopup";
import { getCycleDisplay } from "@/lib/billingCycleDisplay";

const ClientDashboard = () => {
  const { user } = useClientAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem("nivra_welcomed");
  });
  const { data: accountIdentity } = useClientAccountIdentity(user?.id);

  const { data: canonicalData } = useCanonicalClientData(user?.id);
  const profile = canonicalData?.profile;
  const account = canonicalData?.account;
  const orders = canonicalData?.orders?.slice(0, 3) || [];
  const subscriptions = (canonicalData?.subscriptions || [])
    .filter((s: any) => !["cancelled", "expired"].includes(String(s?.status || "").toLowerCase()))
    .map((s: any) => ({
      id: s.id,
      plan_name: s.plan_name,
      amount: s.plan_price,
      billing_cycle: "monthly",
      service_type: s.service_category || (s.plan_name?.toLowerCase().includes("internet") ? "internet" : s.plan_name?.toLowerCase().includes("tv") ? "tv" : "mobile"),
      status: s.status,
      cycle_start_date: s.cycle_start_date,
      cycle_end_date: s.cycle_end_date,
    }));

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papiers");
  };

  // Canonical priority: snapshot account (Nivra Core) → identity hook → fallback label
  const accountNumber =
    account?.account_number ||
    accountIdentity?.accountNumber ||
    "Non attribué";

  // Status badge helper
  const statusBadge = (status: string) => {
    const cfg: Record<string, { label: string; cls: string }> = {
      active:    { label: "Actif",      cls: "bg-emerald-500/20 text-emerald-400" },
      suspended: { label: "Suspendu",   cls: "bg-red-500/20 text-red-400" },
      pending:   { label: "En attente", cls: "bg-amber-500/20 text-amber-400" },
    };
    const c = cfg[status] || { label: status, cls: "bg-secondary text-muted-foreground" };
    return <Badge className={`${c.cls} text-xs ml-2`}>{c.label}</Badge>;
  };

  // Group subscriptions by type
  const mobileServices = subscriptions?.filter((s: any) => 
    s.plan_name?.toLowerCase().includes("mobile") || s.service_type === "mobile"
  ) || [];
  const internetServices = subscriptions?.filter((s: any) => 
    s.plan_name?.toLowerCase().includes("internet") || s.service_type === "internet"
  ) || [];
  const tvServices = subscriptions?.filter((s: any) => 
    s.plan_name?.toLowerCase().includes("tv") || s.service_type === "tv"
  ) || [];

  return (
    <ClientLayout>
      <ReferralPopup />
      <div className="space-y-6" data-testid="portal-dashboard">
        {/* Welcome banner for first-time users */}
        {showWelcome && (
          <div className="rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #1a3a5c 100%)' }}>
            <div className="flex-1 text-white">
              <h2 className="text-lg font-bold mb-1">
                🎉 Bienvenue chez Nivra Telecom{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} !
              </h2>
              <p className="text-sm text-white/80 mb-3">Votre service sera activé sous 24h. Voici vos 3 premières étapes:</p>
              <ul className="text-sm text-white/90 space-y-1">
                <li>✓ Vérifiez votre courriel de confirmation</li>
                <li>✓ Notez votre date d'activation</li>
                <li>✓ Configurez votre modem à la réception</li>
              </ul>
            </div>
            <button
              onClick={() => { setShowWelcome(false); localStorage.setItem("nivra_welcomed", "1"); }}
              className="text-sm text-white px-4 py-2 rounded-lg cursor-pointer shrink-0"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              Compris ✓
            </button>
          </div>
        )}

        {/* Canonical account state banner — only shown when something is off.
            Reads from get_account_state() so we never tell the customer "active"
            while their service is actually suspended somewhere else. */}
        {account?.id && <AccountStateBanner accountId={account.id} />}
        <EmailClaimBanner />

        {/* Bug #15: surface fallback-link warning when history was reconciled via email match. */}
        {canonicalData?.identifiers?.usedFallbackLinks && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
            ⚠️ Certaines données de votre historique ont été reliées via votre adresse courriel.
            Si une commande ou facture semble manquante, contactez le support.
          </div>
        )}

        {/* Page title - Rogers style */}
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground" data-testid="dashboard-greeting">
          Bienvenue
        </h1>

        {/* Alert banners - Rogers style with left colored border */}
        {/* Account Number + Balance Section - Rogers style */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Account header with left accent */}
          <div className="border-l-4 border-primary px-6 py-4">
            <h2 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
              <span>Numéro de compte:</span>
              <span>{accountNumber}</span>
              <button 
                onClick={() => copyToClipboard(accountNumber)}
                className="p-1 text-muted-foreground hover:text-primary transition-colors"
                title="Copier"
              >
                <Copy className="w-4 h-4" />
              </button>
            </h2>
          </div>

          {/* Balance + Actions */}
          <div className="px-6 py-5 border-t border-border">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                {user?.id && <ClientBalanceSummary userId={user.id} />}
              </div>
              <div className="flex flex-col gap-3 lg:w-64">
                <Link to="/portal/invoices">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-11">
                    <FileText className="w-4 h-4 mr-2" />
                    Afficher votre facture
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full border-primary text-primary hover:bg-primary/10 rounded-xl h-11"
                  onClick={() => navigate("/portal/billing")}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Faire un paiement
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </Button>
              </div>
            </div>

            {/* Billing info row — only shown once a service is actually ACTIVE.
                Cycle is anchored on the real activation date (set by the
                fn_activate_sub_on_order_activation trigger). Until then we
                explicitly tell the client the cycle starts at activation. */}
            {(() => {
              // Canonical billing cycle display — never fabricate dates for pending subs
              const activeSub = subscriptions.find((s: any) => String(s.status).toLowerCase() === "active");
              const cycle = getCycleDisplay(activeSub);
              const hasPendingOnly = !activeSub && subscriptions.length > 0;

              return (
                <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
                  <span><strong>Mode de paiement :</strong> Paiements manuels</span>
                  {cycle.isActive && cycle.cycleDayLabel && (
                    <span><strong>Cycle :</strong> {cycle.cycleDayLabel}</span>
                  )}
                  {cycle.isActive && cycle.cycleEnd && (
                    <span><strong>Prochaine facture :</strong> {format(new Date(cycle.cycleEnd), "d MMM yyyy", { locale: fr })}</span>
                  )}
                  {!cycle.isActive && hasPendingOnly && (
                    <span className="text-amber-400">{cycle.pendingMessage}</span>
                  )}
                </div>
              );
            })()}

            {/* Quick links */}
            <div className="mt-4 flex flex-wrap gap-4">
              <Link to="/portal/payments" className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                Historique des paiements <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Payment Method Card — Auto-pay activation / status */}
        <ClientPaymentMethodCard />

        {/* Service Countdown */}
        {user?.id && <ServiceCountdown userId={user.id} />}

        {/* Mobile Services - Rogers style section */}
        {mobileServices.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="border-l-4 border-primary px-6 py-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Compte sans-fil individuel
              </h2>
            </div>
            <div className="divide-y divide-border">
              {mobileServices.map((sub: any) => {
                const cycle = getCycleDisplay(sub);
                return (
                <div key={sub.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground flex items-center">
                        {profile?.full_name || user?.user_metadata?.full_name || "Client"}
                        {statusBadge(sub.status)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {profile?.phone || "—"}
                        {cycle.isActive && cycle.nextRenewal && (
                          <span className="ml-2">· Prochain renouvellement: {format(new Date(cycle.nextRenewal), "d MMM yyyy", { locale: fr })}</span>
                        )}
                        {!cycle.isActive && (
                          <span className="ml-2 text-amber-400">· Cycle débutera à l'activation</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link to="/portal/services">
                    <span className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                      Gérer <ChevronRight className="w-4 h-4" />
                    </span>
                  </Link>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Internet Services - Rogers style */}
        {internetServices.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="border-l-4 border-primary px-6 py-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Wifi className="w-5 h-5 text-primary" />
                Services résidentiels
              </h2>
            </div>
            <div className="divide-y divide-border">
              {internetServices.map((sub: any) => {
                const cycle = getCycleDisplay(sub);
                return (
                <div key={sub.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground flex items-center">
                      {sub.plan_name}
                      {statusBadge(sub.status)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/{sub.billing_cycle === "monthly" ? "mois" : "an"}
                      {cycle.isActive && cycle.nextRenewal && (
                        <span className="ml-2">· Prochain renouvellement: {format(new Date(cycle.nextRenewal), "d MMM yyyy", { locale: fr })}</span>
                      )}
                      {!cycle.isActive && (
                        <span className="ml-2 text-amber-400">· Cycle débutera à l'activation</span>
                      )}
                    </p>
                  </div>
                  <Link to="/portal/services">
                    <span className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                      Gérer <ChevronRight className="w-4 h-4" />
                    </span>
                  </Link>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TV Services - Rogers style */}
        {tvServices.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="border-l-4 border-primary px-6 py-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Tv className="w-5 h-5 text-primary" />
                Télé et Diffusion
              </h2>
            </div>
            <div className="divide-y divide-border">
              {tvServices.map((sub: any) => {
                const cycle = getCycleDisplay(sub);
                return (
                <div key={sub.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground flex items-center">
                      {sub.plan_name}
                      {statusBadge(sub.status)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                      {cycle.isActive && cycle.nextRenewal && (
                        <span className="ml-2">· Prochain renouvellement: {format(new Date(cycle.nextRenewal), "d MMM yyyy", { locale: fr })}</span>
                      )}
                      {!cycle.isActive && (
                        <span className="ml-2 text-amber-400">· Cycle débutera à l'activation</span>
                      )}
                    </p>
                  </div>
                  <Link to="/portal/services">
                    <span className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                      Gérer <ChevronRight className="w-4 h-4" />
                    </span>
                  </Link>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* If no services at all */}
        {(!subscriptions || subscriptions.length === 0) && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="border-l-4 border-border px-6 py-4">
              <h2 className="text-xl font-bold text-foreground">Aucun service actif</h2>
            </div>
            <div className="px-6 py-8 text-center">
              <p className="text-muted-foreground mb-4">Vous n'avez aucun service actif pour le moment.</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link to="/portal/new-order">
                  <Button className="bg-primary hover:bg-primary/90 text-white">
                    Découvrir nos forfaits <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                <Link to="/telephones">
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                    Commander un téléphone <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Submit a complaint */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="border-l-4 border-red-500 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold text-foreground">Une insatisfaction à signaler?</h2>
                <p className="text-sm text-muted-foreground">Soumettez une plainte officielle. SLA de traitement garanti.</p>
              </div>
            </div>
            <Link to="/plainte" className="shrink-0">
              <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                <AlertCircle className="w-4 h-4 mr-2" />
                Soumettre une plainte
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Orders - Rogers style */}

        {orders && orders.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="border-l-4 border-primary px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Commandes récentes</h2>
              <Link to="/portal/orders" className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                Voir tout <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {orders.map((order: any) => (
                <div key={order.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{order.service_type}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.order_number || `#${order.id.slice(0, 8)}`} · {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  <Badge className={
                    order.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                    order.status === "shipped" ? "bg-primary/20 text-primary" :
                    order.status === "cancelled" || order.status === "cancel" ? "bg-red-500/20 text-red-400" :
                    "bg-amber-500/20 text-amber-400"
                  }>
                    {order.status === "completed" ? "Terminé" :
                     order.status === "shipped" ? "Expédié" :
                     order.status === "cancelled" || order.status === "cancel" ? "Annulé" :
                     "En cours"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;
