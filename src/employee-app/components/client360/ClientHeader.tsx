/**
 * ClientHeader — Client identity header with status indicators.
 *
 * Status is rendered via AccountStateBadge — the canonical cross-portal state
 * from get_account_state(). The legacy `account.status` is only a fallback
 * for the rare case where account.id is missing (billing-only customers).
 */
import { Link } from "react-router-dom";
import { User, Mail, Phone, Hash, MapPin, Wifi } from "lucide-react";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { StatusBadge } from "@/employee-app/components/StatusBadge";
import { AccountStateBadge } from "@/components/AccountStateBadge";

interface Props {
  profile: any;
  account: any | null;
  subscriptions: any[];
  address?: string;
}

export function ClientHeader({ profile, account, subscriptions, address }: Props) {
  const activeCount = subscriptions.filter((s: any) => s.status === "active").length;

  return (
    <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,8%)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-500/20 shrink-0">
            <User className="h-7 w-7 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-white truncate">
              {profile.full_name ?? "Client"}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                  <Phone className="h-3 w-3" /> {profile.phone}
                </a>
              )}
              {profile.email && (
                <a href={`mailto:${profile.email}`} className="flex items-center gap-1 text-xs text-[hsl(220,10%,50%)] hover:text-blue-400">
                  <Mail className="h-3 w-3" /> {profile.email}
                </a>
              )}
              {account?.account_number && (
                <Link
                  to={employeePath(`/accounts/${account.id}`)}
                  className="flex items-center gap-1 text-xs font-mono text-blue-400 hover:underline"
                >
                  <Hash className="h-3 w-3" /> {account.account_number}
                </Link>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {address && (
                <span className="flex items-center gap-1 text-[10px] text-[hsl(220,10%,40%)]">
                  <MapPin className="h-3 w-3" /> {address}
                </span>
              )}
              {activeCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <Wifi className="h-3 w-3" /> {activeCount} service{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {account?.id ? (
            <AccountStateBadge accountId={account.id} />
          ) : account?.status ? (
            <StatusBadge status={account.status} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
