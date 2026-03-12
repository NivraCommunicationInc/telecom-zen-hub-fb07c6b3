/**
 * CoreOrderHeader — Professional order file header
 * Shows order identity, client info, status badges, SLA timer, and deep links
 */
import { Link } from "react-router-dom";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { corePath } from "@/core-app/lib/corePaths";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ShoppingCart, User, Mail, Phone, MapPin, Hash,
  RefreshCw, ExternalLink, Calendar, Clock, Truck,
  AlertTriangle, Timer, Copy
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  order: any;
  profile: any;
  account: any;
  appointment: any;
  onRefresh: () => void;
}

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
};

function getSlaInfo(createdAt: string, status: string) {
  if (["completed", "cancelled", "activated"].includes(status)) return null;
  const hours = differenceInHours(new Date(), new Date(createdAt));
  const days = differenceInDays(new Date(), new Date(createdAt));
  
  if (days >= 7) return { label: `${days}j`, color: "text-red-400 bg-red-500/10 border-red-500/20", critical: true };
  if (days >= 3) return { label: `${days}j ${hours % 24}h`, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", critical: false };
  if (hours >= 24) return { label: `${days}j ${hours % 24}h`, color: "text-sky-400 bg-sky-500/10 border-sky-500/20", critical: false };
  return { label: `${hours}h`, color: "text-[hsl(220,10%,50%)] bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]", critical: false };
}

export function CoreOrderHeader({ order, profile, account, appointment, onRefresh }: Props) {
  const clientName = profile?.full_name
    || [order.client_first_name, order.client_last_name].filter(Boolean).join(" ")
    || "—";
  const clientEmail = order.client_email || profile?.email;
  const clientPhone = order.client_phone || profile?.phone;
  const sla = getSlaInfo(order.created_at, order.status);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  };

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,15%,14%)]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center">
            <ShoppingCart className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[15px] font-bold text-white tracking-tight font-mono">
                {order.order_number || `#${order.id.slice(0, 8)}`}
              </h1>
              <button
                onClick={() => copyToClipboard(order.order_number || order.id)}
                className="text-[hsl(220,10%,35%)] hover:text-white transition-colors"
                title="Copier"
              >
                <Copy className="h-3 w-3" />
              </button>
              <StatusBadge label={order.status} variant={statusToVariant(order.status)} size="sm" />
              {order.payment_status && (
                <StatusBadge label={order.payment_status} variant={statusToVariant(order.payment_status)} size="sm" />
              )}
              {order.risk_flags && order.risk_flags.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                  <AlertTriangle className="h-2.5 w-2.5" /> RISQUE
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[11px] text-[hsl(220,10%,45%)]">
                {order.service_type || "—"} · {order.order_type || "Nouvelle commande"}
              </span>
              <span className="text-[10px] text-[hsl(220,10%,35%)] flex items-center gap-1">
                <Clock className="h-3 w-3" /> {fmtDateTime(order.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* SLA timer */}
          {sla && (
            <div className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-mono font-semibold tabular-nums ${sla.color}`}>
              <Timer className={`h-3 w-3 ${sla.critical ? "animate-pulse" : ""}`} />
              {sla.label}
            </div>
          )}
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,13%)] px-2.5 py-1.5 text-[11px] text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Info bar — Client + Account + Fulfillment + Quick Links */}
      <div className="grid grid-cols-4 divide-x divide-[hsl(220,15%,14%)]">
        {/* Client */}
        <div className="px-4 py-2.5">
          <p className="text-[9px] uppercase tracking-widest text-[hsl(220,10%,35%)] font-semibold mb-1.5">Client</p>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white font-medium flex items-center gap-1.5">
              <User className="h-3 w-3 text-[hsl(220,10%,40%)]" /> {clientName}
            </p>
            {profile && (
              <Link to={corePath(`/clients/${profile.user_id}`)} className="text-[hsl(220,10%,35%)] hover:text-blue-400 transition-colors">
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            )}
          </div>
          {clientEmail && (
            <p className="text-[11px] text-[hsl(220,10%,45%)] flex items-center gap-1.5 mt-0.5">
              <Mail className="h-2.5 w-2.5" /> {clientEmail}
            </p>
          )}
          {clientPhone && (
            <p className="text-[11px] text-[hsl(220,10%,45%)] flex items-center gap-1.5 mt-0.5">
              <Phone className="h-2.5 w-2.5" /> {clientPhone}
            </p>
          )}
        </div>

        {/* Account */}
        <div className="px-4 py-2.5">
          <p className="text-[9px] uppercase tracking-widest text-[hsl(220,10%,35%)] font-semibold mb-1.5">Compte lié</p>
          {account ? (
            <Link
              to={corePath(`/accounts/${account.id}`)}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Hash className="h-3 w-3" /> {account.account_number}
              <ExternalLink className="h-2.5 w-2.5 ml-auto opacity-50" />
            </Link>
          ) : (
            <p className="text-xs text-[hsl(220,10%,35%)]">Non associé</p>
          )}
          {order.client_full_address && (
            <p className="text-[11px] text-[hsl(220,10%,45%)] flex items-center gap-1.5 mt-1">
              <MapPin className="h-2.5 w-2.5" /> {order.client_full_address}
            </p>
          )}
        </div>

        {/* Fulfillment */}
        <div className="px-4 py-2.5">
          <p className="text-[9px] uppercase tracking-widest text-[hsl(220,10%,35%)] font-semibold mb-1.5">Livraison</p>
          <p className="text-xs text-white flex items-center gap-1.5">
            <Truck className="h-3 w-3 text-[hsl(220,10%,40%)]" />
            {order.fulfillment_type || "Non assigné"}
          </p>
          {order.installation_type && (
            <p className="text-[11px] text-[hsl(220,10%,45%)] mt-0.5">
              Installation: {order.installation_type}
            </p>
          )}
          {appointment && (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {fmtDateTime(appointment.scheduled_at)}
            </p>
          )}
        </div>

        {/* Quick Nav Links */}
        <div className="px-4 py-2.5">
          <p className="text-[9px] uppercase tracking-widest text-[hsl(220,10%,35%)] font-semibold mb-1.5">Liens rapides</p>
          <div className="flex flex-wrap gap-1.5">
            {account && (
              <Link to={corePath(`/accounts/${account.id}`)} className="text-[10px] text-blue-400/70 hover:text-blue-400 border border-blue-500/15 rounded px-1.5 py-0.5 transition-colors">
                Compte 360
              </Link>
            )}
            {profile && (
              <Link to={corePath(`/clients/${profile.user_id}`)} className="text-[10px] text-blue-400/70 hover:text-blue-400 border border-blue-500/15 rounded px-1.5 py-0.5 transition-colors">
                Dossier CRM
              </Link>
            )}
            <Link to={corePath("/appointments")} className="text-[10px] text-blue-400/70 hover:text-blue-400 border border-blue-500/15 rounded px-1.5 py-0.5 transition-colors">
              Rendez-vous
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
