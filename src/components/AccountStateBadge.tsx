/**
 * AccountStateBadge — Renders the canonical account state as a coloured pill.
 *
 *   <AccountStateBadge accountId={client.account_id} />
 *
 * For static usage (you already have the state object), pass it directly:
 *
 *   <AccountStateBadge state={resultFromRPC} />
 *
 * Use this everywhere the user/staff needs to know "is this account OK?" so
 * the visual is consistent across Core, Field, Employee, Tech, Client portals.
 */
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccountState } from "@/hooks/useAccountState";
import {
  STATE_BADGE_CLASSES,
  type AccountStateResult,
  type AccountState,
} from "@/lib/accountState";
import { useLanguage } from "@/contexts/LanguageContext";

interface PropsWithId {
  accountId: string;
  state?: never;
  size?: "sm" | "md";
  showTooltip?: boolean;
  className?: string;
}

interface PropsWithState {
  accountId?: never;
  state: AccountStateResult;
  size?: "sm" | "md";
  showTooltip?: boolean;
  className?: string;
}

type Props = PropsWithId | PropsWithState;

export function AccountStateBadge(props: Props) {
  const { size = "md", showTooltip = true, className } = props;
  const { language } = useLanguage();
  const isFr = language === "fr";

  // Either render from a passed-in state object, or fetch via hook.
  const hooked = useAccountState(props.accountId);
  const state: AccountStateResult | null = "state" in props && props.state ? props.state : hooked.state;
  const isLoading = "state" in props ? false : hooked.isLoading;

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {isFr ? "Chargement…" : "Loading…"}
      </span>
    );
  }

  if (!state) {
    return null;
  }

  const classes = STATE_BADGE_CLASSES[state.color];
  const label = isFr ? state.label_fr : state.label_en;
  const paddingClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        paddingClass,
        classes.wrap,
        className,
      )}
      title={showTooltip ? `${label} — ${state.reason}` : undefined}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", classes.dot)}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/**
 * Helper for code-paths that have just the state literal (e.g. derived from a
 * subscription status). Mostly useful in tests and edge cases — production
 * code should go through `useAccountState()` to stay synchronized.
 */
export function stateLabel(state: AccountState, locale: "fr" | "en" = "fr"): string {
  const isFr = locale === "fr";
  const map: Record<AccountState, [string, string]> = {
    new: ["Nouveau compte", "New account"],
    pending_kyc: ["Vérification d'identité requise", "Identity verification required"],
    pending_payment: ["Paiement en attente", "Payment pending"],
    pending_activation: ["En attente d'activation", "Pending activation"],
    active: ["Service actif", "Service active"],
    suspended_non_payment: ["Service suspendu", "Service suspended"],
    cancelled: ["Abonnement annulé", "Subscription cancelled"],
    closed: ["Compte fermé", "Account closed"],
    not_found: ["Compte introuvable", "Account not found"],
  };
  const tuple = map[state];
  return isFr ? tuple[0] : tuple[1];
}
